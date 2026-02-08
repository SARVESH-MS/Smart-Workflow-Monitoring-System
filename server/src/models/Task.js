import mongoose from "mongoose";

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
    isDelayed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Task", TaskSchema);
