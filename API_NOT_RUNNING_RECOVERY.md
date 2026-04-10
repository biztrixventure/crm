# 🔴 URGENT: API Service Not Running - Diagnostic & Recovery

**Issue:** Login showing "Server unavailable (Gateway Timeout)"
**Root Cause:** API service is not running or not accessible through nginx
**Status:** REQUIRES IMMEDIATE ACTION

---

## 🔍 DIAGNOSIS

This error means:
1. User tries to login
2. Frontend sends POST to nginx: `/api/v1/auth/login`
3. Nginx tries to proxy to: `http://api:4000`
4. ❌ API service **not running** OR **not reachable**
5. ❌ Nginx times out after 30 seconds
6. ❌ Returns 504 Gateway Timeout

---

## 🚨 IMMEDIATE RECOVERY (DO THIS NOW)

### Step 1: Check if Coolify Services are Running

**In Coolify Dashboard:**
1. Go to: BizTrixVenture Application
2. Look at: Services section
3. Check status of each service:
   - ✅ API (should show "running")
   - ✅ Web (should show "running")
   - ✅ Redis (should show "running")
   - ✅ Worker (should show "running")

**Expected View:**
```
API Service:     🟢 Running (green status)
Web Service:     🟢 Running (green status)
Redis Service:   🟢 Running (green status)
Worker Service:  🟢 Running (green status)
```

### Step 2: If API is NOT Running

**Do this immediately:**
1. Click on the API service
2. Click "Restart" button
3. Observe the restart process:
   - Should see "Building..."
   - Then "Deploying..."
   - Then should show "Running" with green status
4. Wait 30 seconds after it says "Running"

### Step 3: Check API Logs

**If API is running but still not working:**
1. Go to: API Service → Logs
2. Scroll to the bottom
3. Look for one of these messages:

**✅ GOOD (API working):**
```
✅ BizTrixVenture API running on port 4000
✅ Socket.io initialized
🔗 Routes registered: Auth, Companies, Users, ...
```

**❌ BAD (API crashed):**
```
Error:
Cannot connect
ReferenceError
SyntaxError
Uncaught Exception
Exit code: 1
```

### Step 4: If API Logs Show Errors

**Restart completely:**
1. Go to BizTrixVenture → Settings
2. Click "Stop Application"
3. Wait 10 seconds
4. Click "Start Application"
5. Wait 30 seconds for all services to start
6. Check logs again

### Step 5: Verify Network Connectivity

**In Coolify Terminal (if available):**
```bash
# Test if web can reach API
docker exec biztrixventure-web-1 curl -v http://api:4000/api/v1/health

# Should show:
HTTP/1.1 200 OK
{"status":"ok","timestamp":"..."}
```

---

## 🔧 DETAILED TROUBLESHOOTING

### Problem: API Service Won't Start

**Possible Causes & Solutions:**

1. **Out of Memory**
   - Solution: Increase container memory in Coolify settings
   - Try: 512MB or 1GB for API service

2. **Port Already in Use**
   - Solution: Restart Docker
   - In Coolify: Stop → Start application

3. **Environment Variables Missing**
   - Solution: Verify in Coolify → API Service → Variables
   - Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
   - Check: All values are set and not empty

4. **Database Unreachable**
   - Solution: Verify SUPABASE_URL is correct
   - Test: Can you access Supabase dashboard?

5. **Corrupted Docker Image**
   - Solution: Rebuild image
   - In Coolify: Click "Force Rebuild"

### Problem: API Starts But Not Reachable

**Possible Causes:**

1. **Nginx not routing properly**
   - Solution: Check nginx config
   - Already configured in latest deploy ✅

2. **API on wrong port**
   - Solution: Verify PORT=4000 in env vars
   - Check: Docker ps shows `0.0.0.0:4000->4000/tcp`

3. **Network issue between containers**
   - Solution: Restart all services
   - In Coolify: Stop → Wait 10s → Start

4. **DNS resolution failing**
   - Solution: Check docker network
   - Command: `docker network inspect biztrix-network`

### Problem: Specific Error in Logs

**If you see:**
```
ReferenceError: require is not defined
```
- ✅ FIXED in commit ce46604
- Redeploy to get latest code

**If you see:**
```
ECONNREFUSED 127.0.0.1:5432
```
- API can't reach database
- Check: SUPABASE_URL environment variable

**If you see:**
```
ENOTFOUND redis
```
- This is OK! Redis is optional
- App continues to work without caching

---

## 📋 QUICK CHECKLIST

Before testing, verify ALL these are true:

- [ ] Coolify shows API service status as "Running" (green)
- [ ] API logs show "✅ API running on port 4000"
- [ ] Web service is also "Running"
- [ ] No errors in recent logs
- [ ] Been waiting at least 30 seconds after restart

---

## 🧪 TESTING AFTER RESTART

### Test 1: Health Check
```bash
curl https://tokocrypto.live/api/v1/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Test 2: Login Attempt
1. Go to: https://tokocrypto.live/fronter
2. Hard refresh: Ctrl+Shift+R
3. Try login with valid credentials
4. Should succeed OR show "Invalid email or password" (not 504)

### Test 3: WebSocket Connection
1. Open DevTools (F12)
2. Go to Network tab
3. Filter for: socket.io
4. Refresh page
5. Should see /socket.io/ with status 101

### Test 4: Console Errors
1. Open DevTools Console
2. Should NOT see:
   - ❌ "504 Gateway Timeout"
   - ❌ "WebSocket connection failed"
   - ❌ "Cannot connect to server"

---

## 🆘 IF STILL NOT WORKING

### Last Resort: Full Redeploy

**In Coolify:**
1. Go to Application Settings
2. Click "Delete Application"
3. Recreate from git repository
4. Select all services to deploy
5. Wait 5-10 minutes for full deployment

### Or: Check Coolify Status

1. Go to Coolify Dashboard → Settings
2. Check if Coolify itself is running properly
3. Check Docker daemon status
4. Check disk space (might be full)

### Emergency Diagnostics

**Commands (if you have terminal access):**
```bash
# Check if containers exist
docker ps -a | grep biztrix

# Check if redis is running
docker ps | grep redis

# Check nginx error
docker logs biztrixventure-web-1 | grep error

# Check API startup
docker logs biztrixventure-api-1 | tail -50

# Restart API only
docker-compose restart api

# Check port availability
docker port biztrixventure-api-1
```

---

## 📞 NEXT STEPS

1. **Check Coolify Dashboard** - Is API service running?
   - If NO: Click Restart and wait 30 seconds
   - If YES: Check logs for errors

2. **Review API Logs** - Any errors?
   - If YES: Note the error and troubleshoot above
   - If NO: Test API endpoint

3. **Test Health Endpoint** - Does API respond?
   - If NO: Network issue, check connectivity
   - If YES: API is working, check nginx

4. **Test Browser Login** - Can you login?
   - If NO: Check console for specific error
   - If YES: Going to Step 5

5. **Monitor for 1 Hour** - Any errors reappear?
   - Just watch the logs
   - Note any patterns
   - System should be stable

---

## ✅ EXPECTED SUCCESS

Once API is running and reachable:

✅ Login works without timeout
✅ WebSocket connects (status 101)
✅ Transfers can be created
✅ No 504 errors
✅ App is fully functional

---

## 📊 DEBUGGING INFO TO PROVIDE

If still stuck, provide:

1. **API service status** - Running / Not Running / Error
2. **Last 20 lines of API logs** - Copy/paste actual error
3. **Environment variables** - SUPABASE_URL, JWT_SECRET set?
4. **Coolify version** - Check dashboard
5. **Docker status** - Running / Stopped / Error

---

## 🎯 SUMMARY

The API must be running and reachable for any feature to work.

**Immediate Action:**
1. Check Coolify Dashboard
2. Ensure API service is Running
3. Check logs for errors
4. Restart if needed
5. Wait 30 seconds
6. Test in browser

Done! 🚀

