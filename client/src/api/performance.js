import api from "./client.js";

export const teamPerformance = () => api.get("/api/performance/summary").then((res) => res.data);
export const userPerformance = (userId) => api.get(`/api/performance/summary/${userId}`).then((res) => res.data);
