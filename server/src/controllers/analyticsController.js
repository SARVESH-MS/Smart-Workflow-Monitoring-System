import Task from "../models/Task.js";
import Project from "../models/Project.js";

export const analyticsSummary = async (req, res) => {
  const projectQuery = req.user.role === "manager" ? { managerId: req.user.id } : {};
  let projectCount = 0;
  let match = {};

  if (req.user.role === "manager") {
    const projects = await Project.find(projectQuery).select("_id").lean();
    projectCount = projects.length;
    if (projectCount === 0) {
      return res.json({
        projects: 0,
        totalTasks: 0,
        completed: 0,
        delayed: 0,
        completionRate: 0,
        timeSpent: 0
      });
    }
    match = { projectId: { $in: projects.map((p) => p._id) } };
  } else {
    projectCount = await Project.countDocuments(projectQuery);
  }

  const stats = await Task.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] }
        },
        delayed: { $sum: { $cond: ["$isDelayed", 1, 0] } },
        timeSpent: { $sum: { $ifNull: ["$timeSpent", 0] } }
      }
    }
  ]);

  const totals = stats[0] || { totalTasks: 0, completed: 0, delayed: 0, timeSpent: 0 };
  res.json({
    projects: projectCount,
    totalTasks: totals.totalTasks,
    completed: totals.completed,
    delayed: totals.delayed,
    completionRate: totals.totalTasks ? Math.round((totals.completed / totals.totalTasks) * 100) : 0,
    timeSpent: totals.timeSpent
  });
};
