import mongoose from "mongoose";

const TaskTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    roleContribution: { type: String },
    stage: { type: String, default: "Planning" },
    estimatedDays: { type: Number, default: 3 },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("TaskTemplate", TaskTemplateSchema);
