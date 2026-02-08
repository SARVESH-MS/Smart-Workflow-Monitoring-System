import AuditLog from "../models/AuditLog.js";

export const logAudit = async ({ actorId, action, entityType, entityId, before, after, meta }) => {
  try {
    await AuditLog.create({
      actorId,
      action,
      entityType,
      entityId,
      before,
      after,
      meta
    });
  } catch {
    // avoid breaking main flow on audit failure
  }
};
