import mongoose from "mongoose";

const ForumReadSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "ForumRoom", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ForumReadSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export default mongoose.model("ForumRead", ForumReadSchema);
