# 🚀 Local Development Setup - Complete Guide

## Quick Start (3 Terminal Tabs)

### Prerequisites
Make sure you have:
- Node.js 18+ installed
- npm or yarn package manager
- PostgreSQL/Supabase account configured
- Environment variables set up

---

## Step 1: Setup Environment Variables

### Create `.env` in project root

**File:** `apps/api/.env`
```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars

# Server
PORT=3000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173

# Redis (optional, for queue/cache)
REDIS_URL=redis://localhost:6379

# ViciDial (if needed)
VICIDIAL_API_USER=optional
VICIDIAL_API_PASS=optional
VICIDIAL_URL=optional
```

**File:** `apps/web/.env`
```bash
# API Configuration
VITE_API_URL=http://localhost:3000/api/v1

# Environment
VITE_ENV=development
```

---

## Step 2: Run the Services (3 Terminal Tabs)

### Terminal 1 - Backend API Server (Port 3000)
```bash
cd /c/Users/Abdul\ Manan/Desktop/biztrixventure

# Install dependencies (first time only)
npm install --prefix apps/api

# Start API server
npm run dev --prefix apps/api

# Expected output:
# ✅ Environment variables validated
# ✅ Socket.io initialized
# ✅ Server running on port 3000
# ✅ Health check: GET http://localhost:3000/api/v1/health
```

### Terminal 2 - Frontend Development Server (Port 5173)
```bash
cd /c/Users/Abdul\ Manan/Desktop/biztrixventure

# Install dependencies (first time only)
npm install --prefix apps/web

# Start frontend dev server
npm run dev --prefix apps/web

# Expected output:
# ✅ Local:   http://localhost:5173/
# ✅ press h to show help
# Ready to test notifications!
```

### Terminal 3 - Background Worker (optional, for callbacks)
```bash
cd /c/Users/Abdul\ Manan/Desktop/biztrixventure

# Install dependencies (first time only)
npm install --prefix apps/worker

# Start worker
npm run dev --prefix apps/worker

# Expected output:
# ✅ Worker started
# ✅ Polling for due callbacks every 30 seconds
```

---

## Step 3: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

Login with your test credentials.

---

## Step 4: Test the Notification System

### Option A: Manual API Test

**Create a Test Notification:**
```bash
# Open Terminal 4 and run:
curl -X POST http://localhost:3000/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Response:
# {
#   "message": "Test notification created",
#   "notification": {
#     "id": "uuid",
#     "type": "test:notification",
#     "title": "Test Notification",
#     "message": "This is a test notification from the API",
#     ...
#   }
# }
```

### Option B: Trigger Real Notifications

**1. Create a Transfer (Closes gets notified):**
```bash
# Login as FRONTER
# Go to: http://localhost:5173/fronter/transfers
# Click "Create Transfer"
# Fill in form:
#   - Customer Name
#   - Customer Phone
#   - Vehicle (VIN)
#   - Select a Closer
# Submit

# Expected:
# ✅ Toast notification appears
# ✅ Notification bell shows unread count
# ✅ Sound plays automatically
# ✅ Browser notification pops up
```

**2. Complete a Sale (Company Admin gets notified):**
```bash
# Login as CLOSER
# Go to: http://localhost:5173/closer/outcomes
# Click "Record Outcome"
# Fill in form:
#   - Disposition: "Sale Made"
#   - Customer details
# Submit

# Expected:
# ✅ Notification created in database
# ✅ Company admin receives notification
# ✅ Sale sound plays
```

**3. Create a Callback (Fronter/Closer gets notified at time):**
```bash
# Login as FRONTER
# Go to: http://localhost:5173/fronter/callbacks
# Click "Create Callback"
# Set "Best Time" to NOW or 1 minute from now
# Submit

# Expected:
# ✅ Callback added to Redis queue
# ✅ When time arrives, notification triggered
# ✅ Callback sound plays
# ✅ Browser notification appears
```

---

## Step 5: Verify Notification Features

### ✅ Bell Icon & Unread Count
1. Look at top-right corner - you should see bell icon
2. Red badge shows unread notification count
3. Click bell to see dropdown with recent notifications

### ✅ Sound Playback
1. Check browser console for any audio errors
2. You should hear sound for each notification type:
   - **Transfer sound**: When new transfer assigned
   - **Callback sound**: When callback reminder
   - **Sale sound**: When sale made
   - **Batch sound**: When batch assigned
   - **Alert sound**: When flag/alert

### ✅ Full Notifications Panel
1. Click bell icon → "View all notifications"
2. Modal opens with full notification list
3. Use filters: All / Unread / Read
4. Mark as read (check icon)
5. Delete notifications (trash icon)
6. Paginate through old notifications

### ✅ Browser Notifications
1. Allow browser permissions when prompted
2. Create notification
3. Close tab (or minimize)
4. Browser notification should appear top-right
5. Click to focus app window

### ✅ Multi-Tab Sync
1. Open 2 browser tabs to http://localhost:5173
2. Create notification in Tab 1
3. Watch Tab 2 - notification appears real-time
4. Mark as read in Tab 2
5. Watch Tab 1 - unread count updates

---

## Testing Checklist

Use this to verify all features work:

### Backend Tests
- [ ] API health check: `GET /api/v1/health` returns 200
- [ ] Create test notification: `POST /api/v1/notifications/test`
- [ ] List notifications: `GET /api/v1/notifications?limit=10`
- [ ] Mark as read: `PATCH /api/v1/notifications/:id/read`
- [ ] Get unread count: `GET /api/v1/notifications/count`
- [ ] Delete notification: `DELETE /api/v1/notifications/:id`

### Frontend Tests
- [ ] Bell icon appears in header
- [ ] Unread count badge shows and updates
- [ ] Click bell opens dropdown
- [ ] Can view all notifications modal
- [ ] Can mark individual notification as read
- [ ] Can delete individual notification
- [ ] Can mark all as read
- [ ] Can filter by All/Unread/Read
- [ ] Pagination works (10 per page)

### Sound Tests
- [ ] Transfer sound plays when transfer created
- [ ] Callback sound plays when callback reminder
- [ ] Sale sound plays when sale made
- [ ] Batch sound plays when batch assigned
- [ ] Alert sound plays when flag/alert
- [ ] Can adjust volume in browser
- [ ] Can mute sounds (localStorage)

### Browser Notification Tests
- [ ] Permission request appears on first login
- [ ] Browser notification pops up with sound
- [ ] Notification auto-closes after 5 seconds
- [ ] Click brings app into focus
- [ ] Works even when tab not focused

### Database Tests
- [ ] Run migration 009: `SELECT * FROM notifications;`
- [ ] Verify table structure
- [ ] Verify RLS policies work
- [ ] Verify indexes exist
- [ ] Auto-cleanup works (30 days)

---

## Troubleshooting

### Issue: API Server Won't Start
```bash
# Check port 3000 is not in use
netstat -an | grep 3000

# If in use, kill process:
lsof -ti:3000 | xargs kill -9

# Try again:
npm run dev --prefix apps/api
```

### Issue: Frontend Won't Connect to API
```bash
# Check VITE_API_URL in apps/web/.env
# Should be: http://localhost:3000/api/v1

# Check API is running:
curl http://localhost:3000/api/v1/health

# Clear browser cache:
# Ctrl+Shift+Delete → Clear all
```

### Issue: Notifications Not Appearing
```bash
# Check browser console for errors
# Verify database migration ran:
SELECT COUNT(*) FROM notifications;

# Check token in localStorage:
localStorage.getItem('token')

# Verify API headers:
# Authorization: Bearer YOUR_TOKEN
```

### Issue: Sounds Not Playing
```bash
# Check audio files exist:
ls -la apps/web/public/sounds/

# Check browser allows autoplay:
# Settings → Privacy & Security → Permissions → Audio

# Check browser console for audio errors:
# Should NOT show 404 errors for .wav files

# Try manually in console:
const audio = new Audio('/sounds/transfer.wav');
audio.play();
```

### Issue: Browser Notifications Disabled
```bash
# Grant permission:
# 1. Click permission popup when it appears
# 2. OR: Settings → Notifications → Allow

# Check permission in console:
Notification.permission

# Request permission:
Notification.requestPermission()
```

---

## Development Commands

```bash
# Build frontend for production
npm run build --prefix apps/web

# Run frontend build tests
npm run preview --prefix apps/web

# Lint frontend code
npm run lint --prefix apps/web

# Format code
npm run format --prefix apps/api
npm run format --prefix apps/web

# Run backend tests (if available)
npm run test --prefix apps/api

# Check for security issues
npm audit --prefix apps/api
npm audit --prefix apps/web
```

---

## Database Setup

### First Time Setup
1. Create Supabase project
2. Run migration 009:
   ```sql
   -- Copy entire contents of:
   -- db/migrations/009_create_notifications_table.sql

   -- Paste into Supabase SQL Editor
   -- Execute
   ```

3. Verify table created:
   ```sql
   SELECT * FROM notifications LIMIT 1;
   ```

4. Test insert:
   ```sql
   INSERT INTO notifications (
     user_id, role, type, title, message
   ) VALUES (
     'your-user-id', 'closer', 'test:notification',
     'Test', 'Testing database'
   );
   ```

---

## File Locations

| Component | Directory |
|-----------|-----------|
| API | `apps/api/src/` |
| Frontend | `apps/web/src/` |
| Worker | `apps/worker/src/` |
| Migrations | `db/migrations/` |
| Sounds | `apps/web/public/sounds/` |
| Env Files | `.env` (create in root) |

---

## Next: Production Deployment

Once everything works locally, deploy to production:

```bash
# 1. Push to main branch (already done)
git push origin main

# 2. Deploy via Coolify/Docker:
# - Coolify detects changes
# - Rebuilds containers
# - Runs migration automatically
# - Restarts services

# 3. Verify production:
curl https://your-production-domain/api/v1/health
```

---

## Tips & Tricks

**View Notification Preferences in Browser:**
```javascript
// In browser console:
const prefs = localStorage.getItem('notification_sound_preferences');
console.log(JSON.parse(prefs));

// Output:
// {
//   "enabled": true,
//   "volume": 0.7,
//   "soundTypes": {
//     "transfer": true,
//     "callback": true,
//     "sale": true,
//     "batch": true,
//     "alert": true
//   }
// }
```

**Test Sounds Manually:**
```javascript
// In browser console:
const audio = new Audio('/sounds/transfer.wav');
audio.volume = 0.7;
audio.play();
```

**Check Notifications in Database:**
```sql
-- Supabase SQL Editor:
SELECT user_id, type, title, is_read, created_at
FROM notifications
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

**Monitor Real-Time Events:**
```javascript
// In browser console:
const socket = io('http://localhost:3000');
socket.on('notification:new', (data) => {
  console.log('📭 Notification received:', data);
});
```

---

**You're all set!** Follow the steps above and your notification system will be fully operational locally. 🎉
