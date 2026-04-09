# 🔧 Frontend API Proxy Troubleshooting Guide

**Issue:** `POST /api/v1/transfers 404 (Not Found)`

---

## 🔍 Root Cause Analysis

When making transfers, the frontend gets a 404 error from the API. This happens when:

1. ❌ Nginx proxy can't reach the API service
2. ❌ API service isn't responding on port 4000
3. ❌ DNS resolution for `api:4000` fails
4. ❌ Coolify reverse proxy is misconfigured
5. ❌ API routes aren't loaded correctly

---

## ✅ Quick Diagnostic Steps

### Step 1: Check API Service Status

**In Coolify Dashboard:**
1. Go to your application
2. Check "API" service status → Should be 🟢 RUNNING
3. Check logs: Look for errors or "API running on port 4000"

**Expected logs:**
```
✅ BizTrixVenture API running on port 4000
🔗 Routes registered: Auth, Companies, Users, Transfers...
```

### Step 2: Verify API is Responding

**From your browser console on the frontend:**
```javascript
// Test if API is reachable
fetch('/api/v1/health', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(data => console.log('API Health:', data))
.catch(e => console.error('API Error:', e))
```

**Expected response:** `{status: "ok", timestamp: "..."}`

If you get 404 or error, the problem is the proxy configuration.

### Step 3: Check Nginx Logs

**In Coolify terminal or container logs:**
```bash
docker logs -f biztrixventure-web-1 | grep -i "api\|proxy\|error"
```

Look for messages like:
- ✅ `proxy_pass http://api:4000` (good - proxy is configured)
- ❌ `upstream timed out` (API isn't responding)
- ❌ `No such host` (DNS resolution failed)

---

## 🛠️ Solution: Enhanced Nginx Configuration

**Already updated in apps/web/nginx.conf:**

```nginx
# 1. Added DNS resolver support
resolver 127.0.0.11 valid=10s;

# 2. Dynamic backend variable (forces DNS resolution)
set $api_backend "http://api:4000";
proxy_pass $api_backend;

# 3. Proper proxy headers
proxy_set_header Connection "";
proxy_http_version 1.1;

# 4. Connection pooling
proxy_buffering on;
proxy_buffer_size 4k;

# 5. Retry logic
proxy_next_upstream error timeout;
proxy_next_upstream_tries 2;
```

---

## ⚠️ Coolify-Specific Issues

If using Coolify and still getting 404:

### Issue 1: Service Network Isolation
**Problem:** Services might not be on same Docker network

**Solution:** In Coolify UI:
1. Go to Application Settings
2. Verify all services (API, Web) use same network
3. Check labels: `coolify.managed=true` should be on Web service

### Issue 2: Reverse Proxy Stripping Path
**Problem:** Coolify's reverse proxy might strip `/api/` prefix

**Solution:** Check Coolify environment:
1. Verify `FRONTEND_URL` is set correctly
2. Ensure API is not behind another reverse proxy
3. Contact Coolify support if services can't communicate

### Issue 3: Port Exposure
**Problem:** API port 4000 might not be accessible to Web service

**Solution:**
- In docker-compose.yaml: API has `expose: ["4000"]` ✅
- web accesses via: `http://api:4000` ✅
- Docker network connects them ✅

---

## 🔧 Manual Testing (Docker Compose)

If running locally with docker-compose:

```bash
# 1. Start services
docker-compose up -d

# 2. Test API directly from web container
docker-compose exec web curl http://api:4000/api/v1/health

# 3. Check if it returns JSON (not 404)
# Expected: {"status":"ok","timestamp":"..."}

# 4. If 404, check if API is running
docker-compose exec api ps aux | grep node

# 5. Check API logs
docker-compose logs -f api | tail -50
```

---

## ✅ Verification After Fix

After applying the nginx.conf updates, verify:

1. **Restart Web Service**
   - In Coolify: Redeploy the web service
   - Or: `docker-compose restart web`

2. **Test API Proxy**
   ```javascript
   // From frontend console
   fetch('/api/v1/health')
     .then(r => r.json())
     .then(d => console.log('✅ API Proxy Works:', d))
   ```

3. **Make a Transfer**
   - Try creating a transfer as fronter
   - Should see POST /api/v1/transfers 201 in DevTools
   - No more 404 errors

4. **Check Nginx Logs**
   ```bash
   docker logs biztrixventure-web-1 | grep "proxy_pass\|200\|404"
   ```
   - 200 = Good (proxy working)
   - 404 = Still broken

---

## 🚨 If Still Getting 404

### Step 1: Verify API is Actually Running
```bash
# SSH into the server
# Then run:
docker ps | grep api

# Should show: biztrixventure-api-1 running
```

If not running:
```bash
docker logs biztrixventure-api-1  # See why it crashed
docker-compose start api          # Restart it
```

### Step 2: Check API Port
```bash
# Inside API container
docker-compose exec api netstat -tlnp | grep 4000

# Should show: tcp 0 0 0.0.0.0:4000 LISTEN
```

If not listening:
- Database not connecting
- JWT_SECRET not set
- Environment variables missing
- See API logs: `docker logs -f biztrixventure-api-1`

### Step 3: Test Network Connectivity
```bash
# From web container, test reaching API
docker-compose exec web nslookup api

# Should resolve to internal IP like 172.20.0.3
# If "host not found" - network problem in Coolify
```

### Step 4: Update Docker Image
```bash
# Rebuild images with latest nginx.conf
docker-compose build web
docker-compose up -d web

# Verify new config is loaded
docker exec biztrixventure-web-1 cat /etc/nginx/nginx.conf | grep "api_backend"
```

---

## 📝 Coolify Deployment Checklist

After applying the nginx fix, ensure:

- [ ] Web service redeployed with new nginx.conf
- [ ] API service is running (green status)
- [ ] Both services on same Docker network
- [ ] All environment variables set (NODE_ENV=production, etc.)
- [ ] Port 4000 is not exposed externally (only on internal network)
- [ ] Health check endpoint responding: `/api/v1/health`
- [ ] Web service can curl API: `curl http://api:4000/api/v1/health`

---

## 🆘 Contact Support

If issue persists after all steps above:

1. **Collect Logs:**
   ```bash
   docker logs biztrixventure-api-1 > api.log
   docker logs biztrixventure-web-1 > web.log
   ```

2. **Check Network:**
   ```bash
   docker network ls
   docker network inspect biztrix-network
   ```

3. **Provide:**
   - API container logs
   - Web container logs
   - Output of: `docker ps`
   - Output of: `docker network inspect biztrix-network`
   - Error message from frontend (screenshot of 404)

---

## 📊 Expected Behavior After Fix

✅ **Frontend Console:**
```
POST https://tokocrypto.live/api/v1/transfers → 201 Created
Socket connected ✓
All notification sounds loaded ✓
```

✅ **Creating a Transfer:**
1. Fronter fills form
2. Clicks "Create Transfer"
3. POST request succeeds (201)
4. Frontend shows success message
5. Closer receives real-time notification

✅ **Nginx Access Log:**
```
POST /api/v1/transfers HTTP/1.1" 201 ← Success!
```

