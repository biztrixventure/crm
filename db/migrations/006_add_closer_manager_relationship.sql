-- ===========================================
-- BizTrixVenture CRM - Migration #6
-- Add Closer Manager to Closer Relationship
-- ===========================================

-- ====== 1. Add managed_by field to users table ======
-- This tracks which closer_manager supervises each closer

ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- ====== 2. Add index for performance ======

CREATE INDEX IF NOT EXISTS idx_users_managed_by ON users(managed_by);

-- ====== 3. Add constraint to ensure only closers can be managed ======
-- (managed_by can only be set for 'closer' role users, and must reference a 'closer_manager')
-- Note: Constraint logic is enforced at application level since we can't easily query role in CHECK constraints

-- Done
