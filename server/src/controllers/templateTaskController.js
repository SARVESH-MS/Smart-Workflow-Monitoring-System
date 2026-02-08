import { z } from "zod";
import TaskTemplate from "../models/TaskTemplate.js";

const templateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  roleContribution: z.string().optional(),
  stage: z.string().optional(),
  estimatedDays: z.number().int().min(1).optional()
});

export const listTemplates = async (req, res) => {
  const query = req.user.role === "manager" ? { managerId: req.user.id } : {};
  const templates = await TaskTemplate.find(query).sort({ createdAt: -1 });
  res.json(templates);
};

export const createTemplate = async (req, res) => {
  const payload = templateSchema.parse(req.body);
  const template = await TaskTemplate.create({
    ...payload,
    managerId: req.user.role === "manager" ? req.user.id : undefined
  });
  res.status(201).json(template);
};
