-- ===========================================
-- BizTrixVenture CRM - Dialer Configuration
-- Migration 004: Add dialer_config table for client-side ViciDial
-- ===========================================

-- Dialer configuration table (single row for global settings)
CREATE TABLE IF NOT EXISTS dialer_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialer_url    text NOT NULL,
  api_user      text NOT NULL,
  api_pass      text NOT NULL,
  api_path      text DEFAULT '/vicidial/non_agent_api.php',
  is_active     boolean DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES users(id)
);

-- Insert pre-configured row with wavetechnew.i5.tel
INSERT INTO dialer_config (dialer_url, api_user, api_pass, api_path, is_active)
VALUES ('http://wavetechnew.i5.tel', 'apiuser', 'apiuser123', '/vicidial/non_agent_api.php', true);

-- Enable RLS (then disable for service role access)
ALTER TABLE dialer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialer_config DISABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_dialer_config_active ON dialer_config(is_active);
