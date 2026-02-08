import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { setRoleMatrix } from "../controllers/rbacController.js";

const router = express.Router();

router.post("/matrix", auth, role("admin"), asyncHandler(setRoleMatrix));

export default router;
