import mongoose from "mongoose";

const EmailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String },
    body: { type: String },
    templateKey: { type: String },
    sentByRole: { type: String, default: "system" },
    sentById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    meta: { type: Object },
    read: { type: Boolean, default: false },
    deliveryStatus: { type: String, enum: ["sent", "failed"], default: "sent" },
    error: { type: String }
  },
  { timestamps: true }
);

EmailLogSchema.index({ to: 1, createdAt: -1 });
EmailLogSchema.index({ to: 1, read: 1 });

export default mongoose.model("EmailLog", EmailLogSchema);
