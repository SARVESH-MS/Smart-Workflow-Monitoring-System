import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { bulkUpdateTasks } from "../controllers/bulkController.js";

const router = express.Router();

router.post("/tasks", auth, role("admin", "manager"), asyncHandler(bulkUpdateTasks));

export default router;
