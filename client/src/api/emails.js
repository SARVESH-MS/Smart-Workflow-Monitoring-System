import api from "./client.js";

export const listEmailLogs = () => api.get("/api/emails").then((res) => res.data);
export const listMyEmails = () => api.get("/api/emails/my").then((res) => res.data);
export const listMyEmailUnreadCount = () =>
  api.get("/api/emails/my/unread-count").then((res) => res.data);
export const markMyEmailsRead = () => api.post("/api/emails/my/read").then((res) => res.data);
