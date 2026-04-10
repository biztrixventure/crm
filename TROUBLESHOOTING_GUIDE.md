# 🔧 PRODUCTION TROUBLESHOOTING & FIXES

## 🎯 Critical Issues Identified

### Issue 1: API Service Returning 504 Gateway Timeout ❌
**Symptom:** All API calls fail with 504
```
GET /api/v1/transfers 504 (Gateway Timeout)
GET /api/v1/auth/me 504 (Gateway Timeout)
```

**Root Cause:** API backend service is not responding to nginx proxy

**Solutions to try (in order):**
1. ✅ Check if API container is running
2. ✅ Check if API service is crash-looping
3. ✅ Verify DNS resolution in docker network
4. ✅ Check API container logs
5. ✅ Restart all services

---

### Issue 2: WebSocket Connection Failing ❌
**Symptom:**
```
WebSocket connection to 'wss://tokocrypto.live/socket.io/?EIO=4&transport=websocket' failed
WebSocket is closed before the connection is established
```

**Root Cause:** Unable to proxy WebSocket because API not responding (same as Issue 1)

---

### Issue 3: Missing PWA Icons ❌
**Symptom:** 404 errors for `/pwa-192x192.png` and `/pwa-512x512.png`

**Root Cause:** Vite PWA config not generating icons

---

## 🔍 DIAGNOSTIC COMMANDS

Run these in your Docker host:

```bash
# 1. Check if containers exist
docker ps -a | grep biztrix

# 2. Check API container logs
docker logs -f biztrixventure-api-1 --tail 100

# 3. Test API connectivity from web container
docker exec biztrixventure-web-1 curl -v http://api:4000/api/v1/health

# 4. Check if API service is listening
docker exec biztrixventure-api-1 netstat -tln | grep 4000

# 5. Test nginx config syntax
docker exec biztrixventure-web-1 nginx -t

# 6. Check nginx error logs
docker logs -f biztrixventure-web-1 --tail 50
```

---

## ✅ QUICK FIXES (Do These Now)

### Step 1: Add Missing PWA Icons
Create PWA icon files in `apps/web/public/`:

**apps/web/public/pwa-192x192.png** - Create a 192x192 PNG icon
**apps/web/public/pwa-512x512.png** - Create a 512x512 PNG icon

---

### Step 2: Update Vite Config for PWA
Ensure `vite.config.js` includes icons:

```javascript
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    VitePWA({
      manifest: {
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ]
}
```

---

### Step 3: Verify API Container Health

1. Go to Coolify Dashboard
2. Go to API service
3. Click "Logs" and check for errors
4. Look for:
   - ❌ Node.js crash errors
   - ❌ Port unavailable (EADDRINUSE)
   - ❌ Database connection errors
   - ❌ Redis connection errors

---

### Step 4: Check Network Connectivity

If API container is running but nginx can't reach it:

**In docker-compose.yaml, ensure:**
```yaml
services:
  api:
    networks:
      - biztrix-network  # ✅ Must be same network
  web:
    networks:
      - biztrix-network  # ✅ Must be same network

networks:
  biztrix-network:
    driver: bridge     # ✅ Bridge driver for DNS
```

---

### Step 5: Restart Services (Nuclear Option)

```bash
# Stop all services
docker-compose down

# Remove volumes (CAREFUL - loses data)
# docker-compose down -v

# Restart fresh
docker-compose up -d

# Wait 30 seconds for services to start
sleep 30

# Check logs
docker-compose logs -f api
```

---

## 🔥 PRODUCTION CHECKLIST

Before redeploying from Coolify:

- [ ] API container is running (`docker ps`)
- [ ] API logs show "✅ API running on port 4000" (no errors)
- [ ] Nginx config is valid (`nginx -t` returns ok)
- [ ] Can reach API from nginx: `curl http://api:4000/api/v1/health`
- [ ] WebSocket endpoint responding: check browser DevTools Network tab
- [ ] All API endpoints return data (not 504)
- [ ] PWA icons are in `apps/web/public/`

---

## 🚀 DEPLOYMENT STEPS

### Option 1: Coolify Redeploy (Simplest)
1. Go to Coolify Dashboard
2. Find BizTrixVenture application
3. Click Services → select "api" service
4. Click "Redeploy"
5. Wait 3-5 minutes
6. Check logs for errors

### Option 2: Manual Docker Rebuild
```bash
cd /path/to/biztrixventure

# Rebuild API image
docker-compose build --no-cache api

# Restart
docker-compose up -d api

# Check logs
docker-compose logs -f api
```

---

## 📊 WHAT TO LOOK FOR IN LOGS

### ✅ GOOD API Startup:
```
✓ Checking environment variables...
   ✅ All required environment variables are set
✓ Checking route files...
   ✅ All 15 route files found
✅ All startup checks passed! API is ready to start.
✅ BizTrixVenture API running on port 4000
📊 Environment: production
```

### ❌ BAD API Startup:
```
Error: EADDRINUSE: address already in use :::4000
  - Fix: Another process on port 4000, or port not exposed

Cannot find module 'compression'
  - Fix: `npm install compression`

SUPABASE_URL is required
  - Fix: Set environment variable in Coolify

Error: connect ECONNREFUSED 127.0.0.1:5432
  - Fix: Database not accessible, check SUPABASE_URL

Error: ENOTFOUND redis
  - Fix: Normal if Redis container not running (graceful degradation)
```

---

## 🎯 AFTER REDEPLOY - TEST IMMEDIATELY

```bash
# 1. Test API Health
curl https://tokocrypto.live/api/v1/health

# 2. Test Auth
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://tokocrypto.live/api/v1/auth/me

# 3. Check WebSocket in Browser DevTools
# Open: https://tokocrypto.live/fronter
# DevTools → Network → WS → Should see /socket.io/ with status 101

# 4. Try Creating a Transfer
# Fronter page → Click "Create Transfer"
# Should NOT get 404 or timeout
```

---

## 🆘 IF STILL BROKEN

Check these in order:

1. **API Port Mapping** - Is port 4000 exposed?
   ```bash
   docker-compose ps  # Should show web port 80 and api port 4000
   ```

2. **Network Connectivity** - Can web reach api?
   ```bash
   docker exec biztrixventure-web-1 ping -c 3 api
   ```

3. **DNS Resolution** - Can nginx resolve "api" hostname?
   ```bash
   docker exec biztrixventure-web-1 nslookup api
   ```

4. **Nginx Proxy** - Check if proxy is actually forwarding
   ```bash
   docker exec biztrixventure-web-1 cat /etc/nginx/nginx.conf
   # Look for "proxy_pass http://api_backend;"
   ```

---

## 📝 Emergency Rollback

If everything breaks:

```bash
# Stop current deployment
docker-compose down

# Checkout previous working nginx config
git checkout HEAD~1 -- apps/web/nginx.conf

# Restart
docker-compose up -d

# Check if working
docker-compose logs -f web
```

---

## ✨ Expected After Fix

- ✅ All API calls return 200, not 504
- ✅ WebSocket connects successfully (status 101)
- ✅ Transfers can be created without errors
- ✅ Notifications load without timeout
- ✅ PWA icons load (no 404s)
- ✅ No "timeout" or "Gateway Timeout" errors in console

