import User from "../models/User.js";
import { z } from "zod";

export const listUsers = async (req, res) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.managerId) query.managerId = req.query.managerId;
  const users = await User.find(query).select("-password");
  res.json(users);
};

export const teamByManager = async (req, res) => {
  const users = await User.find({ managerId: req.params.managerId }).select("-password");
  res.json(users);
};

const prefsSchema = z.object({
  emailDelay: z.boolean(),
  emailComplete: z.boolean(),
  smsDelay: z.boolean()
});

export const updatePreferences = async (req, res) => {
  const prefs = prefsSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { notificationPrefs: prefs },
    { new: true }
  ).select("-password");
  res.json({ user });
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
  res.json({ user });
};
