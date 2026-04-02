export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not Found - ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  if (err?.name === "ZodError") {
    const firstIssue = Array.isArray(err.issues) ? err.issues[0] : null;
    const fieldLabel = String(firstIssue?.path?.[0] || "")
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim();
    const validationMessage =
      fieldLabel && firstIssue?.message
        ? `${fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)}: ${firstIssue.message}`
        : firstIssue?.message || "Validation error";
    return res.status(400).json({
      message: validationMessage,
      issues: err.issues
    });
  }
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({
    message: err.message || "Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};
