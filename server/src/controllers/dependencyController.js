import Task from "../models/Task.js";
import Project from "../models/Project.js";

export const projectDependencies = async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const tasks = await Task.find({ projectId: project._id }).select("_id title deadline dependencies");
  res.json(tasks);
};

export const criticalPath = async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const tasks = await Task.find({ projectId: project._id }).select("_id title deadline dependencies");
  const taskMap = new Map(tasks.map((t) => [String(t._id), t]));

  const duration = (task) => {
    const start = task.createdAt ? new Date(task.createdAt) : new Date();
    const end = task.deadline ? new Date(task.deadline) : new Date(start.getTime() + 86400000);
    return Math.max(Math.ceil((end - start) / 86400000), 1);
  };

  const memo = new Map();
  const dfs = (id) => {
    if (memo.has(id)) return memo.get(id);
    const task = taskMap.get(id);
    if (!task) return { length: 0, path: [] };
    let best = { length: 0, path: [] };
    (task.dependencies || []).forEach((depId) => {
      const res = dfs(String(depId));
      if (res.length > best.length) best = res;
    });
    const total = best.length + duration(task);
    const result = { length: total, path: [...best.path, id] };
    memo.set(id, result);
    return result;
  };

  let overall = { length: 0, path: [] };
  tasks.forEach((t) => {
    const res = dfs(String(t._id));
    if (res.length > overall.length) overall = res;
  });

  res.json({ lengthDays: overall.length, path: overall.path });
};
