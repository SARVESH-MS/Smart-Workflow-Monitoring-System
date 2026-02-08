import api from "./client.js";

export const listTasks = (params) => api.get("/api/tasks", { params }).then((res) => res.data);
export const createTask = (data) => api.post("/api/tasks", data).then((res) => res.data);
export const updateTask = (id, data) => api.put(`/api/tasks/${id}`, data).then((res) => res.data);
export const startTask = (id) => api.post(`/api/tasks/${id}/start`).then((res) => res.data);
export const stopTask = (id) => api.post(`/api/tasks/${id}/stop`).then((res) => res.data);
export const completeTask = (id) => api.post(`/api/tasks/${id}/complete`).then((res) => res.data);
