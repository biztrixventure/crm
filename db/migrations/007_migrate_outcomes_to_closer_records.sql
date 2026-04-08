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
