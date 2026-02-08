import { z } from "zod";
import AuditLog from "../models/AuditLog.js";

const exportSchema = z.object({
  role: z.enum(["admin", "manager", "employee"]),
  routes: z.array(z.string())
});

export const setRoleMatrix = async (req, res) => {
  const payload = exportSchema.parse(req.body);
  await AuditLog.create({
    actorId: req.user.id,
    action: "rbac.update",
    entityType: "RBAC",
    entityId: req.user.id,
    after: payload
  });
  res.json({ saved: true, payload });
};
