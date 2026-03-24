import { logAudit } from "../services/auditService.js";
import { getRequestMeta } from "../utils/requestMeta.js";

export const setupSockets = (io) => {
  const onlineUsers = new Map();
  const sessionSockets = new Map();
  const pendingSessionLogouts = new Map();
  const explicitSessionLogouts = new Map();
  const SESSION_END_DELAY_MS = 5000;
  io.onlineUsers = onlineUsers;

  const getUserKey = (userId) => (userId ? String(userId) : "");
  const getSessionKey = (userId, sessionId) => {
    const userKey = getUserKey(userId);
    const normalizedSessionId = String(sessionId || "").trim();
    if (!userKey || !normalizedSessionId) return "";
    return `${userKey}:${normalizedSessionId}`;
  };

  const clearPendingSessionLogout = (sessionKey) => {
    if (!sessionKey) return;
    const pending = pendingSessionLogouts.get(sessionKey);
    if (pending) {
      clearTimeout(pending);
      pendingSessionLogouts.delete(sessionKey);
    }
  };

  const clearExplicitSessionLogout = (sessionKey) => {
    if (!sessionKey) return;
    explicitSessionLogouts.delete(sessionKey);
  };

  const markOnline = (userId, sessionId) => {
    const userKey = getUserKey(userId);
    if (!userKey) return;
    const sessionKey = getSessionKey(userId, sessionId);
    if (sessionKey) {
      sessionSockets.set(sessionKey, (sessionSockets.get(sessionKey) || 0) + 1);
      clearPendingSessionLogout(sessionKey);
      clearExplicitSessionLogout(sessionKey);
    }
    onlineUsers.set(userKey, (onlineUsers.get(userKey) || 0) + 1);
    io.emit("presence:update");
  };

  const markOffline = (userId, sessionId, requestMeta) => {
    const userKey = getUserKey(userId);
    if (!userKey) return;
    const count = (onlineUsers.get(userKey) || 0) - 1;
    if (count > 0) {
      onlineUsers.set(userKey, count);
    } else {
      onlineUsers.delete(userKey);
    }

    const sessionKey = getSessionKey(userId, sessionId);
    if (sessionKey) {
      const sessionCount = (sessionSockets.get(sessionKey) || 0) - 1;
      if (sessionCount > 0) {
        sessionSockets.set(sessionKey, sessionCount);
      } else {
        sessionSockets.delete(sessionKey);
        clearPendingSessionLogout(sessionKey);
        const timeout = setTimeout(() => {
          pendingSessionLogouts.delete(sessionKey);
          if (explicitSessionLogouts.has(sessionKey)) {
            explicitSessionLogouts.delete(sessionKey);
            return;
          }
          void logAudit({
            actorId: userId,
            action: "auth.logout",
            entityType: "User",
            entityId: userId,
            meta: { ...requestMeta, sessionId, reason: "session-ended" }
          });
        }, SESSION_END_DELAY_MS);
        timeout.unref?.();
        pendingSessionLogouts.set(sessionKey, timeout);
      }
    }

    io.emit("presence:update");
  };

  io.markSessionExplicitLogout = (userId, sessionId) => {
    const sessionKey = getSessionKey(userId, sessionId);
    if (!sessionKey) return;
    clearPendingSessionLogout(sessionKey);
    explicitSessionLogouts.set(sessionKey, Date.now());
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake?.auth?.userId || null;
    const sessionId = socket.handshake?.auth?.sessionId || null;
    const requestMeta = getRequestMeta({
      headers: socket.handshake?.headers || {},
      ip: socket.handshake?.address,
      socket: { remoteAddress: socket.handshake?.address }
    });

    if (userId) {
      socket.data.userId = String(userId);
      socket.data.sessionId = String(sessionId || requestMeta.sessionId || "");
      markOnline(userId, socket.data.sessionId);
    }

    socket.on("presence:join", (payload = {}) => {
      if (socket.data.userId) return;
      if (!payload.userId) return;
      socket.data.userId = String(payload.userId);
      socket.data.sessionId = String(payload.sessionId || requestMeta.sessionId || "");
      markOnline(socket.data.userId, socket.data.sessionId);
    });

    socket.emit("status", { ok: true, message: "Connected" });
    socket.on("disconnect", () => {
      if (socket.data.userId) {
        markOffline(socket.data.userId, socket.data.sessionId, requestMeta);
      }
    });
  });
};
