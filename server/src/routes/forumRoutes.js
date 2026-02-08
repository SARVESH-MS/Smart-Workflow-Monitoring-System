import express from "express";
import multer from "multer";
import path from "path";
import { auth } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  getMyRoom,
  listMessages,
  createMessage,
  uploadAttachment,
  addAttachmentToMessage
} from "../controllers/forumController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.resolve("uploads"),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${unique}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get("/room", auth, asyncHandler(getMyRoom));
router.get("/messages", auth, asyncHandler(listMessages));
router.post("/messages", auth, asyncHandler(createMessage));
router.post("/upload", auth, upload.single("file"), asyncHandler(uploadAttachment));
router.post("/messages/:id/attachments", auth, asyncHandler(addAttachmentToMessage));

export default router;
