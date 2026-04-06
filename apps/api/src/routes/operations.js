import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard, operationsReadonly } from '../middleware/role.js';

const router = Router();

// All routes require authentication and operations_manager role
router.use(authenticate);
router.use(roleGuard('operations_manager'));
router.use(operationsReadonly); // Enforce read-only access

// ============================================================
// DASHBOARD KPIs
// ============================================================

// GET /operations/dashboard - Read-only KPI view
router.get('/dashboard', async (req, res) => {
  const { from, to } = req.query;

  try {
    // Determine date range
    let fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);

    if (from) {
      fromDate = new Date(from);
    }

    const fromIso = fromDate.toISOString();
    const toIso = to ? new Date(to).toISOString() : new Date().toISOString();

    // Total transfers today
    const { data: transfersData, error: transfersError } = await supabase
      .from('transfers')
      .select('id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    if (transfersError) throw transfersError;

    // Total sales today
    const { data: salesData, error: salesError } = await supabase
      .from('closer_records')
      .select('id')
      .eq('status', 'SOLD')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);

    if (salesError) throw salesError;

    // Pending callbacks
    const { data: callbacksData, error: callbacksError } = await supabase
      .from('callbacks')
      .select('id')
      .eq('is_fired', false);

    if (callbacksError) throw callbacksError;

    // Active companies
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('id')
      .eq('is_active', true);

    if (companiesError) throw companiesError;

    // Active closers
    const { data: closersData, error: closersError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'closer')
      .eq('is_active', true);

    if (closersError) throw closersError;

    res.json({
      kpis: {
        total_transfers: transfersData?.length || 0,
        total_sales: salesData?.length || 0,
        callbacks_pending: callbacksData?.length || 0,
        active_companies: companiesData?.length || 0,
        active_closers: closersData?.length || 0,
      },
      dateRange: { from: fromIso, to: toIso },
    });
  } catch (err) {
    console.error('Get operations dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ============================================================
// COMPANIES (read-only)
// ============================================================

// GET /operations/companies - All companies with feature flags
router.get('/companies', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        display_name,
        slug,
        is_active,
        feature_flags,
        created_at,
        created_by
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) throw error;

    res.json({
      companies: companies || [],
      pagination: {
        limit,
        offset,
        hasMore: companies && companies.length > limit,
      },
    });
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// ============================================================
// TRANSFERS (read-only)
// ============================================================

// GET /operations/transfers - All transfers from all companies
router.get('/transfers', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { company_id, closer_id, from, to } = req.query;

  try {
    let query = supabase
      .from('transfers')
      .select(`
        *,
        closer:users!transfers_closer_id_fkey (id, full_name, email),
        fronter:users!transfers_fronter_id_fkey (id, full_name, email),
        company:companies!transfers_company_id_fkey (id, name, display_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (company_id) query = query.eq('company_id', company_id);
    if (closer_id) query = query.eq('closer_id', closer_id);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: transfers, error } = await query;

    if (error) throw error;

    res.json({
      transfers: transfers || [],
      pagination: {
        limit,
        offset,
        hasMore: transfers && transfers.length > limit,
      },
    });
  } catch (err) {
    console.error('Get transfers error:', err);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// ============================================================
// CLOSER RECORDS (read-only)
// ============================================================

// GET /operations/closer-records - All closer records
router.get('/closer-records', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { company_id, closer_id, from, to, status } = req.query;

  try {
    let query = supabase
      .from('closer_records')
      .select(`
        *,
        closer:users!closer_records_closer_id_fkey (id, full_name, email),
        company:companies!closer_records_company_id_fkey (id, name, display_name),
        plan:plans (id, name),
        client:clients (id, name),
        disposition:dispositions (id, label)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (company_id) query = query.eq('company_id', company_id);
    if (closer_id) query = query.eq('closer_id', closer_id);
    if (status) query = query.eq('status', status);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: records, error } = await query;

    if (error) throw error;

    res.json({
      records: records || [],
      pagination: {
        limit,
        offset,
        hasMore: records && records.length > limit,
      },
    });
  } catch (err) {
    console.error('Get closer records error:', err);
    res.status(500).json({ error: 'Failed to fetch closer records' });
  }
});

// ============================================================
// USERS (read-only)
// ============================================================

// GET /operations/users - All users and their roles
router.get('/users', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { role, is_active } = req.query;

  try {
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        companies!users_company_id_fkey (id, name, display_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (role) query = query.eq('role', role);
    if (typeof is_active === 'string') query = query.eq('is_active', is_active === 'true');

    const { data: users, error } = await query;

    if (error) throw error;

    res.json({
      users: users || [],
      pagination: {
        limit,
        offset,
        hasMore: users && users.length > limit,
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================================
// CALLBACKS (read-only)
// ============================================================

// GET /operations/callbacks - All callbacks
router.get('/callbacks', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { is_fired, from, to } = req.query;

  try {
    let query = supabase
      .from('callbacks')
      .select(`
        *,
        created_by_user:users!callbacks_created_by_fkey (id, full_name, email),
        company:companies!callbacks_company_id_fkey (id, name, display_name)
      `)
      .order('best_time', { ascending: true })
      .range(offset, offset + limit);

    if (typeof is_fired === 'string') query = query.eq('is_fired', is_fired === 'true');
    if (from) query = query.gte('best_time', from);
    if (to) query = query.lte('best_time', to);

    const { data: callbacks, error } = await query;

    if (error) throw error;

    res.json({
      callbacks: callbacks || [],
      pagination: {
        limit,
        offset,
        hasMore: callbacks && callbacks.length > limit,
      },
    });
  } catch (err) {
    console.error('Get callbacks error:', err);
    res.status(500).json({ error: 'Failed to fetch callbacks' });
  }
});

export default router;
