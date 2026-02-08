import mongoose from "mongoose";

const EmailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String },
    body: { type: String },
    templateKey: { type: String },
    sentByRole: { type: String, default: "system" },
    sentById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    meta: { type: Object }
  },
  { timestamps: true }
);

export default mongoose.model("EmailLog", EmailLogSchema);
