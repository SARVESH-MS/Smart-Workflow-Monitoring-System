import express from "express";
import { listUsers, teamByManager, updatePreferences, updatePreferencesForUser } from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", auth, role("admin", "manager"), asyncHandler(listUsers));
router.get("/team/:managerId", auth, role("admin", "manager"), asyncHandler(teamByManager));
router.put("/preferences", auth, asyncHandler(updatePreferences));
router.put("/:id/preferences", auth, role("admin"), asyncHandler(updatePreferencesForUser));

export default router;
