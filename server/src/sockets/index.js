export const setupSockets = (io) => {
  io.on("connection", (socket) => {
    socket.emit("status", { ok: true, message: "Connected" });
    socket.on("disconnect", () => {
      // no-op
    });
  });
};
