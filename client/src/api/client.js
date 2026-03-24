import axios from "axios";
import { getSessionId, getToken } from "../utils/auth.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000"
});

api.interceptors.request.use((config) => {
  const token = getToken();
  config.headers["X-Session-Id"] = getSessionId();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
