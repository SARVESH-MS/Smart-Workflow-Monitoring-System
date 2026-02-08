import mongoose from "mongoose";

const NotificationTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    channel: { type: String, required: true },
    subject: { type: String },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("NotificationTemplate", NotificationTemplateSchema);
