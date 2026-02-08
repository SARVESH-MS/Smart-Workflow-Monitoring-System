import express from "express";
import { analyticsSummary } from "../controllers/analyticsController.js";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/summary", auth, asyncHandler(analyticsSummary));

export default router;
