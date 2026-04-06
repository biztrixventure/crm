# BizTrixVenture 504 Gateway Timeout Debugging Guide (Deployed Instance)

## Issue
GET `/operations/transfers` returns **504 Gateway Timeout** on deployed instance at `k00kokwckgoo08gk0wcg0w4s.76.13.223.28.sslip.io`

## Root Causes to Check

### 1. **API Container Not Starting** (Most Likely)
#### Check Coolify Logs:
1. Go to Coolify dashboard
2. Navigate to your BizTrixVenture API application
3. Click "View Logs" or "Logs" tab
4. Look for:
   - ❌ `error`, `Error`, `ERROR` messages
   - ❌ Database connection failures
   - ❌ "Cannot find module" or import errors
   - ❌ Syntax errors

#### If you see errors:
- **Missing env var**: Add to Coolify environment: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`
- **Module not found**: API needs rebuild. Trigger redeploy.
- **Database connection**: Check if `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct

---

### 2. **Database Migration Not Applied**
The `/operations/transfers` endpoint requires these tables created by Migration #005:
- `compliance_batches`
- `compliance_reviews`
- `compliance_company_assignments`
- `dnc_list`
- `closer_performance_cache`
- `closer_records` (if not exists)

#### How to Check:
Connect to your Supabase database and run:
```sql
-- Check if compliance tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'compliance_%';

-- Check if closer_records exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'closer_records'
);
```

#### If tables are missing:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `db/migrations/005_add_new_roles.sql`
3. Execute it

---

### 3. **Very Slow Database Query**
If the migrations ARE applied but query is still slow:

#### Check for missing indexes:
```sql
-- Check if operations endpoint indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'transfers'
AND indexname ILIKE '%created_at%';

-- Check if closer_records indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'closer_records'
AND indexname ILIKE '%closer_id%';
```

#### If indexes are missing:
Run the index creation from Migration #005:
```sql
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_closer_records_closer_id ON closer_records(closer_id);
CREATE INDEX IF NOT EXISTS idx_closer_records_company_id ON closer_records(company_id);
```

---

### 4. **API Container Redeployment Steps**

#### Option A: Coolify Redeploy
1. Go to Coolify dashboard
2. Select BizTrixVenture API application
3. Click "Redeploy" or "Deploy"
4. Wait for build/deploy to complete
5. Check logs for errors
6. Test endpoint: `curl https://your-domain/api/v1/operations/transfers`

#### Option B: Manual Docker Restart
```bash
# SSH into your Coolify server
docker-compose restart biztrixventure-api

# Check logs
docker-compose logs -f biztrixventure-api
```

---

### 5. **Test Each Endpoint Progression**

Once deployed, test endpoints in this order:

```bash
# 1. Test auth (should work if API started)
curl -X POST https://your-domain/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# 2. Test companies (should work if DB connected)
curl https://your-domain/api/v1/companies

# 3. Test operations endpoints
curl https://your-domain/api/v1/operations/dashboard
curl https://your-domain/api/v1/operations/companies
curl https://your-domain/api/v1/operations/transfers  # The one returning 504
curl https://your-domain/api/v1/operations/users
curl https://your-domain/api/v1/operations/closer-records

# 4. Test compliance endpoints
curl https://your-domain/api/v1/compliance/batches
curl https://your-domain/api/v1/compliance/records
```

---

## Quick Checklist

- [ ] Check Coolify API logs for errors
- [ ] Verify environment variables in Coolify (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, JWT_SECRET)
- [ ] Verify Migration #005 was applied to Supabase database
- [ ] Verify indexes exist on transfers and closer_records tables
- [ ] Redeploy API in Coolify
- [ ] Test each endpoint individually
- [ ] Check API startup output for "All startup checks passed"
- [ ] Verify database can connect (test simple query like SELECT 1)

---

## If Still Broken

Share these logs and outputs:
1. Coolify API logs (last 100 lines)
2. Output of: `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`
3. Output of: `curl -v https://your-domain/api/v1/operations/transfers 2>&1`
4. Environment variables set in Coolify (mask sensitive values)
