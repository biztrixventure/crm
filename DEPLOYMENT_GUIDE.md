# 🚀 BizTrixVenture Production Deployment Guide

**Last Updated:** 2026-04-10
**Status:** ✅ Production Ready

---

## 📋 Pre-Deployment Checklist

- [x] All environment variables configured
- [x] Production build tested (web: ✅ API: ✅ Worker: ✅)
- [x] Security vulnerabilities addressed
- [x] Docker images tested
- [x] Code imports verified and fixed
- [x] Compression middleware enabled
- [x] Rate limiting configured
- [x] Request size limits enabled
- [x] Graceful degradation for missing services (Redis)

---

## 🔧 Environment Variables for Production

**Required in Coolify/deployment platform (set as "Runtime only"):**

```bash
# === SECURITY ===
NODE_ENV=production           # MUST be set as "Runtime only", not "Available at buildtime"
JWT_SECRET=<your-secret-key>

# === SUPABASE ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_DB_PASSWORD=<password>

# === CORS ===
FRONTEND_URL=https://your-domain.com    # or "*" for all origins
CORS_ORIGIN=https://your-domain.com

# === REDIS ===
REDIS_URL=redis://redis:6379
# OR for Upstash managed Redis:
REDIS_URL=rediss://default:password@host:port

# === API CONFIGURATION ===
API_PORT=4000
REQUEST_TIMEOUT=30000        # 30 seconds
REQUEST_BODY_LIMIT=10mb      # Prevent DOS
ENABLE_COMPRESSION=true      # Gzip compression

# === SOCKET.IO ===
SOCKET_PING_INTERVAL=30000
SOCKET_PING_TIMEOUT=60000
ENABLE_SOCKET_POLLING=true   # Fallback if WebSocket fails

# === OPTIONAL PERFORMANCE ===
RATE_LIMIT_MAX_REQUESTS=100
SEARCH_RATE_LIMIT_MAX=30
DEFAULT_PAGE_LIMIT=100
MAX_PAGE_LIMIT=500

# === LOGGING ===
NODE_ENV=production          # Also sets log level to 'info'
LOG_LEVEL=info               # debug, info, warn, error
```

---

## 🐳 Docker Deployment with Coolify

### 1. **Upload to Coolify**

The application uses docker-compose.yaml with three main services:

- **api** - Express.js backend (Node 18-alpine)
- **web** - React frontend (Nginx-alpine)
- **worker** - Callback scheduler (Node 18-alpine)
- **redis** - Redis cache (7-alpine)

### 2. **Coolify Configuration**

**Service: API**
- Port: 4000
- Health check: `GET /api/v1/health`
- Environment: Set as shown above (all as "Runtime only" except SUPABASE keys)
- CPU/Memory: Adjust based on traffic (recommend 512MB minimum per service)

**Service: Web**
- Port: 80
- Environment: No additional env vars needed
- Volumes: None required (handled by docker-compose)

**Service: Worker**
- Port: None exposed
- Environment: Only SUPABASE_URL, SUPABASE_SERVICE_KEY, REDIS_URL, API_URL
- CPU/Memory: 256MB minimum

**Service: Redis**
- Port: 6379 (internal only, not exposed)
- Persistence: Enabled (appendonly.aof)
- Memory: Configured to 256MB with LRU eviction

### 3. **Docker Compose Override for Coolify**

If using Coolify's git deployment:
1. Push code to repository
2. In Coolify, select "Docker Compose"
3. Point to: `docker-compose.yaml`
4. Set environment variables in Coolify UI
5. Deploy

---

## 🚀 Deployment Steps

### Option A: Using Coolify UI
1. Create new application in Coolify
2. Select "Docker Compose" type
3. Repository: `<your-repo-url>`
4. Branch: `main`
5. Compose file: `docker-compose.yaml`
6. Set environment variables one by one
7. Click "Deploy"

### Option B: Manual Docker Deployment
```bash
# Clone repository
git clone <repo-url>
cd biztrixventure

# Set environment file
cat > .env.prod << EOF
NODE_ENV=production
JWT_SECRET=...
SUPABASE_URL=...
# ... rest of env vars
EOF

# Start with docker-compose
docker-compose -f docker-compose.yaml up -d

# View logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f worker
```

---

## ✅ Verification After Deployment

### 1. **API Health Check**
```bash
curl https://your-domain.com/api/v1/health
# Expected: {"status":"ok","timestamp":"2026-04-10T..."}
```

### 2. **Web App**
Open `https://your-domain.com` and verify:
- [ ] Login page loads
- [ ] Static assets load (CSS, JS)
- [ ] No 404 errors in console

### 3. **Socket.io Connection**
Open browser DevTools → Network → WS and verify:
- [ ] WebSocket connection to `/socket.io/`
- [ ] Connection establishes within 3 seconds

### 4. **Redis Check**
```bash
# From API container
# API gracefully continues without Redis, but caching disabled
curl -X GET https://your-domain.com/api/v1/health
```

### 5. **Database Check**
```bash
# Login and verify data loads
# Check transfer list: https://your-domain.com/transfers
# Check users: https://your-domain.com/users
```

---

## 📊 Performance Optimizations Enabled

✅ **Compression Middleware**
- Gzip compression for responses > 1KB
- CSV exports: 60-80% size reduction
- Configured in nginx for frontend assets

✅ **Rate Limiting**
- Search endpoint: 30 req/min
- Auth endpoint: 10 attempts/15min
- General API: 100 req/min

✅ **Request Size Limits**
- Max body size: 10MB (configurable)
- Prevents DOS attacks from massive uploads

✅ **Security Headers**
- Helmet.js enabled
- CORS configured
- X-Frame-Options, Content-Type-Options, XSS-Protection

✅ **Redis Caching**
- Phone number lookups: 24h TTL
- User sessions: 8h TTL
- Notifications: 5min TTL

✅ **Database Query Optimization**
- Pagination enforced (max 500 items/page)
- Proper role-based filtering
- Transaction management

---

## 🔒 Security Checklist

- [x] **Environment Variables**: All secrets in Coolify (not committed)
- [x] **HTTPS**: Nginx redirects to HTTPS via reverse proxy
- [x] **CORS**: Configured for frontend domain only
- [x] **JWT**: Validated on every request
- [x] **Rate Limiting**: Prevents brute force attacks
- [x] **Request Size Limits**: DOS protection
- [x] **Security Headers**: Helmet.js configured
- [x] **SQL Injection**: Supabase parameterized queries
- [x] **XSS Protection**: React escapes by default
- [x] **Dependencies**: Regular npm audit checks

### Security Hardening

```bash
# Check for vulnerabilities
npm audit

# Keep dependencies updated
npm update
npm upgrade

# In production, only run security updates
npm update --save-prod
```

---

## 📈 Monitoring & Logs

### Accessing Logs in Coolify

**API Container:**
```bash
docker logs -f biztrixventure-api-1 --tail 100
```

**Web Container:**
```bash
docker logs -f biztrixventure-web-1 --tail 100
```

**Worker Container:**
```bash
docker logs -f biztrixventure-worker-1 --tail 100
```

### Key Metrics to Monitor

1. **API Health**
   - Uptime: Should be 99%+
   - Response time: < 200ms typical
   - Error rate: < 1%

2. **Database**
   - Connection pool status
   - Query slow-log
   - Transaction rollback rate

3. **Redis**
   - Memory usage
   - Hit/miss ratio
   - Connected clients

4. **Web**
   - Service worker sync status
   - Build cache hits
   - 404 responses

---

## 🔄 Rollback Procedure

If deployment fails:

```bash
# Stop current deployment
docker-compose down

# Revert to last stable version
git revert <commit-hash>
docker-compose up -d

# Check status
docker-compose logs -f api
```

---

## 📝 Production Deployment Maintenance

### Daily
- Monitor error logs for 401/403 errors
- Check Redis memory usage
- Verify backups running

### Weekly
- Review API response times
- Check rate limit metrics
- Validate CORS configuration

### Monthly
- Run npm audit
- Update security patches
- Review unused database records
- Optimize slow queries

### Quarterly
- Major dependency updates
- Performance profiling
- Disaster recovery drill

---

## 🆘 Troubleshooting

### Issue: Database Connection Errors
**Solution:** Verify SUPABASE_URL and SUPABASE_SERVICE_KEY in Coolify

### Issue: Redis Connection Errors
**Solution:** API continues without Redis (graceful degradation). If caching needed, verify REDIS_URL format

### Issue: CORS Errors in Frontend
**Solution:** Update FRONTEND_URL in Coolify environment (not built-in variable)

### Issue: Socket.io Connection Fails
**Solution:** Verify nginx proxy headers for WebSocket upgrade. Falls back to polling.

### Issue: High Memory Usage
**Solution:**
- Increase Docker container memory limits
- Reduce REDIS max memory if applicable
- Review active connections

### Issue: Slow API Responses
**Solution:**
- Check database query times in Supabase
- Verify Redis cache is functioning
- Check network latency
- Review rate limit bucket status

---

## 📚 Additional Resources

- **Coolify Docs:** https://coolify.io/docs
- **Docker Compose:** https://docs.docker.com/compose/
- **Supabase:** https://supabase.com/docs
- **Express.js:** https://expressjs.com/
- **React:** https://react.dev/

---

## ✨ Deployment Complete!

Your BizTrixVenture application is now production-ready.

**Next Steps:**
1. Set environment variables in Coolify
2. Deploy using docker-compose
3. Run verification checks
4. Monitor logs and metrics
5. Set up alerts for critical metrics

**Support:** For issues, check logs first, then review this guide.

