import express from "express";
import { register, login, me } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", auth, asyncHandler(me));

export default router;
