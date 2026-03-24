import { io } from "socket.io-client";
import { getSessionId, getToken } from "./auth.js";

export const createSocket = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return io(url, {
    transports: ["websocket"],
    auth: {
      token: getToken() || "",
      sessionId: getSessionId()
    }
  });
};
