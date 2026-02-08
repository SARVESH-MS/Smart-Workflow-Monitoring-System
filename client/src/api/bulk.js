import api from "./client.js";

export const bulkUpdateTasks = (payload) => api.post("/api/bulk/tasks", payload).then((res) => res.data);
