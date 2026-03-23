import { z } from "zod";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const digestSchema = z.object({
  role: z.enum(["admin", "manager", "employee"]),
  frequency: z.enum(["daily", "weekly"]).optional()
});

export const sendDigest = async (req, res) => {
  const payload = digestSchema.parse(req.body);
  const users = await User.find({ role: payload.role });
  const tasks = await Task.find({});

  const completed = tasks.filter((t) => t.status === "done").length;
  const delayed = tasks.filter((t) => t.isDelayed).length;
  const summary = `Total tasks: ${tasks.length}, Completed: ${completed}, Delayed: ${delayed}`;

  if (users.length === 0) {
    return res.json({ sent: 0, failed: 0, recipients: 0 });
  }

  const created = await Promise.all(
    users.map((user) =>
      Notification.create({
        userId: user._id,
        type: "digest.summary",
        title: `SWMS ${payload.frequency || "daily"} digest`,
        message: summary
      }).catch(() => null)
    )
  );

  const sent = created.filter(Boolean).length;
  const failed = created.length - sent;

  res.json({
    sent,
    failed,
    recipients: users.length
  });
};
