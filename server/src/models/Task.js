import mongoose from "mongoose";

const TaskProgressLogSchema = new mongoose.Schema(
  {
    workType: { type: String, required: true },
    affectedArea: { type: String, required: true },
    progressState: { type: String, required: true },
    evidenceType: { type: String, required: true },
    note: { type: String, required: true },
    evidenceUrl: { type: String, default: "" },
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

export default mongoose.model("Task", TaskSchema);
