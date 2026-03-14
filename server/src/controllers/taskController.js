import { z } from "zod";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { startTimer, stopTimer, markDelay, endOtherActiveTasks } from "../services/timeService.js";
import { notifyDelay, notifyComplete, notifyDelaySms, notifyAssigned } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";

const taskSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  title: z.string().min(3),
  description: z.string().optional(),
  roleContribution: z.string().optional(),
  deadline: z.string()
});

const taskUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  roleContribution: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  deadline: z.string().optional(),
  userId: z.string().optional(),
  stage: z.string().optional(),
  dependencies: z.array(z.string()).optional()
});

export const createTask = async (req, res) => {
  const payload = taskSchema.parse(req.body);
  const task = await Task.create({
    ...payload,
    deadline: new Date(payload.deadline)
  });
  const [user, project] = await Promise.all([
    User.findById(task.userId),
    Project.findById(task.projectId)
  ]);
  const manager = project?.managerId ? await User.findById(project.managerId) : null;
  await notifyAssigned({ user, manager, task, project });
  await logAudit({
    actorId: req.user?.id,
    action: "task.create",
    entityType: "Task",
    entityId: task._id,
    after: task.toObject()
  });
  req.app.get("io").emit("task:created", task);
  res.status(201).json(task);
};

export const listTasks = async (req, res) => {
  const query = {};
  if (req.query.projectId) query.projectId = req.query.projectId;
  if (req.query.userId) query.userId = req.query.userId;
  const compact = String(req.query.compact || "").toLowerCase();
  const limit = Math.min(Number(req.query.limit || 0), 2000);
  const skip = Math.max(Number(req.query.skip || 0), 0);
  if (req.user.role === "manager") {
    const projects = await Project.find({ managerId: req.user.id }).select("_id").lean();
    query.projectId = { $in: projects.map((p) => p._id) };
  }
  if (req.user.role === "employee") {
    query.userId = req.user.id;
  }
  let taskQuery = Task.find(query).sort({ createdAt: -1 });
  if (compact === "1" || compact === "true") {
    taskQuery = taskQuery.select(
      "_id projectId userId title roleContribution stage startTime timeSpent status deadline isDelayed createdAt updatedAt"
    );
  }
  if (skip) taskQuery = taskQuery.skip(skip);
  if (limit) taskQuery = taskQuery.limit(limit);
  const tasks = await taskQuery.lean();
  res.json(tasks);
};

export const updateTask = async (req, res) => {
  const payload = taskUpdateSchema.parse(req.body);
  const before = await Task.findById(req.params.id);
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { ...payload, ...(payload.deadline ? { deadline: new Date(payload.deadline) } : {}) },
    { new: true }
  );
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  if (payload.status === "in_progress") {
    await endOtherActiveTasks(Task, task.userId, task._id);
    if (!task.startTime) {
      task.startTime = new Date();
      await task.save();
    }
  }
  const updated = await markDelay(task);
  if (payload.userId && String(payload.userId) !== String(before?.userId)) {
    const [user, project] = await Promise.all([
      User.findById(updated.userId),
      Project.findById(updated.projectId)
    ]);
    const manager = project?.managerId ? await User.findById(project.managerId) : null;
    await notifyAssigned({ user, manager, task: updated, project });
  }
  await logAudit({
    actorId: req.user?.id,
    action: "task.update",
    entityType: "Task",
    entityId: updated._id,
    before: before?.toObject(),
    after: updated.toObject()
  });
  if (updated.isDelayed) {
    const [user, project] = await Promise.all([
      User.findById(updated.userId),
      Project.findById(updated.projectId)
    ]);
    const manager = project?.managerId ? await User.findById(project.managerId) : null;
    await notifyDelay({ user, manager, task: updated, project });
    await notifyDelaySms({ user, manager, task: updated, project });
  }
  req.app.get("io").emit("task:updated", updated);
  res.json(updated);
};

export const startTaskTimer = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  await endOtherActiveTasks(Task, task.userId, task._id);
  const updated = await startTimer(task);
  await logAudit({
    actorId: req.user?.id,
    action: "task.start",
    entityType: "Task",
    entityId: updated._id,
    after: updated.toObject()
  });
  req.app.get("io").emit("task:updated", updated);
  res.json(updated);
};

export const stopTaskTimer = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  const updated = await stopTimer(task);
  await logAudit({
    actorId: req.user?.id,
    action: "task.stop",
    entityType: "Task",
    entityId: updated._id,
    after: updated.toObject()
  });
  req.app.get("io").emit("task:updated", updated);
  res.json(updated);
};

export const completeTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  task.status = "done";
  task.endTime = new Date();
  await markDelay(task);
  await task.save();
  await logAudit({
    actorId: req.user?.id,
    action: "task.complete",
    entityType: "Task",
    entityId: task._id,
    after: task.toObject()
  });
  const [user, project] = await Promise.all([
    User.findById(task.userId),
    Project.findById(task.projectId)
  ]);
  const manager = project?.managerId ? await User.findById(project.managerId) : null;
  await notifyComplete({ user, manager, task, project });
  req.app.get("io").emit("task:updated", task);
  res.json(task);
};
