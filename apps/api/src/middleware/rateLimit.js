import rateLimit from 'express-rate-limit';

// Auth rate limiter - 10 attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter - 100 requests per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Please slow down',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search rate limiter - 30 requests per minute
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    error: 'Too many search requests',
    message: 'Please wait before searching again',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default { authLimiter, apiLimiter, searchLimiter };
