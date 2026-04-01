/**
 * Express error-handling middleware.
 * Returns consistent JSON envelope and never leaks stack traces in production.
 */
export default function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV !== "production";

  const statusCode = resolveStatusCode(err);
  const message = resolveMessage(err, isDev);

  if (isDev) {
    console.error(`[error-handler] ${err.message}`);
    console.error(err.stack);
  } else {
    console.error(`[error-handler] ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    data: null,
  });
}

function resolveStatusCode(err) {
  if (err.status) {
    return err.status;
  }

  if (err.type === "validation" || err.name === "ValidationError") {
    return 400;
  }

  if (err.type === "not_found" || err.name === "NotFoundError") {
    return 404;
  }

  return 500;
}

function resolveMessage(err, isDev) {
  if (err.type === "validation" || err.name === "ValidationError") {
    return err.message;
  }

  if (err.type === "not_found" || err.name === "NotFoundError") {
    return err.message || "Resource not found";
  }

  if (isDev) {
    return err.message;
  }

  return "Internal server error";
}
