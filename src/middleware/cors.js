const DEFAULT_ALLOWED_ORIGIN = "*";
const ALLOWED_METHODS = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With";

/**
 * CORS middleware that sets standard headers and handles preflight requests.
 *
 * @param {{ origin?: string }} [options]
 * @returns {import('express').RequestHandler}
 */
export default function cors(options = {}) {
  const origin = options.origin ?? DEFAULT_ALLOWED_ORIGIN;

  return (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
