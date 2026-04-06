-- ===========================================
-- BizTrixVenture CRM - Migration #5
-- Add 4 New Roles: Closer Manager, Operations Manager, 
-- Compliance Manager, Compliance Agent
-- ===========================================

-- ===========================================
-- 1. UPDATE users.role CONSTRAINT
-- ===========================================

-- Drop existing constraint and add new one with additional roles
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

-- ===========================================
-- 2. NEW TABLE: compliance_batches
-- ===========================================

CREATE TABLE compliance_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid REFERENCES companies(id),
  date_from           date NOT NULL,
  date_to             date NOT NULL,
  created_by          uuid REFERENCES users(id) NOT NULL,
  assigned_to         uuid REFERENCES users(id),
  status              text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  total_records       integer DEFAULT 0,
  reviewed_records    integer DEFAULT 0,
  flagged_records     integer DEFAULT 0,
  approved_records    integer DEFAULT 0,
  completed_at        timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Indexes for compliance_batches
CREATE INDEX idx_compliance_batches_company_id ON compliance_batches(company_id);
CREATE INDEX idx_compliance_batches_created_by ON compliance_batches(created_by);
CREATE INDEX idx_compliance_batches_assigned_to ON compliance_batches(assigned_to);
CREATE INDEX idx_compliance_batches_status ON compliance_batches(status);
CREATE INDEX idx_compliance_batches_created_at ON compliance_batches(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_compliance_batches_updated_at
  BEFORE UPDATE ON compliance_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 3. NEW TABLE: compliance_reviews
-- ===========================================

CREATE TABLE compliance_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            uuid REFERENCES compliance_batches(id) ON DELETE CASCADE NOT NULL,
  outcome_id          uuid REFERENCES outcomes(id) ON DELETE CASCADE NOT NULL,
  reviewed_by         uuid REFERENCES users(id),
  status              text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'issue_found')),
  flag_reason         text CHECK (flag_reason IS NULL OR flag_reason IN (
    'Wrong VIN',
    'Wrong Reference No',
    'Wrong Plan',
    'Missing Info',
    'Duplicate',
    'Other'
  )),
  flag_notes          text,
  reviewed_at         timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- Indexes for compliance_reviews
CREATE INDEX idx_compliance_reviews_batch_id ON compliance_reviews(batch_id);
CREATE INDEX idx_compliance_reviews_outcome_id ON compliance_reviews(outcome_id);
CREATE INDEX idx_compliance_reviews_reviewed_by ON compliance_reviews(reviewed_by);
CREATE INDEX idx_compliance_reviews_status ON compliance_reviews(status);

-- ===========================================
-- 4. NEW TABLE: compliance_company_assignments
-- ===========================================

CREATE TABLE compliance_company_assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_manager_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  company_id            uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  assigned_by           uuid REFERENCES users(id) NOT NULL,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(compliance_manager_id, company_id)
);

-- Indexes for compliance_company_assignments
CREATE INDEX idx_compliance_company_assignments_manager ON compliance_company_assignments(compliance_manager_id);
CREATE INDEX idx_compliance_company_assignments_company ON compliance_company_assignments(company_id);

-- ===========================================
-- 5. NEW TABLE: dnc_list
-- ===========================================

CREATE TABLE dnc_list (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number          text NOT NULL,
  reason                text,
  notes                 text,
  added_by              uuid REFERENCES users(id) NOT NULL,
  removed_by            uuid REFERENCES users(id),
  removed_at            timestamptz,
  is_active             boolean DEFAULT true,
  vicidial_sync_pending boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

-- Unique constraint only on active DNC entries
CREATE UNIQUE INDEX idx_dnc_list_phone_active ON dnc_list(phone_number) WHERE is_active = true;

-- Indexes for dnc_list
CREATE INDEX idx_dnc_list_phone_number ON dnc_list(phone_number);
CREATE INDEX idx_dnc_list_is_active ON dnc_list(is_active);
CREATE INDEX idx_dnc_list_added_by ON dnc_list(added_by);
CREATE INDEX idx_dnc_list_created_at ON dnc_list(created_at DESC);

-- ===========================================
-- 6. NEW TABLE: closer_performance_cache
-- ===========================================

CREATE TABLE closer_performance_cache (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id         uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  period            text NOT NULL CHECK (period IN ('today', 'yesterday', 'this_week', 'this_month')),
  total_transfers   integer DEFAULT 0,
  total_sales       integer DEFAULT 0,
  callbacks_pending integer DEFAULT 0,
  dispositions      jsonb DEFAULT '{}',
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(closer_id, period)
);

-- Indexes for closer_performance_cache
CREATE INDEX idx_closer_performance_cache_closer_id ON closer_performance_cache(closer_id);
CREATE INDEX idx_closer_performance_cache_period ON closer_performance_cache(period);
CREATE INDEX idx_closer_performance_cache_updated_at ON closer_performance_cache(updated_at);

-- ===========================================
-- 7. DISABLE RLS FOR NEW TABLES
-- ===========================================
-- API uses service role key which bypasses RLS anyway

ALTER TABLE compliance_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_company_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE closer_performance_cache DISABLE ROW LEVEL SECURITY;

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================
