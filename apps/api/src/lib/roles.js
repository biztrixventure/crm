/**
 * Role constants and utilities for permission checking
 */

export const ROLE_TYPES = {
  // BizTrix internal roles - full system access
  SUPER_ADMIN: 'super_admin',
  READONLY_ADMIN: 'readonly_admin',

  // Closer management
  CLOSER_MANAGER: 'closer_manager',
  CLOSER: 'closer',
  FRONTER: 'fronter',

  // Company roles
  COMPANY_ADMIN: 'company_admin',

  // Compliance roles
  COMPLIANCE_MANAGER: 'compliance_manager',
  COMPLIANCE_AGENT: 'compliance_agent',
};

/**
 * Roles that have company-wide scope (not system-wide)
 */
export const COMPANY_SCOPED_ROLES = [
  ROLE_TYPES.COMPANY_ADMIN,
  ROLE_TYPES.FRONTER,
];

/**
 * Roles that have system-wide scope (BizTrix internal)
 */
export const BIZTRIX_INTERNAL_ROLES = [
  ROLE_TYPES.SUPER_ADMIN,
  ROLE_TYPES.READONLY_ADMIN,
  ROLE_TYPES.CLOSER_MANAGER,
  ROLE_TYPES.COMPLIANCE_MANAGER,
];

/**
 * Super admin roles with full system access
 */
export const ADMIN_ROLES = [
  ROLE_TYPES.SUPER_ADMIN,
  ROLE_TYPES.READONLY_ADMIN,
];

/**
 * Compliance-related roles
 */
export const COMPLIANCE_ROLES = [
  ROLE_TYPES.COMPLIANCE_MANAGER,
  ROLE_TYPES.COMPLIANCE_AGENT,
];

/**
 * Check if a role is company-scoped
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function isCompanyScopedRole(role) {
  return COMPANY_SCOPED_ROLES.includes(role);
}

/**
 * Check if a role is BizTrix internal
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function isBizTrixInternalRole(role) {
  return BIZTRIX_INTERNAL_ROLES.includes(role);
}

/**
 * Check if a role is an admin role
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

/**
 * Check if a role is compliance-related
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role);
}
