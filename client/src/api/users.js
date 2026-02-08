import api from "./client.js";

export const updatePreferences = (data) =>
  api.put("/api/users/preferences", data).then((res) => res.data);

export const listUsers = (role) =>
  api.get("/api/users", { params: role ? { role } : {} }).then((res) => res.data);

export const updateUserPreferences = (id, data) =>
  api.put(`/api/users/${id}/preferences`, data).then((res) => res.data);
