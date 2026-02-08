import express from "express";
import {
  createTask,
  listTasks,
  updateTask,
  startTaskTimer,
  stopTaskTimer,
  completeTask
} from "../controllers/taskController.js";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", auth, asyncHandler(listTasks));
router.post("/", auth, role("admin", "manager"), asyncHandler(createTask));
router.put("/:id", auth, role("admin", "manager"), asyncHandler(updateTask));
router.post("/:id/start", auth, role("manager", "employee"), asyncHandler(startTaskTimer));
router.post("/:id/stop", auth, role("manager", "employee"), asyncHandler(stopTaskTimer));
router.post("/:id/complete", auth, role("manager", "employee"), asyncHandler(completeTask));

export default router;
