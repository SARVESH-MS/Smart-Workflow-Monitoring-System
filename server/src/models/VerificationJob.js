import mongoose from "mongoose";

const VerificationJobCheckSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    status: { type: String, enum: ["pass", "warning", "fail"], required: true },
    message: { type: String, required: true }
  },
  { _id: false }
);

const VerificationJobSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    progressEntryId: { type: String, required: true, index: true },
    evidenceType: { type: String, required: true },
    evidenceUrl: { type: String, required: true },
    mode: { type: String, enum: ["url", "archive"], required: true },
    status: {
      type: String,
      enum: ["queued", "running", "pass", "warning", "fail", "error"],
      default: "queued",
      index: true
    },
    summary: { type: String, default: "" },
    checks: { type: [VerificationJobCheckSchema], default: [] },
    log: { type: String, default: "" },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

VerificationJobSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("VerificationJob", VerificationJobSchema);
