import express from "express";
import {
  listUsers,
  teamByManager,
  updatePreferences,
  updateProfile,
  updatePreferencesForUser,
  listRegistrationRequests,
  processRegistrationRequest,
  listLoginActivity,
  listSessionMonitor
} from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", auth, role("admin", "manager"), asyncHandler(listUsers));
router.get("/team/:managerId", auth, role("admin", "manager"), asyncHandler(teamByManager));
router.get("/login-activity", auth, role("admin"), asyncHandler(listLoginActivity));
router.get("/session-monitor", auth, role("admin"), asyncHandler(listSessionMonitor));
router.get("/registration-requests", auth, role("admin"), asyncHandler(listRegistrationRequests));
router.put("/registration-requests/:id", auth, role("admin"), asyncHandler(processRegistrationRequest));
router.put("/preferences", auth, asyncHandler(updatePreferences));
router.put("/profile", auth, asyncHandler(updateProfile));
router.put("/:id/preferences", auth, role("admin"), asyncHandler(updatePreferencesForUser));

export default router;
