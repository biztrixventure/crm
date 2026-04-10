-- ===========================================
-- Migration: Simplify to Single Admin Role
-- Removes TOTP fields and updates role constraint
-- ===========================================

-- 1. Drop TOTP-related columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled;

-- 2. Update role constraint to only allow super_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin'));

-- 3. Update any existing users to super_admin role (data migration)
UPDATE users SET role = 'super_admin' WHERE role IS NOT NULL;
