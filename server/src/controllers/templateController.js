import { z } from "zod";
import NotificationTemplate from "../models/NotificationTemplate.js";

const templateSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1)
});

export const listTemplates = async (req, res) => {
  const templates = await NotificationTemplate.find({}).sort({ key: 1 });
  res.json(templates);
};

export const upsertTemplate = async (req, res) => {
  const payload = templateSchema.parse(req.body);
  const template = await NotificationTemplate.findOneAndUpdate(
    { key: req.params.key },
    { ...payload },
    { new: true, upsert: true }
  );
  res.json(template);
};
