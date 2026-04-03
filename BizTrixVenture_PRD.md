# BizTrixVenture CRM — Product Requirements Document

> **Version:** 1.0 (MVP)
> **Stack:** React 18 + Vite + TailwindCSS · Node.js + Express · Supabase (PostgreSQL) · Redis · Socket.io
> **Deploy:** Coolify (Docker Compose) · Supabase Cloud
> **PWA:** Yes — all roles, fully responsive

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Roles & Permissions](#2-roles--permissions)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema-supabase--postgresql)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Modules & Screens](#6-frontend-modules--screens)
7. [Number Search — Redis](#7-number-search--redis-implementation)
8. [Number Upload & Assignment](#8-number-list-upload--assignment)
9. [Security & 2FA](#9-security--2fa)
10. [Deployment on Coolify](#10-deployment-on-coolify)
11. [Build Order for Claude IDE](#11-recommended-build-order-for-claude-ide)
12. [Monorepo File Structure](#12-monorepo-file-structure)
13. [Key Rules & Constraints](#13-key-rules--constraints-for-claude-ide)

---

## 1. Project Overview

BizTrixVenture CRM is a multi-tenant, role-based web application that manages the full lifecycle of inbound call transfers between a parent company (BizTrixVenture) and its registered sub-companies.

It records transfer data, call outcomes, callbacks, number assignments, and real-time notifications — deployed on Coolify with Supabase as the primary database and Redis for caching and real-time pub/sub.

| Attribute | Value |
|---|---|
| Product name | BizTrixVenture CRM |
| Version | 1.0 (MVP) |
| Frontend | React 18 + Vite + TailwindCSS (PWA) |
| Backend | Node.js + Express (REST API) |
| Database | Supabase (PostgreSQL) |
| Cache / Realtime | Redis (Upstash or self-hosted on Coolify) |
| Auth | Supabase Auth + TOTP 2FA (speakeasy) |
| Real-time | Socket.io over Redis pub/sub |
| File handling | CSV / XLSX upload (multer + xlsx) |
| Deployment | Coolify (Docker Compose) |
| PWA target | Super admin + all roles, fully responsive |

---

## 2. Roles & Permissions

The system has five distinct roles. BizTrixVenture controls which features each sub-company may access through per-company feature flags.

| Role | Belongs to | Capabilities |
|---|---|---|
| Super Admin | BizTrixVenture | Full access to everything. Manages companies, feature flags, dispositions, audit logs, 2FA enforcement. |
| Read-only Admin | BizTrixVenture | Same view as Super Admin but cannot create, edit, or delete anything. |
| Company Admin | Sub-company | Sees only their own company data — transfers, fronters, callbacks, reports. Cannot see other companies. |
| Closer | BizTrixVenture | Receives transfers, fills outcome form, searches numbers (if enabled). Sees only their own records plus search. |
| Fronter / Agent | Sub-company | Dials manually on ViciDial, fills transfer form, sees assigned number list, creates callbacks for themselves. |

### 2.1 Feature Flags (per sub-company, toggled by Super Admin)

| Flag key | Description |
|---|---|
| `number_search` | Allow company admin and fronters to search whether a number is already sold |
| `allow_edit` | Allow company admin to edit transfer records submitted by fronters |
| `allow_export` | Allow company admin to download CSV reports |
| `custom_dispositions` | Allow company admin to see custom dispositions added by Super Admin |

---

## 3. System Architecture

### 3.1 Stack Overview

| Technology | Role in system |
|---|---|
| React 18 + Vite | SPA frontend, code-split by role. Vite PWA plugin for installable PWA. |
| TailwindCSS | Utility-first styling, dark/light mode via class strategy. |
| Node.js + Express | REST API server. JWT middleware for route protection. |
| Supabase | PostgreSQL database + Auth (email/password + TOTP 2FA). Row-Level Security (RLS) as a second layer. |
| Redis | Number lookup cache (sold/not-sold). Session cache. Socket.io adapter for horizontal scaling. |
| Socket.io | Real-time notifications pushed to connected clients. Rooms scoped per company and per user. |
| multer + xlsx | CSV/Excel upload and parsing for number list imports. |
| Coolify | Self-hosted PaaS. Docker Compose deployment. Reverse proxy via Traefik. SSL auto-provisioned. |
| speakeasy + qrcode | TOTP 2FA generation and verification for admin accounts. |

### 3.2 Docker Compose Services (Coolify)

| Service | Description |
|---|---|
| `api` | Node.js Express API — port 4000 (internal) |
| `web` | React/Vite static build served via Nginx — port 80/443 |
| `redis` | Redis 7 Alpine — port 6379 (internal). Use Upstash if managed Redis preferred. |
| `worker` | Callback scheduler microservice — checks due callbacks every 30s and fires Socket.io events |

Supabase is external (cloud-hosted). Connect via `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables.

### 3.3 Environment Variables

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # service role key — never expose to frontend
SUPABASE_ANON_KEY=eyJ...      # anon key — used by frontend for auth only

# API
JWT_SECRET=your-32-char-random-secret
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Redis
REDIS_URL=redis://redis:6379  # or Upstash TLS URL

# 2FA
TOTP_ISSUER=BizTrixVenture
```

### 3.4 Nginx Config (web service)

| Location | Behavior |
|---|---|
| `/` | Serve React build. `try_files $uri /index.html` for SPA routing. |
| `/api/` | `proxy_pass http://api:4000/`. Upstream is the internal Docker network. |
| `/socket.io/` | `proxy_pass http://api:4000`. Enable WebSocket upgrade headers. |

---

## 4. Database Schema (Supabase / PostgreSQL)

All tables use UUID primary keys via `gen_random_uuid()`. Timestamps use `timestamptz`. RLS policies restrict rows by `company_id` and role. The API's service key bypasses RLS — all authorization logic lives in the API layer.

### 4.1 `companies`

```sql
CREATE TABLE companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                        -- internal name
  display_name  text NOT NULL,                        -- shown in UI
  logo_url      text,                                 -- Supabase Storage URL
  slug          text UNIQUE NOT NULL,                 -- URL-safe identifier
  is_active     boolean DEFAULT true,
  feature_flags jsonb DEFAULT '{}',                   -- { number_search, allow_edit, allow_export }
  created_at    timestamptz DEFAULT now(),
  created_by    uuid REFERENCES users(id)
);
```

### 4.2 `users`

```sql
CREATE TABLE users (
  id           uuid PRIMARY KEY,                      -- matches Supabase Auth uid
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         text NOT NULL,                         -- super_admin | readonly_admin | company_admin | closer | fronter
  company_id   uuid REFERENCES companies(id),         -- null for BizTrix roles
  totp_secret  text,                                  -- AES-256 encrypted
  totp_enabled boolean DEFAULT false,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  created_by   uuid REFERENCES users(id)
);
```

### 4.3 `transfers`

```sql
CREATE TABLE transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) NOT NULL,
  fronter_id      uuid REFERENCES users(id) NOT NULL,
  closer_id       uuid REFERENCES users(id) NOT NULL,
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  car_make        text,
  car_model       text,
  car_year        text,
  zip_code        text,
  city            text,
  state           text,
  miles           text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  updated_by      uuid REFERENCES users(id)
);
```

### 4.4 `outcomes`

```sql
CREATE TABLE outcomes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     uuid REFERENCES transfers(id),
  closer_id       uuid REFERENCES users(id) NOT NULL,
  company_id      uuid REFERENCES companies(id) NOT NULL,  -- company that sent transfer
  customer_phone  text NOT NULL,
  customer_name   text NOT NULL,
  disposition_id  uuid REFERENCES dispositions(id) NOT NULL,
  remarks         text,
  created_at      timestamptz DEFAULT now()
);
```

### 4.5 `dispositions`

```sql
CREATE TABLE dispositions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,   -- Sale Made | No Answer | Callback | Not Interested | Wrong Number | DNC
  is_default  boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Seed defaults
INSERT INTO dispositions (label, is_default) VALUES
  ('Sale Made', true),
  ('No Answer', true),
  ('Callback', true),
  ('Not Interested', true),
  ('Wrong Number', true),
  ('Do Not Call', true);
```

### 4.6 `callbacks`

```sql
CREATE TABLE callbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid REFERENCES users(id) NOT NULL,  -- fronter or closer
  company_id      uuid REFERENCES companies(id),
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  best_time       timestamptz NOT NULL,                 -- scheduled time for notification
  notes           text,
  is_fired        boolean DEFAULT false,               -- true after push notification sent
  created_at      timestamptz DEFAULT now()
);
```

### 4.7 `number_lists`

```sql
CREATE TABLE number_lists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) NOT NULL,
  uploaded_by     uuid REFERENCES users(id) NOT NULL,
  file_name       text,
  total_numbers   integer,
  created_at      timestamptz DEFAULT now()
);
```

### 4.8 `assigned_numbers`

```sql
CREATE TABLE assigned_numbers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid REFERENCES number_lists(id) NOT NULL,
  company_id    uuid REFERENCES companies(id) NOT NULL,
  fronter_id    uuid REFERENCES users(id),             -- null = unassigned
  phone_number  text NOT NULL,
  row_order     integer,                               -- original CSV row position
  created_at    timestamptz DEFAULT now()
);
```

### 4.9 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  event        text NOT NULL,   -- login_success | login_failed | logout | 2fa_setup | totp_verify_failed | password_reset
  ip_address   text,
  user_agent   text,
  device_info  jsonb,           -- { browser, os, device } parsed from UA
  metadata     jsonb,           -- extra context
  created_at   timestamptz DEFAULT now()
);
```

### 4.10 Redis Key Patterns

| Key | Type | Description |
|---|---|---|
| `sold:{phone_e164}` | STRING | `"yes"` or `"no"`. TTL 24h. Set when a Sale Made outcome is recorded. |
| `session:{userId}` | STRING | JWT token. TTL matches token expiry (8h). |
| `cb:queue` | SORTED SET | Callback IDs scored by Unix timestamp. Worker polls this every 30s. |
| `socket:rooms` | — | Managed by Socket.io Redis adapter automatically. |

---

## 5. API Endpoints

Base path: `/api/v1`. All endpoints require `Authorization: Bearer <jwt>` except `/auth/*`. Role guards are middleware applied per route group.

### 5.1 Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Email + password. Returns JWT + `totp_required` flag if 2FA enabled. |
| POST | `/auth/totp/verify` | Verify TOTP code. Returns full JWT on success. |
| POST | `/auth/totp/setup` | Generate TOTP secret + QR code for admin. [Admin] |
| POST | `/auth/totp/confirm` | Confirm TOTP setup with first code. [Admin] |
| POST | `/auth/logout` | Invalidate session from Redis. |
| GET | `/auth/me` | Return current user profile + company + feature flags. |

### 5.2 Companies (Super Admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/companies` | List all companies with stats. |
| POST | `/companies` | Create company (name, display_name, slug, logo upload). |
| PATCH | `/companies/:id` | Update company info or feature flags. |
| DELETE | `/companies/:id` | Soft-delete (set `is_active = false`). |
| GET | `/companies/:id/stats` | Transfer count, sales, callbacks for one company. |

### 5.3 Users

| Method | Path | Description |
|---|---|---|
| GET | `/users` | Super Admin: all users. Company Admin: own company users only. |
| POST | `/users` | Create user. Super Admin: any role. Company Admin: fronter only. |
| PATCH | `/users/:id` | Update user info or deactivate. |
| GET | `/users/closers` | List active closers (BizTrix). Used for transfer form dropdown. |

### 5.4 Transfers

| Method | Path | Description |
|---|---|---|
| GET | `/transfers` | List transfers. Filtered by `company_id` for Company Admin / Fronter. |
| POST | `/transfers` | Create transfer record. [Fronter] |
| PATCH | `/transfers/:id` | Edit transfer. [Company Admin if `allow_edit` flag on] |
| GET | `/transfers/:id` | Get single transfer with outcome. |
| GET | `/transfers/export` | CSV download. [Company Admin if `allow_export` flag on] Accepts `?from=&to=` date range. |

### 5.5 Outcomes

| Method | Path | Description |
|---|---|---|
| POST | `/outcomes` | Submit call outcome. [Closer] Triggers sale notification if disposition = Sale Made. |
| GET | `/outcomes` | List outcomes. Scoped by role. |
| GET | `/outcomes/:id` | Single outcome detail. |

### 5.6 Dispositions

| Method | Path | Description |
|---|---|---|
| GET | `/dispositions` | List active dispositions. |
| POST | `/dispositions` | Create new disposition. [Super Admin] |
| PATCH | `/dispositions/:id` | Update or deactivate. [Super Admin] |

### 5.7 Callbacks

| Method | Path | Description |
|---|---|---|
| GET | `/callbacks` | List callbacks for current user. |
| POST | `/callbacks` | Create callback. [Fronter or Closer] |
| PATCH | `/callbacks/:id` | Edit callback. |
| DELETE | `/callbacks/:id` | Delete callback. |

### 5.8 Number Lists & Assignment

| Method | Path | Description |
|---|---|---|
| POST | `/numbers/upload` | Upload CSV/XLSX. [Company Admin] Returns `list_id` + parsed row count. |
| GET | `/numbers/lists` | Get all number lists for company. |
| POST | `/numbers/assign` | Assign range from a list to a fronter. Body: `{ list_id, fronter_id, from_row, to_row }` |
| GET | `/numbers/my` | Get numbers assigned to current fronter. |

### 5.9 Number Search

| Method | Path | Description |
|---|---|---|
| GET | `/search/number?q={phone}` | Check if number is sold. Returns `{ sold: true\|false }`. Hits Redis first, falls back to DB, then writes to Redis. [Closer, Company Admin if flag on] |

### 5.10 Audit Log (Super Admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/audit` | List login events with IP, device, timestamp. Filterable by user and date range. |

---

## 6. Frontend Modules & Screens

Built in React 18 + Vite. Routing via `react-router-dom` v6. State via Zustand. API calls via Axios with interceptors for JWT injection and 401 redirect. Socket.io client connected on login.

### 6.1 Auth Flow

- Login screen — email + password. If `totp_required` → show TOTP 6-digit input screen.
- 2FA setup screen (admins only) — QR code display + confirm with first valid code.
- Forgot password — Supabase Auth magic link.
- Protected route wrapper — redirects unauthenticated users to `/login`. Role-based route guards.

### 6.2 Super Admin Dashboard (`/admin`)

- KPI cards: Total transfers today, total sales today, pending callbacks, active companies, active closers.
- Per-company breakdown table: transfers, sales, callbacks. Date range filter.
- Company management: list, create, edit, toggle active. Logo upload. Feature flag toggles per company.
- User management: create/edit/deactivate users across all companies. Assign roles.
- Disposition manager: default list + add custom. Toggle active/inactive.
- Audit log: table of login events with IP, device, browser, timestamp. Filter by user and date.
- Read-only admin sees same layout with all action buttons hidden/disabled.

### 6.3 Company Admin Dashboard (`/company`)

- KPI cards: transfers today (own company), sales today, pending callbacks, active fronters.
- Transfers table: all transfers submitted by their fronters. Columns: date, fronter, closer, customer, phone, car details, state, city. Date range filter.
- Outcomes table: all outcomes where `company_id` matches. Columns: date, closer, disposition, customer, phone, remarks.
- Edit transfer — available if `allow_edit` flag is on. Opens modal with editable fields.
- Fronter management: list fronters, create new fronter account, deactivate.
- Number list management: upload CSV/XLSX, view lists, assign ranges to individual fronters.
- Callbacks: list all callbacks created by their fronters.
- Export CSV: date range picker → download. Only if `allow_export` flag is on.

### 6.4 Closer Dashboard (`/closer`)

- Outcome form: customer phone, customer name, company (dropdown), disposition (dropdown from API), remarks. Submit button.
- My outcomes table: all outcomes this closer has submitted. Date range filter.
- Number search: search box with instant Redis-backed lookup. Displays `SOLD` or `NOT SOLD` badge.
- My callbacks: list of callbacks this closer created. Push notification fires at due time.
- Real-time toast: when a transfer is submitted with this closer selected, a toast/banner appears instantly via Socket.io.

### 6.5 Fronter Dashboard (`/fronter`)

- Transfer form: customer name, phone, car make, car model, car year, zip, city, state, miles, closer name (dropdown from `/users/closers`). Submit.
- My transfers table: list of transfers this fronter submitted. Read-only.
- My number list: table of numbers assigned to this fronter. Paginated. Shows phone numbers in row order.
- Callback form + list: create callback (customer name, phone, best time, notes). View own callbacks. Push notification at scheduled time.

### 6.6 Real-Time Notification Events

| Event | Who receives | Message |
|---|---|---|
| Transfer submitted | The selected closer | "New transfer incoming from [Company Name]" |
| Sale made | Company admin of the transferring company | "Sale recorded by [Closer] for your lead" |
| Callback due | The user who created the callback | Browser push notification at scheduled device time |
| New company / user | Super Admin | Toast in admin dashboard |

**Implementation:**
- Socket.io rooms: `user:{id}` (always) + `company:{company_id}` (if applicable).
- Callback worker polls Redis sorted set (`cb:queue`) every 30 seconds, fires events for due entries, marks `is_fired = true` in DB.

---

## 7. Number Search — Redis Implementation

1. **Normalize** phone input: strip all non-digits, format as E.164 (e.g. `+12345678900`). Do this on input AND on every write.
2. **Check Redis:** `GET sold:{phone_e164}`. If cache hit → return result immediately (< 5ms).
3. **Cache miss:** query Supabase `outcomes` table `WHERE customer_phone = normalized AND disposition = 'Sale Made'`. Return `yes` or `no`.
4. **Write to Redis:** `SET sold:{phone_e164} "yes"|"no" EX 86400` (24h TTL).
5. **On new Sale Made outcome:** immediately `SET sold:{phone_e164} "yes" EX 86400` to keep cache warm.
6. **Access:** Closer always. Company Admin only if `number_search` feature flag is `true` for their company.

---

## 8. Number List Upload & Assignment

### 8.1 Upload Flow

1. Company Admin uploads CSV or XLSX via drag-drop or file picker.
2. Backend (multer) receives file. `xlsx.utils.sheet_to_json` parses it. Expects one column of phone numbers. First row auto-detected as header if non-numeric.
3. Create `number_lists` record. Bulk insert all rows into `assigned_numbers` with `fronter_id = null` and `row_order = index`.
4. Return `list_id` and total row count to frontend.

### 8.2 Assignment Flow

1. Company Admin selects a list and a fronter from dropdowns.
2. Admin enters `from_row` and `to_row` (1-based, inclusive). UI shows preview of phone numbers in that range.
3. API: `UPDATE assigned_numbers SET fronter_id = ? WHERE list_id = ? AND row_order BETWEEN from_row-1 AND to_row-1`.
4. Fronter can now see their assigned numbers in the **My Number List** section.

> One number can only be assigned to one fronter at a time. Re-assigning overwrites the previous assignment and logs the change in `audit_logs`.

---

## 9. Security & 2FA

### 9.1 Two-Factor Authentication

- **Enforced for:** Super Admin, Read-only Admin, Company Admin.
- **Not required for:** Closer, Fronter (optional future enhancement).
- **Library:** `speakeasy` (TOTP, RFC 6238). QR code: `qrcode` npm package.
- **Setup flow:** Admin logs in → sees 2FA setup prompt → scans QR in Google Authenticator / Authy → confirms with first code → `totp_enabled = true`.
- **Login flow:** email/password → API returns `{ totp_required: true }` + short-lived scoped token (5 min TTL) → frontend shows 6-digit input → `POST /auth/totp/verify` → returns full 8h JWT.
- **TOTP secret:** stored AES-256 encrypted in DB using `JWT_SECRET` as the encryption key via Node.js `crypto` module.

### 9.2 Audit Logging

- Every login attempt (success or failure) writes a row to `audit_logs` with user_id, IP, user agent, parsed device info, timestamp.
- Events logged: `login_success`, `login_failed`, `logout`, `2fa_setup`, `totp_verify_failed`, `password_reset`.
- Super Admin views full audit log with filters: by user, by date range, by event type.
- Optional: resolve IP to country/city via `ip-api.com` (free tier), stored in `metadata` jsonb.

### 9.3 General Security

| Measure | Detail |
|---|---|
| JWT auth | All routes protected. Token expiry: 8h. Refresh via re-login. |
| Role guard | Middleware checks `user.role` against allowed roles per route. |
| Company isolation | All company-scoped queries MUST include `WHERE company_id = req.user.company_id`. |
| Rate limiting | `express-rate-limit` on `/auth/*` — 10 attempts per 15 min per IP. |
| CORS | Restricted to `FRONTEND_URL` env var only. |
| Helmet.js | CSP, HSTS, X-Frame-Options, etc. |
| Input validation | Zod schemas on all `POST`/`PATCH` bodies. Errors return 422. |
| File uploads | Mime type check (csv, xlsx only). Max 10MB. Stored in `/tmp`, parsed, then deleted. |

---

## 10. Deployment on Coolify

### 10.1 Repository Structure

```
/
├── apps/
│   ├── api/              # Node.js Express API
│   │   └── Dockerfile
│   ├── web/              # React + Vite frontend
│   │   └── Dockerfile    # Multi-stage: build + nginx
│   └── worker/           # Callback scheduler microservice
│       └── Dockerfile
├── db/
│   └── migrations/
│       └── 001_init.sql  # Full schema + seed data
├── docker-compose.yml    # Coolify reads this
└── .env.example          # Template of all required env vars
```

### 10.2 `docker-compose.yml`

```yaml
version: '3.9'
services:
  api:
    build: ./apps/api
    env_file: .env
    ports:
      - "4000:4000"
    depends_on:
      - redis
    restart: unless-stopped

  web:
    build: ./apps/web
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  worker:
    build: ./apps/worker
    env_file: .env
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis_data:
```

### 10.3 Coolify Setup Steps

1. Create a new project in Coolify. Add a Docker Compose source pointing to your repo.
2. Set all environment variables from `.env.example` in Coolify's Environment tab.
3. Enable "Expose to internet" for the `web` service on port 80. Coolify auto-provisions SSL via Let's Encrypt through Traefik.
4. `api` and `redis` services stay internal (no public port). `web` proxies API calls via nginx to `http://api:4000`.
5. Run DB migrations: use Supabase Dashboard SQL editor to run `db/migrations/001_init.sql`.
6. Set a Coolify health check on the `api` service: `GET /api/v1/health` → `200 OK`.

---

## 11. Recommended Build Order for Claude IDE

Follow this sequence. Each phase is independently testable before moving to the next.

| Phase | What to build |
|---|---|
| **Phase 1** | **Supabase schema** — Run `001_init.sql`. Creates all tables, indexes, RLS policies. Seeds default dispositions. |
| **Phase 2** | **Auth system** — `POST /auth/login`, JWT middleware, role guard, 2FA setup + verify endpoints. Frontend: login screen + TOTP screen. |
| **Phase 3** | **Company & user management** — CRUD for companies and users. Super Admin screens. Feature flag toggles. |
| **Phase 4** | **Transfer form** — Fronter creates transfer. Closer dropdown. `POST /transfers`. Fronter dashboard. |
| **Phase 5** | **Outcome form** — Closer fills outcome. Disposition dropdown. `POST /outcomes`. Closer dashboard. |
| **Phase 6** | **Real-time notifications** — Socket.io setup, Redis adapter, rooms, transfer ping to closer, sale alert to company admin. |
| **Phase 7** | **Callback system** — Create callback, worker service, push notification on due time. Callback list per user. |
| **Phase 8** | **Number search** — Redis lookup endpoint. Frontend search input with instant result display. |
| **Phase 9** | **Number upload & assignment** — CSV/XLSX upload, assignment UI, fronter number list view. |
| **Phase 10** | **Reporting & export** — Date range filters on all tables, CSV export endpoint, company admin report screen. |
| **Phase 11** | **Audit log & 2FA** — Login event recording, audit log screen for Super Admin, 2FA enforcement flow. |
| **Phase 12** | **PWA + polish** — Vite PWA plugin, manifest, service worker, responsive polish, dark/light mode. |

---

## 12. Monorepo File Structure

```
/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.js                  # Express app entry. Middleware stack.
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   ├── companies.js
│   │   │   │   ├── users.js
│   │   │   │   ├── transfers.js
│   │   │   │   ├── outcomes.js
│   │   │   │   ├── dispositions.js
│   │   │   │   ├── callbacks.js
│   │   │   │   ├── numbers.js
│   │   │   │   ├── search.js
│   │   │   │   └── audit.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js               # JWT verify
│   │   │   │   ├── role.js               # Role guard
│   │   │   │   ├── rateLimit.js
│   │   │   │   └── validate.js           # Zod validation
│   │   │   ├── services/
│   │   │   │   ├── supabase.js           # Supabase client (service key)
│   │   │   │   ├── redis.js              # Redis client
│   │   │   │   ├── socket.js             # Socket.io instance
│   │   │   │   ├── totp.js               # speakeasy helpers
│   │   │   │   ├── audit.js              # Audit log writer
│   │   │   │   └── notification.js       # Socket.io event emitters
│   │   │   └── schemas/
│   │   │       └── *.schema.js           # Zod schemas per resource
│   │   └── Dockerfile
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── CompanyDashboard.jsx
│   │   │   │   ├── CloserDashboard.jsx
│   │   │   │   └── FronterDashboard.jsx
│   │   │   ├── components/
│   │   │   │   ├── TransferForm.jsx
│   │   │   │   ├── OutcomeForm.jsx
│   │   │   │   ├── CallbackForm.jsx
│   │   │   │   ├── NumberSearch.jsx
│   │   │   │   ├── NumberUpload.jsx
│   │   │   │   ├── NumberAssign.jsx
│   │   │   │   ├── AuditLog.jsx
│   │   │   │   ├── UserTable.jsx
│   │   │   │   ├── CompanyTable.jsx
│   │   │   │   ├── DispositionManager.jsx
│   │   │   │   └── ExportButton.jsx
│   │   │   ├── store/
│   │   │   │   ├── auth.js               # Zustand: user, token, role
│   │   │   │   ├── notifications.js      # Zustand: toast queue
│   │   │   │   └── ui.js                 # Zustand: sidebar, theme
│   │   │   ├── hooks/
│   │   │   │   ├── useSocket.js          # Socket.io client connection
│   │   │   │   ├── useSearch.js          # Debounced number search
│   │   │   │   └── useCallbacks.js       # Callback list + push notification
│   │   │   └── lib/
│   │   │       ├── axios.js              # Axios instance + JWT interceptor + 401 redirect
│   │   │       ├── socket.js             # Socket.io client init
│   │   │       └── utils.js             # Phone normalizer, date helpers, etc.
│   │   ├── public/
│   │   │   └── manifest.json             # PWA manifest
│   │   ├── vite.config.js                # Vite + PWA plugin config
│   │   └── Dockerfile                    # Multi-stage: build → nginx
│   │
│   └── worker/
│       └── index.js                      # Callback scheduler. Polls Redis sorted set every 30s.
│
├── db/
│   └── migrations/
│       └── 001_init.sql                  # All tables + indexes + RLS + seed dispositions
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 13. Key Rules & Constraints for Claude IDE

### Must Follow — Backend

- **Every API route must have a Zod schema.** Never trust raw `req.body`.
- **Company isolation is sacred.** Every DB query on company-scoped data MUST include `WHERE company_id = req.user.company_id`. Never skip this.
- **Redis key normalization.** The number search key is always E.164: `sold:+12345678900`. Normalize on every read AND write.
- **Socket.io rooms:** user joins `user:{id}` always. If they have a company, they also join `company:{company_id}`. Never broadcast globally.
- **Feature flag checks must happen in the API**, not just the frontend. Frontend hides buttons; API enforces access.
- **2FA intermediate token** — after password but before TOTP: limited scope (`{ userId, step: 'totp' }`), 5-minute TTL. Full JWT only issued after TOTP verify.
- **Audit log writes synchronously** on login. A failed audit write should still allow login but log the error to console.
- **CSV export uses Node.js streams** (`fast-csv` or `papaparse`). Never load all rows into memory.
- **Callback worker is idempotent:** check `is_fired = false` before firing, set `is_fired = true` atomically in a Supabase transaction.

### Must Follow — Supabase

- Use `supabase-js` v2 in the API with the **service role key**. Never use the anon key server-side.
- Use Supabase Auth only for email/password login and magic links. All session management beyond that is custom JWT.
- Store logos in a Supabase Storage bucket named `company-logos`. Generate a signed URL for display.

### Must Follow — Frontend

- All forms must show **loading state on submit** and disable the button to prevent double submission.
- All tables must have **loading skeletons**, **empty states**, and **error states**.
- Number search input: **debounce 300ms**. Normalize input on the fly (strip spaces and dashes) before sending to API.
- Closer dropdown in transfer form: fetch from `GET /users/closers` **on form open**. Show full name.
- Company dropdown in outcome form: fetch from `GET /companies` (active only).
- Date range filter: use a date range picker component. Default to **today**. Apply to all tables.
- PWA: register service worker. Cache shell assets. Show "install app" prompt on mobile.

### Never Do

- ❌ Never expose `SUPABASE_SERVICE_KEY` to the frontend or include it in the Vite build.
- ❌ Never skip the `company_id` filter on company-scoped routes.
- ❌ Never use a global Socket.io broadcast — always scope to a room.
- ❌ Never issue a full JWT before TOTP is verified when `totp_enabled = true`.
- ❌ Never load an entire number list or export into memory — always stream.
- ❌ Never let a fronter or closer call another company's data — enforce in middleware.

---

*BizTrixVenture CRM — PRD v1.0 | Ready to build. Start with Phase 1: Supabase schema.*
