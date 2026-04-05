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
      smsDelay: { type: Boolean, default: false },
      smsComplete: { type: Boolean, default: false },
      smsDailyProgress: { type: Boolean, default: false },
      desktopDailyProgress: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

UserSchema.index({ role: 1 });
UserSchema.index({ managerId: 1 });

export default mongoose.model("User", UserSchema);
