import mongoose from "mongoose";
import Task from "../models/Task.js";
import Project from "../models/Project.js";

export const performanceSummary = async (req, res) => {
  const userId = req.params.userId;
  const projectQuery = req.user.role === "manager" ? { managerId: req.user.id } : {};
  let match = {};

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({ total: 0, completed: 0, delayed: 0, completionRate: 0, avgTime: 0 });
    }
    match = { userId: new mongoose.Types.ObjectId(userId) };
  } else if (req.user.role === "manager") {
    const projects = await Project.find(projectQuery).select("_id").lean();
    if (projects.length === 0) {
      return res.json({ total: 0, completed: 0, delayed: 0, completionRate: 0, avgTime: 0 });
    }
    match = { projectId: { $in: projects.map((p) => p._id) } };
  }

  const stats = await Task.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        delayed: { $sum: { $cond: ["$isDelayed", 1, 0] } },
        timeSpent: { $sum: { $ifNull: ["$timeSpent", 0] } }
      }
    }
  ]);

  const totals = stats[0] || { total: 0, completed: 0, delayed: 0, timeSpent: 0 };
  const avgTime = totals.total ? Math.round(totals.timeSpent / totals.total) : 0;
  res.json({
    total: totals.total,
    completed: totals.completed,
    delayed: totals.delayed,
    completionRate: totals.total ? Math.round((totals.completed / totals.total) * 100) : 0,
    avgTime
  });
};
