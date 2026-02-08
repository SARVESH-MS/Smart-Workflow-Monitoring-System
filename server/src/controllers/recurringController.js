import { z } from "zod";
import Task from "../models/Task.js";
import TaskTemplate from "../models/TaskTemplate.js";

const recurringSchema = z.object({
  templateId: z.string(),
  projectId: z.string(),
  userId: z.string(),
  intervalDays: z.number().int().min(1),
  occurrences: z.number().int().min(1).max(50).optional()
});

export const createRecurringTasks = async (req, res) => {
  const payload = recurringSchema.parse(req.body);
  const template = await TaskTemplate.findById(payload.templateId);
  if (!template) return res.status(404).json({ message: "Template not found" });

  const count = payload.occurrences || 5;
  const tasks = [];
  for (let i = 0; i < count; i += 1) {
    const start = new Date();
    start.setDate(start.getDate() + payload.intervalDays * i);
    const deadline = new Date(start);
    deadline.setDate(deadline.getDate() + (template.estimatedDays || 3));
    tasks.push({
      projectId: payload.projectId,
      userId: payload.userId,
      title: template.name,
      description: template.description,
      roleContribution: template.roleContribution,
      stage: template.stage,
      deadline
    });
  }

  const created = await Task.insertMany(tasks);
  res.status(201).json(created);
};
