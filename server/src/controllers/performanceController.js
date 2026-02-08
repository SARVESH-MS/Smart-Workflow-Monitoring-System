import Task from "../models/Task.js";
import Project from "../models/Project.js";

export const performanceSummary = async (req, res) => {
  const userId = req.params.userId;
  const projectQuery = req.user.role === "manager" ? { managerId: req.user.id } : {};
  const projects = await Project.find(projectQuery).select("_id");
  const projectIds = projects.map((p) => p._id);

  const query = userId ? { userId } : { projectId: { $in: projectIds } };
  const tasks = await Task.find(query);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const delayed = tasks.filter((t) => t.isDelayed).length;
  const avgTime = total ? Math.round(tasks.reduce((s, t) => s + (t.timeSpent || 0), 0) / total) : 0;

  res.json({ total, completed, delayed, completionRate: total ? Math.round((completed / total) * 100) : 0, avgTime });
};
