import mongoose from "mongoose";

const ForumRoomSchema = new mongoose.Schema(
  {
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("ForumRoom", ForumRoomSchema);
