import Task from "../models/Task.js";
import Project from "../models/Project.js";

export const analyticsSummary = async (req, res) => {
  const projectQuery = req.user.role === "manager" ? { managerId: req.user.id } : {};
  const projects = await Project.find(projectQuery);
  const projectIds = projects.map((p) => p._id);
  const tasks = await Task.find({ projectId: { $in: projectIds } });

  const totalTasks = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const delayed = tasks.filter((t) => t.isDelayed).length;
  const timeSpent = tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0);

  res.json({
    projects: projects.length,
    totalTasks,
    completed,
    delayed,
    completionRate: totalTasks ? Math.round((completed / totalTasks) * 100) : 0,
    timeSpent
  });
};
