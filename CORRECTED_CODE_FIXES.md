# CORRECTED CODE - Critical Issues

This document contains corrected code for all critical issues identified in the audit.

---

## 1. outcomes.js - Fix Closer Manager Query (Lines 38-44)

**File:** `apps/api/src/routes/outcomes.js`

**REPLACE THIS:**
```javascript
// Line 38-44 (WRONG - closer_manager can't see outcomes)
if (role === 'closer' || role === 'closer_manager') {
  query = query.eq('closer_id', userId);
} else if (role === 'company_admin') {
  query = query.eq('company_id', companyId);
} else if (['super_admin', 'readonly_admin'].includes(role) && company_id) {
  query = query.eq('company_id', company_id);
}
```

**WITH THIS:**
```javascript
// Line 38-80 (FIXED - proper closer_manager isolation)
if (role === 'closer') {
  query = query.eq('closer_id', userId);
} else if (role === 'closer_manager') {
  // Get all closers managed by this manager
  try {
    const { data: managedClosers, error: closersError } = await supabase
      .from('users')
      .select('id')
      .eq('managed_by', userId)
      .eq('role', 'closer');

    if (closersError) throw closersError;

    const closerIds = (managedClosers || []).map(c => c.id);
    if (closerIds.length === 0) {
      return res.json({
        outcomes: [],
        pagination: { page, limit, hasMore: false },
      });
    }

    query = query.in('closer_id', closerIds);
  } catch (err) {
    console.error('Error fetching managed closers for outcomes:', err);
    throw err;
  }
} else if (role === 'company_admin') {
  query = query.eq('company_id', companyId);
} else if (['super_admin', 'readonly_admin', 'operations_manager'].includes(role) && company_id) {
  query = query.eq('company_id', company_id);
} else if (role === 'operations_manager') {
  // Operations manager can see all outcomes (no filter if no company_id specified)
  // Filter is optional below
}
```

---

## 2. transfers.js - Fix Closer Manager Transfer Visibility (Lines 32-42)

**File:** `apps/api/src/routes/transfers.js`

**REPLACE THIS:**
```javascript
// Line 32-42 (WRONG - comment says "closer_manager can see all transfers")
// Role-based filtering
if (role === 'fronter') {
  query = query.eq('fronter_id', userId);
} else if (role === 'closer') {
  query = query.eq('closer_id', userId);
} else if (role === 'company_admin') {
  query = query.eq('company_id', companyId);
} else if (['super_admin', 'readonly_admin', 'closer_manager', 'operations_manager'].includes(role) && company_id) {
  query = query.eq('company_id', company_id);
}
// closer_manager and operations_manager can see all transfers without company_id filter
```

**WITH THIS:**
```javascript
// Line 32-60 (FIXED - proper closer_manager restrictions)
// Role-based filtering
if (role === 'fronter') {
  query = query.eq('fronter_id', userId);
} else if (role === 'closer') {
  query = query.eq('closer_id', userId);
} else if (role === 'company_admin') {
  query = query.eq('company_id', companyId);
} else if (role === 'closer_manager') {
  // Closer managers see only their managed closers' transfers
  try {
    const { data: managedClosers, error: closersError } = await supabase
      .from('users')
      .select('id')
      .eq('managed_by', userId)
      .eq('role', 'closer');

    if (closersError) throw closersError;

    const closerIds = (managedClosers || []).map(c => c.id);
    if (closerIds.length === 0) {
      return res.json({
        transfers: [],
        pagination: { page, limit, hasMore: false },
      });
    }

    query = query.in('closer_id', closerIds);
  } catch (err) {
    console.error('Error fetching managed closers for transfers:', err);
    throw err;
  }
} else if (role === 'operations_manager') {
  // Operations manager can see all transfers (apply company_id filter if provided)
  if (company_id) {
    query = query.eq('company_id', company_id);
  }
} else if (['super_admin', 'readonly_admin'].includes(role) && company_id) {
  query = query.eq('company_id', company_id);
}
```

---

## 3. closer-manager.js - Fix PATCH /closers/:id (Lines 262-293)

**File:** `apps/api/src/routes/closer-manager.js`

**REPLACE THIS:**
```javascript
// PATCH /closer-manager/closers/:id - Edit or deactivate closer
router.patch('/closers/:id', async (req, res) => {
  const { id: closerId } = req.params;
  const { is_active } = req.body;

  try {
    // Only allowing is_active toggle for now
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({ is_active })
      .eq('id', closerId)
      .eq('role', 'closer')
      .select();

    if (error) throw error;

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Closer not found' });
    }

    res.json({
      closer: updated[0],
      message: `Closer account ${is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    console.error('Patch closer error:', err);
    res.status(500).json({ error: 'Failed to update closer' });
  }
});
```

**WITH THIS:**
```javascript
// PATCH /closer-manager/closers/:id - Edit or deactivate closer (FIXED WITH AUTHORIZATION CHECK)
router.patch('/closers/:id', async (req, res) => {
  const { id: closerId } = req.params;
  const { is_active } = req.body;
  const { id: managerId } = req.user;

  try {
    // Only allowing is_active toggle for now
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    // CRITICAL FIX: Verify that closerId is actually managed by this manager
    const { data: closer, error: verifyError } = await supabase
      .from('users')
      .select('id, managed_by, role')
      .eq('id', closerId)
      .eq('role', 'closer')
      .single();

    if (verifyError || !closer) {
      return res.status(404).json({ error: 'Closer not found' });
    }

    // Authorization check: Manager can only update their own managed closers
    if (closer.managed_by !== managerId) {
      return res.status(403).json({ error: 'Cannot manage closers outside your team' });
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({ is_active })
      .eq('id', closerId)
      .select();

    if (error) throw error;

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Closer not found' });
    }

    res.json({
      closer: updated[0],
      message: `Closer account ${is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    console.error('Patch closer error:', err);
    res.status(500).json({ error: 'Failed to update closer' });
  }
});
```

---

## 4. closer-manager.js - Fix GET /performance/:id (Lines 340-368)

**File:** `apps/api/src/routes/closer-manager.js`

**REPLACE THIS:**
```javascript
// GET /closer-manager/performance/:id - Single closer performance
router.get('/performance/:id', async (req, res) => {
  const { id: closerId } = req.params;
  const period = req.query.period || 'today';

  try {
    // Verify closer exists
    const { data: closer, error: closerError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', closerId)
      .eq('role', 'closer')
      .single();

    if (closerError || !closer) {
      return res.status(404).json({ error: 'Closer not found' });
    }

    const stats = await getCloserPerformanceStats(closerId, period);

    res.json({
      closer,
      period,
      stats,
    });
  } catch (err) {
    console.error('Get closer performance error:', err);
    res.status(500).json({ error: 'Failed to fetch closer performance' });
  }
});
```

**WITH THIS:**
```javascript
// GET /closer-manager/performance/:id - Single closer performance (FIXED WITH AUTHORIZATION CHECK)
router.get('/performance/:id', async (req, res) => {
  const { id: closerId } = req.params;
  const { id: managerId } = req.user;
  const period = req.query.period || 'today';

  try {
    // CRITICAL FIX: Verify closer is managed by this manager
    const { data: closer, error: closerError } = await supabase
      .from('users')
      .select('id, email, full_name, managed_by, role')
      .eq('id', closerId)
      .eq('role', 'closer')
      .single();

    if (closerError || !closer) {
      return res.status(404).json({ error: 'Closer not found' });
    }

    // Authorization check: Manager can only view managed closers' performance
    if (closer.managed_by !== managerId) {
      return res.status(403).json({ error: 'Cannot view performance for closers outside your team' });
    }

    const stats = await getCloserPerformanceStats(closerId, period);

    res.json({
      closer,
      period,
      stats,
    });
  } catch (err) {
    console.error('Get closer performance error:', err);
    res.status(500).json({ error: 'Failed to fetch closer performance' });
  }
});
```

---

## 5. compliance.js - Fix PATCH /batches/:id/assign (Lines 367-435)

**File:** `apps/api/src/routes/compliance.js`

**REPLACE THIS:**
```javascript
// PATCH /compliance/batches/:id/assign - Assign/reassign agent [manager only, pending batches only]
router.patch('/batches/:id/assign', ensureComplianceManager, async (req, res) => {
  const { id: batchId } = req.params;
  const { assign_to } = req.body;

  if (!assign_to) {
    return res.status(400).json({ error: 'assign_to (user_id) is required' });
  }

  try {
    // Get batch and check status
    const { data: batch, error: batchError } = await supabase
      .from('compliance_batches')
      .select('id, status')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Only allow reassignment for pending batches (no work started)
    if (batch.status !== 'pending') {
      return res.status(422).json({
        error: `Cannot reassign batch in ${batch.status} status. Only pending batches can be reassigned.`
      });
    }
    // ... rest of code
```

**WITH THIS:**
```javascript
// PATCH /compliance/batches/:id/assign - Assign/reassign agent [manager only, pending batches only] (FIXED)
router.patch('/batches/:id/assign', ensureComplianceManager, async (req, res) => {
  const { id: batchId } = req.params;
  const { assign_to } = req.body;
  const { id: managerId } = req.user;

  if (!assign_to) {
    return res.status(400).json({ error: 'assign_to (user_id) is required' });
  }

  try {
    // Get batch and check status AND company
    const { data: batch, error: batchError } = await supabase
      .from('compliance_batches')
      .select('id, status, company_id')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // CRITICAL FIX: Verify manager can access this batch's company
    const canAccess = await canAccessCompany(managerId, batch.company_id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Cannot access this batch' });
    }

    // Only allow reassignment for pending batches (no work started)
    if (batch.status !== 'pending') {
      return res.status(422).json({
        error: `Cannot reassign batch in ${batch.status} status. Only pending batches can be reassigned.`
      });
    }
    // ... rest of code
```

---

## 6. closer-manager.js - Fix PATCH /transfers/:id/reassign (Lines 513-571)

**File:** `apps/api/src/routes/closer-manager.js`

**REPLACE THIS:**
```javascript
// PATCH /closer-manager/transfers/:id/reassign - Reassign transfer to different closer
router.patch('/transfers/:id/reassign', async (req, res) => {
  const { id: transferId } = req.params;
  const { new_closer_id } = req.body;

  if (!new_closer_id) {
    return res.status(400).json({ error: 'new_closer_id is required' });
  }

  try {
    // Check if transfer exists
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select('id')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    // Check if closer_record already exists for this transfer
    const hasCloserRecord = await transferHasCloserRecord(transferId);
    if (hasCloserRecord) {
      return res.status(409).json({
        error: 'Cannot reassign',
        message: 'This transfer already has a closer record — cannot reassign',
      });
    }

    // Verify new_closer_id is valid closer
    const { data: newCloser, error: newCloserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', new_closer_id)
      .eq('role', 'closer')
      .single();

    if (newCloserError || !newCloser) {
      return res.status(400).json({ error: 'Invalid closer_id' });
    }
    // ... rest of code
```

**WITH THIS:**
```javascript
// PATCH /closer-manager/transfers/:id/reassign - Reassign transfer to different closer (FIXED)
router.patch('/transfers/:id/reassign', async (req, res) => {
  const { id: transferId } = req.params;
  const { new_closer_id } = req.body;
  const { id: managerId } = req.user;

  if (!new_closer_id) {
    return res.status(400).json({ error: 'new_closer_id is required' });
  }

  try {
    // Check if transfer exists AND it belongs to a managed closer
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select('id, closer_id, closer!transfers_closer_id_fkey(managed_by)')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    // CRITICAL FIX: Verify current closer is managed by this manager
    if (!transfer.closer || transfer.closer.managed_by !== managerId) {
      return res.status(403).json({ error: 'Cannot reassign transfers outside your team' });
    }

    // Check if closer_record already exists for this transfer
    const hasCloserRecord = await transferHasCloserRecord(transferId);
    if (hasCloserRecord) {
      return res.status(409).json({
        error: 'Cannot reassign',
        message: 'This transfer already has a closer record — cannot reassign',
      });
    }

    // Verify new_closer_id is valid closer AND managed by this manager
    const { data: newCloser, error: newCloserError } = await supabase
      .from('users')
      .select('id, managed_by, role')
      .eq('id', new_closer_id)
      .eq('role', 'closer')
      .single();

    if (newCloserError || !newCloser) {
      return res.status(400).json({ error: 'Invalid closer_id' });
    }

    // CRITICAL FIX: Verify new closer is managed by this manager
    if (newCloser.managed_by !== managerId) {
      return res.status(403).json({ error: 'Cannot assign transfer to closer outside your team' });
    }

    // Reassign transfer
    const { data: updated, error: updateError } = await supabase
      .from('transfers')
      .update({ closer_id: new_closer_id })
      .eq('id', transferId)
      .select();

    if (updateError) throw updateError;

    res.json({
      transfer: updated[0],
      message: 'Transfer reassigned successfully',
    });
  } catch (err) {
    console.error('Reassign transfer error:', err);
    res.status(500).json({ error: 'Failed to reassign transfer' });
  }
});
```

---

## 7. search.js - Improve Disposition Label Matching (Line 263)

**File:** `apps/api/src/routes/search.js`

**REPLACE THIS:**
```javascript
const recordResults = (closerRecordsData || []).map((r) => ({
  type: 'record',
  id: r.id,
  customer_phone: r.customer_phone,
  customer_name: r.customer_name,
  customer_email: r.customer_email || null,
  vin: r.vin || null,
  company: r.companies?.display_name || r.companies?.name || 'N/A',
  status: r.status,
  disposition: r.dispositions?.label || null,
  closer_name: r.closer?.full_name || 'Unknown',
  created_at: r.created_at,
  is_sold: r.dispositions?.label?.toLowerCase() === 'sale made', // true if disposition = "Sale Made"
}));
```

**WITH THIS:**
```javascript
const recordResults = (closerRecordsData || []).map((r) => {
  // Flexible disposition check - supports multiple "sold" labels
  const dispositionLabel = r.dispositions?.label?.toLowerCase().trim() || '';
  const soldLabels = ['sale made', 'sold', 'sale', 'closed won', 'sold (auto)', 'sold (rv)'];
  const isSold = soldLabels.includes(dispositionLabel);

  return {
    type: 'record',
    id: r.id,
    customer_phone: r.customer_phone,
    customer_name: r.customer_name,
    customer_email: r.customer_email || null,
    vin: r.vin || null,
    company: r.companies?.display_name || r.companies?.name || 'N/A',
    status: r.status,
    disposition: r.dispositions?.label || null,
    closer_name: r.closer?.full_name || 'Unknown',
    created_at: r.created_at,
    is_sold: isSold,
  };
});
```

---

## Implementation Checklist

### Pre-Deployment
- [ ] Backup production database
- [ ] Run migrations in test environment first
- [ ] Create staging environment to test all fixes
- [ ] Notify stakeholders of authorization changes

### Deployment Steps
1. [ ] Deploy corrected `outcomes.js` (Issue #1)
2. [ ] Deploy corrected `transfers.js` (Issue #2)
3. [ ] Deploy corrected `closer-manager.js` (Issues #3, #4, #6)
4. [ ] Deploy corrected `compliance.js` (Issue #5)
5. [ ] Deploy corrected `search.js` (Issue #7)

### Post-Deployment Testing
- [ ] Test closer_manager can only view their team's outcomes
- [ ] Test closer_manager can only see their team's transfers
- [ ] Test closer_manager cannot patch closers outside their team
- [ ] Test closer_manager cannot view performance of other team's closers
- [ ] Test compliance manager cannot reassign batches from other companies
- [ ] Test closer_manager cannot reassign transfers to/from other teams
- [ ] Verify search still returns correct sold/not sold status
- [ ] Run integration tests for all role-based access patterns

### Monitoring
- [ ] Monitor error logs for authorization denials
- [ ] Check performance impact of new manager lookups
- [ ] Verify no regression in other endpoints

---

**Prepared:** 2026-04-08
**Changes:** 6 critical security fixes + 1 quality improvement
**Estimated Deployment Time:** 30 minutes
**Estimated Testing Time:** 2-3 hours
