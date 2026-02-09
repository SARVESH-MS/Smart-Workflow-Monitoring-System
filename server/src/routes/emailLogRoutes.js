import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  listEmailLogs,
  listMyEmails,
  listMyUnreadEmailCount,
  markMyEmailsRead
} from "../controllers/emailLogController.js";

const router = express.Router();

router.get("/", auth, role("admin"), asyncHandler(listEmailLogs));
router.get("/my", auth, asyncHandler(listMyEmails));
router.get("/my/unread-count", auth, asyncHandler(listMyUnreadEmailCount));
router.post("/my/read", auth, asyncHandler(markMyEmailsRead));

export default router;
