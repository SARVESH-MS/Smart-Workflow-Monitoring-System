import { io } from "socket.io-client";

export const createSocket = () => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return io(url, { transports: ["websocket"] });
};
