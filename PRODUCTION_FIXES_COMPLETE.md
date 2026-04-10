# 🔴 CRITICAL: Production Issues Diagnosis & Complete Fix Guide

**Issues:** WebSocket fails + Login fails + 504 Gateway Timeout
**Root Cause:** API backend service not accessible through nginx proxy
**Severity:** CRITICAL (system non-functional)

---

## 🔍 DIAGNOSIS

### Why This Happens in Production

```
Browser Request:
  1. Browser → https://tokocrypto.live/api/v1/transfers
  2. Nginx receives request on port 80
  3. Nginx tries to proxy to: http://api:4000
  4. ❌ Docker DNS can't resolve "api" or service not running
  5. ❌ Connection refused/timeout
  6. ❌ Returns 504 Gateway Timeout

WebSocket Failure (same root cause):
  1. Browser → wss://tokocrypto.live/socket.io/
  2. Nginx tries to upgrade to WebSocket
  3. ❌ Can't reach api:4000
  4. ❌ Connection timeout
  5. ❌ WebSocket closes

Login Failure (cascading):
  1. User tries to login
  2. POST /auth/login sent
  3. ❌ Gets 504 (can't reach API)
  4. ❌ Login fails
```

---

## ✅ COMPLETE FIX (Step by Step)

### PART 1: Verify API Service is Running

**Run these commands:**

```bash
# Check if containers exist
docker ps -a | grep biztrix

# Check specific API container
docker ps | grep api

# If not running, check why it stopped
docker logs biztrixventure-api-1 --tail 100
```

**Expected Output:**
```
biztrixventure-api-1       node src/index.js        Up 5 minutes   0.0.0.0:4000->4000/tcp
```

**If API is NOT running:**
```bash
# Start it
docker-compose up -d api

# Wait 10 seconds
sleep 10

# Check logs
docker logs -f biztrixventure-api-1
```

**Look for in logs:**
```
✅ GOOD: "✅ BizTrixVenture API running on port 4000"
❌ BAD: "Error:", "Cannot connect", "EADDRINUSE", "Exit"
```

---

### PART 2: Verify Docker Network Connectivity

**From web container, test if it can reach api:**

```bash
# Test DNS resolution
docker exec biztrixventure-web-1 nslookup api

# Test connectivity
docker exec biztrixventure-web-1 curl -v http://api:4000/api/v1/health

# Test from inside api container
docker exec biztrixventure-api-1 curl http://localhost:4000/api/v1/health
```

**Expected Responses:**
```
✅ GOOD (DNS): "Address: 172.XX.XX.XX" (IP address)
✅ GOOD (curl): HTTP 200 with "status":"ok"
```

**If connectivity fails:**
```bash
# Verify network exists
docker network ls | grep biztrix-network

# Verify containers on network
docker network inspect biztrix-network | grep Name -A 20

# Restart network
docker-compose down
docker-compose up -d
```

---

### PART 3: Verify Nginx Configuration

**Check nginx template:**

```bash
# Verify nginx syntax
docker exec biztrixventure-web-1 nginx -t

# Check nginx config
docker exec biztrixventure-web-1 cat /etc/nginx/nginx.conf | grep -A 10 "upstream"

# Check if proxy is working
docker exec biztrixventure-web-1 curl -v http://localhost/api/v1/health
```

**Expected:**
```
✅ "nginx: configuration file /etc/nginx/nginx.conf test is successful"
✅ Contains upstream block: "upstream api_backend"
✅ curl returns 200 OK (not 504)
```

---

### PART 4: Verify Environment Variables in API

**Check if all required env vars are set:**

```bash
docker exec biztrixventure-api-1 env | grep -E "SUPABASE|JWT|NODE_ENV|PORT"
```

**Must have:**
```
SUPABASE_URL=https://ujxrlkbatxmunrwjkaxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
JWT_SECRET=biztrix-crm-...
NODE_ENV=production
PORT=4000
```

**If missing, add in Coolify:**
1. Go to Coolify
2. API Service → Variables
3. Add missing variables
4. Restart service

---

## 🔧 SPECIFIC FIXES

### Fix 1: Socket.io Backend Configuration

Create/Update: `apps/api/src/services/socket.js`

**Key fixes needed:**

```javascript
// CORS ORIGIN - CRITICAL for production
const corsOrigin = process.env.FRONTEND_URL ?
  process.env.FRONTEND_URL === '*' ? true : process.env.FRONTEND_URL :
  'https://tokocrypto.live';  // ← Add actual domain

// Socket.io options - optimized for nginx proxy
const ioOptions = {
  cors: {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  },
  transports: ['websocket', 'polling'],  // ← Fallback critical
  allowEIO3: true,                       // ← Socket.io 2.x compatibility
  pingInterval: 30000,
  pingTimeout: 60000,
  upgradeTimeout: 10000,                 // ← Add timeout

  // Connection pooling
  maxHttpBufferSize: 1e6,               // 1MB max
  perMessageDeflate: false,             // Disable compression for nginx

  // Parser configuration
  parser: require('socket.io-parser')
};
```

---

### Fix 2: Frontend Socket.io Client Configuration

Create/Update: `apps/web/src/lib/socket.js`

**Enhanced connection logic:**

```javascript
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function initSocket() {
  if (socket?.connected) return socket;

  const isHttps = window.location.protocol === 'https:';
  const protocol = isHttps ? 'wss' : 'ws';

  // ✅ FIX: Explicit socket.io path and namespace
  const socketUrl = isHttps ?
    `${window.location.origin}` :
    `ws://${window.location.hostname}:${window.location.port}`;

  socket = io(socketUrl, {
    // Transport configuration - CRITICAL for nginx
    transports: ['websocket', 'polling'],  // WebSocket primary, polling fallback
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    // Path and namespace
    path: '/socket.io/',                   // ✅ Explicit path for nginx
    namespace: '/',                        // ✅ Default namespace

    // Timeout and connection settings
    timeout: 20000,                        // Increased for slow networks
    connect_timeout: 20000,
    ackTimeout: 10000,

    // Credentials and security
    withCredentials: true,
    autoConnect: false,                    // Manual control over connection
    secure: isHttps,

    // Upgrade settings
    upgradeTimeout: 10000,

    // Authentication tokens - ✅ FIX: Send auth header
    auth: {
      token: useAuthStore.getState().token || localStorage.getItem('auth-store-token')
    }
  });

  return socket;
}

export function connectSocket() {
  if (!socket) {
    socket = initSocket();
  }

  const { user, token } = useAuthStore.getState();

  // Only connect if authenticated
  if (!socket.connected && user && token) {
    socket.connect();
  } else if (!user) {
    console.log('Socket not connecting - user not authenticated');
    return socket;
  }

  // ✅ FIX: Better error handling with detailed logging
  socket.off('connect');
  socket.on('connect', () => {
    console.log('✓ Socket connected (id: ' + socket.id + ')');
    reconnectAttempts = 0;

    // Emit join event with user details
    socket.emit('join', {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      socketId: socket.id
    });
  });

  socket.off('connect_error');
  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    console.error(
      `Socket connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`,
      {
        message: error?.message,
        code: error?.code,
        type: error?.type,
        data: error?.data
      }
    );

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        '❌ Max socket reconnection attempts reached.',
        'API may be unavailable. App will use polling for data updates.'
      );
    }
  });

  socket.off('disconnect');
  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);

    // Auto-reconnect on specific reasons
    if (reason === 'io server disconnect' || reason === 'transport close') {
      setTimeout(() => {
        if (user && token) {
          socket.connect();
        }
      }, 2000);
    }
  });

  // ✅ FIX: Error event listener
  socket.off('error');
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
  }
}

export function getSocket() {
  return socket;
}

export function isSocketConnected() {
  return socket?.connected ?? false;
}
```

---

### Fix 3: Nginx WebSocket Proxy Configuration

Ensure `apps/web/nginx.conf` has:

```nginx
upstream api_backend {
    server api:4000 max_fails=3 fail_timeout=30s;
    keepalive 32;               # ← Connection pooling
}

server {
    listen 80 default_server;
    server_name _;

    # ===== API PROXY =====
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;

        # ✅ Connection headers
        proxy_set_header Connection "";
        proxy_set_header Upgrade $http_upgrade;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts - CRITICAL
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # ===== WEBSOCKET PROXY =====
    location /socket.io/ {
        proxy_pass http://api_backend;

        # ✅ WebSocket upgrade
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";     # ← CRITICAL

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeouts for WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 30s;

        # Keep connection alive
        proxy_buffering off;
    }
}
```

---

### Fix 4: Enhanced Login Error Handling

Update: `apps/web/src/store/auth.js`

```javascript
login: async (email, password) => {
  set({ isLoading: true, error: null });
  try {
    // ✅ FIX: Better error handling
    const response = await api.post('/auth/login', { email, password });

    if (response.data.totp_required) {
      set({
        intermediateToken: response.data.intermediate_token,
        isLoading: false,
      });
      return { totpRequired: true };
    }

    set({
      user: response.data.user,
      token: response.data.token,
      intermediateToken: null,
      isLoading: false,
    });

    // ✅ FIX: Connect socket after successful login
    const { connectSocket } = await import('../lib/socket');
    setTimeout(() => connectSocket(), 500);

    return { success: true };
  } catch (error) {
    let message = 'Login failed';

    // ✅ FIX: Better error detection
    if (error.response?.status === 504) {
      message = 'Server unavailable (504 Gateway Timeout). Please try again.';
    } else if (error.response?.status === 401) {
      message = 'Invalid email or password';
    } else if (error.code === 'ECONNREFUSED') {
      message = 'Cannot connect to server. Check your internet connection.';
    } else if (error.code === 'ENOTFOUND') {
      message = 'Cannot reach server. DNS resolution failed.';
    } else if (error.message === 'timeout of 30000ms exceeded') {
      message = 'Request timeout. Server may be slow or unavailable.';
    } else {
      message = error.response?.data?.error || error.message;
    }

    set({ error: message, isLoading: false });
    return { error: message };
  }
}
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before going live, verify:

- [ ] API container is running: `docker ps | grep api`
- [ ] API logs show success: `docker logs -f biztrixventure-api-1`
- [ ] Nginx can reach API: `docker exec biztrixventure-web-1 curl http://api:4000/api/v1/health`
- [ ] WebSocket path configured: `/socket.io/` in nginx
- [ ] CORS origin set: `FRONTEND_URL` environment variable
- [ ] All env vars in API: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`
- [ ] Nginx config valid: `docker exec biztrixventure-web-1 nginx -t`
- [ ] Test login in browser (clear cache first)
- [ ] Test WebSocket: DevTools → Network → look for `/socket.io/`
- [ ] Test transfer creation: Should not get 504

---

## 🆘 IF STILL FAILING

### Debug Checklist:

**API not starting?**
```bash
docker logs -f biztrixventure-api-1
# Look for: "Error", "Cannot connect", "EADDRINUSE", "Missing environment"
```

**Nginx can't reach API?**
```bash
docker exec biztrixventure-web-1 curl -v http://api:4000
# If fails: containers not on same network, or API crashed
```

**WebSocket still won't connect?**
```
1. Open DevTools (F12)
2. Go to Network tab
3. Try WebSocket connection
4. Look for /socket.io/ request
5. Should show status 101 (upgrade)
6. If 504: API not reachable
```

**Login still fails?**
```bash
1. Clear browser cache completely (Ctrl+Shift+Delete)
2. Check CORS origin: should match FRONTEND_URL
3. Check API logs for auth errors
4. Verify Supabase credentials in env vars
```

---

## 📊 EXPECTED AFTER FIX

✅ **API Calls:**
- GET /api/v1/health → 200
- POST /auth/login → 200 or 401 (not 504)
- All API endpoints → no 504 errors

✅ **WebSocket:**
- Browser → DevTools → Network → /socket.io/
- Status should be 101 (protocol upgrade)
- Socket.io says "✓ Socket connected"

✅ **Login:**
- User can login successfully
- Token stored in localStorage
- User data loads
- Socket connects automatically

✅ **Transfer Creation:**
- Can create, list, and update transfers
- No 504 errors
- Real-time updates via WebSocket

