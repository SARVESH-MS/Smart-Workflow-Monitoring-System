import express from "express";
import { createProject, listProjects, updateProject, deleteProject } from "../controllers/projectController.js";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/", auth, asyncHandler(listProjects));
router.post("/", auth, role("admin"), asyncHandler(createProject));
router.put("/:id", auth, role("admin"), asyncHandler(updateProject));
router.delete("/:id", auth, role("admin"), asyncHandler(deleteProject));

export default router;
