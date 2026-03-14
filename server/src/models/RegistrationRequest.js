import mongoose from "mongoose";

const RegistrationRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "manager", "employee"],
      required: true
    },
    teamRole: {
      type: String,
      enum: ["designer", "frontend", "backend", "tester", "manager"],
      default: "frontend"
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    processedAt: { type: Date },
    rejectionReason: { type: String }
  },
  { timestamps: true }
);

RegistrationRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("RegistrationRequest", RegistrationRequestSchema);
