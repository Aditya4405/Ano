const { getRedisClient, isRedisAvailable } = require('./redis');

/**
 * In-memory fallback for rate limiting
 * Map<string, { count: number, resetAt: number }>
 */
const memoryRateLimits = new Map();

// Periodic sweep for expired memory rate limits
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryRateLimits.entries()) {
    if (v.resetAt <= now) {
      memoryRateLimits.delete(k);
    }
  }
}, 60000).unref();

const RATE_LIMIT_PREFIX = 'ano:ratelimit:';

/**
 * Check and increment rate limit for a specific action & identifier
 * @param {string} action - e.g. "auth:google", "feed:post", "chat:msg"
 * @param {string} identifier - e.g. userId or IP address
 * @param {number} windowMs - Window duration in milliseconds (e.g. 60000 for 1 min)
 * @param {number} maxRequests - Max allowed requests within the window
 * @returns {Promise<{ allowed: boolean, count: number, remaining: number, resetMs: number }>}
 */
async function checkRateLimit(action, identifier, windowMs = 60000, maxRequests = 10) {
  const key = `${RATE_LIMIT_PREFIX}${action}:${identifier}`;
  const now = Date.now();

  if (isRedisAvailable()) {
    try {
      const client = getRedisClient();
      const ttlSeconds = Math.ceil(windowMs / 1000);

      // Atomic increment & set expiry on new key
      const results = await client
        .pipeline()
        .incr(key)
        .pttl(key)
        .exec();

      const count = results[0][1];
      let pttl = results[1][1];

      // If key was just created (pttl === -1), set the expiration
      if (pttl < 0) {
        await client.pexpire(key, windowMs);
        pttl = windowMs;
      }

      const allowed = count <= maxRequests;
      const remaining = Math.max(0, maxRequests - count);

      return {
        allowed,
        count,
        remaining,
        resetMs: now + Math.max(0, pttl)
      };
    } catch (err) {
      // Fall through to memory rate limiter on Redis failure
    }
  }

  // In-Memory Fallback
  let record = memoryRateLimits.get(key);
  if (!record || record.resetAt <= now) {
    record = { count: 1, resetAt: now + windowMs };
    memoryRateLimits.set(key, record);
  } else {
    record.count += 1;
  }

  const allowed = record.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - record.count);

  return {
    allowed,
    count: record.count,
    remaining,
    resetMs: record.resetAt
  };
}

/**
 * Express middleware factory for rate limiting
 */
function createRateLimiter({
  action = 'api',
  windowMs = 60000,
  max = 30,
  message = 'Too many requests, please slow down.',
  keyGenerator = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'anonymous'
}) {
  return async (req, res, next) => {
    try {
      const identifier = keyGenerator(req);
      const result = await checkRateLimit(action, identifier, windowMs, max);

      // Set standard rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000));

      if (!result.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil((result.resetMs - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(429).json({
          error: message,
          retryAfter: retryAfterSeconds
        });
      }

      next();
    } catch (err) {
      // Never block legitimate requests on rate limiter internal exception
      console.warn('[RateLimiter] Middleware evaluation error:', err.message);
      next();
    }
  };
}

/**
 * Helper to rate-limit Socket.IO event handlers
 */
async function checkSocketRateLimit(socket, action, windowMs = 5000, max = 5) {
  const identifier = socket.userId || socket.id;
  const result = await checkRateLimit(action, identifier, windowMs, max);
  if (!result.allowed) {
    socket.emit('rate_limit_exceeded', {
      action,
      message: 'You are sending requests too quickly. Please slow down.',
      retryAfterMs: Math.max(0, result.resetMs - Date.now())
    });
    return false;
  }
  return true;
}

module.exports = {
  checkRateLimit,
  createRateLimiter,
  checkSocketRateLimit,
};
