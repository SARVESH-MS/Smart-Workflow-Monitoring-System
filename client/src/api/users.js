import api from "./client.js";

export const updatePreferences = (data) =>
  api.put("/api/users/preferences", data).then((res) => res.data);

export const updateProfile = (data) =>
  api.put("/api/users/profile", data).then((res) => res.data);

export const listUsers = (role) =>
  api.get("/api/users", { params: role ? { role } : {} }).then((res) => res.data);

export const updateUserPreferences = (id, data) =>
  api.put(`/api/users/${id}/preferences`, data).then((res) => res.data);

export const listRegistrationRequests = (status = "pending") =>
  api.get("/api/users/registration-requests", { params: { status } }).then((res) => res.data);

export const processRegistrationRequest = (id, data) =>
  api.put(`/api/users/registration-requests/${id}`, data).then((res) => res.data);

export const listLoginActivity = (limit = 200) =>
  api.get("/api/users/login-activity", { params: { limit } }).then((res) => res.data);

export const listSessionMonitor = () =>
  api.get("/api/users/session-monitor").then((res) => res.data);
