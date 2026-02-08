import express from "express";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { projectDependencies, criticalPath } from "../controllers/dependencyController.js";

const router = express.Router();

router.get("/project/:projectId", auth, asyncHandler(projectDependencies));
router.get("/project/:projectId/critical-path", auth, asyncHandler(criticalPath));

export default router;
