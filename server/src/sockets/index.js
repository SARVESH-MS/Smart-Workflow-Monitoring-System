import { logAudit } from "../services/auditService.js";
import { getRequestMeta } from "../utils/requestMeta.js";

export const setupSockets = (io) => {
  const onlineUsers = new Map();
  io.onlineUsers = onlineUsers;

  const markOnline = (userId) => {
    if (!userId) return;
    const key = String(userId);
    onlineUsers.set(key, (onlineUsers.get(key) || 0) + 1);
    io.emit("presence:update");
  };

  const markOffline = (userId) => {
    if (!userId) return;
    const key = String(userId);
    const count = (onlineUsers.get(key) || 0) - 1;
    if (count > 0) {
      onlineUsers.set(key, count);
    } else {
      onlineUsers.delete(key);
    }
    io.emit("presence:update");
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake?.auth?.userId || null;
    const requestMeta = getRequestMeta({
      headers: socket.handshake?.headers || {},
      ip: socket.handshake?.address,
      socket: { remoteAddress: socket.handshake?.address }
    });

    if (userId) {
      socket.data.userId = String(userId);
      markOnline(userId);
    }

    socket.on("presence:join", (payload = {}) => {
      if (socket.data.userId) return;
      if (!payload.userId) return;
      socket.data.userId = String(payload.userId);
      markOnline(socket.data.userId);
    });

    socket.emit("status", { ok: true, message: "Connected" });
    socket.on("disconnect", () => {
      if (socket.data.userId) {
        const current = onlineUsers.get(socket.data.userId) || 0;
        markOffline(socket.data.userId);
        if (current <= 1) {
          // When the last tab/device disconnects, record it as logout in activity.
          void logAudit({
            actorId: socket.data.userId,
            action: "auth.logout",
            entityType: "User",
            entityId: socket.data.userId,
            meta: requestMeta
          });
        }
      }
    });
  });
};
