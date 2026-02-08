import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import { logAudit } from "../services/auditService.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "manager", "employee"]),
  managerId: z.string().optional(),
  teamRole: z.enum(["designer", "frontend", "backend", "tester", "manager"]).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export const register = async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    return res.status(400).json({ message: "Email already exists" });
  }
  const hashed = await bcrypt.hash(payload.password, 10);
  const user = await User.create({
    ...payload,
    password: hashed
  });
  const token = signToken(user);
  return res.status(201).json({ token, user: sanitizeUser(user) });
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
    meta: { ip: req.ip, ua: req.headers["user-agent"] }
  });
  const token = signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  return res.json({ user });
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  managerId: user.managerId,
  teamRole: user.teamRole,
  notificationPrefs: user.notificationPrefs
});
