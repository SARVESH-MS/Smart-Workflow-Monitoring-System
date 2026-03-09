import api from "./client.js";

export const login = (data) => api.post("/api/auth/login", data).then((res) => res.data);
export const register = (data) => api.post("/api/auth/register", data).then((res) => res.data);
export const googleAuth = (data) => api.post("/api/auth/google", data).then((res) => res.data);
export const me = () => api.get("/api/auth/me").then((res) => res.data);
export const logout = () => api.post("/api/auth/logout").then((res) => res.data);
