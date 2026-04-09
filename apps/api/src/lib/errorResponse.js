/**
 * Standardized error response factory
 * Provides consistent error response format across all endpoints
 */

export const ErrorResponse = {
  /**
   * Validation error with detailed field errors
   * @param {Array} details - Zod validation error details
   */
  validation: (details) => ({
    error: 'Validation failed',
    details: Array.isArray(details) ? details : [],
  }),

  /**
   * Resource not found error
   * @param {string} resource - Resource type (e.g., "User", "Transfer")
   */
  notFound: (resource = 'Resource') => ({
    error: `${resource} not found`,
    code: 'NOT_FOUND',
  }),

  /**
   * Unauthorized error (not authenticated)
   */
  unauthorized: () => ({
    error: 'Unauthorized',
    code: 'UNAUTHORIZED',
  }),

  /**
   * Forbidden error (authenticated but not permitted)
   * @param {string} reason - Why permission was denied (optional)
   */
  forbidden: (reason = '') => ({
    error: 'Forbidden',
    code: 'FORBIDDEN',
    ...(reason && { reason }),
  }),

  /**
   * Conflict error (resource already exists or state conflict)
   * @param {string} message - Specific conflict message
   */
  conflict: (message = 'Resource conflict') => ({
    error: message,
    code: 'CONFLICT',
  }),

  /**
   * Bad request error (malformed request)
   * @param {string} message - Error message
   */
  badRequest: (message = 'Bad request') => ({
    error: message,
    code: 'BAD_REQUEST',
  }),

  /**
   * Rate limit error
   * @param {number} retryAfter - Seconds to retry after
   */
  rateLimit: (retryAfter = 60) => ({
    error: 'Too many requests',
    code: 'RATE_LIMIT',
    retryAfter,
  }),

  /**
   * Server error (internal)
   * @param {string} message - Error message (don't expose internals in production)
   */
  serverError: (message = 'Internal server error') => ({
    error: message,
    code: 'INTERNAL_ERROR',
  }),

  /**
   * Service unavailable error
   */
  unavailable: (service = 'Service') => ({
    error: `${service} is temporarily unavailable`,
    code: 'SERVICE_UNAVAILABLE',
  }),

  /**
   * Generic error handler that infers type from HTTP status
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Custom message
   */
  byStatus: (statusCode, message) => {
    const status = statusCode;
    if (status === 400) return ErrorResponse.badRequest(message);
    if (status === 401) return ErrorResponse.unauthorized();
    if (status === 403) return ErrorResponse.forbidden(message);
    if (status === 404) return ErrorResponse.notFound(message);
    if (status === 409) return ErrorResponse.conflict(message);
    if (status === 429) return ErrorResponse.rateLimit();
    if (status === 503) return ErrorResponse.unavailable(message);
    return ErrorResponse.serverError(message);
  },
};

/**
 * Helper to send error response with proper status code
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
export function sendError(res, statusCode, message) {
  const errorBody = ErrorResponse.byStatus(statusCode, message);
  return res.status(statusCode).json(errorBody);
}
