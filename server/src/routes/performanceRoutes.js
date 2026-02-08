import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { performanceSummary } from "../controllers/performanceController.js";

const router = express.Router();

router.get("/summary", auth, role("admin", "manager"), asyncHandler(performanceSummary));
router.get("/summary/:userId", auth, role("admin", "manager"), asyncHandler(performanceSummary));

export default router;
