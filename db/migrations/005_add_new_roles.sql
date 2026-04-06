-- ===========================================
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
