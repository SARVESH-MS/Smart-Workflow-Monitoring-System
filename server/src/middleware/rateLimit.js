import { getClientIp } from "../utils/requestMeta.js";

const buckets = new Map();

export const rateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = "Too many requests. Please try again later.",
  key = (req) => `${getClientIp(req)}:${req.baseUrl}${req.path}`
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = key(req);
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    buckets.set(bucketKey, current);

    if (current.count > max) {
      const retryAfterSec = Math.max(Math.ceil((current.resetAt - now) / 1000), 1);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({ message });
    }

    return next();
  };
};
