/**
 * Extracts and validates pagination parameters from query object
 * @param {Object} query - Query object from request
 * @param {number} defaultLimit - Default limit per page (default: 100)
 * @param {number} maxLimit - Maximum allowed limit (default: 500)
 * @returns {Object} Validated {limit, offset}
 */
export function getPagination(query, defaultLimit = 100, maxLimit = 500) {
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit
  );
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

/**
 * Calculates pagination metadata for responses
 * @param {number} offset - Current offset
 * @param {number} limit - Current limit
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
export function getPaginationMeta(offset, limit, total) {
  return {
    offset,
    limit,
    total,
    hasMore: offset + limit < total,
    pages: Math.ceil(total / limit),
    currentPage: Math.floor(offset / limit) + 1,
  };
}
