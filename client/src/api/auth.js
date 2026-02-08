import api from "./client.js";

export const login = (data) => api.post("/api/auth/login", data).then((res) => res.data);
export const register = (data) => api.post("/api/auth/register", data).then((res) => res.data);
export const me = () => api.get("/api/auth/me").then((res) => res.data);
