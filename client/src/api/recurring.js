import api from "./client.js";

export const listTaskTemplates = () => api.get("/api/task-templates").then((res) => res.data);
export const createTaskTemplate = (data) => api.post("/api/task-templates", data).then((res) => res.data);
export const createRecurring = (data) => api.post("/api/recurring", data).then((res) => res.data);
