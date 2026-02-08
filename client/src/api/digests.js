import api from "./client.js";

export const sendDigest = (data) => api.post("/api/digests", data).then((res) => res.data);
