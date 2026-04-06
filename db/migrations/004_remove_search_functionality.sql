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
DROP TABLE IF EXISTS dialer_config CASCADE;