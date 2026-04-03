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