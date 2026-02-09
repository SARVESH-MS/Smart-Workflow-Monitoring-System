import api from "./client.js";

export const listMyNotifications = () => api.get("/api/notifications/my").then((res) => res.data);
export const markNotificationRead = (id) => api.put(`/api/notifications/${id}/read`).then((res) => res.data);
export const listMyNotificationUnreadCount = () =>
  api.get("/api/notifications/unread-count").then((res) => res.data);
export const markAllNotificationsRead = () =>
  api.post("/api/notifications/my/read").then((res) => res.data);
