# 🗄️ DATABASE MIGRATIONS - SETUP GUIDE

**Date:** 2026-04-08
**Status:** ✅ READY TO DEPLOY

---

## 📋 MIGRATIONS OVERVIEW

All migrations have been created and are ready to be applied to Supabase. Run them **IN ORDER**.

### Migrations Checklist:

| # | File | Purpose | Status |
|---|------|---------|--------|
| 001 | `001_init.sql` | Initial schema setup | ✅ Base schema |
| 002 | `002_add_plans_clients_config.sql` | Plans & Clients | ✅ Configuration |
| 003 | `003_add_callbacks.sql` | Callbacks system | ✅ Follow-ups |
| 004 | `004_remove_search_functionality.sql` | Legacy cleanup | ✅ Cleanup |
| 005 | `005_add_new_roles.sql` | 4 new roles + tables | ✅ New features |
| 006 | `006_add_closer_manager_relationship.sql` | Manager relationships | ⏳ REQUIRED NOW |
| 007 | `007_migrate_outcomes_to_closer_records.sql` | Data consolidation | ✅ Historical data |

---

## ⏳ NEXT STEPS - REQUIRED MIGRATION

### **Migration 006: Add Closer Manager Relationship**

**Status:** ⚠️ MUST RUN NOW

This migration adds the `managed_by` column to track closer-manager relationships.

**Steps:**

1. **Open Supabase Dashboard**
   - Navigate to your project
   - Go to: SQL Editor

2. **Run Migration 006:**
```sql
-- ===========================================
-- BizTrixVenture CRM - Migration #6
-- Add Closer Manager to Closer Relationship
-- ===========================================

-- ====== 1. Add managed_by field to users table ======
-- This tracks which closer_manager supervises each closer

ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- ====== 2. Add index for performance ======

CREATE INDEX IF NOT EXISTS idx_users_managed_by ON users(managed_by);

-- ====== 3. Add constraint to ensure only closers can be managed ======
-- (managed_by can only be set for 'closer' role users, and must reference a 'closer_manager')
-- Note: Constraint logic is enforced at application level since we can't easily query role in CHECK constraints

-- Done
```

3. **Verify Success:**
   - Check that no errors appear
   - Migrate 006 should complete in <1 second

4. **Redeploy API:**
   - API code already has closer creation that uses `managed_by`
   - Just redeploy to pick up logging improvements

---

## 📊 MIGRATION DEPENDENCIES

```
001 (Init)
  ↓
002 (Plans & Clients)
  ↓
003 (Callbacks)
  ↓
004 (Cleanup)
  ↓
005 (New Roles)
  ↓
006 (Manager Relationships) ⏳ DO THIS NOW
  ↓
007 (Data Migration) ✅ Already done
```

---

## ✅ FEATURES GATED BY MIGRATIONS

### Migration 005 Enables:
- ✅ Closer Manager role
- ✅ Operations Manager role
- ✅ Compliance Manager role
- ✅ Compliance Agent role
- ✅ closer_records table
- ✅ compliance_batches table
- ✅ compliance_reviews table
- ✅ compliance_company_assignments table
- ✅ dnc_list table
- ✅ closer_performance_cache table

### Migration 006 Enables:
- ❌ **Create Closers** (500 error without this)
- ❌ **Manager sees team records** (needs managed_by)
- ❌ **Closer filtering** (needs managed_by)
- ❌ **Compliance agent batch filtering** (needs database structure)

### Migration 007 Enables:
- ✅ Historical data access
- ✅ Closer records visibility
- ✅ Number search with old data

---

## 🔍 WHAT EACH MIGRATION DOES

### Migration 001: Initial Schema
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text CHECK (role IN (...)),
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);
```

### Migration 002: Plans & Clients
Adds business configuration tables:
- plans
- clients
- callback_settings

### Migration 003: Callbacks
```sql
CREATE TABLE callbacks (
  id uuid PRIMARY KEY,
  created_by uuid REFERENCES users(id),
  ... (follow-up system)
);
```

### Migration 004: Cleanup
Removes deprecated search functionality columns.

### Migration 005: New Roles & Tables
**Adds roles:**
- closer_manager
- operations_manager
- compliance_manager
- compliance_agent

**Creates tables:**
- closer_records (sales records)
- compliance_batches (review batches)
- compliance_reviews (review status)
- dnc_list (do-not-call)
- closer_performance_cache (performance stats)

### Migration 006: Manager Relationships ⏳ **NEXT**
```sql
ALTER TABLE users ADD COLUMN managed_by uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_users_managed_by ON users(managed_by);
```

**Why this matters:**
- Closer managers can only manage closers assigned to them
- The `managed_by` field links closers to their managers
- Without this, closer creation fails (tries to set NULL column)

### Migration 007: Data Migration
```sql
INSERT INTO closer_records (...)
SELECT ... FROM outcomes
WHERE NOT EXISTS (...);
```

Consolidates legacy outcomes into closer_records table.

---

## 🚀 DEPLOYMENT SEQUENCE

### **Phase 1: Apply Migrations (Supabase)**
```
1. Run Migration 001 ✅ (already applied)
2. Run Migration 002 ✅ (already applied)
3. Run Migration 003 ✅ (already applied)
4. Run Migration 004 ✅ (already applied)
5. Run Migration 005 ✅ (already applied)
6. Run Migration 006 ⏳ DO NOW
7. Run Migration 007 ✅ (already applied)
```

### **Phase 2: Redeploy Code (Your Environment)**
```
npm run build
npm run start
```

### **Phase 3: Test Features**
```
✅ Create closer via manager
✅ Number search
✅ View team records
✅ Delete users
```

---

## ⚠️ TROUBLESHOOTING

### Issue: "Closer creation returns 500 error"

**Root Cause:** Migration 006 not applied

**Solution:**
1. Run Migration 006 SQL above
2. Verify no errors
3. Redeploy API
4. Try creating closer again

### Issue: "managed_by column not found"

**Root Cause:** Column missing from users table

**Solution:**
```sql
-- Check if column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'managed_by';

-- If not found, run Migration 006
```

### Issue: "Cannot create index"

**Solution:**
```sql
-- Index might already exist, this is OK
-- If error, just continue - index creation is idempotent
```

---

## 📝 MIGRATION FILES LOCATION

All SQL files are in: `/db/migrations/`

```
db/migrations/
├── 001_init.sql
├── 002_add_plans_clients_config.sql
├── 003_add_callbacks.sql
├── 004_remove_search_functionality.sql
├── 005_add_new_roles.sql
├── 006_add_closer_manager_relationship.sql ⏳ NEXT
└── 007_migrate_outcomes_to_closer_records.sql
```

---

## ✅ VERIFICATION CHECKLIST

### After Running Migration 006:

- [ ] Supabase shows no errors
- [ ] Run this query to verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('managed_by', 'created_by')
ORDER BY column_name;

-- Expected output:
-- created_by
-- managed_by
```

- [ ] Index created:
```sql
SELECT * FROM pg_indexes
WHERE tablename = 'users'
AND indexname = 'idx_users_managed_by';

-- Should return 1 row
```

- [ ] Redeploy API
- [ ] Try creating closer from dashboard
- [ ] Should succeed ✅

---

## 🔗 REFERENCE

**Current Status:**
- Migrations 001-005: ✅ Applied
- Migration 006: ⏳ Apply now
- Migration 007: ✅ Applied

**API Code Status:**
- Closer creation: Ready (waits for Migration 006)
- User deletion: Ready
- Number search: Ready
- Compliance features: Ready

**Frontend Status:**
- All pages ready
- Delete functionality ready
- Closer creation UI ready

---

**Next Action: Run Migration 006 in Supabase SQL Editor**

Expected time: < 1 minute
Then redeploy API

---
