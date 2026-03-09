import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import EmailLog from "../models/EmailLog.js";
import Notification from "../models/Notification.js";
import RegistrationRequest from "../models/RegistrationRequest.js";
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
  password: z.string().min(8)
});

const googleAuthSchema = z.object({
  credential: z.string().min(10),
  mode: z.enum(["login", "register"]),
  role: z.enum(["manager", "employee"]).optional(),
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

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
  await RegistrationRequest.create({
    name: payload.name,
    email: payload.email,
    password: hashed,
    role: payload.role,
    teamRole: payload.role === "manager" ? "manager" : payload.teamRole || "frontend"
  });

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

  const payload = googleAuthSchema.parse(req.body);
  const ticket = await googleClient.verifyIdToken({
    idToken: payload.credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const googleUser = ticket.getPayload();

  if (!googleUser?.email || !googleUser?.email_verified) {
    return res.status(400).json({ message: "Google account email is not verified" });
  }

  const email = googleUser.email.toLowerCase();
  const name = googleUser.name || email.split("@")[0];

  if (payload.mode === "login") {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "No account found. Please sign up first." });
    }
    await logAudit({
      actorId: user._id,
      action: "auth.login",
      entityType: "User",
      entityId: user._id,
      meta: { ...getRequestMeta(req), provider: "google" }
    });
    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  }

  const expectedCompanyId = process.env.COMPANY_ID || "SWMS-2026";
  if ((payload.companyId || "") !== expectedCompanyId) {
    return res.status(400).json({ message: "Invalid company ID" });
  }
  if (!payload.role) {
    return res.status(400).json({ message: "Role is required" });
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
  await RegistrationRequest.create({
    name,
    email,
    password: randomPasswordHash,
    role: payload.role,
    teamRole: payload.role === "manager" ? "manager" : payload.teamRole || "frontend"
  });

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
  const user = await User.findOne({ email: payload.email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const match = await bcrypt.compare(payload.password, user.password);
  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  await logAudit({
    actorId: user._id,
    action: "auth.login",
    entityType: "User",
    entityId: user._id,
    meta: getRequestMeta(req)
  });
  const token = signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  return res.json({ user: sanitizeUser(user) });
};

export const logout = async (req, res) => {
  await logAudit({
    actorId: req.user.id,
    action: "auth.logout",
    entityType: "User",
    entityId: req.user.id,
    meta: getRequestMeta(req)
  });
  return res.json({ message: "Logged out" });
};

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
