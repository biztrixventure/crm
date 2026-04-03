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
