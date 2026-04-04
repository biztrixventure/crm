# BizTrixVenture CRM — Product Requirements Document

> **Version:** 2.0
> **Stack:** React 18 + Vite + TailwindCSS · Node.js + Express · Supabase (PostgreSQL) · Redis · Socket.io
> **Deploy:** Coolify (Docker Compose) · Supabase Cloud
> **PWA:** Yes — all roles, fully responsive
> **New in v2.0:** ViciDial number search · Closer record form · Multi-policy support · Merged timeline

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Roles & Permissions](#2-roles--permissions)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema-supabase--postgresql)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Modules & Screens](#6-frontend-modules--screens)
7. [Number Search — Redis + ViciDial](#7-number-search--redis--vicidial)
8. [Closer Record Form](#8-closer-record-form)
9. [Multi-Policy Flow](#9-multi-policy--returning-customer-flow)
10. [Number Upload & Assignment](#10-number-list-upload--assignment)
11. [Security & 2FA](#11-security--2fa)
12. [Deployment on Coolify](#12-deployment-on-coolify)
13. [Build Order for Claude IDE](#13-recommended-build-order-for-claude-ide)
14. [Monorepo File Structure](#14-monorepo-file-structure)
15. [Key Rules & Constraints](#15-key-rules--constraints-for-claude-ide)

---

## 1. Project Overview

BizTrixVenture CRM is a multi-tenant, role-based web application that manages the full lifecycle of inbound call transfers between a parent company (BizTrixVenture) and its registered sub-companies.

**Call flow:**
1. Fronter dials lead on `wavetech3new.i5.tel` (fronter ViciDial server).
2. Fronter clicks a webform to push the lead (all 13 fields) into the closer's dialer `tmcsolinb.i5.tel`.
3. Closer receives the call on `tmcsolinb.i5.tel`, speaks to customer, puts a disposition.
4. Fronter also manually fills the **transfer form** in this CRM.
5. Closer fills the **closer record form** in this CRM with full policy details.
6. CRM pulls disposition history from `tmcsolinb.i5.tel` via ViciDial API.

| Attribute | Value |
|---|---|
| Product name | BizTrixVenture CRM |
| Version | 2.0 |
| Frontend | React 18 + Vite + TailwindCSS (PWA) |
| Backend | Node.js + Express (REST API) |
| Database | Supabase (PostgreSQL) |
| Cache / Realtime | Redis (Upstash or self-hosted on Coolify) |
| Auth | Supabase Auth + TOTP 2FA (speakeasy) |
| Real-time | Socket.io over Redis pub/sub |
| File handling | CSV / XLSX upload (multer + xlsx) |
| ViciDial integration | `tmcsolinb.i5.tel` — non_agent_api.php (read dispositions + lead data) |
| Deployment | Coolify (Docker Compose) |
| PWA target | All roles, fully responsive |

---

## 2. Roles & Permissions

| Role | Belongs to | Capabilities |
|---|---|---|
| Super Admin | BizTrixVenture | Full access. Manages companies, feature flags, plans, clients, dispositions, audit logs, search field visibility, 2FA. |
| Read-only Admin | BizTrixVenture | Same view as Super Admin, no create/edit/delete. |
| Company Admin | Sub-company | Own company data only — transfers, closer records, callbacks, reports, fronters. |
| Closer | BizTrixVenture | Fills closer record form, searches numbers (ViciDial + CRM), sees full history timeline, creates new policies. |
| Fronter / Agent | Sub-company | Fills transfer form, sees assigned number list, creates callbacks. |

### 2.1 Feature Flags (per sub-company, toggled by Super Admin)

| Flag key | Description |
|---|---|
| `number_search` | Allow company admin to search number history |
| `allow_edit` | Allow company admin to edit transfer records |
| `allow_export` | Allow company admin to download CSV reports |
| `search_field_visibility` | JSON map of which fields are visible in search results for this company's admin |

### 2.2 Super Admin Managed Dropdowns

Super Admin can add/edit/deactivate items in these global dropdowns at any time:

| Dropdown | Used in | Example values |
|---|---|---|
| Plans | Closer record form | Signature, Gold, Platinum, Silver |
| Clients | Closer record form | Jim, (others added by super admin) |
| Dispositions | Outcome form + ViciDial mapping | Sale Made, No Answer, Callback, Not Interested, Wrong Number, DNC |

---

## 3. System Architecture

### 3.1 Stack Overview

| Technology | Role |
|---|---|
| React 18 + Vite | SPA frontend, code-split by role. Vite PWA plugin. |
| TailwindCSS | Utility-first styling, dark/light mode. |
| Node.js + Express | REST API. JWT middleware for route protection. |
| Supabase | PostgreSQL + Auth. RLS as second layer. |
| Redis | Number lookup cache. Session cache. Socket.io adapter. Callback queue. |
| Socket.io | Real-time notifications scoped to rooms. |
| multer + xlsx | CSV/XLSX upload and parsing. |
| Coolify | Docker Compose deployment. Traefik reverse proxy. Auto SSL. |
| speakeasy + qrcode | TOTP 2FA for admin accounts. |
| axios (server-side) | ViciDial API calls from Node.js backend to `tmcsolinb.i5.tel`. |

### 3.2 ViciDial Servers

| Server | URL | Purpose |
|---|---|---|
| Fronter dialer | `wavetech3new.i5.tel` | Fronter dials leads. Pushes lead via webform to closer dialer. CRM does NOT connect to this server. |
| Closer dialer | `tmcsolinb.i5.tel` | Closer receives calls, puts dispositions. CRM connects to this via ViciDial API to pull dispositions and lead history. |

### 3.3 Docker Compose Services

| Service | Description |
|---|---|
| `api` | Node.js Express API — port 4000 (internal) |
| `web` | React/Vite build served via Nginx — port 80/443 |
| `redis` | Redis 7 Alpine — port 6379 (internal) |
| `worker` | Callback scheduler — polls Redis sorted set every 30s |

### 3.4 Environment Variables

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# API
JWT_SECRET=your-32-char-random-secret
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Redis
REDIS_URL=redis://redis:6379

# 2FA
TOTP_ISSUER=BizTrixVenture

# ViciDial — Closer dialer only
VICIDIAL_URL=https://tmcsolinb.i5.tel
VICIDIAL_API_USER=your_api_user
VICIDIAL_API_PASS=your_api_pass
VICIDIAL_API_PATH=/vicidial/non_agent_api.php
```

---

## 4. Database Schema (Supabase / PostgreSQL)

### 4.1 `companies`

```sql
CREATE TABLE companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  display_name  text NOT NULL,
  logo_url      text,
  slug          text UNIQUE NOT NULL,
  is_active     boolean DEFAULT true,
  feature_flags jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  created_by    uuid REFERENCES users(id)
);
```

### 4.2 `users`

```sql
CREATE TABLE users (
  id           uuid PRIMARY KEY,
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         text NOT NULL,  -- super_admin | readonly_admin | company_admin | closer | fronter
  company_id   uuid REFERENCES companies(id),
  totp_secret  text,
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

### 4.4 `closer_records`

This is the main policy record filled by the closer after a call. Replaces the old `outcomes` table for policy data.

```sql
CREATE TABLE closer_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linking
  transfer_id         uuid REFERENCES transfers(id),         -- linked transfer if exists
  policy_number       integer DEFAULT 1,                     -- 1 = first policy, 2 = second policy, etc.
  previous_record_id  uuid REFERENCES closer_records(id),    -- for new policies on same customer

  -- Customer info
  customer_phone      text NOT NULL,
  customer_name       text NOT NULL,
  customer_email      text,
  customer_address    text,
  customer_dob        text,
  customer_gender     text,

  -- Vehicle info
  car_make            text,
  car_model           text,
  car_year            text,
  car_miles           text,
  car_vin             text,

  -- Policy info
  plan_id             uuid REFERENCES plans(id),
  client_id           uuid REFERENCES clients(id),
  down_payment        numeric(10,2),
  monthly_payment     numeric(10,2),
  reference_no        text,
  next_payment_note   text,
  status              text DEFAULT 'SOLD',                   -- SOLD | PENDING | CANCELLED

  -- Staff
  closer_id           uuid REFERENCES users(id) NOT NULL,
  fronter_name        text,                                  -- stored as text, not FK
  company_id          uuid REFERENCES companies(id),

  -- ViciDial
  vicidial_lead_id    text,                                  -- lead_id from tmcsolinb

  -- Meta
  record_date         date DEFAULT CURRENT_DATE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
```

### 4.5 `dispositions`

```sql
CREATE TABLE dispositions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  code        text,             -- ViciDial code e.g. SALE, NI, NA, CB, DNC
  is_default  boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Seed
INSERT INTO dispositions (label, code, is_default) VALUES
  ('Sale Made',       'SALE', true),
  ('No Answer',       'NA',   true),
  ('Callback',        'CB',   true),
  ('Not Interested',  'NI',   true),
  ('Wrong Number',    'WN',   true),
  ('Do Not Call',     'DNC',  true);
```

### 4.6 `plans` (Super Admin managed)

```sql
CREATE TABLE plans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,        -- Signature, Gold, Platinum, etc.
  is_active  boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Seed
INSERT INTO plans (name, is_active) VALUES ('Signature', true);
```

### 4.7 `clients` (Super Admin managed — companies whose warranties closers sell)

```sql
CREATE TABLE clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,        -- Jim, etc.
  is_active  boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Seed
INSERT INTO clients (name, is_active) VALUES ('Jim', true);
```

### 4.8 `callbacks`

```sql
CREATE TABLE callbacks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid REFERENCES users(id) NOT NULL,
  company_id      uuid REFERENCES companies(id),
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  best_time       timestamptz NOT NULL,
  notes           text,
  is_fired        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
```

### 4.9 `number_lists`

```sql
CREATE TABLE number_lists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid REFERENCES companies(id) NOT NULL,
  uploaded_by   uuid REFERENCES users(id) NOT NULL,
  file_name     text,
  total_numbers integer,
  created_at    timestamptz DEFAULT now()
);
```

### 4.10 `assigned_numbers`

```sql
CREATE TABLE assigned_numbers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid REFERENCES number_lists(id) NOT NULL,
  company_id    uuid REFERENCES companies(id) NOT NULL,
  fronter_id    uuid REFERENCES users(id),
  phone_number  text NOT NULL,
  row_order     integer,
  created_at    timestamptz DEFAULT now()
);
```

### 4.11 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  event        text NOT NULL,
  ip_address   text,
  user_agent   text,
  device_info  jsonb,
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
);
```

### 4.12 `search_field_config` (Super Admin controls per role/company)

```sql
CREATE TABLE search_field_config (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      text NOT NULL,    -- 'global' | company_id uuid as text
  role       text NOT NULL,    -- 'closer' | 'company_admin' | 'super_admin'
  fields     jsonb NOT NULL,   -- { customer_name: true, dob: false, email: true, ... }
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now()
);
```

### 4.13 Redis Key Patterns

| Key | Type | Description |
|---|---|---|
| `sold:{phone_e164}` | STRING | `"yes"` or `"no"`. TTL 24h. |
| `vdlead:{phone_e164}` | STRING | Cached ViciDial lead data JSON. TTL 1h. |
| `session:{userId}` | STRING | JWT. TTL 8h. |
| `cb:queue` | SORTED SET | Callback IDs scored by Unix timestamp. |

---

## 5. API Endpoints

Base path: `/api/v1`. All routes require `Authorization: Bearer <jwt>` except `/auth/*`.

### 5.1 Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Email + password → JWT or `totp_required`. |
| POST | `/auth/totp/verify` | Verify TOTP code → full JWT. |
| POST | `/auth/totp/setup` | Generate TOTP secret + QR. [Admin] |
| POST | `/auth/totp/confirm` | Confirm TOTP with first code. [Admin] |
| POST | `/auth/logout` | Invalidate Redis session. |
| GET | `/auth/me` | Current user + company + feature flags. |

### 5.2 Companies (Super Admin)

| Method | Path | Description |
|---|---|---|
| GET | `/companies` | List all with stats. |
| POST | `/companies` | Create company. |
| PATCH | `/companies/:id` | Update info or feature flags. |
| DELETE | `/companies/:id` | Soft delete. |
| GET | `/companies/:id/stats` | Transfers, sales, callbacks for one company. |

### 5.3 Users

| Method | Path | Description |
|---|---|---|
| GET | `/users` | All users (Super Admin) or own company (Company Admin). |
| POST | `/users` | Create user. |
| PATCH | `/users/:id` | Update or deactivate. |
| GET | `/users/closers` | List active closers for dropdown. |

### 5.4 Transfers

| Method | Path | Description |
|---|---|---|
| GET | `/transfers` | List. Scoped by role. |
| POST | `/transfers` | Create. [Fronter] |
| PATCH | `/transfers/:id` | Edit. [Company Admin if flag on] |
| GET | `/transfers/:id` | Single with linked closer record. |
| GET | `/transfers/export` | CSV download. [Company Admin if flag on] |

### 5.5 Closer Records

| Method | Path | Description |
|---|---|---|
| POST | `/closer-records` | Submit closer record. [Closer] Triggers sale notification. Updates Redis `sold:` key. |
| GET | `/closer-records` | List. Scoped by role. |
| GET | `/closer-records/:id` | Single record with full policy chain. |
| PATCH | `/closer-records/:id` | Edit record. [Closer who created it, or Super Admin] |
| POST | `/closer-records/:id/new-policy` | Create new policy linked to existing record. Pre-fills customer data. |

### 5.6 Dispositions

| Method | Path | Description |
|---|---|---|
| GET | `/dispositions` | List active. |
| POST | `/dispositions` | Create. [Super Admin] |
| PATCH | `/dispositions/:id` | Update or deactivate. [Super Admin] |

### 5.7 Plans (Super Admin managed)

| Method | Path | Description |
|---|---|---|
| GET | `/plans` | List active plans for dropdown. |
| POST | `/plans` | Create plan. [Super Admin] |
| PATCH | `/plans/:id` | Update or deactivate. [Super Admin] |

### 5.8 Clients (Super Admin managed)

| Method | Path | Description |
|---|---|---|
| GET | `/clients` | List active clients for dropdown. |
| POST | `/clients` | Create client. [Super Admin] |
| PATCH | `/clients/:id` | Update or deactivate. [Super Admin] |

### 5.9 Callbacks

| Method | Path | Description |
|---|---|---|
| GET | `/callbacks` | List for current user. |
| POST | `/callbacks` | Create. [Fronter or Closer] |
| PATCH | `/callbacks/:id` | Edit. |
| DELETE | `/callbacks/:id` | Delete. |

### 5.10 Number Lists & Assignment

| Method | Path | Description |
|---|---|---|
| POST | `/numbers/upload` | Upload CSV/XLSX. [Company Admin] |
| GET | `/numbers/lists` | All lists for company. |
| POST | `/numbers/assign` | Assign range to fronter. |
| GET | `/numbers/my` | Numbers assigned to current fronter. |

### 5.11 Number Search (Core Feature)

| Method | Path | Description |
|---|---|---|
| GET | `/search/number?q={phone}` | Full unified search. Returns CRM records + ViciDial history merged. Role-scoped field visibility. |
| GET | `/search/vicidial?phone={phone}` | Raw ViciDial pull for a number from `tmcsolinb.i5.tel`. [Internal — called by /search/number] |

### 5.12 Search Field Config (Super Admin)

| Method | Path | Description |
|---|---|---|
| GET | `/search-config` | Get current field visibility config. |
| PATCH | `/search-config` | Update which fields are visible per role/company. [Super Admin] |

### 5.13 Audit Log (Super Admin)

| Method | Path | Description |
|---|---|---|
| GET | `/audit` | Login events. Filter by user, date range, event type. |

---

## 6. Frontend Modules & Screens

### 6.1 Auth Flow

- Login → TOTP screen if required.
- 2FA setup for admins (QR + confirm).
- Forgot password via Supabase magic link.
- Role-based route guards.

### 6.2 Super Admin Dashboard (`/admin`)

- KPI cards: transfers today, sales today, pending callbacks, active companies, active closers.
- Per-company breakdown table with date range filter.
- Company management: create, edit, toggle active, logo upload, feature flags per company.
- User management: all users, all roles.
- Disposition manager: list + add custom + toggle active.
- **Plan manager:** list + add + toggle. (e.g. Signature, Gold, Platinum)
- **Client manager:** list + add + toggle. (e.g. Jim)
- **Search field config panel:** for each role (closer, company_admin), toggle which fields appear in search results.
- Audit log: IP, device, browser, timestamp. Filter by user and date.

### 6.3 Company Admin Dashboard (`/company`)

- KPI cards: own company only.
- Transfers table with date range filter.
- Closer records table (their company's transfers that were closed).
- Edit transfer (if `allow_edit` on).
- Fronter management.
- Number list management: upload, view, assign ranges.
- Callbacks list.
- Export CSV (if `allow_export` on).
- Number search (if `number_search` on) — sees fields allowed by super admin config.

### 6.4 Closer Dashboard (`/closer`)

- **Number search bar** — primary feature, prominent at top.
- **Closer record form** — fill after every call.
- My records table — all records this closer submitted. Date range filter.
- My callbacks list + form.
- Real-time toast on new incoming transfer.

### 6.5 Fronter Dashboard (`/fronter`)

- Transfer form.
- My transfers table.
- My number list (assigned numbers).
- Callback form + list.

### 6.6 Real-Time Notifications

| Event | Who | Message |
|---|---|---|
| Transfer submitted | Selected closer | "New transfer from [Company]" |
| Sale recorded | Company admin of transferring company | "Sale by [Closer] for your lead" |
| Callback due | Creator of callback | Browser push at scheduled time |

---

## 7. Number Search — Redis + ViciDial

This is the core intelligence feature of the CRM. When a closer searches a phone number they get a complete unified view from both the CRM database and ViciDial.

### 7.1 Search Flow (Step by Step)

```
Closer types phone number
        │
        ▼
1. Normalize phone → E.164 format (+1XXXXXXXXXX)
        │
        ▼
2. Check Redis: GET sold:{phone_e164}
   ├── HIT → return cached CRM result immediately
   └── MISS → continue
        │
        ▼
3. Query Supabase:
   - closer_records WHERE customer_phone = normalized (ALL companies, ALL closers)
   - transfers WHERE customer_phone = normalized (ALL companies)
        │
        ▼
4. Write CRM result to Redis: SET sold:{phone_e164} EX 86400
        │
        ▼
5. If CRM has no record OR result is incomplete:
   Check Redis: GET vdlead:{phone_e164}
   ├── HIT → use cached ViciDial data
   └── MISS → call ViciDial API on tmcsolinb.i5.tel
        │
        ▼
6. ViciDial API call:
   GET /vicidial/non_agent_api.php
     ?source=test
     &user={VICIDIAL_API_USER}
     &pass={VICIDIAL_API_PASS}
     &function=lead_search
     &phone_number={normalized_10_digit}
     &query_fields=lead_id,first_name,last_name,phone_number,
                   address1,city,state,zip_code,email,date_of_birth,
                   gender,comments,status,user,entry_date
   Cache result: SET vdlead:{phone_e164} JSON.stringify(data) EX 3600
        │
        ▼
7. For each ViciDial lead_id found, pull disposition history:
   GET /vicidial/non_agent_api.php
     ?function=get_call_notes
     &lead_id={lead_id}
     (returns all dispositions where closer actually spoke to customer)
        │
        ▼
8. Merge CRM records + ViciDial dispositions into unified timeline
        │
        ▼
9. Apply field visibility filter based on role + search_field_config
        │
        ▼
10. Return unified response to frontend
```

### 7.2 ViciDial API Integration

```javascript
// services/vicidial.js

const VICIDIAL_BASE = process.env.VICIDIAL_URL;
const API_PATH = process.env.VICIDIAL_API_PATH; // /vicidial/non_agent_api.php

async function searchLead(phone10digit) {
  const url = `${VICIDIAL_BASE}${API_PATH}`;
  const params = new URLSearchParams({
    source: 'test',
    user: process.env.VICIDIAL_API_USER,
    pass: process.env.VICIDIAL_API_PASS,
    function: 'lead_search',
    phone_number: phone10digit,
    query_fields: 'lead_id,first_name,last_name,phone_number,address1,city,state,zip_code,email,date_of_birth,gender,comments,status,user,entry_date'
  });
  const res = await axios.get(`${url}?${params}`);
  return parseViciDialResponse(res.data);
}

async function getLeadDispositions(leadId) {
  // Returns only calls with actual dispositions (closer spoke to customer)
  // Filter out: NA, DROP, BUSY, INCALL — only return calls where closer left a real dispo
  const params = new URLSearchParams({
    source: 'test',
    user: process.env.VICIDIAL_API_USER,
    pass: process.env.VICIDIAL_API_PASS,
    function: 'get_call_notes',
    lead_id: leadId
  });
  const res = await axios.get(`${VICIDIAL_BASE}${API_PATH}?${params}`);
  return parseDispositions(res.data);
}

function normalizePhone(raw) {
  // Strip all non-digits
  const digits = raw.replace(/\D/g, '');
  // Handle 10-digit (US) or 11-digit with leading 1
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  return {
    e164: `+1${ten}`,     // for Redis keys: +19047650112
    ten: ten              // for ViciDial API: 9047650112
  };
}
```

### 7.3 Unified Search Response Shape

```json
{
  "phone": "+19047650112",
  "sold": true,
  "total_policies": 2,
  "crm_records": [
    {
      "id": "uuid",
      "record_date": "2026-04-03",
      "status": "SOLD",
      "customer_name": "FRANK JENKINS",
      "customer_phone": "(904) 765-0112",
      "customer_email": "FRANK.JENKINSJr.49@gmail.com",
      "customer_address": "230 E 1st St #813 Jacksonville, FL 32206",
      "customer_dob": "...",
      "customer_gender": "...",
      "car_make": "TOYOTA",
      "car_model": "CAMRY",
      "car_year": "2018",
      "car_miles": "152,225",
      "car_vin": "4T1B11HK5JU153898",
      "plan": "Signature",
      "client": "Jim",
      "down_payment": 108.00,
      "monthly_payment": 108.00,
      "reference_no": "MBH4220SBN",
      "next_payment_note": "Monthly payments will be on 3rd of May",
      "closer_name": "Haroon Yousaf",
      "fronter_name": "Mohsin Tariq Illahi",
      "company_name": "Company A",
      "policy_number": 1,
      "previous_record_id": null
    }
  ],
  "vicidial_history": [
    {
      "lead_id": "12345",
      "call_date": "2026-04-03T14:32:00Z",
      "agent": "Haroon Yousaf",
      "disposition_code": "SALE",
      "duration_seconds": 847,
      "comments": "..."
    },
    {
      "lead_id": "12345",
      "call_date": "2026-03-15T10:10:00Z",
      "agent": "John Smith",
      "disposition_code": "NI",
      "duration_seconds": 120,
      "comments": "..."
    }
  ],
  "merged_timeline": [
    {
      "timestamp": "2026-04-03T14:32:00Z",
      "type": "vicidial_call",
      "agent": "Haroon Yousaf",
      "disposition_code": "SALE",
      "summary": "SALE by Haroon Yousaf"
    },
    {
      "timestamp": "2026-04-03T15:00:00Z",
      "type": "crm_record",
      "record_id": "uuid",
      "summary": "Policy 1 — 2018 TOYOTA CAMRY — Signature — Jim"
    }
  ]
}
```

### 7.4 Search Result UI (Closer View)

The search screen is split into three panels:

**Panel 1 — Summary Header**
- Phone number (formatted)
- SOLD / NOT SOLD badge (large, color-coded green/red)
- Total policies count
- "Create New Policy" button (always visible on sold numbers)

**Panel 2 — CRM Records (left side)**
- Card per policy record showing all fields visible per `search_field_config`
- If field is not available: show "Not available" in muted text
- Click card → expand to show all details inline
- Policy chain shown: "Policy 1 → Policy 2" with arrow

**Panel 3 — ViciDial History Timeline (right side)**
- Chronological list of all calls where closer spoke and left a disposition
- Each entry: date/time · agent name · disposition code · call duration
- Entries from most recent to oldest
- ViciDial and CRM entries merged into one timeline sorted by timestamp

### 7.5 Field Visibility Rules

Super Admin configures via `/admin` → Search Field Config panel:

| Field | Default visibility |
|---|---|
| customer_name | ✅ visible |
| customer_phone | ✅ visible |
| customer_email | ✅ visible |
| customer_address | ✅ visible |
| customer_dob | ✅ visible (shown as-is if available, "Not available" if not) |
| customer_gender | ✅ visible |
| car_make / model / year | ✅ visible |
| car_miles | ✅ visible |
| car_vin | ✅ visible |
| plan | ✅ visible |
| client | ✅ visible |
| down_payment | ✅ visible |
| monthly_payment | ✅ visible |
| reference_no | ✅ visible |
| next_payment_note | ✅ visible |
| closer_name | ✅ visible |
| fronter_name | ✅ visible |
| company_name | ✅ visible |
| disposition_code | ✅ visible |

Super Admin can toggle any field off for specific roles (company_admin) or globally.

---

## 8. Closer Record Form

Filled by the closer after every call where they spoke to the customer and completed the interaction.

### 8.1 Form Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Customer Phone | text input | ✅ | Auto-normalizes on blur. If pre-filled from search, locked. |
| Customer Name | text input | ✅ | UPPERCASE encouraged |
| Car Make | text input | ✅ | e.g. TOYOTA |
| Car Model | text input | ✅ | e.g. CAMRY |
| Car Year | text input | ✅ | e.g. 2018 |
| Miles | text input | ✅ | e.g. 152,225 |
| VIN | text input | ✅ | Stored as-is. No validation. |
| Email | text input | ❌ | Shows "Not available" if empty |
| Address | text input | ❌ | Full address free text |
| DOB | text input | ❌ | Free text |
| Gender | text input | ❌ | Free text |
| Plan | dropdown | ✅ | From `plans` table. Super Admin adds options. |
| Client | dropdown | ✅ | From `clients` table. Super Admin adds options. |
| Down Payment | number input | ✅ | Dollar amount e.g. 108 |
| Monthly Payment | number input | ✅ | Dollar amount e.g. 108 |
| Reference No | text input | ✅ | Manually typed by closer from client's system |
| Next Payment Note | text input | ❌ | Free text e.g. "Monthly payments will be on 3rd of May" |
| Fronter Name | text input | ✅ | Free text — name of fronter who transferred the call |
| Company | dropdown | ✅ | Which sub-company sent the transfer |
| Closer | auto-filled | — | Logged-in closer's name. Not editable. |
| Record Date | date picker | ✅ | Defaults to today |
| Status | dropdown | ✅ | SOLD (default). Options: SOLD, PENDING, CANCELLED |
| ViciDial Lead ID | text input | ❌ | Optional. Closer pastes from ViciDial if known. Used for API linking. |
| Disposition | dropdown | ✅ | From `dispositions` table |
| Remarks | textarea | ❌ | Free text notes |

### 8.2 Form Behavior

- If closer came from search result → phone, name, email, address, DOB, gender are pre-filled from existing record and **editable**.
- If creating new policy → all fields pre-filled except vehicle fields (make, model, year, miles, VIN) which are blank.
- On submit: create `closer_records` row, set Redis `sold:{phone_e164} = "yes" EX 86400`, emit Socket.io sale event to company room.
- Show loading state on submit. Disable button to prevent double submission.

---
# BizTrixVenture CRM — ViciDial Integration
## PRD Section + Ready-to-Use Service File

> **Server:** `tmcsolinb.i5.tel`
> **API Path:** `/vicidial/non_agent_api.php`
> **Confirmed working functions:** `lead_search`, `phone_number_log`, `logged_in_agents`
> **Auth:** `user=apiuser&pass=apiuser123`

---

## Part 1 — PRD: ViciDial Integration (Phase 8)

### 1.1 What ViciDial Provides vs What CRM Provides

| Data Point | Source | How |
|---|---|---|
| Phone → lead_id | ViciDial `lead_search` | Returns `phone\|count\|lead_id` |
| Call dates, durations, disposition codes | ViciDial `phone_number_log` | Returns one row per call |
| Live agent names + statuses | ViciDial `logged_in_agents` | Cached in Redis 60s |
| Historical agent name | CRM `closer_records` | Matched by lead_id or phone + date within 30 min |
| Customer name, address, email, DOB, vehicle | CRM `closer_records` + `transfers` | Filled by closer and fronter manually |

**Key design decision:** ViciDial's `lead_search` on this server ignores `query_fields` and only returns `phone|count|lead_id`. All customer data comes from the CRM. ViciDial only provides call history (dates, durations, dispositions).

---

### 1.2 Confirmed API Responses

**`lead_search` — find lead_id by phone:**
```
Request:  ?function=lead_search&phone_number=9148062683
Response: 9148062683|1|52457
Format:   phone_number | count | lead_id
```

**`phone_number_log` — full call history for a phone:**
```
Request:  ?function=phone_number_log&phone_number=9148062683
Response: 9148062683|2026-04-03 16:57:27|101010|1974|SALE|CALLER|SALE||1011
          9148062683|2026-04-03 16:55:11|101010|22|SALE|CALLER|A||1011
          9148062683|2026-04-03 16:54:31|101010|33|SALE|CALLER|A||1011
          9148062683|2026-04-03 16:53:51|101010|33|SALE|CALLER|A||1011

Format (pipe-separated, one row per call):
  [0] phone_number      — 9148062683
  [1] call_datetime     — 2026-04-03 16:57:27
  [2] list_id           — 101010
  [3] duration_seconds  — 1974
  [4] disposition_code  — SALE
  [5] call_type         — CALLER
  [6] status            — SALE (or A for attempt)
  [7] extra             — (empty)
  [8] campaign_id       — 1011
```

**`logged_in_agents` — live agents with names:**
```
Request:  ?function=logged_in_agents&campaign_id=IHP_01
Response: 1005|IHP_01|8600051|PAUSED|52731||33|Simon Vargas|tmcsolinb|1
          1024|IHP_01|8600058|INCALL|40171|M403...|60|Mark Oliver|tmcsolinb|1

Format (pipe-separated, one row per agent):
  [0] user_id        — 1005
  [1] campaign_id    — IHP_01
  [2] phone_ext      — 8600051
  [3] agent_status   — PAUSED | INCALL | READY | DISPO
  [4] lead_id        — 52731
  [5] call_id        — (empty or call id)
  [6] duration_sec   — 33
  [7] agent_name     — Simon Vargas
  [8] server         — tmcsolinb
  [9] flag           — 1
```

---

### 1.3 Search Flow (Step by Step)

```
Closer types phone number in search bar
              │
              ▼
1. normalizePhone(input)
   → e164:  +19148062683   (Redis key)
   → ten:   9148062683     (ViciDial param)
              │
              ▼
2. Redis GET sold:{e164}
   ├── HIT  → skip to step 6 (use cached result)
   └── MISS → continue
              │
              ▼
3. Supabase query (parallel):
   - closer_records WHERE customer_phone = e164 (ALL companies, ALL closers)
   - transfers WHERE customer_phone = e164 (ALL companies)
              │
              ▼
4. Redis GET vdlog:{e164}
   ├── HIT  → use cached ViciDial rows
   └── MISS → call ViciDial:
              │
              ▼
5. ViciDial call 1 — lead_search:
   GET phone_number_log?phone_number=9148062683
   → parse all rows
   → filter: keep only rows where duration_seconds > 60
              (removes short dial attempts, keeps real conversations)
   → write to Redis: SET vdlog:{e164} JSON EX 3600
              │
              ▼
6. Agent name resolution per call row:
   For each filtered ViciDial row:
     a. Try match: closer_records WHERE vicidial_lead_id = row.lead_id
                   AND ABS(created_at - row.call_datetime) < 1800 seconds
        → if match found: use closer_records.closer.full_name
     b. No match: check Redis agent_cache:{list_id}
        → if found: use cached name
     c. No cache: show "Agent ID: {list_id}"
              │
              ▼
7. Build agent cache from logged_in_agents
   (called once per search session, cached Redis 60s):
   GET logged_in_agents&campaign_id=IHP_01
   → parse user_id → agent_name pairs
   → SET agent_cache:{user_id} name EX 60 for each
              │
              ▼
8. Merge into unified timeline:
   - Combine CRM records + filtered ViciDial rows
   - Sort by timestamp DESC (newest first)
   - Tag each entry: type = "crm_record" | "vicidial_call"
              │
              ▼
9. Apply field visibility filter:
   - Load search_field_config for requester's role
   - Strip hidden fields from CRM records
   - ViciDial rows always show: date, duration, disposition_code, agent_name
              │
              ▼
10. Write sold status to Redis:
    If any CRM closer_record has status = SOLD:
      SET sold:{e164} "yes" EX 86400
    Else:
      SET sold:{e164} "no" EX 86400
              │
              ▼
11. Return unified response to frontend
```

---

### 1.4 Duration Filter Logic

From confirmed ViciDial data on `tmcsolinb.i5.tel`:

| Duration | What it means | Keep? |
|---|---|---|
| > 60 seconds | Real conversation — closer spoke to customer | ✅ Yes |
| ≤ 60 seconds | Dial attempt — rang or connected briefly | ❌ No |

This is configurable via env var `VICIDIAL_MIN_CALL_DURATION=60` so it can be adjusted without a code change.

---

### 1.5 Redis Keys for ViciDial

| Key | Type | TTL | Content |
|---|---|---|---|
| `sold:{e164}` | STRING | 24h | `"yes"` or `"no"` |
| `vdlog:{e164}` | STRING | 1h | JSON array of filtered call rows |
| `agent_cache:{user_id}` | STRING | 60s | Agent full name string |

---

### 1.6 Unified Search Response Shape

```json
{
  "phone": "+19148062683",
  "sold": true,
  "total_policies": 1,
  "vicidial_available": true,
  "crm_records": [
    {
      "id": "uuid",
      "policy_number": 1,
      "previous_record_id": null,
      "record_date": "2026-04-03",
      "status": "SOLD",
      "customer_name": "FRANK JENKINS",
      "customer_phone": "(904) 765-0112",
      "customer_email": "FRANK.JENKINSJr.49@gmail.com",
      "customer_address": "230 E 1st St #813 Jacksonville, FL 32206",
      "customer_dob": null,
      "customer_gender": null,
      "car_make": "TOYOTA",
      "car_model": "CAMRY",
      "car_year": "2018",
      "car_miles": "152,225",
      "car_vin": "4T1B11HK5JU153898",
      "plan": "Signature",
      "client": "Jim",
      "down_payment": 108.00,
      "monthly_payment": 108.00,
      "reference_no": "MBH4220SBN",
      "next_payment_note": "Monthly payments will be on 3rd of May",
      "closer_name": "Haroon Yousaf",
      "fronter_name": "Mohsin Tariq Illahi",
      "company_name": "Company A",
      "disposition_code": "SALE",
      "remarks": ""
    }
  ],
  "vicidial_calls": [
    {
      "phone_number": "9148062683",
      "call_datetime": "2026-04-03 16:57:27",
      "list_id": "101010",
      "duration_seconds": 1974,
      "duration_display": "32m 54s",
      "disposition_code": "SALE",
      "call_type": "CALLER",
      "campaign_id": "1011",
      "agent_name": "Haroon Yousaf",
      "agent_source": "crm_match"
    }
  ],
  "merged_timeline": [
    {
      "timestamp": "2026-04-03 16:57:27",
      "type": "vicidial_call",
      "disposition_code": "SALE",
      "duration_display": "32m 54s",
      "agent_name": "Haroon Yousaf",
      "summary": "SALE — 32m 54s — Haroon Yousaf"
    },
    {
      "timestamp": "2026-04-03T15:00:00Z",
      "type": "crm_record",
      "record_id": "uuid",
      "policy_number": 1,
      "summary": "Policy 1 — 2018 TOYOTA CAMRY — Signature — Jim"
    }
  ]
}
```

---

### 1.7 Frontend Search UI Layout

```
┌─────────────────────────────────────────────────────┐
│  🔍  Search phone number...              [Search]    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  +1 (914) 806-2683                                   │
│  ● SOLD   2 calls found   1 policy                   │
│                          [+ Create New Policy]       │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│   CRM RECORDS        │  │   VICIDIAL TIMELINE       │
│                      │  │                           │
│  Policy 1            │  │  2026-04-03 16:57:27      │
│  2018 TOYOTA CAMRY   │  │  SALE — 32m 54s           │
│  Signature — Jim     │  │  Haroon Yousaf            │
│  Haroon Yousaf       │  │  ─────────────────────    │
│  04/03/2026          │  │  (short attempts hidden)  │
│  [▼ expand]          │  │                           │
└──────────────────────┘  └──────────────────────────┘
```

**Expanded CRM record card shows all fields allowed by `search_field_config`. Any null field shows "Not available" in muted gray — never hidden.**

---

## Part 2 — `vicidial.js` Service File

Save this at: `apps/api/src/services/vicidial.js`

```javascript
/**
 * vicidial.js
 * BizTrixVenture CRM — ViciDial Integration Service
 * Server: tmcsolinb.i5.tel
 * Confirmed working functions: lead_search, phone_number_log, logged_in_agents
 */

const axios = require('axios');
const redis = require('./redis'); // your existing redis client

// ─── Config ────────────────────────────────────────────────────────────────

const VD_BASE        = process.env.VICIDIAL_URL;        // https://tmcsolinb.i5.tel
const VD_PATH        = process.env.VICIDIAL_API_PATH;   // /vicidial/non_agent_api.php
const VD_USER        = process.env.VICIDIAL_API_USER;   // apiuser
const VD_PASS        = process.env.VICIDIAL_API_PASS;   // apiuser123
const VD_CAMPAIGN    = process.env.VICIDIAL_CAMPAIGN;   // IHP_01
const MIN_DURATION   = parseInt(process.env.VICIDIAL_MIN_CALL_DURATION || '60'); // seconds

// Disposition codes that mean the closer actually spoke to the customer.
// Calls with these codes AND duration > MIN_DURATION are shown in timeline.
// Short attempts (duration <= MIN_DURATION) are always filtered regardless of dispo.
const REAL_CALL_DISPOS = ['SALE', 'NI', 'NA', 'CB', 'DNC', 'WN', 'A'];

// ─── Phone Normalization ───────────────────────────────────────────────────

/**
 * Normalize any phone input to E.164 and 10-digit formats.
 * E.164 (+1XXXXXXXXXX) is used for Redis keys.
 * 10-digit (XXXXXXXXXX) is used for ViciDial API params.
 *
 * Examples:
 *   "(904) 765-0112"  → { e164: "+19047650112", ten: "9047650112" }
 *   "1-914-806-2683"  → { e164: "+19148062683", ten: "9148062683" }
 *   "+19148062683"    → { e164: "+19148062683", ten: "9148062683" }
 */
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  // Remove leading country code 1 if 11 digits
  const ten = digits.length === 11 && digits[0] === '1'
    ? digits.slice(1)
    : digits;
  if (ten.length !== 10) return null; // invalid US number
  return {
    e164: `+1${ten}`,
    ten
  };
}

// ─── Duration Formatter ────────────────────────────────────────────────────

function formatDuration(seconds) {
  const s = parseInt(seconds) || 0;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

// ─── ViciDial HTTP Call ────────────────────────────────────────────────────

/**
 * Make a GET request to the ViciDial non_agent_api.php endpoint.
 * Returns the raw text response (ViciDial returns plain text, not JSON).
 * Throws on HTTP error or timeout.
 */
async function vdCall(params) {
  const url = `${VD_BASE}${VD_PATH}`;
  const fullParams = {
    source: 'test',
    user: VD_USER,
    pass: VD_PASS,
    ...params
  };
  const qs = new URLSearchParams(fullParams).toString();
  const response = await axios.get(`${url}?${qs}`, {
    timeout: 8000, // 8 second timeout — never block search for too long
    headers: { 'User-Agent': 'BizTrixVentureCRM/2.0' }
  });
  return response.data;
}

// ─── lead_search — Get lead_id from phone number ───────────────────────────

/**
 * Given a 10-digit phone number, returns the ViciDial lead_id.
 * Response format: "9148062683|1|52457"
 * Returns lead_id string or null if not found.
 */
async function getLeadId(tenDigitPhone) {
  try {
    const raw = await vdCall({
      function: 'lead_search',
      phone_number: tenDigitPhone
    });

    // Response: "phone|count|lead_id" or "ERROR:..."
    if (!raw || raw.startsWith('ERROR')) return null;

    const parts = raw.trim().split('|');
    // parts[0] = phone, parts[1] = count, parts[2] = lead_id
    if (parts.length >= 3 && parts[2]) {
      return parts[2].trim();
    }
    return null;
  } catch (err) {
    console.error('[ViciDial] lead_search error:', err.message);
    return null;
  }
}

// ─── phone_number_log — Get call history ──────────────────────────────────

/**
 * Parse a single pipe-separated row from phone_number_log response.
 * Format: phone|datetime|list_id|duration|dispo_code|call_type|status|extra|campaign
 *
 * Example row:
 * "9148062683|2026-04-03 16:57:27|101010|1974|SALE|CALLER|SALE||1011"
 */
function parseCallLogRow(row) {
  const parts = row.split('|');
  if (parts.length < 5) return null;
  return {
    phone_number:      parts[0]?.trim() || '',
    call_datetime:     parts[1]?.trim() || '',
    list_id:           parts[2]?.trim() || '',
    duration_seconds:  parseInt(parts[3]) || 0,
    disposition_code:  parts[4]?.trim() || '',
    call_type:         parts[5]?.trim() || '',
    status:            parts[6]?.trim() || '',
    campaign_id:       parts[8]?.trim() || '',
  };
}

/**
 * Fetch full call log for a phone number from ViciDial.
 * Returns only calls where closer actually spoke to customer:
 *   - duration > MIN_DURATION seconds (default 60)
 * Filtered rows include duration display string and are sorted newest first.
 *
 * Caches result in Redis for 1 hour.
 */
async function getCallLog(tenDigitPhone, e164Phone) {
  const cacheKey = `vdlog:${e164Phone}`;

  // Check Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  try {
    const raw = await vdCall({
      function: 'phone_number_log',
      phone_number: tenDigitPhone
    });

    if (!raw || raw.startsWith('ERROR')) return [];

    const rows = raw.trim().split('\n').filter(Boolean);
    const parsed = rows
      .map(parseCallLogRow)
      .filter(Boolean)
      // Only keep calls where closer actually spoke to customer
      .filter(row => row.duration_seconds > MIN_DURATION)
      // Add display-friendly duration
      .map(row => ({
        ...row,
        duration_display: formatDuration(row.duration_seconds),
        agent_name: null,        // resolved later via resolveAgentNames()
        agent_source: 'unknown'
      }))
      // Sort newest first
      .sort((a, b) => new Date(b.call_datetime) - new Date(a.call_datetime));

    // Cache for 1 hour
    try {
      await redis.set(cacheKey, JSON.stringify(parsed), 'EX', 3600);
    } catch (_) {}

    return parsed;
  } catch (err) {
    console.error('[ViciDial] phone_number_log error:', err.message);
    return [];
  }
}

// ─── logged_in_agents — Live agent name cache ──────────────────────────────

/**
 * Parse a single pipe-separated row from logged_in_agents response.
 * Format: user_id|campaign|phone_ext|status|lead_id|call_id|duration|agent_name|server|flag
 *
 * Example:
 * "1005|IHP_01|8600051|PAUSED|52731||33|Simon Vargas|tmcsolinb|1"
 */
function parseAgentRow(row) {
  const parts = row.split('|');
  if (parts.length < 8) return null;
  return {
    user_id:      parts[0]?.trim() || '',
    campaign_id:  parts[1]?.trim() || '',
    status:       parts[3]?.trim() || '',  // PAUSED | INCALL | READY | DISPO
    lead_id:      parts[4]?.trim() || '',
    duration_sec: parseInt(parts[6]) || 0,
    agent_name:   parts[7]?.trim() || '',
    server:       parts[8]?.trim() || '',
  };
}

/**
 * Fetch live agents from ViciDial and build a user_id → name map.
 * Cached in Redis for 60 seconds (live data, refreshes frequently).
 * Returns object: { "1005": "Simon Vargas", "1024": "Mark Oliver" }
 */
async function getLiveAgentMap() {
  const cacheKey = 'vd:agent_map';

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  try {
    const raw = await vdCall({
      function: 'logged_in_agents',
      campaign_id: VD_CAMPAIGN
    });

    if (!raw || raw.startsWith('ERROR')) return {};

    const agentMap = {};
    const rows = raw.trim().split('\n').filter(Boolean);
    rows.forEach(row => {
      const agent = parseAgentRow(row);
      if (agent && agent.user_id && agent.agent_name) {
        agentMap[agent.user_id] = agent.agent_name;
      }
    });

    try {
      await redis.set(cacheKey, JSON.stringify(agentMap), 'EX', 60);
    } catch (_) {}

    return agentMap;
  } catch (err) {
    console.error('[ViciDial] logged_in_agents error:', err.message);
    return {};
  }
}

// ─── Agent Name Resolution ─────────────────────────────────────────────────

/**
 * Resolve agent names for each ViciDial call row.
 * Strategy (in priority order):
 *
 * 1. Match to CRM closer_record:
 *      closer_records WHERE vicidial_lead_id = row.lead_id
 *      AND ABS(created_at - call_datetime) < 1800 seconds (30 min window)
 *      → use closer's full_name from DB
 *      → agent_source: "crm_match"
 *
 * 2. Match to live agent map (logged_in_agents):
 *      agentMap[row.list_id]
 *      → use agent_name from ViciDial live data
 *      → agent_source: "vicidial_live"
 *
 * 3. Fallback:
 *      Show "Agent: {list_id}"
 *      → agent_source: "id_only"
 *
 * @param {Array}  callRows    - filtered rows from getCallLog()
 * @param {Array}  crmRecords  - closer_records from Supabase for this phone
 * @param {Object} agentMap    - { user_id: name } from getLiveAgentMap()
 * @returns {Array} callRows with agent_name and agent_source filled in
 */
function resolveAgentNames(callRows, crmRecords, agentMap) {
  return callRows.map(row => {
    // Strategy 1: match to CRM closer record
    const THIRTY_MINUTES = 30 * 60 * 1000; // ms
    const callTime = new Date(row.call_datetime).getTime();

    const crmMatch = crmRecords.find(rec => {
      const recTime = new Date(rec.created_at).getTime();
      const sameLeadId = rec.vicidial_lead_id && rec.vicidial_lead_id === row.list_id;
      const withinWindow = Math.abs(recTime - callTime) < THIRTY_MINUTES;
      return sameLeadId || withinWindow;
    });

    if (crmMatch && crmMatch.closer_name) {
      return { ...row, agent_name: crmMatch.closer_name, agent_source: 'crm_match' };
    }

    // Strategy 2: live agent map by list_id
    if (agentMap[row.list_id]) {
      return { ...row, agent_name: agentMap[row.list_id], agent_source: 'vicidial_live' };
    }

    // Strategy 3: fallback to ID
    return { ...row, agent_name: `Agent: ${row.list_id}`, agent_source: 'id_only' };
  });
}

// ─── Timeline Merger ───────────────────────────────────────────────────────

/**
 * Merge CRM records and ViciDial call rows into a single timeline.
 * Each entry has a type: "crm_record" | "vicidial_call"
 * Sorted newest first by timestamp.
 */
function buildMergedTimeline(crmRecords, vicidialCalls) {
  const timeline = [];

  crmRecords.forEach(rec => {
    timeline.push({
      timestamp:        rec.created_at,
      type:             'crm_record',
      record_id:        rec.id,
      policy_number:    rec.policy_number,
      status:           rec.status,
      car_make:         rec.car_make,
      car_model:        rec.car_model,
      car_year:         rec.car_year,
      plan:             rec.plan_name,
      client:           rec.client_name,
      closer_name:      rec.closer_name,
      summary: `Policy ${rec.policy_number} — ${rec.car_year || ''} ${rec.car_make || ''} ${rec.car_model || ''} — ${rec.plan_name || ''} — ${rec.client_name || ''}`
    });
  });

  vicidialCalls.forEach(call => {
    timeline.push({
      timestamp:        call.call_datetime,
      type:             'vicidial_call',
      disposition_code: call.disposition_code,
      duration_seconds: call.duration_seconds,
      duration_display: call.duration_display,
      agent_name:       call.agent_name,
      agent_source:     call.agent_source,
      campaign_id:      call.campaign_id,
      summary: `${call.disposition_code} — ${call.duration_display} — ${call.agent_name}`
    });
  });

  // Sort newest first
  return timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ─── Main Search Function ──────────────────────────────────────────────────

/**
 * Full unified number search.
 * Called by the search API route: GET /api/v1/search/number?q={phone}
 *
 * @param {string} rawPhone   - raw phone input from user
 * @param {Array}  crmRecords - closer_records + transfers from Supabase (passed in from route)
 * @returns {Object} unified search result
 */
async function searchNumber(rawPhone, crmRecords = []) {
  // 1. Normalize
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { error: 'Invalid phone number', phone: rawPhone };
  }

  let vicidialAvailable = true;
  let vicidialCalls = [];
  let leadId = null;

  try {
    // 2. Check Redis sold cache
    let soldStatus = null;
    try {
      soldStatus = await redis.get(`sold:${phone.e164}`);
    } catch (_) {}

    // 3. Fetch ViciDial call log (uses Redis cache internally)
    vicidialCalls = await getCallLog(phone.ten, phone.e164);

    // 4. Get lead_id (for reference — stored on closer record if found)
    leadId = await getLeadId(phone.ten);

    // 5. Get live agent map for name resolution
    const agentMap = await getLiveAgentMap();

    // 6. Resolve agent names for each ViciDial call
    vicidialCalls = resolveAgentNames(vicidialCalls, crmRecords, agentMap);

  } catch (err) {
    console.error('[ViciDial] searchNumber error:', err.message);
    vicidialAvailable = false;
    // Do NOT throw — degrade gracefully, return CRM data only
  }

  // 7. Determine sold status from CRM records
  const isSold = crmRecords.some(r => r.status === 'SOLD');
  const totalPolicies = crmRecords.filter(r => r.status === 'SOLD').length;

  // 8. Update Redis sold cache
  try {
    await redis.set(
      `sold:${phone.e164}`,
      isSold ? 'yes' : 'no',
      'EX',
      86400 // 24 hours
    );
  } catch (_) {}

  // 9. Build merged timeline
  const mergedTimeline = buildMergedTimeline(crmRecords, vicidialCalls);

  // 10. Return unified result
  return {
    phone:              phone.e164,
    phone_display:      `(${phone.ten.slice(0,3)}) ${phone.ten.slice(3,6)}-${phone.ten.slice(6)}`,
    sold:               isSold,
    total_policies:     totalPolicies,
    lead_id:            leadId,
    vicidial_available: vicidialAvailable,
    crm_records:        crmRecords,
    vicidial_calls:     vicidialCalls,
    merged_timeline:    mergedTimeline
  };
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  searchNumber,
  normalizePhone,
  getLeadId,
  getCallLog,
  getLiveAgentMap,
  resolveAgentNames,
  buildMergedTimeline,
  formatDuration
};
```

---

## Part 3 — Search Route

Save at: `apps/api/src/routes/search.js`

```javascript
/**
 * search.js — Number search route
 * GET /api/v1/search/number?q={phone}
 * Accessible by: closer, company_admin (if flag on), super_admin, readonly_admin
 */

const express = require('express');
const router = express.Router();
const { searchNumber, normalizePhone } = require('../services/vicidial');
const { supabase } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const ALLOWED_ROLES = ['closer', 'company_admin', 'super_admin', 'readonly_admin'];

router.get('/number', requireAuth, requireRole(ALLOWED_ROLES), async (req, res) => {
  const { q } = req.query;
  const user = req.user;

  if (!q) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Company admin must have number_search feature flag enabled
  if (user.role === 'company_admin') {
    const flags = user.company?.feature_flags || {};
    if (!flags.number_search) {
      return res.status(403).json({ error: 'Number search not enabled for your company' });
    }
  }

  const phone = normalizePhone(q);
  if (!phone) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  try {
    // Fetch CRM records from Supabase
    // Closers and super admins see ALL companies
    // Company admins see ALL companies too (by design — search is cross-company)
    const { data: closerRecords, error: crErr } = await supabase
      .from('closer_records')
      .select(`
        *,
        closer:users!closer_id(full_name),
        plan:plans(name),
        client:clients(name),
        company:companies(name, display_name)
      `)
      .eq('customer_phone', phone.e164)
      .order('created_at', { ascending: false });

    if (crErr) throw crErr;

    // Flatten joins for cleaner response
    const flatRecords = (closerRecords || []).map(r => ({
      ...r,
      closer_name:  r.closer?.full_name || r.fronter_name || 'Unknown',
      plan_name:    r.plan?.name || null,
      client_name:  r.client?.name || null,
      company_name: r.company?.display_name || null,
    }));

    // Apply search_field_config visibility filter
    const visibleRecords = await applyFieldVisibility(flatRecords, user, supabase);

    // Run unified search (CRM + ViciDial)
    const result = await searchNumber(q, visibleRecords);

    return res.json(result);

  } catch (err) {
    console.error('[Search] error:', err.message);
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

/**
 * Apply search_field_config to strip fields the user should not see.
 * Hidden fields are replaced with null (frontend shows "Not available").
 */
async function applyFieldVisibility(records, user, supabase) {
  try {
    const { data: config } = await supabase
      .from('search_field_config')
      .select('fields')
      .eq('role', user.role)
      .single();

    if (!config || !config.fields) return records;

    const fields = config.fields; // { customer_email: false, customer_dob: false, ... }

    return records.map(rec => {
      const filtered = { ...rec };
      Object.keys(fields).forEach(field => {
        if (fields[field] === false) {
          filtered[field] = null; // hide field — frontend shows "Not available"
        }
      });
      return filtered;
    });
  } catch (_) {
    return records; // if config fails, return unfiltered (safe default)
  }
}

module.exports = router;
```

---

## Part 4 — Environment Variables to Add

Add these to your `.env` and Coolify environment:

```env
# ViciDial — Closer dialer (tmcsolinb.i5.tel)
VICIDIAL_URL=https://tmcsolinb.i5.tel
VICIDIAL_API_USER=apiuser
VICIDIAL_API_PASS=apiuser123
VICIDIAL_API_PATH=/vicidial/non_agent_api.php
VICIDIAL_CAMPAIGN=IHP_01
VICIDIAL_MIN_CALL_DURATION=60
```

---

## Part 5 — Key Rules for Claude IDE (Phase 8 Specific)

- **Never expose ViciDial credentials to frontend.** All ViciDial calls happen server-side only in `vicidial.js`.
- **Always normalize phone before any ViciDial call.** Use `normalizePhone()` — it handles all formats.
- **Always check Redis before calling ViciDial.** `vdlog:{e164}` TTL 1h. `vd:agent_map` TTL 60s.
- **Never block search if ViciDial is down.** All ViciDial calls are wrapped in try/catch. Return CRM data with `vicidial_available: false` if ViciDial fails.
- **Duration filter is the key quality gate.** Only calls > 60 seconds reach the timeline. This is set via `VICIDIAL_MIN_CALL_DURATION` env var.
- **Agent name resolution priority:** CRM match first → live agent map second → ID fallback third. Never show blank agent name.
- **`phone_number_log` is the only confirmed working history function.** Do not attempt `get_call_notes`, `call_log`, or `call_dispo_report` — these are not available on this server.
- **`lead_search` returns only `phone|count|lead_id`.** Do not attempt `query_fields` — this server ignores it.
- **`logged_in_agents` requires `campaign_id=IHP_01`.** Cache result 60 seconds.

---

*BizTrixVenture CRM — ViciDial Integration Doc | Phase 8 ready to build.*

## 9. Multi-Policy / Returning Customer Flow

### 9.1 Scenario

Customer `(904) 765-0112` was sold a policy on a **2018 Toyota Camry**. They call back and want a policy on their **2022 Honda Accord**.

### 9.2 Flow

```
Closer searches: (904) 765-0112
        │
        ▼
Search result shows: SOLD — Policy 1 — 2018 Toyota Camry
        │
        ▼
Closer clicks "Create New Policy"
        │
        ▼
New policy form opens — PRE-FILLED:
  ✅ Customer Phone  — (904) 765-0112   [editable]
  ✅ Customer Name   — FRANK JENKINS    [editable]
  ✅ Email           — FRANK...@gmail   [editable]
  ✅ Address         — 230 E 1st St...  [editable]
  ✅ DOB             — (from record)    [editable]
  ✅ Gender          — (from record)    [editable]
  ⬜ Car Make        — BLANK            [closer fills]
  ⬜ Car Model       — BLANK            [closer fills]
  ⬜ Car Year        — BLANK            [closer fills]
  ⬜ Miles           — BLANK            [closer fills]
  ⬜ VIN             — BLANK            [closer fills]
  ⬜ Plan            — (select)         [closer fills]
  ⬜ Client          — (select)         [closer fills]
  ⬜ Down Payment    — BLANK            [closer fills]
  ⬜ Monthly         — BLANK            [closer fills]
  ⬜ Reference No    — BLANK            [closer fills]
  ⬜ Company         — (select)         [closer selects — which company is sending this transfer]
        │
        ▼
Closer fills new vehicle info + policy details → Submit
        │
        ▼
New closer_records row created:
  - previous_record_id = original record uuid
  - policy_number = 2
  - same customer phone/name/email/address
  - new vehicle: 2022 Honda Accord
        │
        ▼
Search result now shows:
  SOLD — 2 policies
  Policy 1: 2018 Toyota Camry [expand]
  Policy 2: 2022 Honda Accord [expand]
  → → (linked chain)
```

### 9.3 Policy Chain Display

In search results, policies for the same customer are shown as a linked chain:

```
[ Policy 1 — 2018 TOYOTA CAMRY — Signature — Jim — Haroon — 04/03/2026 ]
         ↓ New policy created
[ Policy 2 — 2022 HONDA ACCORD — Gold — Jim — Sarah — 05/15/2026     ]
```

Each policy card is collapsible. Clicking expands to show all fields.

---

## 10. Number List Upload & Assignment

### 10.1 Upload Flow

1. Company Admin uploads CSV or XLSX via drag-drop or file picker.
2. Backend parses with `xlsx.utils.sheet_to_json`. Expects one column of phone numbers. Auto-detects header row.
3. Creates `number_lists` record. Bulk inserts all rows into `assigned_numbers` with `fronter_id = null`.
4. Returns `list_id` and total row count.

### 10.2 Assignment Flow

1. Company Admin selects a list and a fronter from dropdowns.
2. Enters `from_row` and `to_row` (1-based, inclusive). UI previews the range.
3. API: `UPDATE assigned_numbers SET fronter_id = ? WHERE list_id = ? AND row_order BETWEEN from_row-1 AND to_row-1`.
4. Fronter sees their assigned numbers in **My Number List**.

> One number can only be assigned to one fronter. Re-assigning overwrites and logs the change.

---

## 11. Security & 2FA

### 11.1 Two-Factor Authentication

- **Enforced for:** Super Admin, Read-only Admin, Company Admin.
- **Library:** `speakeasy` (TOTP RFC 6238). QR: `qrcode`.
- **Login flow:** email/password → `{ totp_required: true }` + scoped 5-min token → TOTP verify → full 8h JWT.
- **TOTP secret:** AES-256 encrypted in DB.

### 11.2 Audit Logging

Events logged: `login_success`, `login_failed`, `logout`, `2fa_setup`, `totp_verify_failed`, `password_reset`.
Each row: user_id, IP, user agent, parsed device info, timestamp.

### 11.3 General Security

| Measure | Detail |
|---|---|
| JWT auth | 8h expiry. Role in payload. |
| Role guard | Middleware per route. |
| Company isolation | All queries include `WHERE company_id = req.user.company_id`. |
| Rate limiting | `/auth/*` — 10 req / 15 min / IP. |
| CORS | Restricted to `FRONTEND_URL`. |
| Helmet.js | CSP, HSTS, X-Frame-Options. |
| Zod validation | All POST/PATCH bodies. |
| ViciDial creds | Server-side only. Never sent to frontend. |
| File uploads | CSV/XLSX only. Max 10MB. Temp stored, parsed, deleted. |

---

## 12. Deployment on Coolify

### 12.1 Repository Structure

```
/
├── apps/
│   ├── api/              # Node.js Express API
│   ├── web/              # React + Vite frontend
│   └── worker/           # Callback scheduler
├── db/
│   └── migrations/
│       └── 001_init.sql  # All tables + indexes + RLS + seeds
├── docker-compose.yml
├── .env.example
└── README.md
```

### 12.2 `docker-compose.yml`

```yaml
version: '3.9'
services:
  api:
    build: ./apps/api
    env_file: .env
    ports: ["4000:4000"]
    depends_on: [redis]
    restart: unless-stopped

  web:
    build: ./apps/web
    ports: ["80:80"]
    depends_on: [api]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes: [redis_data:/data]

  worker:
    build: ./apps/worker
    env_file: .env
    depends_on: [redis]
    restart: unless-stopped

volumes:
  redis_data:
```

### 12.3 Coolify Setup Steps

1. Create project in Coolify. Add Docker Compose source pointing to repo.
2. Set all env vars from `.env.example` in Coolify Environment tab.
3. Expose `web` service to internet on port 80. Coolify auto-provisions SSL via Traefik.
4. `api` and `redis` stay internal.
5. Run `db/migrations/001_init.sql` in Supabase Dashboard SQL editor.
6. Health check on `api`: `GET /api/v1/health` → `200 OK`.

---

## 13. Recommended Build Order for Claude IDE

| Phase | What to build |
|---|---|
| **Phase 1** | Supabase schema — `001_init.sql`. All tables including `closer_records`, `plans`, `clients`, `search_field_config`. Seed dispositions, plans, clients. |
| **Phase 2** | Auth system — login, JWT, role guard, 2FA setup + verify. Frontend: login + TOTP screens. |
| **Phase 3** | Company & user management — CRUD, Super Admin screens, feature flags, plan manager, client manager. |
| **Phase 4** | Transfer form — Fronter creates transfer. Closer dropdown. Fronter dashboard. |
| **Phase 5** | Closer record form — all 22 fields, plan/client/disposition dropdowns, submit creates `closer_records` row, updates Redis. |
| **Phase 6** | Real-time notifications — Socket.io, Redis adapter, rooms, transfer ping, sale alert. |
| **Phase 7** | Number search (CRM only first) — Redis check → Supabase query → return results. Search UI on closer dashboard. |
| **Phase 8** | ViciDial integration — `services/vicidial.js`, lead search, disposition history pull, merge with CRM results, unified timeline UI. |
| **Phase 9** | Multi-policy flow — "Create New Policy" button, pre-filled form, `previous_record_id` linking, policy chain display. |
| **Phase 10** | Search field config — Super Admin config panel, field visibility filter applied in search API. |
| **Phase 11** | Callback system — create callback, worker service, push notification. |
| **Phase 12** | Number upload & assignment — CSV/XLSX upload, assignment UI, fronter number list. |
| **Phase 13** | Reporting & export — date range filters, CSV export. |
| **Phase 14** | Audit log & 2FA enforcement — login event recording, audit screen. |
| **Phase 15** | PWA + polish — Vite PWA plugin, manifest, service worker, responsive, dark/light mode. |

---

## 14. Monorepo File Structure

```
/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   ├── companies.js
│   │   │   │   ├── users.js
│   │   │   │   ├── transfers.js
│   │   │   │   ├── closer-records.js
│   │   │   │   ├── dispositions.js
│   │   │   │   ├── plans.js
│   │   │   │   ├── clients.js
│   │   │   │   ├── callbacks.js
│   │   │   │   ├── numbers.js
│   │   │   │   ├── search.js
│   │   │   │   ├── search-config.js
│   │   │   │   └── audit.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js
│   │   │   │   ├── role.js
│   │   │   │   ├── rateLimit.js
│   │   │   │   └── validate.js
│   │   │   ├── services/
│   │   │   │   ├── supabase.js
│   │   │   │   ├── redis.js
│   │   │   │   ├── socket.js
│   │   │   │   ├── totp.js
│   │   │   │   ├── audit.js
│   │   │   │   ├── notification.js
│   │   │   │   └── vicidial.js       # ViciDial API calls
│   │   │   └── schemas/
│   │   │       ├── closer-record.schema.js
│   │   │       ├── transfer.schema.js
│   │   │       └── *.schema.js
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
│   │   │   │   ├── CloserRecordForm.jsx      # 22-field closer form
│   │   │   │   ├── NewPolicyForm.jsx          # Pre-filled new policy form
│   │   │   │   ├── NumberSearch.jsx           # Search bar + results
│   │   │   │   ├── SearchResultCard.jsx       # Single policy record card
│   │   │   │   ├── PolicyChain.jsx            # Policy 1 → Policy 2 display
│   │   │   │   ├── ViciDialTimeline.jsx       # ViciDial call history
│   │   │   │   ├── MergedTimeline.jsx         # CRM + ViciDial merged
│   │   │   │   ├── CallbackForm.jsx
│   │   │   │   ├── NumberUpload.jsx
│   │   │   │   ├── NumberAssign.jsx
│   │   │   │   ├── AuditLog.jsx
│   │   │   │   ├── UserTable.jsx
│   │   │   │   ├── CompanyTable.jsx
│   │   │   │   ├── DispositionManager.jsx
│   │   │   │   ├── PlanManager.jsx
│   │   │   │   ├── ClientManager.jsx
│   │   │   │   ├── SearchFieldConfig.jsx      # Super Admin field visibility
│   │   │   │   └── ExportButton.jsx
│   │   │   ├── store/
│   │   │   │   ├── auth.js
│   │   │   │   ├── notifications.js
│   │   │   │   └── ui.js
│   │   │   ├── hooks/
│   │   │   │   ├── useSocket.js
│   │   │   │   ├── useSearch.js              # Debounced + normalized search
│   │   │   │   └── useCallbacks.js
│   │   │   └── lib/
│   │   │       ├── axios.js
│   │   │       ├── socket.js
│   │   │       └── utils.js                  # normalizePhone(), formatCurrency(), etc.
│   │   ├── public/manifest.json
│   │   ├── vite.config.js
│   │   └── Dockerfile
│   │
│   └── worker/
│       └── index.js
│
├── db/
│   └── migrations/
│       └── 001_init.sql
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 15. Key Rules & Constraints for Claude IDE

### ViciDial Integration Rules

- **ViciDial credentials are server-side only.** Never include `VICIDIAL_API_USER`, `VICIDIAL_API_PASS`, or `VICIDIAL_URL` in the frontend build or any response sent to the client.
- **Always normalize phone before ViciDial call.** ViciDial expects 10-digit US format (no country code, no formatting). Strip all non-digits and remove leading `1` if present.
- **Cache ViciDial responses.** ViciDial API calls are slow — always check Redis `vdlead:{phone_e164}` before hitting the API. TTL: 1 hour.
- **CRM first, ViciDial second.** Never call ViciDial if the CRM Redis cache already has the full answer.
- **ViciDial API failures must not break search.** Wrap all ViciDial calls in try/catch. If ViciDial is unreachable, return CRM data only with a flag `{ vicidial_available: false }` so the frontend can show a notice.
- **Only show dispositions where closer actually spoke to customer.** Filter ViciDial call history to exclude `NA`, `DROP`, `BUSY`, `INCALL` and any other system-generated non-conversation dispositions. The exact exclusion list will be provided when ViciDial credentials are set up — build the filter as a configurable array `VICIDIAL_SKIP_DISPOS = ['NA', 'DROP', 'BUSY', 'INCALL']` in env.

### Closer Record Form Rules

- **Phone normalization on blur.** When closer leaves the phone field, normalize it and immediately trigger a background search to check if this number is already sold. Show a small indicator.
- **All editable on new policy.** For "Create New Policy" flow, every field is editable — pre-filled is a convenience, not a lock.
- **Status defaults to SOLD.** Closer should not have to change this for normal calls.
- **Company dropdown** on closer form fetches only active companies from `/companies`.
- **Plan and Client dropdowns** fetch from `/plans` and `/clients` — these are Super Admin managed.
- **On submit:** (1) Insert `closer_records` row. (2) Set Redis `sold:{phone_e164} = "yes" EX 86400`. (3) Emit Socket.io event to `company:{company_id}` room. All three must happen — use Promise.all for 2 and 3 after DB insert succeeds.

### Search Rules

- **Search is by phone number only** (not name, not email).
- **Debounce 500ms** before triggering search (phone numbers are longer than regular search terms).
- **Show all company records** for a number — closers see records from all companies, including other closers' names and dispositions. Full detail on click/expand.
- **Field visibility filter** is applied server-side in the search API, not client-side.
- **"Not available"** in muted gray text for any field that is null or empty — never hide the field label, always show it.

### Multi-Policy Rules

- **"Create New Policy" button always shows** on any SOLD number search result.
- **`previous_record_id`** must be set to the most recent `closer_records.id` for that phone number when creating a new policy.
- **`policy_number`** must be `MAX(policy_number) + 1` for that phone number across all records.
- **New policy company** is selected manually by the closer from the dropdown — do not inherit from old record.

### General Must-Follow Rules

- **Every API route must have a Zod schema.** Never trust raw `req.body`.
- **Company isolation:** Every company-scoped query MUST include `WHERE company_id = req.user.company_id`. Closers are BizTrix-side and are exempt — they see all companies' records in search.
- **Socket.io rooms:** `user:{id}` always + `company:{company_id}` if applicable. Never broadcast globally.
- **Feature flag checks in API, not just frontend.**
- **CSV export uses streams** — never load all rows into memory.
- **Callback worker is idempotent** — check `is_fired = false`, set atomically.
- **2FA intermediate token** — 5-min TTL scoped token between password and TOTP steps.

### Never Do

- ❌ Never expose ViciDial credentials to the frontend.
- ❌ Never call ViciDial without checking Redis cache first.
- ❌ Never skip the `company_id` filter on company-scoped routes.
- ❌ Never issue a full JWT before TOTP is verified when `totp_enabled = true`.
- ❌ Never block search if ViciDial is down — degrade gracefully.
- ❌ Never let a company admin see another company's data.
- ❌ Never use a global Socket.io broadcast.
- ❌ Never load full export into memory — always stream.

---

*BizTrixVenture CRM — PRD v2.0 | Start with Phase 1: Supabase schema.*