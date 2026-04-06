# BizTrixVenture CRM — New Roles Implementation Prompt
## For Claude IDE (Claude Code)

> **Scope:** Add 4 new internal BizTrix roles to the existing system
> **Roles:** Closer Manager · Operations Manager · Compliance Manager · Compliance Agent
> **Do NOT touch:** ViciDial search, phone_number_log, vicidial_agents.js — leave as is
> **Base:** Existing PRD v2.0 schema and codebase

---

## Context

The existing system has these roles already built:
- `super_admin` — full access
- `readonly_admin` — view only
- `company_admin` — own company only
- `closer` — fills closer record form, searches numbers
- `fronter` — fills transfer form, assigned numbers

You are now adding 4 new **BizTrix-internal** roles. All 4 belong to BizTrixVenture only — never to a sub-company. Their `company_id` in the `users` table is `null` just like closers and super admins.

---

## Role 1 — Closer Manager

### Who they are
Senior BizTrix staff who supervise all closers, can make sales themselves, and manage closer accounts.

### What they can do

**As a closer (they are also a closer):**
- Fill the closer record form exactly like any closer
- Access number search
- Create and manage their own callbacks
- Receive real-time transfer notifications when selected in transfer form

**As a manager (additional powers):**
- View all closer records from all closers — full table with filters (date range, closer name, disposition, company, status)
- View all transfers from all companies — read only
- Create, edit, and deactivate closer accounts (role = `closer` only — cannot create other managers or admins)
- Reassign a transfer from one closer to another IF the transfer has no closer record linked yet — once a closer record exists the transfer is locked
- See a closer performance dashboard:
  - Leaderboard: all closers ranked by sales count for selected date range
  - Per-closer stats: total transfers received, sales made, callbacks pending, dispositions breakdown
  - Today vs yesterday vs this week vs this month toggle
- Receive notifications:
  - When any closer makes a sale
  - When any closer has a callback due and it is overdue by 30+ minutes
  - When a new closer account is created by super admin

### What they cannot do
- Cannot see compliance flags or compliance assignments
- Cannot edit closer records (only view)
- Cannot manage companies or feature flags
- Cannot access audit logs
- Cannot export reports

### Dashboard
Same layout as Super Admin but restricted:
- Left sidebar sections visible: **Dashboard · Closers · Transfers · Performance · My Records · Search · Callbacks**
- Hidden sections: Companies, Audit Log, Dispositions Manager, Plans, Clients, Compliance, Operations

---

## Role 2 — Operations Manager

### Who they are
BizTrix internal oversight role. View-only across everything. Gets notified on key business events to monitor health of operations.

### What they can do

**View access (read-only, no edit, no create, no delete anywhere):**
- All companies — name, status, feature flags (view only)
- All transfers — from all companies, all date ranges
- All closer records — from all closers
- All users list — all roles (view names and roles, not passwords or TOTP secrets)
- All callbacks — from all users
- All dispositions, plans, clients list
- Dashboard KPIs: total transfers today, sales today, callbacks pending, active companies, active closers, per-company breakdown

**Notifications (real-time):**
- New company registered
- New sale made (any closer, any company)
- Callback overdue 30+ minutes
- Any closer deactivated
- Daily summary at end of day (configurable time, default 6 PM): total transfers, total sales, total callbacks for the day

### What they cannot do
- Cannot create, edit, or delete anything — strictly read-only
- Cannot access compliance module
- Cannot export CSV
- Cannot access audit logs
- Cannot access number search

### Dashboard
Same layout as Super Admin but all action buttons (Add, Edit, Delete, Export, Toggle) are hidden. Shows a read-only view of all data. Banner at top: "Operations View — Read Only".

---

## Role 3 — Compliance Manager

### Who they are
BizTrix internal senior compliance staff. Verifies that sales records are accurate (VIN, policy details, reference numbers, plan). Assigns review batches to compliance agents. Can be assigned to specific companies to oversee.

### What they can do

**Record review:**
- View all closer records from all companies
- Cannot edit records directly
- Can **flag** a record with a reason (dropdown: Wrong VIN · Wrong Reference No · Wrong Plan · Missing Info · Duplicate · Other + free text notes)
- Can mark a record as **Reviewed & Approved** (green badge on record)
- Can mark a record as **Issue Found** (red badge on record) with mandatory reason
- Flagged/approved status is invisible to closers — only visible within compliance department

**Batch assignment:**
- Select a company + date range → creates a **compliance batch**
- Assign batch to one or multiple compliance agents
- See status of all batches: pending, in progress, completed
- Can reassign a batch from one agent to another
- Receives notification when a compliance agent completes a batch or flags an issue

**DNC Management:**
- Add a phone number to DNC list with reason and notes
- Remove a phone number from DNC list with reason
- View full DNC list — phone, added by, date, reason
- ViciDial DNC sync: mark for future implementation (store flag `vicidial_sync_pending = true` on DNC record — do not build the sync now)

**Company assignment:**
- Super Admin can assign specific companies to a compliance manager
- Compliance manager sees ALL companies by default unless restricted by super admin
- Stored in `compliance_company_assignments` table

**Notifications:**
- When a compliance agent flags an issue on an assigned batch
- When a compliance agent marks a batch as complete
- When a new closer record is submitted with a disposition of SALE (optional alert — toggleable by super admin)

### What they cannot do
- Cannot edit closer records
- Cannot create or manage user accounts
- Cannot access transfer form or closer record form
- Cannot access number search
- Cannot export reports
- Cannot see audit logs

### Dashboard
Left sidebar: **Dashboard · Closer Records · Compliance Batches · DNC List · My Assignments**

---

## Role 4 — Compliance Agent

### Who they are
Junior compliance staff working under compliance managers. Only see records assigned to them via batches.

### What they can do

**Assigned batches only:**
- See list of batches assigned to them
- Click into a batch → see all closer records in that batch
- For each record:
  - View all fields (read only)
  - Flag with reason (same dropdown as compliance manager: Wrong VIN · Wrong Reference No · Wrong Plan · Missing Info · Duplicate · Other + notes)
  - Mark as Reviewed & Approved
  - Mark as Issue Found with mandatory reason
- Mark entire batch as complete when all records reviewed

**Cannot see anything outside assigned batches.**

**Notifications:**
- New batch assigned to them
- Reminder notification if batch has been pending for 24+ hours without any action

### What they cannot do
- Cannot create batches
- Cannot assign batches
- Cannot manage DNC list
- Cannot see unassigned records
- Cannot access number search
- Cannot see other agents' batches
- Cannot create or manage accounts
- Cannot see companies, transfers, or callbacks outside their batch records

### Dashboard
Left sidebar: **My Batches · (batch detail view)**
Simple clean UI: list of assigned batches with status pill (Pending / In Progress / Complete), record count, company name, date range, assigned by.

---

## Database Changes Required

### 1. Update `users.role` allowed values
Add to the role check constraint:
```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin',
    'readonly_admin',
    'company_admin',
    'closer',
    'fronter',
    'closer_manager',
    'operations_manager',
    'compliance_manager',
    'compliance_agent'
  ));
```

### 2. New table: `compliance_batches`
```sql
CREATE TABLE compliance_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid REFERENCES companies(id),        -- which company's records
  date_from           date NOT NULL,
  date_to             date NOT NULL,
  created_by          uuid REFERENCES users(id) NOT NULL,   -- compliance manager
  assigned_to         uuid REFERENCES users(id),            -- compliance agent
  status              text DEFAULT 'pending',               -- pending | in_progress | completed
  total_records       integer DEFAULT 0,
  reviewed_records    integer DEFAULT 0,
  flagged_records     integer DEFAULT 0,
  approved_records    integer DEFAULT 0,
  completed_at        timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
```

### 3. New table: `compliance_reviews`
```sql
CREATE TABLE compliance_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            uuid REFERENCES compliance_batches(id) NOT NULL,
  closer_record_id    uuid REFERENCES closer_records(id) NOT NULL,
  reviewed_by         uuid REFERENCES users(id) NOT NULL,   -- agent or manager
  status              text NOT NULL,                        -- approved | issue_found | pending
  flag_reason         text,                                 -- Wrong VIN | Wrong Reference No | Wrong Plan | Missing Info | Duplicate | Other
  flag_notes          text,
  reviewed_at         timestamptz,
  created_at          timestamptz DEFAULT now()
);
```

### 4. New table: `compliance_company_assignments`
```sql
CREATE TABLE compliance_company_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_manager_id uuid REFERENCES users(id) NOT NULL,
  company_id          uuid REFERENCES companies(id) NOT NULL,
  assigned_by         uuid REFERENCES users(id) NOT NULL,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(compliance_manager_id, company_id)
);
```

### 5. New table: `dnc_list`
```sql
CREATE TABLE dnc_list (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number          text NOT NULL UNIQUE,               -- E.164 format
  reason                text,
  notes                 text,
  added_by              uuid REFERENCES users(id) NOT NULL,
  removed_by            uuid REFERENCES users(id),
  removed_at            timestamptz,
  is_active             boolean DEFAULT true,
  vicidial_sync_pending boolean DEFAULT true,               -- for future ViciDial DNC sync
  created_at            timestamptz DEFAULT now()
);
```

### 6. New table: `closer_performance_cache`
```sql
CREATE TABLE closer_performance_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id       uuid REFERENCES users(id) NOT NULL,
  period          text NOT NULL,                            -- today | yesterday | this_week | this_month
  total_transfers integer DEFAULT 0,
  total_sales     integer DEFAULT 0,
  callbacks_pending integer DEFAULT 0,
  dispositions    jsonb DEFAULT '{}',                       -- { SALE: 5, NI: 3, CB: 2 }
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(closer_id, period)
);
```

---

## New API Endpoints Required

### Closer Manager endpoints

```
GET  /api/v1/closer-manager/closers              — list all closers with stats
POST /api/v1/closer-manager/closers              — create closer account
PATCH /api/v1/closer-manager/closers/:id         — edit or deactivate closer
GET  /api/v1/closer-manager/performance          — leaderboard + per-closer stats
GET  /api/v1/closer-manager/performance/:id      — single closer performance
GET  /api/v1/closer-manager/transfers            — all transfers read only
PATCH /api/v1/closer-manager/transfers/:id/reassign — reassign closer on transfer (only if no closer record linked)
```

### Operations Manager endpoints

```
GET  /api/v1/operations/dashboard                — KPIs: transfers, sales, callbacks, companies, closers
GET  /api/v1/operations/companies                — all companies read only
GET  /api/v1/operations/transfers                — all transfers read only
GET  /api/v1/operations/closer-records           — all closer records read only
GET  /api/v1/operations/users                    — all users read only
```

### Compliance endpoints

```
GET  /api/v1/compliance/records                  — all closer records [manager] or assigned only [agent]
POST /api/v1/compliance/batches                  — create batch [manager]
GET  /api/v1/compliance/batches                  — list batches [manager: all, agent: own]
GET  /api/v1/compliance/batches/:id              — batch detail with all records
PATCH /api/v1/compliance/batches/:id/assign      — assign/reassign agent [manager]
PATCH /api/v1/compliance/batches/:id/complete    — mark batch complete [agent]
POST /api/v1/compliance/reviews                  — submit review (flag/approve) for a record
GET  /api/v1/compliance/reviews/:record_id       — get review status for a record
GET  /api/v1/compliance/dnc                      — list DNC numbers [manager]
POST /api/v1/compliance/dnc                      — add to DNC [manager]
PATCH /api/v1/compliance/dnc/:id                 — remove from DNC [manager]
GET  /api/v1/compliance/assignments              — company assignments for this manager
```

---

## Frontend Pages Required

### New pages to create

```
/closer-manager/dashboard          — KPIs + recent activity
/closer-manager/closers            — closer list + create/edit/deactivate
/closer-manager/performance        — leaderboard table + per-closer stats
/closer-manager/transfers          — all transfers read only
/closer-manager/record             — closer record form (same as /closer but manager version)
/closer-manager/search             — number search (same as /closer)
/closer-manager/callbacks          — own callbacks

/operations/dashboard              — read-only KPI view of everything

/compliance/dashboard              — batch summary + flagged records count
/compliance/records                — all closer records [manager] or assigned [agent]
/compliance/batches                — batch list + create [manager] / view [agent]
/compliance/batches/:id            — batch detail — review records one by one
/compliance/dnc                    — DNC list + add/remove [manager only]
```

### New components to create

```
CloserLeaderboard.jsx              — ranked table: closer name, sales, transfers, callbacks
CloserStatsCard.jsx                — per-closer breakdown card
PerformancePeriodToggle.jsx        — today / yesterday / this week / this month
TransferReassignModal.jsx          — modal to change closer on a transfer
ComplianceBatchForm.jsx            — create batch: company + date range + assign agent
ComplianceBatchList.jsx            — list of batches with status pills
ComplianceBatchDetail.jsx          — record-by-record review UI with flag/approve buttons
ComplianceReviewPanel.jsx          — side panel showing flag reason dropdown + notes
DNCList.jsx                        — DNC table + add number form
DNCAddModal.jsx                    — add phone to DNC with reason
OperationsDashboard.jsx            — read-only dashboard with all KPIs
```

---

## Notification Events for New Roles

| Event | Who receives |
|---|---|
| Any closer makes a sale | Closer Manager (toast + badge) |
| Closer callback overdue 30+ min | Closer Manager (toast) |
| New closer account created | Closer Manager (toast) |
| New sale made | Operations Manager (toast) |
| New company registered | Operations Manager (toast) |
| Any closer deactivated | Operations Manager (toast) |
| Callback overdue 30+ min | Operations Manager (toast) |
| Compliance agent flags an issue | Compliance Manager (toast + email optional) |
| Compliance agent completes batch | Compliance Manager (toast) |
| New batch assigned | Compliance Agent (toast + push notification) |
| Batch pending 24h with no action | Compliance Agent (push reminder) |

Add to Socket.io room strategy:
- `role:closer_manager` — all closer manager instances join this room
- `role:operations_manager` — all operations manager instances join this room
- `role:compliance_manager` — all compliance manager instances join this room
- `compliance_agent:{user_id}` — individual room per compliance agent

---

## Role Guard Updates

Update the existing `middleware/role.js` to include new roles in all relevant existing routes:

```javascript
// Routes that new roles can access (add to existing allowedRoles arrays):

// GET /transfers — add:
['closer_manager', 'operations_manager']

// GET /closer-records — add:
['closer_manager', 'operations_manager', 'compliance_manager', 'compliance_agent']

// GET /users — add:
['closer_manager', 'operations_manager']

// GET /companies — add:
['operations_manager', 'compliance_manager']

// POST /closer-records — add:
['closer_manager']   // closer manager can make sales too

// GET /search/number — add:
['closer_manager']

// GET /agents (ViciDial live agents) — add:
['closer_manager', 'operations_manager']
```

---

## Sidebar Navigation Per Role

### Closer Manager sidebar
```
Dashboard
├── My Records          (own closer records)
├── My Callbacks        (own callbacks)
├── Number Search
── Closers
   ├── All Closers      (list + manage)
   └── Performance      (leaderboard + stats)
── Transfers            (all, read only)
── Record Form          (make a sale)
```

### Operations Manager sidebar
```
Dashboard              (read-only KPIs)
├── Companies
├── Transfers
├── Closer Records
├── Users
└── Callbacks
```

### Compliance Manager sidebar
```
Dashboard
├── Closer Records      (all — review + flag)
├── Batches             (create + assign + track)
├── DNC List            (add/remove)
└── Company Assignments (which companies assigned to me)
```

### Compliance Agent sidebar
```
My Batches             (only assigned batches)
└── Batch Detail       (record by record review)
```

---

## Key Business Logic Rules

### Closer Manager
- When reassigning a transfer: check `closer_records` table first. If any record exists with this `transfer_id` → block reassign, return error: "This transfer already has a closer record — cannot reassign."
- Closer manager creating a closer account: set `role = closer`, `company_id = null`. Do not allow setting any other role.
- Performance stats: compute from `closer_records` table grouped by `closer_id`. Cache result in `closer_performance_cache` table, refresh every 5 minutes via a simple API call trigger (no separate worker needed).

### Operations Manager
- Strictly GET only on all routes. If operations manager somehow sends a POST/PATCH/DELETE → return 403 immediately at middleware level regardless of route.
- Add `operations_readonly` middleware that wraps all operations routes:
```javascript
function operationsReadonly(req, res, next) {
  if (req.user.role === 'operations_manager' && req.method !== 'GET') {
    return res.status(403).json({ error: 'Operations role is read-only' });
  }
  next();
}
```

### Compliance Manager
- Batch creation: query `closer_records` where `company_id = batch.company_id` AND `record_date BETWEEN batch.date_from AND batch.date_to`. Count results → set `total_records`. Create one `compliance_reviews` row per record with `status = pending`.
- A compliance manager can only see compliance reviews for companies assigned to them (via `compliance_company_assignments`). If no assignments exist for this manager → they see all companies (default open access).
- When marking a record as Issue Found: `flag_reason` is required — return 422 if missing.
- When flagging an issue: emit Socket.io event to `role:compliance_manager` room AND to the specific manager who created the batch.

### Compliance Agent
- Agent can only see batches where `assigned_to = req.user.id`.
- When agent reviews a record: update `compliance_reviews` row. Then update `compliance_batches` counters (`reviewed_records`, `flagged_records`, `approved_records`) in same transaction.
- When agent marks batch complete: set `status = completed`, `completed_at = now()`. Check all records in batch have a review status (not pending) — if any are still pending return error: "All records must be reviewed before completing the batch."
- Batch reminder: in the existing worker (`apps/worker/index.js`), add a check every hour: find batches where `status = pending` AND `created_at < now() - interval 24 hours` AND `assigned_to IS NOT NULL` → emit reminder notification to `compliance_agent:{assigned_to}` room.

### DNC List
- Phone stored as E.164 format (use existing `normalizePhone()` from `vicidial.js`).
- On add: check if number already exists in `dnc_list` with `is_active = true` → return 409 "Already on DNC list".
- Removal is soft delete: set `is_active = false`, `removed_by`, `removed_at`. Record stays in table for audit trail.
- Set `vicidial_sync_pending = true` on all new DNC entries — ViciDial sync not implemented yet, just flag it.

---

## Files to Create

```
apps/api/src/routes/
  closer-manager.js         — all closer manager routes
  operations.js             — all operations manager routes
  compliance.js             — all compliance routes (manager + agent)

apps/web/src/pages/
  CloserManagerDashboard.jsx
  OperationsDashboard.jsx
  ComplianceDashboard.jsx

apps/web/src/components/
  CloserLeaderboard.jsx
  CloserStatsCard.jsx
  PerformancePeriodToggle.jsx
  TransferReassignModal.jsx
  ComplianceBatchForm.jsx
  ComplianceBatchList.jsx
  ComplianceBatchDetail.jsx
  ComplianceReviewPanel.jsx
  DNCList.jsx
  DNCAddModal.jsx
```

---

## Files to Modify

```
apps/api/src/middleware/role.js           — add 4 new roles to all relevant route guards
apps/api/src/routes/transfers.js          — add closer_manager + operations_manager read access
apps/api/src/routes/closer-records.js     — add all new roles with correct access level
apps/api/src/routes/users.js             — add closer_manager + operations_manager read access
apps/api/src/routes/search.js            — add closer_manager access
apps/api/src/services/notification.js    — add new notification events for new roles
apps/api/src/index.js                    — register new route files
apps/worker/index.js                     — add batch reminder check (every 60 min)
apps/web/src/lib/axios.js               — no change needed
apps/web/src/store/auth.js              — add new roles to role-based routing logic
```

---

## Never Do (Constraints)

- Never allow compliance agent to see records outside their assigned batch
- Never allow compliance manager or agent to edit closer records — flag only
- Never show compliance flags to closers — compliance data is internal only
- Never allow operations manager to POST, PATCH, or DELETE anything
- Never allow closer manager to create any role other than `closer`
- Never allow closer manager to reassign a transfer that already has a closer record
- Never sync DNC to ViciDial yet — just store `vicidial_sync_pending = true`
- Never add 2FA enforcement for these 4 roles yet — leave for future revision
- Do not touch vicidial_agents.js, vicidial.js, or search.js ViciDial logic

---

*BizTrixVenture CRM — New Roles Prompt v1.0 | Add after existing system is running.*
