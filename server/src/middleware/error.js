export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not Found - ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  if (err?.name === "ZodError") {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues
    });
  }
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({
    message: err.message || "Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};
