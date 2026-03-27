import mongoose from "mongoose";
import { randomUUID } from "crypto";

const TaskEvidenceAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true }
  },
  { _id: false }
);

const TaskVerificationCheckSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    status: { type: String, enum: ["pass", "warning", "fail"], required: true },
    message: { type: String, required: true }
  },
  { _id: false }
);

const TaskVerificationResultSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pass", "warning", "fail"], required: true },
    summary: { type: String, required: true },
    scope: { type: String, default: "automated" },
    checkedAt: { type: Date, default: Date.now },
    taskAlignmentScore: { type: Number, default: 0 },
    evidenceAlignmentScore: { type: Number, default: 0 },
    checks: { type: [TaskVerificationCheckSchema], default: [] },
    jobId: { type: String, default: "" },
    runtimeStatus: {
      type: String,
      enum: ["not_requested", "queued", "running", "completed", "error"],
      default: "not_requested"
    },
    runtimeSummary: { type: String, default: "" }
  },
  { _id: false }
);

const TaskProgressLogSchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, default: randomUUID },
    workType: { type: String, required: true },
    affectedArea: { type: String, required: true },
    progressState: { type: String, required: true },
    evidenceType: { type: String, required: true },
    note: { type: String, required: true },
    evidenceUrl: { type: String, default: "" },
    evidenceAttachment: { type: TaskEvidenceAttachmentSchema, default: null },
    verification: { type: TaskVerificationResultSchema, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    loggedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    roleContribution: { type: String },
    stage: { type: String, default: "Planning" },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    startTime: { type: Date },
    endTime: { type: Date },
    timeSpent: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo"
    },
    deadline: { type: Date, required: true },
    isDelayed: { type: Boolean, default: false },
    progressLogs: { type: [TaskProgressLogSchema], default: [] },
    lastProgressAt: { type: Date }
  },
  { timestamps: true }
);

TaskSchema.index({ projectId: 1, createdAt: -1 });
TaskSchema.index({ userId: 1, createdAt: -1 });

TaskSchema.pre("validate", function ensureProgressEntryIds(next) {
  if (Array.isArray(this.progressLogs)) {
    this.progressLogs.forEach((entry) => {
      if (!entry?.entryId) {
        entry.entryId = randomUUID();
      }
    });
  }
  next();
});

export default mongoose.model("Task", TaskSchema);
