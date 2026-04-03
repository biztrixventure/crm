// Role guard middleware
// Usage: roleGuard('super_admin', 'readonly_admin')

export function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

// Check if user has a specific feature flag enabled
export function featureGuard(flagKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Super admin always has access
    if (req.user.role === 'super_admin') {
      return next();
    }

    const flags = req.user.featureFlags || {};
    if (!flags[flagKey]) {
      return res.status(403).json({ 
        error: 'Feature not available',
        message: `The "${flagKey}" feature is not enabled for your company`,
      });
    }

    next();
  };
}

// Company isolation guard - ensures user can only access their company's data
export function companyGuard(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Super admin and readonly admin can access all companies
  if (['super_admin', 'readonly_admin'].includes(req.user.role)) {
    return next();
  }

  // Company-scoped users must have a company_id
  if (!req.user.companyId) {
    return res.status(403).json({ 
      error: 'No company assigned',
      message: 'Your account is not associated with any company',
    });
  }

  next();
}

export default { roleGuard, featureGuard, companyGuard };
