const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

// Stricter limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/register attempts per hour
  message: {
    error: 'Too Many Auth Attempts',
    message: 'Too many authentication attempts. Please try again in an hour.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow 60 webhook calls per minute
  message: {
    error: 'Rate Limited',
    message: 'Webhook rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user rate limiter (requires auth middleware to run first)
const createUserLimiter = (maxRequests = 50, windowMinutes = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => req.user?.id || req.ip, // Use user ID if authenticated
    message: {
      error: 'User Rate Limited',
      message: `You have exceeded ${maxRequests} requests in ${windowMinutes} minutes.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  apiLimiter,
  authLimiter,
  webhookLimiter,
  createUserLimiter,
};
