import express from "express";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { exportTasksCsv, exportTasksPdf } from "../controllers/reportController.js";

const router = express.Router();

router.get("/tasks.csv", auth, asyncHandler(exportTasksCsv));
router.get("/tasks.pdf", auth, asyncHandler(exportTasksPdf));

export default router;
