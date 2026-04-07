-- ========================================
-- TEST DATA: Phone Number Search System
-- ========================================
-- Run this AFTER migrations to populate test data

-- 1. Create test user accounts for testing
INSERT INTO users (id, email, full_name, role, company_id, password_hash, is_active)
VALUES
  -- Super Admin (BizTrix internal, no company)
  ('00000001-0000-0000-0000-000000000001'::uuid, 'admin@biztrix.local', 'Super Admin', 'super_admin', NULL, 'hashed_password', true),

  -- Company A (Fake Auto Insurance)
  ('10000001-0000-0000-0000-000000000001'::uuid, 'alice.company@test.local', 'Alice Jackson', 'company_admin', '20000001-0000-0000-0000-000000000001'::uuid, 'hashed_password', true),
  ('10000002-0000-0000-0000-000000000002'::uuid, 'bob.closer@test.local', 'Bob Smith', 'closer', '20000001-0000-0000-0000-000000000001'::uuid, 'hashed_password', true),
  ('10000003-0000-0000-0000-000000000003'::uuid, 'carol.fronter@test.local', 'Carol Davis', 'fronter', '20000001-0000-0000-0000-000000000001'::uuid, 'hashed_password', true),

  -- Company B (Premium Coverage Inc)
  ('20000001-0000-0000-0000-000000000001'::uuid, 'diana.company@test.local', 'Diana Wilson', 'company_admin', '20000002-0000-0000-0000-000000000002'::uuid, 'hashed_password', true),
  ('20000002-0000-0000-0000-000000000002'::uuid, 'evan.closer@test.local', 'Evan Johnson', 'closer', '20000002-0000-0000-0000-000000000002'::uuid, 'hashed_password', true),
  ('20000003-0000-0000-0000-000000000003'::uuid, 'fiona.fronter@test.local', 'Fiona Lee', 'fronter', '20000002-0000-0000-0000-000000000002'::uuid, 'hashed_password', true),

  -- BizTrix Internal Roles
  ('30000001-0000-0000-0000-000000000001'::uuid, 'georgia.closer-mgr@biztrix.local', 'Georgia Brown', 'closer_manager', NULL, 'hashed_password', true),
  ('30000002-0000-0000-0000-000000000002'::uuid, 'henry.ops@biztrix.local', 'Henry Martinez', 'operations_manager', NULL, 'hashed_password', true),
  ('30000003-0000-0000-0000-000000000003'::uuid, 'iris.compliance@biztrix.local', 'Iris Taylor', 'compliance_manager', NULL, 'hashed_password', true),
  ('30000004-0000-0000-0000-000000000004'::uuid, 'jack.compliance-agent@biztrix.local', 'Jack Anderson', 'compliance_agent', NULL, 'hashed_password', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Get disposition IDs for "Sold" status
-- Note: These should exist from migration 001. If not, insert them:
INSERT INTO dispositions (label, is_default, is_active)
VALUES
  ('Sold', true, true),
  ('Not Interested', false, true),
  ('Callback', false, true)
ON CONFLICT (label) DO NOTHING;

-- Get the disposition IDs (adjust if they have different IDs in your DB)
-- SELECT id FROM dispositions WHERE label = 'Sold'; -- Should be used below

-- 3. Create test transfers (pending sales - NOT SOLD)
INSERT INTO transfers (id, company_id, fronter_id, closer_id, customer_name, customer_phone, car_make, car_model, status, created_at)
VALUES
  -- Company A transfers
  ('40000001-0000-0000-0000-000000000001'::uuid, '20000001-0000-0000-0000-000000000001'::uuid, '10000003-0000-0000-0000-000000000003'::uuid, '10000002-0000-0000-0000-000000000002'::uuid, 'John Doe', '2025551234', 'Toyota', 'Civic', 'pending', now()),
  ('40000002-0000-0000-0000-000000000002'::uuid, '20000001-0000-0000-0000-000000000001'::uuid, '10000003-0000-0000-0000-000000000003'::uuid, '10000002-0000-0000-0000-000000000002'::uuid, 'Jane Smith', '5555678901', 'Honda', 'Accord', 'pending', now() - interval '2 days'),

  -- Company B transfers
  ('40000003-0000-0000-0000-000000000003'::uuid, '20000002-0000-0000-0000-000000000002'::uuid, '20000003-0000-0000-0000-000000000003'::uuid, '20000002-0000-0000-0000-000000000002'::uuid, 'Michael Brown', '7135551234', 'Ford', 'F-150', 'pending', now() - interval '1 day'),
  ('40000004-0000-0000-0000-000000000004'::uuid, '20000002-0000-0000-0000-000000000002'::uuid, '20000003-0000-0000-0000-000000000003'::uuid, '20000002-0000-0000-0000-000000000002'::uuid, 'Sarah Johnson', '8185551234', 'Chevy', 'Silverado', 'pending', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- 4. Create test closer records (completed sales)
INSERT INTO closer_records (
  id, transfer_id, closer_id, company_id, customer_phone, customer_name,
  car_make, car_model, vin, email, plan_id, reference_no, fronter_name,
  record_date, status, disposition_id, remarks, created_at
)
SELECT
  -- Company A - SOLD records
  '50000001-0000-0000-0000-000000000001'::uuid, '40000001-0000-0000-0000-000000000001'::uuid, '10000002-0000-0000-0000-000000000002'::uuid, '20000001-0000-0000-0000-000000000001'::uuid,
  '2025551234', 'John Doe', 'Toyota', 'Civic', '1YVDP11C955123456', 'john@example.com', NULL, 'REF-001',
  'Carol Davis', CURRENT_DATE, 'SOLD', d.id, 'Customer purchased premium plan', now()
FROM dispositions d WHERE d.label = 'Sold'
UNION ALL
SELECT
  -- Company A - NOT SOLD record
  '50000002-0000-0000-0000-000000000002'::uuid, '40000002-0000-0000-0000-000000000002'::uuid, '10000002-0000-0000-0000-000000000002'::uuid, '20000001-0000-0000-0000-000000000001'::uuid,
  '5555678901', 'Jane Smith', 'Honda', 'Accord', '1HGCV1F32AA123456', 'jane@example.com', NULL, 'REF-002',
  'Carol Davis', CURRENT_DATE - interval '1 day', 'PENDING', d.id, 'Waiting for callback', now() - interval '1 day'
FROM dispositions d WHERE d.label = 'Callback'
UNION ALL
SELECT
  -- Company B - SOLD record
  '50000003-0000-0000-0000-000000000003'::uuid, '40000003-0000-0000-0000-000000000003'::uuid, '20000002-0000-0000-0000-000000000002'::uuid, '20000002-0000-0000-0000-000000000002'::uuid,
  '7135551234', 'Michael Brown', 'Ford', 'F-150', '1FTFW1E84KFA12345', 'michael@example.com', NULL, 'REF-003',
  'Fiona Lee', CURRENT_DATE - interval '2 days', 'SOLD', d.id, 'Corporate fleet purchase', now() - interval '2 days'
FROM dispositions d WHERE d.label = 'Sold'
UNION ALL
SELECT
  -- Company B - NOT SOLD record (Not Interested)
  '50000004-0000-0000-0000-000000000004'::uuid, NULL, '20000002-0000-0000-0000-000000000002'::uuid, '20000002-0000-0000-0000-000000000002'::uuid,
  '8185551234', 'Sarah Johnson', 'Chevy', 'Silverado', '3G5DB03E14S123456', 'sarah@example.com', NULL, 'REF-004',
  'Fiona Lee', CURRENT_DATE - interval '3 days', 'PENDING', d.id, 'Not interested in coverage', now() - interval '3 days'
FROM dispositions d WHERE d.label = 'Not Interested'
ON CONFLICT (id, transfer_id, closer_id, company_id, customer_phone, customer_name, reference_no) DO NOTHING;

-- 5. Create compliance batch for testing
INSERT INTO compliance_batches (
  id, company_id, date_from, date_to, created_by, assigned_to, status,
  total_records, reviewed_records, flagged_records, approved_records, created_at
)
VALUES
  -- Batch assigned to compliance agent Jack Anderson
  ('60000001-0000-0000-0000-000000000001'::uuid, '20000001-0000-0000-0000-000000000001'::uuid,
   CURRENT_DATE - interval '7 days', CURRENT_DATE,
   '30000003-0000-0000-0000-000000000003'::uuid, '30000004-0000-0000-0000-000000000004'::uuid,
   'in_progress', 4, 2, 1, 1, now()),

  -- Unassigned batch
  ('60000002-0000-0000-0000-000000000002'::uuid, '20000002-0000-0000-0000-000000000002'::uuid,
   CURRENT_DATE - interval '7 days', CURRENT_DATE,
   '30000003-0000-0000-0000-000000000003'::uuid, NULL,
   'pending', 2, 0, 0, 0, now())
ON CONFLICT (id) DO NOTHING;

-- 6. Link closer records to compliance batch via reviews
INSERT INTO compliance_reviews (
  id, batch_id, closer_record_id, reviewed_by, status, flag_reason, reviewed_at, created_at
)
VALUES
  ('70000001-0000-0000-0000-000000000001'::uuid, '60000001-0000-0000-0000-000000000001'::uuid,
   '50000001-0000-0000-0000-000000000001'::uuid, '30000004-0000-0000-0000-000000000004'::uuid,
   'approved', NULL, now(), now()),

  ('70000002-0000-0000-0000-000000000002'::uuid, '60000001-0000-0000-0000-000000000001'::uuid,
   '50000002-0000-0000-0000-000000000002'::uuid, '30000004-0000-0000-0000-000000000004'::uuid,
   'issue_found', 'Wrong VIN', now(), now()),

  ('70000003-0000-0000-0000-000000000003'::uuid, '60000001-0000-0000-0000-000000000001'::uuid,
   '50000003-0000-0000-0000-000000000003'::uuid, '30000004-0000-0000-0000-000000000004'::uuid,
   'approved', NULL, now(), now()),

  ('70000004-0000-0000-0000-000000000004'::uuid, '60000001-0000-0000-0000-000000000001'::uuid,
   '50000004-0000-0000-0000-000000000004'::uuid, '30000004-0000-0000-0000-000000000004'::uuid,
   'approved', NULL, now(), now())
ON CONFLICT (batch_id, closer_record_id) DO NOTHING;

-- ========================================
-- TEST QUERIES
-- ========================================

-- Test 1: Search for "202-555-1234" as different roles
-- Expected results:
-- - Super Admin: 1 transfer (Company A) + 1 record (Company A) = 2 results
-- - Company A Admin: same 2 results
-- - Company B Admin: 0 results (no matching numbers in company B)
-- - Bob Closer (Company A): 2 results (his own)
-- - Evan Closer (Company B): 0 results (no matching numbers)
-- - Compliance Agent Jack: 2 results (from assigned batch)

-- Test 2: Search for "555-567-8901"
-- Expected results:
-- - Should find Jane Smith record (Company A)
-- - Status: "NOT SOLD" (disposition = Callback)

-- Test 3: Search for "713-555-1234"
-- Expected results:
-- - Super Admin: 1 transfer + 1 record = 2 results (all from Company B)
-- - Company A Admin: 0 results
-- - Company B Admin: 2 results
-- - Closer Manager Georgia: Can search all (test implementation)

-- ========================================
-- CLEANUP (if needed later)
-- ========================================
-- DELETE FROM compliance_reviews WHERE batch_id IN ('60000001-0000-0000-0000-000000000001'::uuid, '60000002-0000-0000-0000-000000000002'::uuid);
-- DELETE FROM compliance_batches WHERE id IN ('60000001-0000-0000-0000-000000000001'::uuid, '60000002-0000-0000-0000-000000000002'::uuid);
-- DELETE FROM closer_records WHERE id LIKE '50000%';
-- DELETE FROM transfers WHERE id LIKE '40000%';
-- DELETE FROM users WHERE email LIKE '%@test.local' OR email LIKE '%@biztrix.local';
