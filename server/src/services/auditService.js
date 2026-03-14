import AuditLog from "../models/AuditLog.js";

export const logAudit = ({ actorId, action, entityType, entityId, before, after, meta }) => {
  AuditLog.create({
    actorId,
    action,
    entityType,
    entityId,
    before,
    after,
    meta
  }).catch(() => {
    // avoid breaking main flow on audit failure
  });
};
