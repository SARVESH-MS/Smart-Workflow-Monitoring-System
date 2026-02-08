import { z } from "zod";
import Availability from "../models/Availability.js";

const availabilitySchema = z.object({
  weekStart: z.string(),
  capacityHours: z.number().min(0).max(80),
  timeOffHours: z.number().min(0).max(80)
});

export const getAvailability = async (req, res) => {
  const userId = req.params.userId || req.user.id;
  const items = await Availability.find({ userId }).sort({ weekStart: -1 }).limit(12);
  res.json(items);
};

export const upsertAvailability = async (req, res) => {
  const payload = availabilitySchema.parse(req.body);
  const userId = req.params.userId || req.user.id;
  const item = await Availability.findOneAndUpdate(
    { userId, weekStart: new Date(payload.weekStart) },
    { capacityHours: payload.capacityHours, timeOffHours: payload.timeOffHours },
    { upsert: true, new: true }
  );
  res.json(item);
};
