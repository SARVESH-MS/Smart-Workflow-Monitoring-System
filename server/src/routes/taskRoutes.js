import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  uploadTaskEvidence,
  addTaskProgressLog,
  recheckTaskProgressProof,
  startTaskTimer,
  stopTaskTimer,
  completeTask
} from "../controllers/taskController.js";
import { auth } from "../middleware/auth.js";
import { role } from "../middleware/role.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();
const evidenceUploadDir = path.resolve("uploads", "task-evidence");
const MAX_TASK_EVIDENCE_FILE_SIZE = 1000 * 1024 * 1024;
fs.mkdirSync(evidenceUploadDir, { recursive: true });

const allowedEvidenceExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".rtf",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".xml",
  ".yml",
  ".yaml",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".zip",
  ".rar",
  ".7z",
  ".json",
  ".md"
]);

const storage = multer.diskStorage({
  destination: evidenceUploadDir,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_TASK_EVIDENCE_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!allowedEvidenceExtensions.has(extension)) {
      cb(new Error("Unsupported file type. Upload pdf, doc, docx, images, text, csv, or archive files."));
      return;
    }
    cb(null, true);
  }
});

router.get("/", auth, asyncHandler(listTasks));
router.post("/progress/upload", auth, role("admin", "manager", "employee"), upload.single("file"), asyncHandler(uploadTaskEvidence));
router.get("/:id", auth, asyncHandler(getTask));
router.post("/", auth, role("admin", "manager"), asyncHandler(createTask));
router.put("/:id", auth, role("admin", "manager"), asyncHandler(updateTask));
router.delete("/:id", auth, role("admin", "manager"), asyncHandler(deleteTask));
router.post("/:id/progress", auth, role("admin", "manager", "employee"), asyncHandler(addTaskProgressLog));
router.post("/:id/progress/:entryId/recheck", auth, role("admin", "manager"), asyncHandler(recheckTaskProgressProof));
router.post("/:id/start", auth, role("manager", "employee"), asyncHandler(startTaskTimer));
router.post("/:id/stop", auth, role("manager", "employee"), asyncHandler(stopTaskTimer));
router.post("/:id/complete", auth, role("manager", "employee"), asyncHandler(completeTask));

export default router;
