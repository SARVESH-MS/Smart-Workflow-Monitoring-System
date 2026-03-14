import { z } from "zod";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import { logAudit } from "../services/auditService.js";

const projectSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(5),
  deadline: z.string(),
  managerId: z.string().optional(),
  status: z.enum(["planning", "design", "development", "testing", "done"]).optional(),
  workflow: z.array(z.string()).optional()
});

export const createProject = async (req, res) => {
  const payload = projectSchema.parse(req.body);
  const project = await Project.create({
    ...payload,
    deadline: new Date(payload.deadline)
  });
  await logAudit({
    actorId: req.user?.id,
    action: "project.create",
    entityType: "Project",
    entityId: project._id,
    after: project.toObject()
  });
  req.app.get("io").emit("project:created", project);
  res.status(201).json(project);
};

export const listProjects = async (req, res) => {
  const query = {};
  if (req.user.role === "manager") {
    query.managerId = req.user.id;
  }
  if (req.user.role === "employee") {
    const projectIds = await Task.distinct("projectId", { userId: req.user.id });
    query._id = { $in: projectIds };
  }
  const projects = await Project.find(query).sort({ createdAt: -1 }).lean();
  res.json(projects);
};

export const updateProject = async (req, res) => {
  const payload = projectSchema.partial().parse(req.body);
  const before = await Project.findById(req.params.id);
  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { ...payload, ...(payload.deadline ? { deadline: new Date(payload.deadline) } : {}) },
    { new: true }
  );
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }
  await logAudit({
    actorId: req.user?.id,
    action: "project.update",
    entityType: "Project",
    entityId: project._id,
    before: before?.toObject(),
    after: project.toObject()
  });
  req.app.get("io").emit("project:updated", project);
  res.json(project);
};

export const deleteProject = async (req, res) => {
  const before = await Project.findById(req.params.id);
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }
  await logAudit({
    actorId: req.user?.id,
    action: "project.delete",
    entityType: "Project",
    entityId: project._id,
    before: before?.toObject()
  });
  req.app.get("io").emit("project:deleted", { id: req.params.id });
  res.json({ success: true });
};
