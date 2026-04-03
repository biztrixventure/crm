// Zod validation middleware
// Usage: validate(schema) where schema is a Zod schema

export function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(422).json({
          error: 'Validation error',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      // Replace body with parsed/transformed data
      req.body = result.data;
      next();
    } catch (err) {
      console.error('Validation error:', err);
      return res.status(500).json({ error: 'Validation failed' });
    }
  };
}

// Validate query parameters
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        return res.status(422).json({
          error: 'Invalid query parameters',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      req.query = result.data;
      next();
    } catch (err) {
      console.error('Query validation error:', err);
      return res.status(500).json({ error: 'Validation failed' });
    }
  };
}

// Validate route parameters
export function validateParams(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        return res.status(422).json({
          error: 'Invalid parameters',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      req.params = result.data;
      next();
    } catch (err) {
      console.error('Params validation error:', err);
      return res.status(500).json({ error: 'Validation failed' });
    }
  };
}

export default { validate, validateQuery, validateParams };
