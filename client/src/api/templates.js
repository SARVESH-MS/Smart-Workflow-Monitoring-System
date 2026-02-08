import api from "./client.js";

export const listTemplates = () => api.get("/api/templates").then((res) => res.data);
export const updateTemplate = (key, data) =>
  api.put(`/api/templates/${key}`, data).then((res) => res.data);
