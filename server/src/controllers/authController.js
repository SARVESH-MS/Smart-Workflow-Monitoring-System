import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import EmailLog from "../models/EmailLog.js";
import Notification from "../models/Notification.js";
import RegistrationRequest from "../models/RegistrationRequest.js";
import AuditLog from "../models/AuditLog.js";
import { logAudit } from "../services/auditService.js";
import { getRequestMeta } from "../utils/requestMeta.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["manager", "employee"]),
  companyId: z.string().min(3),
  managerId: z.string().optional(),
  teamRole: z.enum(["designer", "frontend", "backend", "tester", "manager"]).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "manager", "employee"]).optional()
});

const googleAuthSchema = z.object({
  credential: z.string().min(10),
  mode: z.enum(["login", "register"]),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  companyId: z.string().optional(),
  teamRole: z.enum(["designer", "frontend", "backend", "tester", "manager"]).optional()
});

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const findUserByEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return Promise.resolve(null);
  return User.findOne({ email: new RegExp(`^${escapeRegExp(normalized)}$`, "i") });
};
const findRequestByEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return Promise.resolve(null);
  return RegistrationRequest.findOne({ email: new RegExp(`^${escapeRegExp(normalized)}$`, "i") }).lean();
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const shouldLogLogin = async (actorId, meta = {}) => {
  if (!actorId) return false;
  const windowMs = 8000;
  const query = {
    actorId,
    action: "auth.login",
    createdAt: { $gte: new Date(Date.now() - windowMs) }
  };
  if (meta.sessionId) {
    query["meta.sessionId"] = meta.sessionId;
  } else {
    if (meta.ip) query["meta.ip"] = meta.ip;
    if (meta.ua) query["meta.ua"] = meta.ua;
  }
  const recent = await AuditLog.findOne(query).select("_id").lean();
  return !recent;
};

const warmGoogleCerts = () => {
  if (!process.env.GOOGLE_CLIENT_ID) return;
  googleClient.getFederatedSignonCerts().catch(() => null);
};

warmGoogleCerts();
setInterval(warmGoogleCerts, 6 * 60 * 60 * 1000).unref();

export const register = async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const expectedCompanyId = process.env.COMPANY_ID || "SWMS-2026";
  if (payload.companyId !== expectedCompanyId) {
    return res.status(400).json({ message: "Invalid company ID" });
  }

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    return res.status(400).json({ message: "Email already exists" });
  }
  const existingRequest = await RegistrationRequest.findOne({
    email: payload.email,
    status: "pending"
  });
  if (existingRequest) {
    return res.status(400).json({ message: "Request already pending admin approval" });
  }

  const hashed = await bcrypt.hash(payload.password, 10);
  const request = await RegistrationRequest.create({
    name: payload.name,
    email: payload.email,
    password: hashed,
    role: payload.role,
    teamRole: payload.role === "manager" ? "manager" : payload.teamRole || "frontend"
  });
  req.app.get("io")?.emit("registration-request:created", sanitizeRegistrationRequest(request));

  const admins = await User.find({ role: "admin" }).select("_id email name");
  const subject = `New account approval request: ${payload.name}`;
  const body = `<p>${payload.name} (${payload.email}) requested ${payload.role} access.</p>`;
  await Promise.all(
    admins.map((admin) =>
      Promise.all([
        EmailLog.create({
          to: admin.email,
          subject,
          body,
          templateKey: "auth.register.request",
          sentByRole: "system",
          deliveryStatus: "sent",
          meta: { requestedEmail: payload.email, requestedRole: payload.role }
        }),
        Notification.create({
          userId: admin._id,
          type: "auth.register.request",
          title: "New user approval request",
          message: `${payload.name} (${payload.email}) requested ${payload.role} access`
        })
      ]).catch(() => null)
    )
  );

  return res.status(201).json({
    message: "Your progress has been sent to the Admin. Wait for authorization."
  });
};

export const googleAuth = async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: "Google auth is not configured" });
  }

  const timingEnabled = process.env.DEBUG_AUTH_TIMING === "1";
  const timingStart = timingEnabled ? Date.now() : 0;

  const payload = googleAuthSchema.parse(req.body);
  const ticket = await googleClient.verifyIdToken({
    idToken: payload.credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const afterVerify = timingEnabled ? Date.now() : 0;
  const googleUser = ticket.getPayload();

  if (!googleUser?.email || !googleUser?.email_verified) {
    return res.status(400).json({ message: "Google account email is not verified" });
  }

  const email = normalizeEmail(googleUser.email);
  const name = googleUser.name || email.split("@")[0];

  if (payload.mode === "login") {
    const user = await findUserByEmail(email)
      .select("_id swmsId name email role phone avatarUrl managerId teamRole notificationPrefs")
      .lean();
    const afterLookup = timingEnabled ? Date.now() : 0;
    if (!user) {
      const pending = await findRequestByEmail(email);
      if (pending?.status === "pending") {
        return res.status(403).json({ message: "Your account is pending admin approval." });
      }
      if (pending?.status === "rejected") {
        return res.status(403).json({ message: "Your account request was rejected." });
      }
      return res.status(401).json({ message: "No account found. Please sign up first." });
    }
    if (payload.role && user.role !== payload.role) {
      return res.status(403).json({ message: "Account does not match this portal" });
    }
    const meta = { ...getRequestMeta(req), provider: "google" };
    if (await shouldLogLogin(user._id, meta)) {
      await logAudit({
        actorId: user._id,
        action: "auth.login",
        entityType: "User",
        entityId: user._id,
        meta
      });
    }
    const token = signToken(user);
    if (timingEnabled) {
      const total = afterLookup - timingStart;
      const verifyMs = afterVerify - timingStart;
      const lookupMs = afterLookup - afterVerify;
      console.warn(`[auth/google] verifyIdToken=${verifyMs}ms userLookup=${lookupMs}ms total=${total}ms`);
    }
    return res.json({ token, user: sanitizeUser(user) });
  }

  const expectedCompanyId = process.env.COMPANY_ID || "SWMS-2026";
  if ((payload.companyId || "") !== expectedCompanyId) {
    return res.status(400).json({ message: "Invalid company ID" });
  }
  if (!payload.role) {
    return res.status(400).json({ message: "Role is required" });
  }
  if (payload.role === "admin") {
    return res.status(400).json({ message: "Admin registration is restricted" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: "Email already exists" });
  }
  const existingRequest = await RegistrationRequest.findOne({ email, status: "pending" });
  if (existingRequest) {
    return res.status(400).json({ message: "Request already pending admin approval" });
  }

  const randomPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const request = await RegistrationRequest.create({
    name,
    email,
    password: randomPasswordHash,
    role: payload.role,
    teamRole: payload.role === "manager" ? "manager" : payload.teamRole || "frontend"
  });
  req.app.get("io")?.emit("registration-request:created", sanitizeRegistrationRequest(request));

  const admins = await User.find({ role: "admin" }).select("_id email");
  const subject = `New Google account approval request: ${name}`;
  const body = `<p>${name} (${email}) requested ${payload.role} access via Google sign-in.</p>`;
  await Promise.all(
    admins.map((admin) =>
      Promise.all([
        EmailLog.create({
          to: admin.email,
          subject,
          body,
          templateKey: "auth.register.google.request",
          sentByRole: "system",
          deliveryStatus: "sent",
          meta: { requestedEmail: email, requestedRole: payload.role, provider: "google" }
        }),
        Notification.create({
          userId: admin._id,
          type: "auth.register.request",
          title: "New user approval request",
          message: `${name} (${email}) requested ${payload.role} access via Google`
        })
      ]).catch(() => null)
    )
  );

  return res.status(201).json({
    message: "Your progress has been sent to the Admin. Wait for authorization."
  });
};

export const login = async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const user = await findUserByEmail(payload.email);
  if (!user) {
    const pending = await findRequestByEmail(payload.email);
    if (pending?.status === "pending") {
      return res.status(403).json({ message: "Your account is pending admin approval." });
    }
    if (pending?.status === "rejected") {
      return res.status(403).json({ message: "Your account request was rejected." });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const match = await bcrypt.compare(payload.password, user.password);
  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (payload.role && user.role !== payload.role) {
    return res.status(403).json({ message: "Account does not match this portal" });
  }
  const meta = getRequestMeta(req);
  if (await shouldLogLogin(user._id, meta)) {
    await logAudit({
      actorId: user._id,
      action: "auth.login",
      entityType: "User",
      entityId: user._id,
      meta
    });
  }
  const token = signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  return res.json({ user: sanitizeUser(user) });
};

export const logout = async (req, res) => {
  req.app.get("io")?.markSessionExplicitLogout?.(req.user.id, getRequestMeta(req).sessionId);
  await logAudit({
    actorId: req.user.id,
    action: "auth.logout",
    entityType: "User",
    entityId: req.user.id,
    meta: getRequestMeta(req)
  });
  return res.json({ message: "Logged out" });
};

const sanitizeRegistrationRequest = (request) => ({
  _id: request._id,
  name: request.name,
  email: request.email,
  role: request.role,
  teamRole: request.teamRole,
  status: request.status,
  rejectionReason: request.rejectionReason,
  processedBy: request.processedBy,
  processedAt: request.processedAt,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
});

const sanitizeUser = (user) => ({
  id: user._id,
  swmsId: user.swmsId,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  managerId: user.managerId,
  teamRole: user.teamRole,
  notificationPrefs: user.notificationPrefs
});
