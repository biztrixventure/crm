# 🚀 Coolify/tokocrypto.live - Production Deployment Guide

## ✅ Current Status

- ✅ All code pushed to GitHub: `main` branch
- ✅ Webhook auto-deploy configured
- ✅ Docker containers ready
- ✅ Notification system implemented
- ⏳ Environment variables need verification

---

## 🔑 Coolify Environment Variables Setup

### Dashboard Location
```
Coolify → Database/Service → Environment Variables
```

### Required Variables for Notification System

Add these in **Coolify Admin Panel** → Your Service → **Environment Variables**:

#### **Database (Supabase)**
```
SUPABASE_URL=https://ujxrlkbatxmunrwjkaxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=1112@P@kistan@1112
```

#### **API Configuration**
```
JWT_SECRET=biztrix-crm-ultra-secure-jwt-secret-key-2024-v1
PORT=4000
NODE_ENV=production          ⚠️ CRITICAL: Set as "Runtime only" (uncheck "Available at Buildtime")
FRONTEND_URL=https://tokocrypto.live
```

#### **Redis Configuration**
```
REDIS_URL=redis://redis:6379    (Docker internal, Coolify handles this)
```

#### **2FA Configuration**
```
TOTP_ISSUER=BizTrixVenture
```

#### **Notification System (New)**
```
NOTIFICATION_SOUNDS_ENABLED=true
NOTIFICATION_BROWSER_ENABLED=true
NOTIFICATION_SOCKET_ENABLED=true
```

---

## 🌐 Frontend Environment Variables

### For Web App Build

Add in **Coolify** → Web Service → **Build Variables**:

```
VITE_API_URL=https://tokocrypto.live/api/v1
VITE_ENV=production
```

### Important: Access Pattern

The frontend (running on `tokocrypto.live`) needs to connect to the API.

**Two options:**

#### Option 1: Same Domain (Recommended - Already Set)
```
Frontend runs on: https://tokocrypto.live/
API runs on: https://tokocrypto.live/api/v1
(nginx proxies /api/* → backend)
```

**Environment Variable:**
```
VITE_API_URL=https://tokocrypto.live/api/v1
```

#### Option 2: Different Port (If needed)
```
Frontend: https://tokocrypto.live:80/
API: https://tokocrypto.live:4000/api/v1
```

**Environment Variable:**
```
VITE_API_URL=https://tokocrypto.live:4000/api/v1
```

---

## 📋 Coolify Setup Checklist

### Step 1: Set Environment Variables
- [ ] Open Coolify Dashboard
- [ ] Navigate to Your Service
- [ ] Go to "Environment Variables"
- [ ] Copy all variables from above
- [ ] Set `NODE_ENV` as "Runtime only" (uncheck "Available at Buildtime")
- [ ] Set `VITE_API_URL` in build variables
- [ ] Save and rebuild

### Step 2: Verify Database Migration
- [ ] Open Supabase project
- [ ] Go to SQL Editor
- [ ] Run Migration 009:
```sql
-- Copy contents from: db/migrations/009_create_notifications_table.sql
-- Paste into Supabase SQL Editor
-- Execute
```

### Step 3: Configure Webhook (GitHub → Coolify)
- [ ] In Coolify: Service → Webhooks
- [ ] Enable "Deploy on Git Webhook"
- [ ] Copy webhook URL
- [ ] Go to GitHub → Settings → Webhooks
- [ ] Add webhook URL
- [ ] Select events: "Push events"
- [ ] Test webhook

### Step 4: Deploy & Verify
- [ ] Push code to GitHub
- [ ] Coolify auto-deploys (watch logs)
- [ ] Access: https://tokocrypto.live
- [ ] Check notification bell in header
- [ ] Test creating a notification

---

## 🔍 Verification Steps

### Check API Health
```bash
curl https://tokocrypto.live/api/v1/health

# Expected response:
# {"status":"ok","timestamp":"2026-04-10T..."}
```

### Check Notifications Endpoint
```bash
curl https://tokocrypto.live/api/v1/notifications/count \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
# {"unreadCount":0}
```

### Check Socket.io Connection
```javascript
// In browser console at tokocrypto.live:
console.log(window.location.origin)  // Should show https://tokocrypto.live

// Open DevTools → Network → WS
// Should see WebSocket connection to: wss://tokocrypto.live/socket.io/
```

### Test Notification Creation
```bash
curl -X POST https://tokocrypto.live/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📊 Coolify Variable Configuration Reference

| Variable | Value | Buildtime? | Sensitive? | Notes |
|----------|-------|-----------|-----------|-------|
| SUPABASE_URL | https://ujxr...co | ❌ No | ❌ No | Database endpoint |
| SUPABASE_SERVICE_KEY | eyJ... | ❌ No | ✅ Yes | Backend-only secret |
| SUPABASE_ANON_KEY | eyJ... | ❌ No | ❌ No | Frontend-safe key |
| SUPABASE_DB_PASSWORD | 1112@P... | ❌ No | ✅ Yes | Database password |
| JWT_SECRET | biztrix-crm... | ❌ No | ✅ Yes | Signing secret |
| PORT | 4000 | ❌ No | ❌ No | Backend port |
| NODE_ENV | production | ❌ No (Runtime Only) | ❌ No | ⚠️ Critical setting |
| FRONTEND_URL | https://tokocrypto.live | ❌ No | ❌ No | CORS origin |
| REDIS_URL | redis://redis:6379 | ❌ No | ❌ No | Cache/queue |
| VITE_API_URL | https://tokocrypto.live/api/v1 | ✅ Yes | ❌ No | Frontend API |
| VITE_ENV | production | ✅ Yes | ❌ No | Frontend environment |

---

## ⚠️ Critical Settings

### NODE_ENV Must Be Runtime-Only
```
IMPORTANT: In Coolify UI
- Click NODE_ENV variable
- UNCHECK "Available at Buildtime"
- CHECK "Runtime only"
- This prevents build mode leaking into production
```

### VITE_API_URL Must Be Build-Time
```
IMPORTANT: In Coolify UI
- Click VITE_API_URL variable
- CHECK "Available at Buildtime"
- UNCHECK "Runtime only"
- Vite needs this during npm run build
```

---

## 🔄 Auto-Deploy Workflow

### When you push to GitHub:

1. **GitHub detects push** to `main` branch
2. **Webhook fires** → sends payload to Coolify
3. **Coolify receives** webhook notification
4. **Coolify clones** latest code from GitHub
5. **Docker builds** with environment variables:
   - Build stage: Uses `VITE_API_URL`, `VITE_ENV`, etc.
   - Frontend built with API URL hardcoded
6. **Containers start**:
   - API service (port 4000)
   - Web service (nginx, port 80)
   - Redis service
   - Worker service
7. **nginx proxies** requests:
   - `/api/*` → backend:4000
   - Static files → dist folder
8. **Available at** https://tokocrypto.live ✅

---

## 📝 Troubleshooting

### Issue: Notifications not loading (404 or CORS error)

**Check:**
```
1. VITE_API_URL in Coolify (must be https://tokocrypto.live/api/v1)
2. Frontend build log (Coolify → Logs)
3. Browser console (DevTools → F12)
4. API health: curl https://tokocrypto.live/api/v1/health
```

**Fix:**
```bash
# In Coolify:
1. Edit VITE_API_URL → https://tokocrypto.live/api/v1
2. Rebuild web container
3. Check logs for build success
4. Clear browser cache (Ctrl+Shift+Delete)
5. Reload https://tokocrypto.live
```

### Issue: Sounds not playing (404 errors)

**Check:**
```
1. Sound files exist in public/sounds/: *.wav files
2. nginx.conf serves /sounds/ correctly
3. DevTools Network tab for .wav requests
4. Browser console for audio errors
```

**Fix:**
```bash
# Verify files in Docker:
docker exec <container> ls -la /usr/share/nginx/html/sounds/

# Should show:
# transfer.wav, callback.wav, sale.wav, batch.wav, alert.wav
```

### Issue: Socket.io not connecting

**Check:**
```
1. FRONTEND_URL in Coolify: https://tokocrypto.live
2. Socket.io configured for correct origin
3. Browser console: wss://tokocrypto.live/socket.io/
4. nginx.conf allows WebSocket upgrade
```

**Fix:**
```bash
# In Coolify:
1. Verify FRONTEND_URL = https://tokocrypto.live
2. Check nginx.conf includes:
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
3. Rebuild containers
```

### Issue: Database migration not applied

**Manual Fix:**
```sql
-- Go to Supabase → SQL Editor
-- Paste contents of: db/migrations/009_create_notifications_table.sql
-- Click Execute

-- Verify:
SELECT COUNT(*) FROM notifications;
-- Should return: 0
```

---

## 🎯 Quick Deploy Checklist

- [ ] All environment variables set in Coolify
- [ ] NODE_ENV = "Runtime only"
- [ ] VITE_API_URL = "Buildtime"
- [ ] Database migration 009 executed
- [ ] Webhook configured in GitHub
- [ ] Code pushed to `main` branch
- [ ] Coolify logs show successful build
- [ ] https://tokocrypto.live loads
- [ ] Notification bell appears
- [ ] API health check passes
- [ ] Socket.io connects (check Network → WS)
- [ ] Create test notification
- [ ] Sound plays and notification appears

---

## 📞 Quick Reference Commands

```bash
# Coolify Docker logs
docker logs <coolify-container-id>

# Check running containers
docker ps -a

# View environment in container
docker exec <container> env | grep SUPABASE

# Test notification endpoint
curl https://tokocrypto.live/api/v1/notifications/count \
  -H "Authorization: Bearer TOKEN"

# Restart container
docker restart <container>

# Rebuild specific service
docker-compose -f docker-compose.yaml build web
```

---

## 🚀 Final Status

**Everything is ready for production deployment at tokocrypto.live!**

✅ Code pushed to GitHub
✅ Webhook configured
✅ Docker containers ready
✅ Environment variables setup guide complete
✅ Database migration ready
✅ Notification system production-ready

**Next: Follow the Coolify Setup Checklist above** ↑
