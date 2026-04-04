-- ===========================================
-- BizTrixVenture CRM - Migration #2
-- Add Plans, Clients, and Search Field Config Tables
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

-- Search field configuration (controls field visibility in search results)
CREATE TABLE search_field_config (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      text NOT NULL,    -- 'global' | company_id uuid as text
  role       text NOT NULL,    -- 'closer' | 'company_admin' | 'super_admin'
  fields     jsonb NOT NULL,   -- { customer_name: true, dob: false, email: true, ... }
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(scope, role)
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_plans_is_active ON plans(is_active);
CREATE INDEX idx_plans_created_by ON plans(created_by);

CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_created_by ON clients(created_by);

CREATE INDEX idx_search_field_config_scope ON search_field_config(scope);
CREATE INDEX idx_search_field_config_role ON search_field_config(role);
CREATE INDEX idx_search_field_config_scope_role ON search_field_config(scope, role);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_field_config ENABLE ROW LEVEL SECURITY;

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

-- Seed default search field config
INSERT INTO search_field_config (scope, role, fields) VALUES
  ('global', 'closer', '{
    "customer_name": true,
    "customer_phone": true,
    "customer_email": true,
    "customer_address": true,
    "customer_dob": true,
    "customer_gender": true,
    "car_make": true,
    "car_model": true,
    "car_year": true,
    "car_miles": true,
    "car_vin": true,
    "plan": true,
    "client": true,
    "down_payment": true,
    "monthly_payment": true,
    "reference_no": true,
    "next_payment_note": true,
    "closer_name": true,
    "fronter_name": true,
    "company_name": true,
    "disposition_code": true
  }'::jsonb),
  ('global', 'company_admin', '{
    "customer_name": true,
    "customer_phone": true,
    "customer_email": true,
    "customer_address": true,
    "customer_dob": true,
    "customer_gender": true,
    "car_make": true,
    "car_model": true,
    "car_year": true,
    "car_miles": true,
    "car_vin": true,
    "plan": true,
    "client": true,
    "down_payment": true,
    "monthly_payment": true,
    "reference_no": true,
    "next_payment_note": true,
    "closer_name": true,
    "fronter_name": true,
    "company_name": false,
    "disposition_code": true
  }'::jsonb),
  ('global', 'super_admin', '{
    "customer_name": true,
    "customer_phone": true,
    "customer_email": true,
    "customer_address": true,
    "customer_dob": true,
    "customer_gender": true,
    "car_make": true,
    "car_model": true,
    "car_year": true,
    "car_miles": true,
    "car_vin": true,
    "plan": true,
    "client": true,
    "down_payment": true,
    "monthly_payment": true,
    "reference_no": true,
    "next_payment_note": true,
    "closer_name": true,
    "fronter_name": true,
    "company_name": true,
    "disposition_code": true
  }'::jsonb);
