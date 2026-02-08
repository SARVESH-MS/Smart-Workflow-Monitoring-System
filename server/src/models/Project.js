import mongoose from "mongoose";

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    deadline: { type: Date, required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["planning", "design", "development", "testing", "done"],
      default: "planning"
    },
    workflow: {
      type: [String],
      default: ["Planning", "Design", "Development", "Testing", "Done"]
    }
  },
  { timestamps: true }
);

export default mongoose.model("Project", ProjectSchema);
