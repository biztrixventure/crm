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
