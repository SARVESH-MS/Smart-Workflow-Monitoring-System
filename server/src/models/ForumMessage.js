import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const ForumMessageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ForumRoom", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
    attachments: { type: [AttachmentSchema], default: [] },
    editedAt: { type: Date }
  },
  { timestamps: true }
);

ForumMessageSchema.index({ roomId: 1, createdAt: 1 });

export default mongoose.model("ForumMessage", ForumMessageSchema);
