import { z } from "zod";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { sendEmail } from "../services/emailService.js";

const digestSchema = z.object({
  role: z.enum(["admin", "manager", "employee"]),
  frequency: z.enum(["daily", "weekly"]).optional()
});

export const sendDigest = async (req, res) => {
  const payload = digestSchema.parse(req.body);
  const users = await User.find({ role: payload.role });
  const tasks = await Task.find({});

  const summary = `Total tasks: ${tasks.length}, Completed: ${tasks.filter((t) => t.status === "done").length}`;

  await Promise.all(
    users.map((u) =>
      sendEmail({
        to: u.email,
        subject: `SWMS ${payload.frequency || "daily"} digest`,
        html: `<div><h3>Digest</h3><p>${summary}</p></div>`
      }).catch(() => null)
    )
  );

  res.json({ sent: users.length });
};
