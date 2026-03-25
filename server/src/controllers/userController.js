import User from "../models/User.js";
import { z } from "zod";
import RegistrationRequest from "../models/RegistrationRequest.js";
import EmailLog from "../models/EmailLog.js";
import AuditLog from "../models/AuditLog.js";
import { getDeviceName } from "../utils/requestMeta.js";

const SWMS_PREFIX = "7376231SWMS";
const sessionCache = { at: 0, data: null };

const serializeUser = (user) => ({
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

const nextSwmsId = async (role) => {
  if (role === "employee") {
    const employees = await User.find({ role: "employee", swmsId: { $regex: `^${SWMS_PREFIX}\\d{3}$` } })
      .select("swmsId")
      .lean();
    const maxSuffix = employees.reduce((max, item) => {
      const suffix = Number(String(item.swmsId || "").slice(-3));
      return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
    }, 299);
    return `${SWMS_PREFIX}${String(maxSuffix + 1).padStart(3, "0")}`;
  }

  const managers = await User.find({ role: "manager", swmsId: { $regex: "^7376231SWMS?\\d{3}$" } })
    .select("swmsId")
    .lean();
  const maxSuffix = managers.reduce((max, item) => {
    const match = String(item.swmsId || "").match(/(\d{3})$/);
    const suffix = match ? Number(match[1]) : NaN;
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
  }, 100);
  return `${SWMS_PREFIX}${String(maxSuffix + 1).padStart(3, "0")}`;
};

export const listUsers = async (req, res) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.managerId) query.managerId = req.query.managerId;
  const users = await User.find(query)
    .select("_id swmsId name email role phone avatarUrl managerId teamRole notificationPrefs")
    .lean();
  res.json(users);
};

export const teamByManager = async (req, res) => {
  const users = await User.find({ managerId: req.params.managerId })
    .select("_id name email role teamRole managerId avatarUrl")
    .lean();
  res.json(users);
};

const prefsSchema = z.object({
  emailDelay: z.boolean(),
  emailComplete: z.boolean(),
  smsDelay: z.boolean(),
  smsDailyProgress: z.boolean(),
  desktopDailyProgress: z.boolean()
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(25).optional().or(z.literal("")),
  avatarUrl: z
    .string()
    .max(8_000_000)
    .optional()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http"), {
      message: "Avatar must be a valid image data URL or remote URL"
    })
});

export const updatePreferences = async (req, res) => {
  const prefs = prefsSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { notificationPrefs: prefs },
    { new: true }
  ).select("-password");
  res.json({ user: serializeUser(user) });
};

export const updatePreferencesForUser = async (req, res) => {
  const prefs = prefsSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { notificationPrefs: prefs },
    { new: true }
  ).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json({ user: serializeUser(user) });
};

export const updateProfile = async (req, res) => {
  const payload = profileSchema.parse(req.body);
  const update = {
    name: payload.name,
    phone: payload.phone || "",
    avatarUrl: payload.avatarUrl || ""
  };
  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json({ user: serializeUser(user) });
};

export const listRegistrationRequests = async (req, res) => {
  const status = req.query.status || "pending";
  const query = status ? { status } : {};
  const requests = await RegistrationRequest.find(query).sort({ createdAt: -1 }).lean();
  res.json(requests);
};

const processRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
  managerId: z.string().optional()
});

export const processRegistrationRequest = async (req, res) => {
  const payload = processRequestSchema.parse(req.body);
  const request = await RegistrationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });
  if (request.status !== "pending") {
    return res.status(400).json({ message: "Request already processed" });
  }

  if (payload.action === "approve") {
    const existing = await User.findOne({ email: request.email });
    if (existing) {
      return res.status(400).json({ message: "User already exists with this email" });
    }
    if (request.role === "employee" && !payload.managerId) {
      return res.status(400).json({ message: "Manager is required for employee approval" });
    }
    const swmsId = await nextSwmsId(request.role);
    await User.create({
      swmsId,
      name: request.name,
      email: request.email,
      password: request.password,
      role: request.role,
      teamRole: request.teamRole || "frontend",
      managerId: request.role === "employee" ? payload.managerId : undefined
    });
    request.status = "approved";
  } else {
    request.status = "rejected";
    request.rejectionReason = payload.reason || "Rejected by admin";
  }

  request.processedBy = req.user.id;
  request.processedAt = new Date();
  await request.save();

  await EmailLog.create({
    to: request.email,
    subject:
      payload.action === "approve"
        ? "Your SWMS account is approved"
        : "Your SWMS account request was rejected",
    body:
      payload.action === "approve"
        ? `<p>Your account request has been approved. You can now login.</p>`
        : `<p>Your account request was rejected. Reason: ${request.rejectionReason}</p>`,
    templateKey:
      payload.action === "approve" ? "auth.register.approved" : "auth.register.rejected",
    sentByRole: "admin",
    sentById: req.user.id,
    deliveryStatus: "sent",
    meta: { requestId: request._id, status: request.status }
  }).catch(() => null);

  res.json({ request });
};

export const listLoginActivity = async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const logs = await AuditLog.find({
    action: { $in: ["auth.login", "auth.logout"] }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actorId", "name email role")
    .lean();

  const items = logs
    .filter((log) => ["manager", "employee"].includes(log.actorId?.role))
    .map((log) => ({
      id: log._id,
      userId: log.actorId?._id,
      name: log.actorId?.name || "Unknown",
      email: log.actorId?.email || "-",
      role: log.actorId?.role || "-",
      action: log.action === "auth.login" ? "login" : "logout",
      ip: log.meta?.ip || "-",
      deviceName:
        log.meta?.deviceName ||
        getDeviceName({ headers: { "user-agent": log.meta?.ua || "" } }),
      userAgent: log.meta?.ua || "-",
      at: log.createdAt
    }));

  res.json(items);
};

export const listSessionMonitor = async (req, res) => {
  const now = Date.now();
  if (sessionCache.data && now - sessionCache.at < 10_000) {
    return res.json(sessionCache.data);
  }
  const io = req.app.get("io");
  const onlineUsers = io?.onlineUsers || new Map();
  const users = await User.find({ role: { $in: ["manager", "employee"] } })
    .select("_id name email role")
    .lean();
  const userIds = users.map((u) => u._id);
  const logs = await AuditLog.find({ actorId: { $in: userIds } })
    .sort({ createdAt: -1 })
    .limit(5000)
    .select("actorId action createdAt")
    .lean();

  const stats = new Map();
  logs.forEach((log) => {
    const key = String(log.actorId);
    if (!stats.has(key)) {
      stats.set(key, {
        lastSeenAt: log.createdAt,
        loggedInAt: null,
        loggedOutAt: null
      });
    }
    const item = stats.get(key);
    if (log.action === "auth.login" && !item.loggedInAt) item.loggedInAt = log.createdAt;
    if (log.action === "auth.logout" && !item.loggedOutAt) item.loggedOutAt = log.createdAt;
  });

  const sessions = users.map((user) => {
    const item = stats.get(String(user._id)) || {};
    const loggedInAt = item.loggedInAt || null;
    const loggedOutAt = item.loggedOutAt || null;
    const isOnline = (onlineUsers.get(String(user._id)) || 0) > 0;
    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      loggedInAt,
      lastSeenAt: item.lastSeenAt || null,
      isOnline
    };
  });

  const sorted = sessions.sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
  sessionCache.at = now;
  sessionCache.data = sorted;
  res.json(sorted);
};
