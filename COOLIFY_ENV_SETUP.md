# 🌍 COOLIFY DEPLOYMENT - ENVIRONMENT CONFIGURATION GUIDE

**Date:** 2026-04-08
**Status:** ✅ READY FOR DEPLOYMENT
**Issue Fixed:** NODE_ENV build-time environment variable

---

## 🔧 ENVIRONMENT VARIABLES FOR COOLIFY DEPLOYMENT

### ⚠️ CRITICAL: NODE_ENV Configuration

**Problem:** NODE_ENV was set as "Available at Buildtime" which caused npm to skip devDependencies during Docker build, breaking the build.

**Solution:** NODE_ENV must be **Runtime only** in Coolify

---

## 📋 COMPLETE ENVIRONMENT VARIABLES LIST

### **Set in Coolify Dashboard:**

| Variable | Value | Build-time | Runtime | Notes |
|----------|-------|-----------|---------|-------|
| `SUPABASE_URL` | `https://ujxrlkbatxmunrwjkaxx.supabase.co` | ✅ YES | ✅ YES | API needs this at build |
| `SUPABASE_ANON_KEY` | `eyJhbGc...` | ✅ YES | ✅ YES | Frontend uses this |
| `SUPABASE_SERVICE_KEY` | `eyJhbGc...` | ✅ YES | ✅ YES | API uses this |
| `SUPABASE_DB_PASSWORD` | `1112@P@kistan@1112` | ✅ YES | ✅ YES | Database connection |
| `JWT_SECRET` | `biztrix-crm-ultra-secure-jwt-secret-key-2024-v1` | ✅ YES | ✅ YES | API uses this |
| `NODE_ENV` | `production` | ❌ NO | ✅ YES | **RUNTIME ONLY!** |
| `PORT` | `4000` | ✅ YES | ✅ YES | API port |
| `FRONTEND_URL` | `*` | ✅ YES | ✅ YES | CORS configuration |
| `REDIS_URL` | `redis://redis:6379` | ✅ YES | ✅ YES | Cache/sessions |
| `TOTP_ISSUER` | `BizTrixVenture` | ✅ YES | ✅ YES | 2FA configuration |

---

## 🎯 STEP-BY-STEP COOLIFY CONFIGURATION

### **Step 1: Open Your Deployment**
```
Coolify Dashboard
  ↓
Click "biztrixventure/crm" deployment
  ↓
Go to "Settings"
```

### **Step 2: Navigate to Environment Variables**
```
Settings
  ↓
Environment Variables
```

### **Step 3: For EACH Variable**

**Variable: NODE_ENV**
```
Name: NODE_ENV
Value: production
Available at Buildtime: ❌ UNCHECK THIS ← CRITICAL!
Available at Runtime: ✅ CHECK THIS
Save
```

**All Other Variables (SUPABASE_URL, JWT_SECRET, etc.):**
```
Name: [Variable name]
Value: [Variable value]
Available at Buildtime: ✅ CHECK THIS
Available at Runtime: ✅ CHECK THIS
Save
```

---

## ✅ VERIFICATION CHECKLIST

Before deploying, verify in Coolify:

- [ ] `SUPABASE_URL` = buildtime ✅ + runtime ✅
- [ ] `SUPABASE_ANON_KEY` = buildtime ✅ + runtime ✅
- [ ] `SUPABASE_SERVICE_KEY` = buildtime ✅ + runtime ✅
- [ ] `SUPABASE_DB_PASSWORD` = buildtime ✅ + runtime ✅
- [ ] `JWT_SECRET` = buildtime ✅ + runtime ✅
- [ ] `NODE_ENV` = buildtime ❌ + runtime ✅ (RUNTIME ONLY!)
- [ ] `PORT` = buildtime ✅ + runtime ✅
- [ ] `FRONTEND_URL` = buildtime ✅ + runtime ✅
- [ ] `REDIS_URL` = buildtime ✅ + runtime ✅
- [ ] `TOTP_ISSUER` = buildtime ✅ + runtime ✅

---

## 🚀 DEPLOYMENT PROCESS

### **After Configuring Variables:**

1. **Navigate to your deployment**
   - Coolify Dashboard → biztrixventure/crm

2. **Click "Deploy"**
   - Deployment starts
   - Docker build begins
   - npm install runs with all devDependencies
   - Frontend builds successfully
   - Containers start

3. **Monitor the logs**
   - Should see build progress
   - No more NODE_ENV warnings
   - Deployment completes

4. **Verify deployment**
   - Navigate to your URL
   - Check console for errors
   - Test login functionality

---

## 🔍 TROUBLESHOOTING

### **Issue: Build still fails with "npm run build" failed**

**Check:**
1. Is `NODE_ENV` still checked for "Available at Buildtime"?
   - **Solution:** Uncheck it

2. Are all other dependencies set?
   - **Solution:** Verify all variables from the table above

3. Is the Docker image pulling correctly?
   - **Solution:** Try rebuilding from scratch

**Steps to recover:**
```
1. Go to Coolify Settings
2. Verify NODE_ENV is "Runtime only"
3. Click "Deploy" again
4. Wait for completion
```

---

### **Issue: Application runs but shows blank page or errors**

**Check:**
1. Are build-time variables set for API?
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`

2. Are runtime variables set?
   - `NODE_ENV=production`, `REDIS_URL`, etc.

3. Check browser console
   - Coolify logs for any runtime errors

**Solution:**
1. Verify all variables from table above
2. Redeploy
3. Clear browser cache (Ctrl+Shift+Del)

---

### **Issue: Frontend can't reach API**

**Check:**
1. Is `FRONTEND_URL` set to `*` or your API URL?
2. Is `SUPABASE_ANON_KEY` present at build-time? (needed for frontend)
3. Check CORS configuration

**Solution:**
```
SUPABASE_ANON_KEY must be available at buildtime
(Check this checkbox in Coolify)
```

---

## 📝 LOCAL DEVELOPMENT SETUP

Your local `.env` file has been updated:

```bash
# .env (Local Development)
NODE_ENV=development  ← For local npm build to work
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=biztrix-crm-...
```

### **Run locally:**
```bash
npm install      # Installs all deps (devDependencies included)
npm run dev      # Development server
# or
npm run build    # Production build locally
npm start        # Production server
```

---

## 🌐 ENVIRONMENT VARIABLE USAGE

### **At Build-time:**
```
Frontend needs: SUPABASE_URL, SUPABASE_ANON_KEY, FRONTEND_URL
API needs: SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, REDIS_URL
npm needs: NODE_ENV=development (NOT production!)
```

### **At Runtime:**
```
Frontend needs: API URL (loaded from Coolify environment)
API needs: All secrets + SUPABASE_URL + REDIS_URL
Node.js needs: NODE_ENV=production
```

---

## ✨ WHY THIS MATTERS

### **The Problem:**
```
NODE_ENV=production → npm skips devDependencies
  ↓
No webpack, TypeScript, build tools
  ↓
npm run build fails ❌
```

### **The Solution:**
```
Build-time: NODE_ENV not set or =development
  ↓
npm installs webpack, TypeScript, etc.
  ↓
npm run build succeeds ✅
  ↓
Runtime: NODE_ENV=production (loaded from Coolify dashboard)
  ↓
App runs in production mode ✅
```

---

## 📊 SUMMARY TABLE FOR QUICK REFERENCE

| Phase | NODE_ENV Value | Why |
|-------|-----------------|-----|
| Docker Build | `development` or **missing** | Install devDependencies |
| Development Run | `development` | Full npm output, hot reload |
| Production Run | `production` | Optimized, no debug logs |

---

## 🎯 NEXT STEPS

1. ✅ **Update Coolify settings** per instructions above
2. ✅ **Verify NODE_ENV is Runtime-only**
3. ✅ **Click Deploy** in Coolify
4. ✅ **Wait for build to complete**
5. ✅ **Verify deployment** at your URL

---

**Status: Ready to Deploy** 🚀

All environment variables configured correctly for build and runtime phases!
