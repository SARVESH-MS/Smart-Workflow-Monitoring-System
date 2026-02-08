import express from "express";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/", auth, asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ tasks: [], projects: [], users: [] });
  const regex = new RegExp(q, "i");

  let projectQuery = {};
  if (req.user.role === "manager") projectQuery = { managerId: req.user.id };
  const projects = await Project.find(projectQuery).or([{ name: regex }, { description: regex }]).limit(10);

  let taskQuery = {};
  if (req.user.role === "manager") {
    const projIds = projects.map((p) => p._id);
    taskQuery = { projectId: { $in: projIds } };
  }
  if (req.user.role === "employee") {
    taskQuery = { userId: req.user.id };
  }
  const tasks = await Task.find(taskQuery).or([{ title: regex }, { description: regex }]).limit(10);

  const users = await User.find({ name: regex }).select("name email role").limit(10);

  res.json({ tasks, projects, users });
}));

export default router;
