# 🔧 BizTrixVenture - 504 Gateway Timeout Fix Guide

## 🎯 Root Cause Analysis

The **504 Gateway Timeout** error occurs when:
1. ❌ **Nginx reverse proxy** tries to forward requests to the API backend
2. ❌ **API container is not running** or keeps crashing
3. ❌ API crashes due to:
   - Syntax/import errors in Node.js code
   - Missing environment variables
   - Missing dependencies
   - Unhandled exceptions at startup

---

## ✅ What I Fixed

### 1. **Startup Verification (NEW)**
Added `apps/api/src/startup-check.js` that validates:
- ✅ All required environment variables are set
- ✅ All route files exist
- ✅ All service files exist
- ✅ All middleware files exist
- ✅ Fails fast with clear error messages

### 2. **Better Error Handling**
Updated `apps/api/src/index.js`:
- ✅ Handles unhandled rejections
- ✅ Catches uncaught exceptions
- ✅ Shows startup errors clearly
- ✅ Listens on `0.0.0.0` for proper Docker networking

---

## 🚀 How to Deploy & Fix (Choose One)

### **Option 1: Using Docker Compose (Recommended)**

```bash
cd /c/Users/Abdul\ Manan/Desktop/biztrixventure

# Stop all containers
docker-compose down

# Remove old images to force rebuild
docker-compose rm -f api web

# Rebuild and start fresh
docker-compose up --build api web redis

# Watch logs for startup verification
# You should see: ✅ All startup checks passed!
```

### **Option 2: Using Coolify Dashboard**

1. Go to your Coolify dashboard
2. Find the deployment
3. Click **"Redeploy"** or **"Trigger Deploy"**
4. Wait for rebuild and deployment
5. Check logs for `✅ API running on port 4000`

### **Option 3: Manual Docker Rebuild**

```bash
# Build API image
docker build -t biztrixventure-api ./apps/api

# Run container with proper networking
docker run -d \
  --name biztrix-api \
  --network biztrix-network \
  -p 4000:4000 \
  -e SUPABASE_URL=<your_url> \
  -e SUPABASE_SERVICE_KEY=<your_key> \
  -e SUPABASE_ANON_KEY=<your_key> \
  -e JWT_SECRET=<your_secret> \
  biztrixventure-api

# Check logs
docker logs -f biztrix-api
```

---

## 🔍 Debugging Steps

### **Step 1: Check if API Container is Running**

```bash
# List running containers
docker ps | grep api

# If not running, check why it crashed:
docker logs biztrix-api -n 50
```

### **Step 2: Look for These Success Messages**

If API started successfully, you should see:
```
🔍 Running startup verification...

✓ Checking environment variables...
   ✅ All required environment variables are set

✓ Checking route files...
   ✅ All 15 route files found

✓ Checking service files...
   ✅ All 5 service files found

✓ Checking middleware files...
   ✅ All 3 middleware files found

✅ All startup checks passed! API is ready to start.

✅ BizTrixVenture API running on port 4000
📊 Environment: production
🔗 Routes registered: Auth, Companies, Users, ...
```

### **Step 3: If You See Errors**

Common errors and solutions:

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing environment variables` | .env file missing values | Add missing env vars to `.env` |
| `Missing route files` | File not committed or uploaded | Run `git add` and `git push` |
| `Failed to import route` | Syntax error in route file | Check route file for JS errors |
| `Cannot find module` | Missing dependency | Run `npm install` in api folder |
| `EADDRINUSE: address already in use` | Port 4000 in use | Kill process or change port |

### **Step 4: Test API Health**

Once API is running:

```bash
# Test health endpoint
curl http://localhost:4000/api/v1/health

# Expected response:
# {"status":"ok","timestamp":"2026-04-07T..."}
```

### **Step 5: Check Nginx Connectivity**

```bash
# Inside nginx container, verify it can reach API
docker exec biztrix-web curl http://api:4000/api/v1/health

# If this fails, Docker network is misconfigured
```

---

## 🛡️ Prevention Going Forward

### **When Making Code Changes:**

1. **Always test locally first:**
   ```bash
   cd apps/api
   npm install  # Make sure dependencies are installed
  npm start     # Test the app locally
   ```

2. **Verify all imports:**
   - Check that all imported files exist
   - Check for typos in import paths
   - Make sure no circular dependencies

3. **Run startup verification:**
   - The startup check will catch most errors immediately
   - Check API logs after any deployment

4. **Commit & push code:**
   ```bash
   git add -A
   git commit -m "..."
   git push origin main
   ```

5. **Redeploy in Docker:**
   - Coolify will auto-deploy when code is pushed
   - Monitor logs for startup messages

---

## 📋 Checklist Before Deploying

- [ ] All code syntax is valid (no `.js` errors)
- [ ] All imports have correct file paths
- [ ] `.env` file has all required variables
- [ ] `package.json` has all dependencies
- [ ] No circular imports
- [ ] Code is committed and pushed to `main`
- [ ] Docker images are being rebuilt
- [ ] API container is running (check `docker ps`)
- [ ] API startup check passes (check logs)
- [ ] Health endpoint responds (test `/api/v1/health`)

---

## 🆘 Still Getting 504?

If you're still seeing 504 after following this guide:

1. **Check docker logs:**
   ```bash
   docker logs <container-id> --tail 100
   ```

2. **Check nginx error logs:**
   ```bash
   docker logs biztrix-web --tail 100
   ```

3. **Verify docker networks:**
   ```bash
   docker network ls
   docker network inspect biztrix-network
   ```

4. **Delete everything and start fresh:**
   ```bash
   docker-compose down -v  # Remove volumes too
   docker system prune -a  # Remove unused images
   docker-compose up --build
   ```

---

## 📝 What Changed

**Commit:** `6b21dde`

**Files Added:**
- `apps/api/src/startup-check.js` - Startup verification

**Files Modified:**
- `apps/api/src/index.js` - Better error handling and logging

**Result:**
- API will fail fast if something is wrong
- Clear error messages explain what's missing
- Prevention of silent crashes that cause 504 timeouts
- Better visibility into startup process

---

## ✅ Next Steps

1. **Rebuild Docker images** using one of the deployment options above
2. **Monitor API logs** for startup messages
3. **Test the health endpoint** to verify API is running
4. **Login to the application** - you should see the login page
5. **Enjoy!** 🎉

If any issues persist, share the **API container logs** and I can help diagnose!
