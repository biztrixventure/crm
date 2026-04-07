-- ===========================================
-- BizTrixVenture CRM - Migration #7
-- Migrate Legacy Outcomes to Closer Records
-- ===========================================
-- Purpose: Consolidate legacy outcomes into new closer_records table
-- This ensures managers can see all team records in one place
-- Outcomes table kept for audit trail only (marked deprecated)

-- Copy all outcomes data to closer_records with required fields
INSERT INTO closer_records (
  transfer_id, closer_id, company_id, customer_phone, customer_name,
  vin, reference_no, fronter_name, record_date,
  disposition_id, remarks, status, created_at, updated_at
)
SELECT
  transfer_id,
  closer_id,
  company_id,
  customer_phone,
  customer_name,
  'N/A'::text as vin,                    -- outcomes doesn't have VIN, default to N/A
  COALESCE(reference_no, 'LEGACY-' || ROW_NUMBER() OVER (ORDER BY created_at))::text as reference_no,
  'Legacy Import'::text as fronter_name,  -- outcomes doesn't have fronter info
  CURRENT_DATE as record_date,            -- use today's date for legacy records
  disposition_id,
  remarks,
  'SOLD'::text as status,                -- outcomes are completed sales
  created_at,
  NOW()::timestamptz as updated_at
FROM outcomes o
WHERE NOT EXISTS (
  SELECT 1 FROM closer_records cr
  WHERE cr.transfer_id = o.transfer_id
  AND cr.closer_id = o.closer_id
  AND cr.created_at = o.created_at
);

-- Mark outcomes table as deprecated
COMMENT ON TABLE outcomes IS 'DEPRECATED: Legacy outcomes table. New sales records go to closer_records table. Kept for audit trail and historical reference only.';

-- Done - closer_records is now the single source of truth for all sales data
