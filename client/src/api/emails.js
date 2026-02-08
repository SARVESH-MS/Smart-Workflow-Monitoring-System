import api from "./client.js";

export const listEmailLogs = () => api.get("/api/emails").then((res) => res.data);
export const listMyEmails = () => api.get("/api/emails/my").then((res) => res.data);
