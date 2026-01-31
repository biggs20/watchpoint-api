// Custom error class for API errors
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error types
const ErrorTypes = {
  BAD_REQUEST: (message = 'Bad request') => new APIError(message, 400, 'BAD_REQUEST'),
  UNAUTHORIZED: (message = 'Unauthorized') => new APIError(message, 401, 'UNAUTHORIZED'),
  FORBIDDEN: (message = 'Forbidden') => new APIError(message, 403, 'FORBIDDEN'),
  NOT_FOUND: (message = 'Resource not found') => new APIError(message, 404, 'NOT_FOUND'),
  CONFLICT: (message = 'Conflict') => new APIError(message, 409, 'CONFLICT'),
  VALIDATION_ERROR: (message = 'Validation error') => new APIError(message, 422, 'VALIDATION_ERROR'),
  RATE_LIMITED: (message = 'Too many requests') => new APIError(message, 429, 'RATE_LIMITED'),
  INTERNAL_ERROR: (message = 'Internal server error') => new APIError(message, 500, 'INTERNAL_ERROR'),
  SERVICE_UNAVAILABLE: (message = 'Service unavailable') => new APIError(message, 503, 'SERVICE_UNAVAILABLE'),
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Handle known operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Handle Postgres errors
  if (err.code && err.code.startsWith('23')) {
    // Postgres constraint violations
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists.',
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced record does not exist.',
      });
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired.',
    });
  }

  // Handle validation errors (e.g., from express-validator)
  if (err.array && typeof err.array === 'function') {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: err.array(),
    });
  }

  // Default to 500 Internal Server Error
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  APIError,
  ErrorTypes,
  errorHandler,
  asyncHandler,
};
