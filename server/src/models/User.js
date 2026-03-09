import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    swmsId: { type: String, unique: true, index: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "manager", "employee"],
      required: true
    },
    phone: { type: String },
    avatarUrl: { type: String, default: "" },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    teamRole: {
      type: String,
      enum: ["designer", "frontend", "backend", "tester", "manager"],
      default: "frontend"
    },
    notificationPrefs: {
      emailDelay: { type: Boolean, default: true },
      emailComplete: { type: Boolean, default: false },
      smsDelay: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
