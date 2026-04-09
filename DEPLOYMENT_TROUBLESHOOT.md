# 🚨 Deployment Troubleshooting - 504 Errors Persisting

## Current Status: ⏱️ Delayed/Stuck Rebuild

You're still seeing:
- ❌ 504 Gateway Timeout (API down)
- ❌ callback.mp3 (old code, not new .wav)
- ❌ POST /auth/login failing
- ⚠️ React nesting warning (non-blocking)

**This means:** Coolify rebuild is either **stuck** or **taking longer than expected**

---

## 🔍 Immediate Diagnostic Steps

### Step 1: Check Coolify Deployment Status

**In Coolify Dashboard:**
```
1. Go to: Your Application → Deployments
2. Look at the latest deployment
3. Check status:
   - "In Progress" = Still building
   - "Failed" = Build error
   - "Success" = Already rebuilt (but 504s suggest containers not ready)
4. Click on deployment to see logs
```

### Step 2: Check Container Status
```
In Coolify:
1. Go to: Your Service → Containers
2. Check if containers are "Running" or "Restarting"
3. If "Restarting" = Still rebuilding
4. If "Stopped/Error" = Build failed
```

### Step 3: View Build Logs
```
In Coolify:
1. Go to: Deployments → Latest Build
2. Click on build number
3. Scroll to bottom for error messages
4. Look for:
   ✅ "Build successful"
   ❌ "Exited with code 1"
   ❌ "Docker build failed"
```

---

## ⚡ Quick Fixes to Try

### Option 1: Manual Rebuild (Recommended)

**In Coolify:**
```
1. Go to Your Service
2. Click "Rebuild" button (top right)
3. Wait for build to start
4. Watch logs for:
   - "Building Docker image..."
   - "Docker build complete"
   - "Containers starting..."
   - "nginx: master process started"
5. Once you see those messages, wait 2-3 more minutes
6. Hard refresh browser: Ctrl+Shift+R
```

### Option 2: Force Fresh Deploy
```
In Coolify:
1. Stop all containers
2. Wait 30 seconds
3. Click "Deploy" button
4. Watch logs until complete
5. Hard refresh browser
```

### Option 3: Check for Build Errors
```
If build is stuck:
1. Go to Deployments tab
2. Look at error logs
3. Common issues:
   - npm install timeout (try rebuild again)
   - Docker out of disk space (contact support)
   - Port already in use (restart container)
```

---

## 🛠️ What to Look For in Coolify Logs

### ✅ **Good Signs** (Build working):
```
✅ "npm install"
✅ "npm run build"
✅ "Build complete"
✅ "Docker build successful"
✅ "api service started"
✅ "redis: Starting..."
✅ "worker: Starting..."
✅ "nginx: master process started"
```

### ❌ **Bad Signs** (Build failed):
```
❌ "Exited with code 1"
❌ "npm ERR!"
❌ "Docker build failed"
❌ "ENOSPC: no space left"
❌ "Address already in use"
❌ "Connection refused" (services not starting)
```

---

## 📊 Deployment Health Check

**Run this to diagnose:**

1. **Browser Console - Check if old or new code:**
   ```javascript
   // If undefined or shows localhost = OLD code (rebuild failed)
   console.log(import.meta.env.VITE_API_URL)

   // If shows https://tokocrypto.live/api/v1 = NEW code (rebuild worked)
   ```

2. **Network Tab - Check sound files:**
   ```
   Expected with NEW code: /sounds/transfer.wav 200 OK
   Shows with OLD code: /sounds/callback.mp3 504
   ```

3. **Check Docker containers:**
   ```bash
   # In Coolify terminal:
   docker ps

   # Should show 4 running containers:
   - api (port 4000)
   - web/nginx (port 80)
   - redis
   - worker

   # If any is missing or "Restarting" = Issue
   ```

---

## 🚀 Complete Recovery Steps

**If rebuild is truly stuck:**

1. **In Coolify:**
   ```
   Stop Service → Wait 30 sec → Start Service
   ```

2. **Wait for everything to start:**
   - Redis starts first
   - API starts next (depends on Redis)
   - Worker starts (depends on API)
   - nginx starts last (depends on API for proxy)

3. **Monitor logs:**
   ```
   Watch for each service log message
   Should take 2-3 minutes total
   ```

4. **Test in browser:**
   ```
   Hard refresh: Ctrl+Shift+R
   Try login
   Check console for errors
   ```

---

## ⏱️ New Timeline

**If you restart now:**
- +1 min: Containers stopping
- +30 sec: Waiting
- +2-3 min: Containers starting in order
- +3-4 min: nginx ready
- **+5 min total: Service should be up**

---

## 🎯 Action Items

### RIGHT NOW:
1. **Open Coolify Dashboard**
2. **Go to Deployments tab**
3. **Check latest build status** (Success/Failed/In Progress)
4. **If "In Progress" for >10 mins:** Click rebuild
5. **If "Failed":** Check error logs below
6. **Watch logs** for those "good signs"

### THEN:
1. Wait for all services to start
2. Hard refresh browser (Ctrl+Shift+R)
3. Check console output
4. Try login again
5. Report any NEW errors

---

## 📞 If Still Not Working After 15 Minutes

Check these in order:

1. **Did rebuild complete?**
   - Logs should show "Deployment successful"

2. **Are all 4 containers running?**
   - docker ps should show: api, nginx, redis, worker

3. **Can you reach API health check?**
   ```bash
   curl https://tokocrypto.live/api/v1/health
   # Should return: {"status":"ok"}
   ```

4. **Did nginx restart with new config?**
   - Check for "nginx: master process" in logs

5. **Is VITE_API_URL set correctly?**
   - Check: import.meta.env.VITE_API_URL in console
   - Should be: https://tokocrypto.live/api/v1

---

## 🔧 Advanced: Force Full Restart

**Only if above doesn't work:**

In Coolify terminal:
```bash
# Stop everything
docker compose down

# Wait 30 seconds
sleep 30

# Start everything fresh
docker compose up -d

# Watch logs
docker compose logs -f
```

---

## ✅ Success Indicators

After deployment completes:
- ✅ No 504 errors
- ✅ Login POST succeeds (200 OK)
- ✅ Notifications load (✅ checkmark icon in console)
- ✅ Sounds load as .wav files (200 OK)
- ✅ Socket.io connects (Network → WS tab)
- ✅ Notification bell appears in header
- ✅ Can create test notification

---

## 📝 Report Back With:

1. **Coolify deployment status** (Success/Failed/In Progress)
2. **Latest log messages** (copy last 10 lines from logs)
3. **Browser console output** of:
   ```javascript
   console.log(import.meta.env.VITE_API_URL)
   ```
4. **Network tab errors** (what shows 504)
5. **Docker ps output** (which containers running)

---

**Next: Check Coolify Deployments tab and report what you find!**
