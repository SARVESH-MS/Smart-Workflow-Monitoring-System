import express from "express";
import { register, login, me, logout, googleAuth } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();
const authAttemptLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
  message: "Too many authentication attempts. Please wait and try again."
});

router.post("/register", authAttemptLimiter, asyncHandler(register));
router.post("/login", authAttemptLimiter, asyncHandler(login));
router.post("/google", authAttemptLimiter, asyncHandler(googleAuth));
router.get("/me", auth, asyncHandler(me));
router.post("/logout", auth, asyncHandler(logout));

export default router;
