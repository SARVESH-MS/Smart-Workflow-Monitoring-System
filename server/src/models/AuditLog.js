import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    before: { type: Object },
    after: { type: Object },
    meta: { type: Object }
  },
  { timestamps: true }
);

AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
