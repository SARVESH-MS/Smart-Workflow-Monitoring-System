import { z } from "zod";
import Task from "../models/Task.js";
import { markDelay, endOtherActiveTasks } from "../services/timeService.js";

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
  const tasks = await Task.find({ _id: { $in: payload.taskIds } });
  const now = new Date();
  let modified = 0;

  for (const task of tasks) {
    let changed = false;

    if (typeof payload.update.stage === "string" && payload.update.stage !== task.stage) {
      task.stage = payload.update.stage;
      changed = true;
    }

    if (typeof payload.update.userId === "string" && String(payload.update.userId) !== String(task.userId)) {
      task.userId = payload.update.userId;
      changed = true;
    }

    if (payload.update.status) {
      if (payload.update.status === "in_progress") {
        await endOtherActiveTasks(Task, task.userId, task._id);
        task.status = "in_progress";
        task.endTime = undefined;
        if (!task.startTime) {
          task.startTime = now;
        }
        changed = true;
      } else if (payload.update.status === "done") {
        task.status = "done";
        task.endTime = now;
        changed = true;
      } else if (payload.update.status === "todo") {
        task.status = "todo";
        task.endTime = undefined;
        changed = true;
      }
    }

    if (!changed) continue;

    await markDelay(task);
    await task.save();
    req.app.get("io").emit("task:updated", task);
    modified += 1;
  }

  res.json({ modified });
};
