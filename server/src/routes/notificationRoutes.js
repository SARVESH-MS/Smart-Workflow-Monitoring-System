import express from "express";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  listMyNotifications,
  markRead,
  listMyUnreadNotificationCount,
  markAllRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/my", auth, asyncHandler(listMyNotifications));
router.get("/unread-count", auth, asyncHandler(listMyUnreadNotificationCount));
router.post("/my/read", auth, asyncHandler(markAllRead));
router.put("/:id/read", auth, asyncHandler(markRead));

export default router;
