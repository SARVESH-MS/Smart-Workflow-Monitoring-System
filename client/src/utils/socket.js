import { io } from "socket.io-client";
import { getSessionId, getUser } from "./auth.js";

export const createSocket = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const user = getUser();
  return io(url, {
    transports: ["websocket"],
    auth: {
      userId: user?.id || user?._id || "",
      sessionId: getSessionId()
    }
  });
};
