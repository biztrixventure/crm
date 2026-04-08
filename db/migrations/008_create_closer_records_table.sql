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
