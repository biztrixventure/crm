# BizTrixVenture CRM - Deployment Guide

## Prerequisites

1. **Coolify** installed and running on your server
2. **Supabase** account with a project created
3. **Domain name** pointed to your Coolify server

---

## Step 1: Supabase Setup

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name:** `biztrixventure-crm`
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose closest to your users
5. Click "Create new project" and wait for provisioning

### 1.2 Run Database Migrations

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `db/migrations/001_init.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute
6. Verify tables were created in **Table Editor**

### 1.3 Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (keep secret!)

### 1.4 Create Storage Bucket (for company logos)

1. Go to **Storage**
2. Click "New bucket"
3. Name: `company-logos`
4. Check "Public bucket"
5. Click "Create bucket"

### 1.5 Create First Super Admin User

1. Go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter:
   - Email: `admin@biztrixventure.com`
   - Password: Choose a strong password
4. After user is created, copy the **User UID**
5. Go to **SQL Editor** and run:

```sql
INSERT INTO users (id, email, full_name, role, is_active)
VALUES (
  'PASTE-USER-UID-HERE',
  'admin@biztrixventure.com',
  'Super Admin',
  'super_admin',
  true
);
```

---

## Step 2: Coolify Setup

### 2.1 Create New Project

1. Log into your Coolify dashboard
2. Click "New Resource" → "Docker Compose"
3. Choose "Git Repository"
4. Connect to: `https://github.com/biztrixventure/crm.git`
5. Branch: `main`

### 2.2 Configure Environment Variables

In Coolify's "Environment Variables" section, add ALL of these:

```env
# Supabase (from Step 1.3)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Configuration
JWT_SECRET=generate-a-random-32-character-string-here
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://crm.yourdomain.com

# Redis (internal Docker network)
REDIS_URL=redis://redis:6379

# 2FA
TOTP_ISSUER=BizTrixVenture

# Worker
API_URL=http://api:4000
```

**Generate JWT_SECRET:**
```bash
openssl rand -hex 32
```

### 2.3 Configure Domain & SSL

1. In Coolify, go to your resource settings
2. Under "Domains":
   - Add your domain: `crm.yourdomain.com`
   - Enable HTTPS (Let's Encrypt)
3. Point domain to Coolify server in DNS settings

### 2.4 Network Configuration

Coolify handles this automatically via Docker Compose, but verify:
- `api` service: internal only (port 4000)
- `web` service: exposed on port 80/443
- `redis` service: internal only (port 6379)
- `worker` service: internal only

### 2.5 Deploy

1. Click "Deploy" in Coolify
2. Monitor build logs
3. Wait for all services to show "Running"

---

## Step 3: Verify Deployment

### 3.1 Check Health Endpoint

```bash
curl https://crm.yourdomain.com/api/v1/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

### 3.2 Test Login

1. Open `https://crm.yourdomain.com`
2. Login with the super admin credentials from Step 1.5
3. You should see the Admin Dashboard

---

## Troubleshooting

### API not starting

Check logs in Coolify for the `api` service. Common issues:
- Missing environment variables
- Supabase URL/keys incorrect
- Redis connection failed

### Database connection errors

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
2. Check Supabase dashboard for any IP restrictions
3. Ensure tables were created via SQL Editor

### Redis connection errors

The Redis service should start automatically. If issues:
1. Check if `redis` container is running
2. Verify `REDIS_URL=redis://redis:6379`

### WebSocket not connecting

1. Ensure nginx is proxying `/socket.io/` correctly
2. Check CORS settings match `FRONTEND_URL`

---

## Updating the Application

1. Push changes to GitHub
2. In Coolify, click "Redeploy" or enable auto-deploy on push

---

## Backup & Maintenance

### Database Backups

Supabase automatically backs up your database. For manual backups:
1. Go to Supabase Dashboard → Settings → Database
2. Click "Create backup"

### Redis Data

Redis data is persisted in the `redis_data` Docker volume. For backup:
```bash
docker exec biztrix-redis redis-cli BGSAVE
```

---

## Security Checklist

- [ ] Strong JWT_SECRET (32+ characters)
- [ ] Supabase service key never exposed to frontend
- [ ] HTTPS enabled
- [ ] Rate limiting active on auth endpoints
- [ ] 2FA enabled for admin accounts
- [ ] Regular database backups configured
