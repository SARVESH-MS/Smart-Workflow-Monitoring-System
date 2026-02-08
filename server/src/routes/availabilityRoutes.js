import express from "express";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getAvailability, upsertAvailability } from "../controllers/availabilityController.js";

const router = express.Router();

router.get("/me", auth, asyncHandler(getAvailability));
router.get("/user/:userId", auth, role("admin", "manager"), asyncHandler(getAvailability));
router.post("/me", auth, asyncHandler(upsertAvailability));
router.post("/user/:userId", auth, role("admin", "manager"), asyncHandler(upsertAvailability));

export default router;
