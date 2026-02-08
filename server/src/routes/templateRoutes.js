import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { listTemplates, upsertTemplate } from "../controllers/templateController.js";

const router = express.Router();

router.get("/", auth, role("admin"), asyncHandler(listTemplates));
router.put("/:key", auth, role("admin"), asyncHandler(upsertTemplate));

export default router;
