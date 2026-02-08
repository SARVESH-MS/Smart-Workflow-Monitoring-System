import api from "./client.js";

export const summary = () => api.get("/api/analytics/summary").then((res) => res.data);
