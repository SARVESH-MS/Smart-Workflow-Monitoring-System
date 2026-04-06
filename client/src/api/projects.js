import api from "./client.js";

export const listProjects = () => api.get("/api/projects").then((res) => res.data);
export const createProject = (data) => api.post("/api/projects", data).then((res) => res.data);
export const updateProject = (id, data) => api.put(`/api/projects/${id}`, data).then((res) => res.data);
export const deleteProject = (id) => api.delete(`/api/projects/${id}`).then((res) => res.data);
export const updateProjectStatus = (id, status) =>
  api.patch(`/api/projects/${id}/status`, { status }).then((res) => res.data);
