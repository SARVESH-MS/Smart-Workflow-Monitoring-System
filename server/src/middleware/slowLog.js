export const slowLog = (thresholdMs = 800) => (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    if (durationMs >= thresholdMs) {
      const method = req.method;
      const path = req.originalUrl || req.url;
      console.warn(`[slow] ${method} ${path} ${Math.round(durationMs)}ms`);
    }
  });
  next();
};
