import express from "express";
import { register, login, me, logout, googleAuth } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/google", asyncHandler(googleAuth));
router.get("/me", auth, asyncHandler(me));
router.post("/logout", auth, asyncHandler(logout));

export default router;
