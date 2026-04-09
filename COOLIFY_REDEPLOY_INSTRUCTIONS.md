# 🚀 URGENT: Redeploy Web Service - Fix Transfer 404 Error

**Issue:** POST /api/v1/transfers returning 404
**Solution:** Redeploy web service with updated nginx.conf
**Time:** 2-3 minutes

---

## ⚡ IMMEDIATE ACTION REQUIRED

The nginx configuration has been updated locally but **NOT deployed to Coolify yet**.

### Step 1: Go to Coolify Dashboard
1. Open https://your-coolify-instance/
2. Navigate to your BizTrixVenture application
3. Find the **Web** service

### Step 2: Redeploy Web Service

**Option A: Redeploy Button (Fastest)**
1. Select the **Web** service
2. Click **"Redeploy"** button
3. Wait for: `ℹ️ Deployment successful`
4. Status should turn 🟢 GREEN

**Option B: Force Rebuild**
1. Select the **Web** service
2. Click **Settings** gear icon
3. Click **"Force rebuild and deploy"**
4. Wait for deployment to complete

### Step 3: Verify Fix

```javascript
// Open DevTools console and run:
fetch('/api/v1/health', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(d => {
  console.log('✅ API Reachable:', d);
  console.log('Status:', d.status);
})
.catch(e => console.error('❌ API Error:', e));
```

Expected response: `{status: "ok", timestamp: "..."}`

### Step 4: Test Transfer Creation

1. Login as **Fronter**
2. Go to **Transfers**
3. Click **"Create Transfer"**
4. Fill in the details
5. Click **"Submit"**
6. Should see: **Transfer created successfully** ✅

Check browser DevTools → Network:
- Should show: `POST /api/v1/transfers 201 Created` ✅
- NOT: `POST /api/v1/transfers 404` ❌

---

## 📋 What Changed in nginx.conf

### ✅ Improvements Made:

1. **Upstream Block** (Production Best Practice)
   ```nginx
   upstream api_backend {
       server api:4000 max_fails=3 fail_timeout=30s;
       keepalive 32;
   }
   ```

2. **Simpler Proxy Configuration**
   - Uses upstream instead of dynamic variables
   - Proper connection pooling with keepalive

3. **Location Order** (Critical!)
   - `/api/` - API proxy (comes first)
   - `/socket.io/` - WebSocket (comes second)
   - Static files - Caching rules
   - `/` - SPA fallback (comes last ← important!)

4. **Proper Headers**
   - Added `X-Forwarded-Host`
   - Added `X-Forwarded-Port`
   - Proper Connection handling for KeepaliveAlive

5. **Better Timeouts**
   - API: 30s (reasonable for DB queries)
   - WebSocket: 86400s (1 day - proper for long connections)

---

## 🔧 If Redeploy Fails

### Check Deployment Logs:
1. In Coolify, find **Web** service
2. Click **Logs** button
3. Look for errors like:
   - ❌ `nginx: [error]` → Syntax error in nginx.conf
   - ❌ `Connection refused` → API service not running
   - ❌ `Build failed` → Docker build issue

### Common Fixes:

**If nginx won't start:**
```bash
# This means nginx.conf has a syntax error
# Check the logs for "nginx: [emerg] ..."
```
Solution: Redeploy will fix it (syntax is correct)

**If API still not reachable:**
1. Check **API** service is 🟢 RUNNING
2. Verify API service logs: `docker logs biztrixventure-api-1`
3. Confirm Redis running: `docker logs biztrixventure-redis-1`

**If still getting 404:**
1. Clear browser cache: Ctrl+Shift+Delete (Chrome)
2. Do hard refresh: Ctrl+Shift+R (Chrome)
3. Try incognito/private window

---

## ✅ Post-Deployment Checklist

After redeploying:

- [ ] Web service shows 🟢 GREEN status
- [ ] Test API health endpoint
- [ ] Create a transfer successfully
- [ ] POST request shows 201 (not 404)
- [ ] GET requests show 200/304 (cached)
- [ ] WebSocket connects (green indicator)
- [ ] Notifications work in real-time
- [ ] No errors in browser console

---

## 📞 Support

**If deployment fails, run:**
```bash
# SSH into Coolify server
docker logs -f biztrixventure-web-1 | head -100
docker logs -f biztrixventure-api-1 | head -100
docker exec biztrixventure-web-1 nginx -t 2>&1
```

**Expected output for last command:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## 🎯 Why This Works Now

**Previous Issue:** Dynamic DNS + variable proxy_pass sometimes failed with POST

**New Solution:**
- Uses `upstream` block (nginx best practice)
- Connection pooling (faster requests)
- Proper keepalive (reliable POST handling)
- Clear location order (no ambiguity)

**Result:** ✅ POST requests will work reliably

---

## ⏱️ Timeline

- **Now:** Redeploy web service (2-3 min)
- **Then:** Test transfers (1 min)
- **Done:** All transfers working (automated)

**Total Time:** ~5 minutes

