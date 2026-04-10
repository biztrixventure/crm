-- ===========================================
-- BizTrixVenture CRM - Database Schema
-- Version: 1.0 (MVP)
-- Run this in Supabase SQL Editor
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TABLES
-- ===========================================

-- Companies table
CREATE TABLE companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  display_name  text NOT NULL,
  logo_url      text,
  slug          text UNIQUE NOT NULL,
  is_active     boolean DEFAULT true,
  feature_flags jsonb DEFAULT '{"number_search": false, "allow_edit": false, "allow_export": false, "custom_dispositions": false}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  created_by    uuid
);

-- Users table
CREATE TABLE users (
  id           uuid PRIMARY KEY,
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         text NOT NULL CHECK (role IN ('super_admin', 'readonly_admin', 'company_admin', 'closer', 'fronter')),
  company_id   uuid REFERENCES companies(id) ON DELETE SET NULL,
  totp_secret  text,
  totp_enabled boolean DEFAULT false,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  created_by   uuid REFERENCES users(id)
);

-- Add foreign key for companies.created_by after users table exists
ALTER TABLE companies ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- Dispositions table
CREATE TABLE dispositions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  is_default  boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Transfers table
CREATE TABLE transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) NOT NULL,
  fronter_id      uuid REFERENCES users(id) NOT NULL,
  closer_id       uuid REFERENCES users(id) NOT NULL,
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  car_make        text,
  car_model       text,
  car_year        text,
  zip_code        text,
  city            text,
  state           text,
  miles           text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  updated_by      uuid REFERENCES users(id)
);

-- Outcomes table
CREATE TABLE outcomes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     uuid REFERENCES transfers(id),
  closer_id       uuid REFERENCES users(id) NOT NULL,
  company_id      uuid REFERENCES companies(id) NOT NULL,
  customer_phone  text NOT NULL,
  customer_name   text NOT NULL,
  disposition_id  uuid REFERENCES dispositions(id) NOT NULL,
  remarks         text,
  created_at      timestamptz DEFAULT now()
);

-- Callbacks table
CREATE TABLE callbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid REFERENCES users(id) NOT NULL,
  company_id      uuid REFERENCES companies(id),
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  best_time       timestamptz NOT NULL,
  notes           text,
  is_fired        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Number lists table
CREATE TABLE number_lists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) NOT NULL,
  uploaded_by     uuid REFERENCES users(id) NOT NULL,
  file_name       text,
  total_numbers   integer,
  created_at      timestamptz DEFAULT now()
);

-- Assigned numbers table
CREATE TABLE assigned_numbers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid REFERENCES number_lists(id) ON DELETE CASCADE NOT NULL,
  company_id    uuid REFERENCES companies(id) NOT NULL,
  fronter_id    uuid REFERENCES users(id),
  phone_number  text NOT NULL,
  row_order     integer,
  created_at    timestamptz DEFAULT now()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  event        text NOT NULL CHECK (event IN ('login_success', 'login_failed', 'logout', '2fa_setup', 'totp_verify_failed', 'password_reset', 'number_assignment')),
  ip_address   text,
  user_agent   text,
  device_info  jsonb,
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Users indexes
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Transfers indexes
CREATE INDEX idx_transfers_company_id ON transfers(company_id);
CREATE INDEX idx_transfers_fronter_id ON transfers(fronter_id);
CREATE INDEX idx_transfers_closer_id ON transfers(closer_id);
CREATE INDEX idx_transfers_created_at ON transfers(created_at DESC);
CREATE INDEX idx_transfers_customer_phone ON transfers(customer_phone);

-- Outcomes indexes
CREATE INDEX idx_outcomes_company_id ON outcomes(company_id);
CREATE INDEX idx_outcomes_closer_id ON outcomes(closer_id);
CREATE INDEX idx_outcomes_transfer_id ON outcomes(transfer_id);
CREATE INDEX idx_outcomes_customer_phone ON outcomes(customer_phone);
CREATE INDEX idx_outcomes_created_at ON outcomes(created_at DESC);
CREATE INDEX idx_outcomes_disposition_id ON outcomes(disposition_id);

-- Callbacks indexes
CREATE INDEX idx_callbacks_created_by ON callbacks(created_by);
CREATE INDEX idx_callbacks_company_id ON callbacks(company_id);
CREATE INDEX idx_callbacks_best_time ON callbacks(best_time);
CREATE INDEX idx_callbacks_is_fired ON callbacks(is_fired) WHERE is_fired = false;

-- Assigned numbers indexes
CREATE INDEX idx_assigned_numbers_list_id ON assigned_numbers(list_id);
CREATE INDEX idx_assigned_numbers_fronter_id ON assigned_numbers(fronter_id);
CREATE INDEX idx_assigned_numbers_company_id ON assigned_numbers(company_id);
CREATE INDEX idx_assigned_numbers_phone ON assigned_numbers(phone_number);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE number_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies are bypassed by the service role key.
-- All authorization logic is enforced in the API layer.
-- RLS serves as a secondary security layer.

-- ===========================================
-- SEED DATA
-- ===========================================

-- Seed default dispositions
INSERT INTO dispositions (label, is_default, is_active) VALUES
  ('Sale Made', true, true),
  ('No Answer', true, true),
  ('Callback', true, true),
  ('Not Interested', true, true),
  ('Wrong Number', true, true),
  ('Do Not Call', true, true);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for transfers updated_at
CREATE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- STORAGE BUCKET (run in Supabase Dashboard)
-- ===========================================
-- Create a bucket named 'company-logos' in Supabase Storage
-- Enable public access for reading logos
-- ===========================================
-- BizTrixVenture CRM - Migration #2
-- Add Plans and Clients Tables
-- ===========================================

-- Plans table (global plans managed by super admin)
CREATE TABLE plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Clients table (global clients managed by super admin)
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_plans_is_active ON plans(is_active);
CREATE INDEX idx_plans_created_by ON plans(created_by);

CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_created_by ON clients(created_by);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
-- RLS disabled: API uses service role key which bypasses RLS anyway

-- ===========================================
-- SEED DATA
-- ===========================================

-- Seed default plans
INSERT INTO plans (name, is_active) VALUES
  ('Signature', true),
  ('Gold', true),
  ('Platinum', true),
  ('Silver', true);

-- Seed default clients  
INSERT INTO clients (name, is_active) VALUES
  ('Jim', true),
  ('Default Client', true);
-- ===========================================
-- Disable RLS on API tables
-- ===========================================
-- These tables are accessed via backend API with service role key,
-- RLS is not needed and prevents API access

ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispositions DISABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
-- ===========================================
-- BizTrixVenture CRM - Migration #4
-- Remove Search Functionality Tables
-- ===========================================

-- Drop search_field_config table and all related objects
DROP INDEX IF EXISTS idx_search_field_config_scope;
DROP INDEX IF EXISTS idx_search_field_config_role;
DROP INDEX IF EXISTS idx_search_field_config_scope_role;
DROP TABLE IF EXISTS search_field_config CASCADE;

-- Drop dialer_config table and all related objects
DROP INDEX IF EXISTS idx_dialer_config_active;
DROP TABLE IF EXISTS dialer_config CASCADE;-- ===========================================
-- BizTrixVenture CRM - Migration #5
-- Add 4 New Internal Roles & Related Tables
-- ===========================================

-- ====== 1. Update users.role constraint to add new roles ======

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin',
    'readonly_admin',
    'company_admin',
    'closer',
    'fronter',
    'closer_manager',
    'operations_manager',
    'compliance_manager',
    'compliance_agent'
  ));

-- ====== 2. Create closer_records table (if not exists) ======
-- This table stores detailed closer record forms submitted after sales

CREATE TABLE IF NOT EXISTS closer_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id       uuid REFERENCES transfers(id),
  closer_id         uuid REFERENCES users(id) NOT NULL,
  company_id        uuid REFERENCES companies(id) NOT NULL,
  customer_phone    text NOT NULL,
  customer_name     text NOT NULL,
  car_make          text,
  car_model         text,
  car_year          text,
  miles             text,
  vin               text NOT NULL,
  email             text,
  address           text,
  dob               text,
  gender            text,
  plan_id           uuid REFERENCES plans(id),
  client_id         uuid REFERENCES clients(id),
  down_payment      numeric,
  monthly_payment   numeric,
  reference_no      text NOT NULL,
  next_payment_note text,
  fronter_name      text NOT NULL,
  record_date       date NOT NULL,
  status            text DEFAULT 'SOLD' CHECK (status IN ('SOLD', 'PENDING', 'CANCELLED')),
  vicidial_lead_id  text,
  disposition_id    uuid REFERENCES dispositions(id),
  remarks           text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  updated_by        uuid REFERENCES users(id)
);

-- ====== 3. Create compliance_batches table ======

CREATE TABLE compliance_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid REFERENCES companies(id) NOT NULL,
  date_from         date NOT NULL,
  date_to           date NOT NULL,
  created_by        uuid REFERENCES users(id) NOT NULL,   -- compliance manager
  assigned_to       uuid REFERENCES users(id),            -- compliance agent
  status            text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  total_records     integer DEFAULT 0,
  reviewed_records  integer DEFAULT 0,
  flagged_records   integer DEFAULT 0,
  approved_records  integer DEFAULT 0,
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ====== 4. Create compliance_reviews table ======

CREATE TABLE compliance_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          uuid REFERENCES compliance_batches(id) NOT NULL,
  closer_record_id  uuid REFERENCES closer_records(id) NOT NULL,
  reviewed_by       uuid REFERENCES users(id) NOT NULL,   -- agent or manager
  status            text NOT NULL CHECK (status IN ('approved', 'issue_found', 'pending')),
  flag_reason       text CHECK (flag_reason IN (
    'Wrong VIN',
    'Wrong Reference No',
    'Wrong Plan',
    'Missing Info',
    'Duplicate',
    'Other'
  )),
  flag_notes        text,
  reviewed_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(batch_id, closer_record_id)
);

-- ====== 5. Create compliance_company_assignments table ======

CREATE TABLE compliance_company_assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_manager_id uuid REFERENCES users(id) NOT NULL,
  company_id            uuid REFERENCES companies(id) NOT NULL,
  assigned_by           uuid REFERENCES users(id) NOT NULL,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(compliance_manager_id, company_id)
);

-- ====== 6. Create dnc_list table ======

CREATE TABLE dnc_list (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number          text NOT NULL UNIQUE,               -- E.164 format
  reason                text,
  notes                 text,
  added_by              uuid REFERENCES users(id) NOT NULL,
  removed_by            uuid REFERENCES users(id),
  removed_at            timestamptz,
  is_active             boolean DEFAULT true,
  vicidial_sync_pending boolean DEFAULT true,               -- for future ViciDial DNC sync
  created_at            timestamptz DEFAULT now()
);

-- ====== 7. Create closer_performance_cache table ======

CREATE TABLE closer_performance_cache (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id         uuid REFERENCES users(id) NOT NULL,
  period            text NOT NULL CHECK (period IN ('today', 'yesterday', 'this_week', 'this_month')),
  total_transfers   integer DEFAULT 0,
  total_sales       integer DEFAULT 0,
  callbacks_pending integer DEFAULT 0,
  dispositions      jsonb DEFAULT '{}',                     -- { "SALE": 5, "NI": 3, "CB": 2 }
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(closer_id, period)
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Closer records indexes
CREATE INDEX IF NOT EXISTS idx_closer_records_closer_id ON closer_records(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_company_id ON closer_records(company_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_transfer_id ON closer_records(transfer_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_record_date ON closer_records(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_closer_records_customer_phone ON closer_records(customer_phone);
CREATE INDEX IF NOT EXISTS idx_closer_records_created_at ON closer_records(created_at DESC);

-- Compliance batches indexes
CREATE INDEX IF NOT EXISTS idx_compliance_batches_company_id ON compliance_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_batches_created_by ON compliance_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_compliance_batches_assigned_to ON compliance_batches(assigned_to);
CREATE INDEX IF NOT EXISTS idx_compliance_batches_status ON compliance_batches(status);

-- Compliance reviews indexes
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_batch_id ON compliance_reviews(batch_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_closer_record_id ON compliance_reviews(closer_record_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_reviewed_by ON compliance_reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_status ON compliance_reviews(status);

-- Compliance company assignments indexes
CREATE INDEX IF NOT EXISTS idx_compliance_company_assignments_manager_id ON compliance_company_assignments(compliance_manager_id);
CREATE INDEX IF NOT EXISTS idx_compliance_company_assignments_company_id ON compliance_company_assignments(company_id);

-- DNC list indexes
CREATE INDEX IF NOT EXISTS idx_dnc_list_phone ON dnc_list(phone_number);
CREATE INDEX IF NOT EXISTS idx_dnc_list_is_active ON dnc_list(is_active);
CREATE INDEX IF NOT EXISTS idx_dnc_list_added_by ON dnc_list(added_by);

-- Closer performance cache indexes
CREATE INDEX IF NOT EXISTS idx_closer_performance_cache_closer_id ON closer_performance_cache(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_performance_cache_period ON closer_performance_cache(period);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
-- RLS disabled: API uses service role key which bypasses RLS anyway

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Trigger for closer_records updated_at
CREATE OR REPLACE FUNCTION update_closer_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_closer_records_updated_at ON closer_records;
CREATE TRIGGER update_closer_records_updated_at
  BEFORE UPDATE ON closer_records
  FOR EACH ROW
  EXECUTE FUNCTION update_closer_records_updated_at();

-- Trigger for compliance_batches updated_at
CREATE OR REPLACE FUNCTION update_compliance_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_compliance_batches_updated_at ON compliance_batches;
CREATE TRIGGER update_compliance_batches_updated_at
  BEFORE UPDATE ON compliance_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_batches_updated_at();
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
-- ===========================================
-- BizTrixVenture CRM - Migration #7
-- Migrate Legacy Outcomes to Closer Records
-- ===========================================
-- Purpose: Consolidate legacy outcomes into new closer_records table
-- This ensures managers can see all team records in one place
-- Outcomes table kept for audit trail only (marked deprecated)

-- Helper function to update updated_at (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create closer_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS closer_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id       uuid REFERENCES transfers(id),
  closer_id         uuid REFERENCES users(id) NOT NULL,
  company_id        uuid REFERENCES companies(id) NOT NULL,
  customer_phone    text NOT NULL,
  customer_name     text NOT NULL,
  customer_email    text,
  vin               text,
  reference_no      text,
  fronter_name      text,
  record_date       date,
  disposition_id    uuid REFERENCES dispositions(id),
  remarks           text,
  status            text DEFAULT 'PENDING',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_closer_records_company_id ON closer_records(company_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_closer_id ON closer_records(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_transfer_id ON closer_records(transfer_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_customer_phone ON closer_records(customer_phone);
CREATE INDEX IF NOT EXISTS idx_closer_records_disposition_id ON closer_records(disposition_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_created_at ON closer_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_closer_records_record_date ON closer_records(record_date DESC);

-- Enable RLS if not already enabled
ALTER TABLE closer_records ENABLE ROW LEVEL SECURITY;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_closer_records_updated_at ON closer_records;
CREATE TRIGGER update_closer_records_updated_at
  BEFORE UPDATE ON closer_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Copy all outcomes data to closer_records with required fields
INSERT INTO closer_records (
  transfer_id, closer_id, company_id, customer_phone, customer_name,
  vin, reference_no, fronter_name, record_date,
  disposition_id, remarks, status, created_at, updated_at
)
SELECT
  o.transfer_id,
  o.closer_id,
  o.company_id,
  o.customer_phone,
  o.customer_name,
  'N/A'::text as vin,                    -- outcomes doesn't have VIN, default to N/A
  'LEGACY-' || ROW_NUMBER() OVER (ORDER BY o.created_at)::text as reference_no,  -- generate reference from outcomes
  'Legacy Import'::text as fronter_name,  -- outcomes doesn't have fronter info
  CURRENT_DATE as record_date,            -- use today's date for legacy records
  o.disposition_id,
  o.remarks,
  'SOLD'::text as status,                -- outcomes are completed sales
  o.created_at,
  NOW()::timestamptz as updated_at
FROM outcomes o
WHERE NOT EXISTS (
  SELECT 1 FROM closer_records cr
  WHERE cr.transfer_id = o.transfer_id
  AND cr.closer_id = o.closer_id
  AND cr.created_at = o.created_at
)
ON CONFLICT DO NOTHING;

-- Mark outcomes table as deprecated
COMMENT ON TABLE outcomes IS 'DEPRECATED: Legacy outcomes table. New sales records go to closer_records table. Kept for audit trail and historical reference only.';

-- Done - closer_records is now the single source of truth for all sales data
-- ===========================================
-- BizTrixVenture CRM - Migration #8
-- Create Closer Records Table
-- ===========================================
-- Purpose: Create the main table for tracking closer sales records
-- This replaces the legacy outcomes table for new data

-- Create closer_records table
CREATE TABLE IF NOT EXISTS closer_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id       uuid REFERENCES transfers(id),
  closer_id         uuid REFERENCES users(id) NOT NULL,
  company_id        uuid REFERENCES companies(id) NOT NULL,
  customer_phone    text NOT NULL,
  customer_name     text NOT NULL,
  customer_email    text,
  vin               text,
  reference_no      text,
  fronter_name      text,
  record_date       date,
  disposition_id    uuid REFERENCES dispositions(id),
  remarks           text,
  status            text DEFAULT 'PENDING',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_closer_records_company_id ON closer_records(company_id);
CREATE INDEX idx_closer_records_closer_id ON closer_records(closer_id);
CREATE INDEX idx_closer_records_transfer_id ON closer_records(transfer_id);
CREATE INDEX idx_closer_records_customer_phone ON closer_records(customer_phone);
CREATE INDEX idx_closer_records_disposition_id ON closer_records(disposition_id);
CREATE INDEX idx_closer_records_created_at ON closer_records(created_at DESC);
CREATE INDEX idx_closer_records_record_date ON closer_records(record_date DESC);

-- Enable RLS
ALTER TABLE closer_records ENABLE ROW LEVEL SECURITY;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_closer_records_updated_at
  BEFORE UPDATE ON closer_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Done - closer_records table is ready for data migration
-- ===========================================
-- BizTrixVenture CRM - Migration #9
-- Create Notifications Table
-- ===========================================
-- Purpose: Create persistent notifications table for real-time alerts
-- Stores all notifications with 30-day retention
-- Supports role-specific and real-time notification delivery

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id        uuid REFERENCES companies(id),
  role              text NOT NULL,
  type              text NOT NULL, -- transfer:new, callback:reminder, sale:made, batch:assigned, etc.
  title             text NOT NULL,
  message           text NOT NULL,
  metadata          jsonb DEFAULT '{}', -- store arbitrary data: {transferId, closerId, batchId, etc}
  is_read           boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  expires_at        timestamptz DEFAULT (now() + '30 days'::interval),
  browser_notified  boolean DEFAULT false,
  updated_at        timestamptz DEFAULT now()
);

-- Create indexes for optimal query performance
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_expires ON notifications(expires_at);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own notifications
DROP POLICY IF EXISTS notifications_own ON notifications;
CREATE POLICY notifications_own ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_own ON notifications;
CREATE POLICY notifications_insert_own ON notifications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON notifications;
CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Cleanup Job: Mark old notifications as expired (optional, can be manual)
-- Note: pg_cron may not be available in all Supabase projects
-- Alternative: Implement cleanup API endpoint that can be called periodically
-- To enable auto-cleanup, uncomment the line below if pg_cron is available:
-- SELECT cron.schedule('cleanup-expired-notifications', '0 2 * * *', $$
--   DELETE FROM notifications WHERE expires_at < now();
-- $$);

-- For manual/scheduled cleanup, use this query:
-- DELETE FROM notifications WHERE expires_at < now();

-- Done - notifications table is ready
