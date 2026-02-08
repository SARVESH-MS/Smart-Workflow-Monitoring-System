import api from "./client.js";

export const listMyNotifications = () => api.get("/api/notifications/my").then((res) => res.data);
export const markNotificationRead = (id) => api.put(`/api/notifications/${id}/read`).then((res) => res.data);
