import api from "./client.js";

export const listTasks = (params) => api.get("/api/tasks", { params }).then((res) => res.data);
export const getTask = (id) => api.get(`/api/tasks/${id}`).then((res) => res.data);
export const createTask = (data) => api.post("/api/tasks", data).then((res) => res.data);
export const updateTask = (id, data) => api.put(`/api/tasks/${id}`, data).then((res) => res.data);
export const deleteTask = (id) => api.delete(`/api/tasks/${id}`).then((res) => res.data);
export const addTaskProgress = (id, data) => api.post(`/api/tasks/${id}/progress`, data).then((res) => res.data);
export const recheckTaskProof = (id, entryId) => api.post(`/api/tasks/${id}/progress/${entryId}/recheck`).then((res) => res.data);
export const uploadTaskEvidence = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post("/api/tasks/progress/upload", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data);
};
export const startTask = (id) => api.post(`/api/tasks/${id}/start`).then((res) => res.data);
export const stopTask = (id) => api.post(`/api/tasks/${id}/stop`).then((res) => res.data);
export const completeTask = (id) => api.post(`/api/tasks/${id}/complete`).then((res) => res.data);
