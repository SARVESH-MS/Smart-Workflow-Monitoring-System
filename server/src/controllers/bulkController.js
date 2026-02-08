import { z } from "zod";
import Task from "../models/Task.js";

const bulkSchema = z.object({
  taskIds: z.array(z.string()).min(1),
  update: z.object({
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    stage: z.string().optional(),
    userId: z.string().optional()
  })
});

export const bulkUpdateTasks = async (req, res) => {
  const payload = bulkSchema.parse(req.body);
  const result = await Task.updateMany(
    { _id: { $in: payload.taskIds } },
    { $set: payload.update }
  );
  res.json({ modified: result.modifiedCount || 0 });
};
