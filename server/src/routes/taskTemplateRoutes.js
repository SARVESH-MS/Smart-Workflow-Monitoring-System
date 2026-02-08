import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listTemplates, createTemplate } from "../controllers/templateTaskController.js";

const router = express.Router();

router.get("/", auth, role("admin", "manager"), asyncHandler(listTemplates));
router.post("/", auth, role("admin", "manager"), asyncHandler(createTemplate));

export default router;
