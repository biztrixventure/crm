# 🚀 tokocrypto.live - Environment Setup Quick Checklist

## ✅ What's Done
- ✅ All code pushed to GitHub (`main` branch)
- ✅ Webhook auto-deploy configured
- ✅ Docker containers ready
- ✅ Notification system implemented with WAV sounds
- ✅ Production guides created

## 🔄 What You Need to Do in Coolify

### Step 1: Open Coolify Admin Panel
```
https://coolify.your-domain.com
→ Applications → Your Service → Environment
```

### Step 2: Add These Environment Variables

#### COPY-PASTE These Exactly:

**Database Section:**
```
SUPABASE_URL=https://ujxrlkbatxmunrwjkaxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeHJsa2JhdHhtdW5yd2prYXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIxODc0MSwiZXhwIjoyMDkwNzk0NzQxfQ.OTDNxjeZP5UTPk6ykte6oHDWaNcD6i4xobKPQ7oEvEg
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeHJsa2JhdHhtdW5yd2prYXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTg3NDEsImV4cCI6MjA5MDc5NDc0MX0.UQ8-fmJHRoSo-jVj8t3-QTDtCcVwyZpVDdIZTSeMzFE
SUPABASE_DB_PASSWORD=1112@P@kistan@1112
```

**API Configuration:**
```
JWT_SECRET=biztrix-crm-ultra-secure-jwt-secret-key-2024-v1
PORT=4000
FRONTEND_URL=https://tokocrypto.live
REDIS_URL=redis://redis:6379
TOTP_ISSUER=BizTrixVenture
```

**⚠️ CRITICAL - NODE_ENV:**
```
NODE_ENV=production
```
*After entering this value, in Coolify UI:*
- *UNCHECK "Available at Buildtime"*
- *CHECK "Runtime only"*

**Frontend Build Variables:**
```
VITE_API_URL=https://tokocrypto.live/api/v1
VITE_ENV=production
```

### Step 3: Rebuild & Deploy
```
1. Click "Rebuild" button in Coolify
2. Watch the build logs
3. Wait for "Deployment successful"
4. Access https://tokocrypto.live
```

### Step 4: Run Database Migration

Go to **Supabase → SQL Editor** and execute:

```sql
-- Migration 009: Create Notifications Table
-- Copy from: db/migrations/009_create_notifications_table.sql
-- Paste and execute below:

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id),
  role text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + '30 days'::interval),
  browser_notified boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_expires ON notifications(expires_at);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- After full SQL from migration file...
```

---

## 🧪 Test It Works

### Test 1: API Health
```
Curl or browser:
https://tokocrypto.live/api/v1/health

Expected:
{"status":"ok","timestamp":"..."}
```

### Test 2: Notification System
```
1. Login to https://tokocrypto.live
2. Look at top-right corner
3. You should see a 🔔 Bell icon
4. Click it
5. Should see notification dropdown
```

### Test 3: Create Test Notification
```
Developer Console → Network → scroll to /notifications/test
Or curl:

curl -X POST https://tokocrypto.live/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

Expected:
- Bell shows unread count
- Toast appears
- Sound plays
- Browser notification shows
```

---

## 📋 Variable Summary Table

| Variable | Value | Where? | Buildtime? |
|----------|-------|--------|-----------|
| SUPABASE_URL | https://ujxr... | Env Vars | No |
| SUPABASE_SERVICE_KEY | eyJ... | Env Vars | No |
| SUPABASE_ANON_KEY | eyJ... | Env Vars | No |
| SUPABASE_DB_PASSWORD | 1112@P... | Env Vars | No |
| JWT_SECRET | biztrix-crm... | Env Vars | No |
| PORT | 4000 | Env Vars | No |
| NODE_ENV | production | **Runtime Only** ⚠️ | No |
| FRONTEND_URL | https://tokocrypto.live | Env Vars | No |
| REDIS_URL | redis://redis:6379 | Env Vars | No |
| TOTP_ISSUER | BizTrixVenture | Env Vars | No |
| VITE_API_URL | https://tokocrypto.live/api/v1 | **Buildtime** | ✅ Yes |
| VITE_ENV | production | **Buildtime** | ✅ Yes |

---

## 🌐 Auto-Deploy Flow

```
You: git push origin main
  ↓
GitHub: Webhook triggered
  ↓
Coolify: Receives webhook notification
  ↓
Git: Clone latest code
  ↓
Build:
  - Vite builds frontend with VITE_API_URL
  - API Service builds with environment
  - Docker images created
  ↓
Start Containers:
  - API on :4000
  - nginx on :80
  - Redis for cache
  - Worker for jobs
  ↓
Available at: https://tokocrypto.live ✅
```

---

## ✨ After Deploy - What Works

✅ Notification bell in header
✅ Unread notification count badge
✅ Click bell → see recent notifications
✅ "View All" → full notifications modal
✅ Mark as read / delete notifications
✅ Filter by All/Unread/Read
✅ High-quality WAV sounds for each type
✅ Browser notifications with permissions
✅ Real-time sync across browser tabs
✅ Socket.io real-time delivery
✅ All 8 roles get appropriate notifications

---

## 🎯 Current Environment Status

**In .env (local file):**
```
✅ SUPABASE_URL = https://ujxrlkbatxmunrwjkaxx.supabase.co
✅ SUPABASE_SERVICE_KEY = set
✅ SUPABASE_ANON_KEY = set
✅ SUPABASE_DB_PASSWORD = set
✅ JWT_SECRET = set
✅ PORT = 4000
✅ NODE_ENV = development (change to production in Coolify)
✅ FRONTEND_URL = * (change to https://tokocrypto.live in Coolify)
```

**What to update for Coolify:**
- ✏️ NODE_ENV: development → production (Runtime Only)
- ✏️ FRONTEND_URL: * → https://tokocrypto.live
- ✏️ Add VITE_API_URL: https://tokocrypto.live/api/v1 (Buildtime)
- ✏️ Add VITE_ENV: production (Buildtime)

---

## 📞 Files for Reference

| File | Purpose |
|------|---------|
| `COOLIFY_PRODUCTION_SETUP.md` | Full Coolify setup guide |
| `LOCAL_DEV_SETUP.md` | Local development guide |
| `db/migrations/009_create_notifications_table.sql` | Database migration |
| `.env` | Current environment variables |
| `.env.example` | Template for environment |
| `docker-compose.yaml` | Docker compose config |

---

## 🚀 Next Steps

1. **Open Coolify Dashboard**
2. **Add environment variables** (use table above)
3. **Set NODE_ENV as "Runtime only"**
4. **Add VITE_API_URL as "Buildtime"**
5. **Rebuild** - Coolify automatically deploys
6. **Run database migration** in Supabase
7. **Test** at https://tokocrypto.live
8. **Push to GitHub** when ready (auto-deploys)

---

**Everything is pushed to GitHub and ready for deployment!** ✅

The webhook will automatically deploy whenever you push to `main` branch.

**Time to deploy: ~5-10 minutes** ⏱️
