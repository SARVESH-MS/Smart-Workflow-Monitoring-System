import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listEmailLogs, listMyEmails } from "../controllers/emailLogController.js";

const router = express.Router();

router.get("/", auth, role("admin"), asyncHandler(listEmailLogs));
router.get("/my", auth, asyncHandler(listMyEmails));

export default router;
