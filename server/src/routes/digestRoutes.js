import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendDigest } from "../controllers/digestController.js";

const router = express.Router();

router.post("/", auth, role("admin"), asyncHandler(sendDigest));

export default router;
