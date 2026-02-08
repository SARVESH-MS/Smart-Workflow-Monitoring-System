import api from "./client.js";

export const searchAll = (q) => api.get("/api/search", { params: { q } }).then((res) => res.data);
