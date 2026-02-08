import api from "./client.js";

export const getMyAvailability = () => api.get("/api/availability/me").then((res) => res.data);
export const saveMyAvailability = (data) => api.post("/api/availability/me", data).then((res) => res.data);
