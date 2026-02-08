import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createRecurringTasks } from "../controllers/recurringController.js";

const router = express.Router();

router.post("/", auth, role("admin", "manager"), asyncHandler(createRecurringTasks));

export default router;
