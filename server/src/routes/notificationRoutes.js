import express from "express";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listMyNotifications, markRead } from "../controllers/notificationController.js";

const router = express.Router();

router.get("/my", auth, asyncHandler(listMyNotifications));
router.put("/:id/read", auth, asyncHandler(markRead));

export default router;
