import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createCompanySchema, updateCompanySchema } from '../schemas/company.schema.js';
import { notifyAdminNewEntity } from '../services/notification.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /companies - List all companies (Super Admin / Readonly Admin / Closer / Operations Manager / Compliance Manager)
router.get('/', roleGuard('super_admin', 'readonly_admin', 'closer', 'operations_manager', 'compliance_manager'), async (req, res) => {
  try {
    // Get Sale Made disposition ID once (cache it)
    const { data: saleDisposition } = await supabase
      .from('dispositions')
      .select('id')
      .eq('label', 'Sale Made')
      .single();

    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        display_name,
        slug,
        is_active,
        created_at,
        users!users_company_id_fkey (count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get all stats in parallel batches to reduce load
    const companyIds = companies.map(c => c.id);
    
    // Get transfer counts for all companies at once
    const { data: transferCounts } = await supabase
      .from('transfers')
      .select('company_id')
      .in('company_id', companyIds);

    // Get outcome counts for all companies
    const { data: outcomeCounts } = await supabase
      .from('outcomes')
      .select('company_id')
      .in('company_id', companyIds)
      .eq('disposition_id', saleDisposition?.id);

    // Count by company ID
    const transfersByCompany = {};
    const outcomesByCompany = {};
    
    (transferCounts || []).forEach(t => {
      transfersByCompany[t.company_id] = (transfersByCompany[t.company_id] || 0) + 1;
    });
    
    (outcomeCounts || []).forEach(o => {
      outcomesByCompany[o.company_id] = (outcomesByCompany[o.company_id] || 0) + 1;
    });

    const companiesWithStats = companies.map(company => ({
      ...company,
      stats: {
        transferCount: transfersByCompany[company.id] || 0,
        salesCount: outcomesByCompany[company.id] || 0,
        userCount: company.users?.[0]?.count || 0,
      },
    }));

    res.json({ companies: companiesWithStats });
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// POST /companies - Create company (Super Admin only)
router.post('/', roleGuard('super_admin'), validate(createCompanySchema), async (req, res) => {
  const { name, display_name, slug, logo_url, feature_flags } = req.body;

  try {
    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Company with this slug already exists' });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name,
        display_name,
        slug,
        logo_url,
        feature_flags: feature_flags || {
          number_search: false,
          allow_edit: false,
          allow_export: false,
          custom_dispositions: false,
        },
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify other super admins
    notifyAdminNewEntity('company', company);

    res.status(201).json({ company });
  } catch (err) {
    console.error('Create company error:', err);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// GET /companies/:id - Get single company
router.get('/:id', roleGuard('super_admin', 'readonly_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (err) {
    console.error('Get company error:', err);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// PATCH /companies/:id - Update company (Super Admin only)
router.patch('/:id', roleGuard('super_admin'), validate(updateCompanySchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Check if company exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check slug uniqueness if updating
    if (updates.slug) {
      const { data: slugExists } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', updates.slug)
        .neq('id', id)
        .single();

      if (slugExists) {
        return res.status(409).json({ error: 'Slug already in use' });
      }
    }

    const { data: company, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ company });
  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// DELETE /companies/:id - Soft delete company (Super Admin only)
router.delete('/:id', roleGuard('super_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('companies')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Company deactivated successfully' });
  } catch (err) {
    console.error('Delete company error:', err);
    res.status(500).json({ error: 'Failed to deactivate company' });
  }
});

// GET /companies/:id/stats - Get company statistics
router.get('/:id/stats', roleGuard('super_admin', 'readonly_admin', 'company_admin'), async (req, res) => {
  const { id } = req.params;

  // Company admins can only see their own company
  if (req.user.role === 'company_admin' && req.user.companyId !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get Sale Made disposition ID
    const { data: saleDisposition } = await supabase
      .from('dispositions')
      .select('id')
      .eq('label', 'Sale Made')
      .single();

    const [transfers, transfersToday, sales, salesToday, callbacks, users] = await Promise.all([
      supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('company_id', id).gte('created_at', today.toISOString()),
      supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('disposition_id', saleDisposition?.id),
      supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('disposition_id', saleDisposition?.id).gte('created_at', today.toISOString()),
      supabase.from('callbacks').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('is_fired', false),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('is_active', true),
    ]);

    res.json({
      stats: {
        totalTransfers: transfers.count || 0,
        transfersToday: transfersToday.count || 0,
        totalSales: sales.count || 0,
        salesToday: salesToday.count || 0,
        pendingCallbacks: callbacks.count || 0,
        activeUsers: users.count || 0,
      },
    });
  } catch (err) {
    console.error('Get company stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /companies/:id/users - Get company users (Super Admin)
router.get('/:id/users', roleGuard('super_admin', 'readonly_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        totp_enabled,
        created_at,
        last_login
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ users: users || [] });
  } catch (err) {
    console.error('Get company users error:', err);
    res.status(500).json({ error: 'Failed to fetch company users' });
  }
});

// GET /companies/:id/activity - Get recent company activity
router.get('/:id/activity', roleGuard('super_admin', 'readonly_admin'), async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  try {
    // Get recent transfers
    const { data: transfers, error: transferError } = await supabase
      .from('transfers')
      .select(`
        id,
        caller_phone,
        caller_name,
        state,
        created_at,
        fronter:users!transfers_fronter_id_fkey (full_name),
        closer:users!transfers_closer_id_fkey (full_name)
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (transferError) throw transferError;

    // Get recent outcomes
    const { data: outcomes, error: outcomeError } = await supabase
      .from('outcomes')
      .select(`
        id,
        created_at,
        dispositions (label, type),
        transfers (caller_name, caller_phone),
        closer:users!outcomes_closer_id_fkey (full_name)
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (outcomeError) throw outcomeError;

    // Merge and sort activity
    const activity = [
      ...transfers.map(t => ({
        type: 'transfer',
        id: t.id,
        timestamp: t.created_at,
        description: `Transfer from ${t.fronter?.full_name || 'Unknown'} to ${t.closer?.full_name || 'Unassigned'}`,
        details: { caller: t.caller_name, phone: t.caller_phone, state: t.state }
      })),
      ...outcomes.map(o => ({
        type: 'outcome',
        id: o.id,
        timestamp: o.created_at,
        description: `${o.dispositions?.label || 'Unknown'} by ${o.closer?.full_name || 'Unknown'}`,
        details: { caller: o.transfers?.caller_name, disposition: o.dispositions?.label }
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

    res.json({ activity });
  } catch (err) {
    console.error('Get company activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /companies/:id/export - Export company data as CSV
router.get('/:id/export', roleGuard('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { type = 'transfers', days = 30 } = req.query;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let data = [];
    let headers = [];

    if (type === 'transfers') {
      const { data: transfers, error } = await supabase
        .from('transfers')
        .select(`
          id,
          caller_phone,
          caller_name,
          state,
          notes,
          created_at,
          fronter:users!transfers_fronter_id_fkey (full_name, email),
          closer:users!transfers_closer_id_fkey (full_name, email)
        `)
        .eq('company_id', id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      headers = ['ID', 'Caller Phone', 'Caller Name', 'State', 'Notes', 'Fronter', 'Closer', 'Created At'];
      data = transfers.map(t => [
        t.id,
        t.caller_phone,
        t.caller_name,
        t.state || '',
        t.notes || '',
        t.fronter?.full_name || '',
        t.closer?.full_name || '',
        new Date(t.created_at).toISOString()
      ]);
    } else if (type === 'outcomes') {
      const { data: outcomes, error } = await supabase
        .from('outcomes')
        .select(`
          id,
          notes,
          revenue,
          created_at,
          dispositions (label),
          transfers (caller_name, caller_phone),
          closer:users!outcomes_closer_id_fkey (full_name)
        `)
        .eq('company_id', id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      headers = ['ID', 'Caller', 'Phone', 'Disposition', 'Revenue', 'Notes', 'Closer', 'Created At'];
      data = outcomes.map(o => [
        o.id,
        o.transfers?.caller_name || '',
        o.transfers?.caller_phone || '',
        o.dispositions?.label || '',
        o.revenue || '',
        o.notes || '',
        o.closer?.full_name || '',
        new Date(o.created_at).toISOString()
      ]);
    } else if (type === 'users') {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active, totp_enabled, created_at, last_login')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      headers = ['ID', 'Email', 'Full Name', 'Role', 'Active', '2FA Enabled', 'Created At', 'Last Login'];
      data = users.map(u => [
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.is_active ? 'Yes' : 'No',
        u.totp_enabled ? 'Yes' : 'No',
        new Date(u.created_at).toISOString(),
        u.last_login ? new Date(u.last_login).toISOString() : 'Never'
      ]);
    }

    // Build CSV
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Export company data error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// GET /companies/:id/detailed - Get detailed company info
router.get('/:id/detailed', roleGuard('super_admin', 'readonly_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    // Get company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get Sale Made disposition ID
    const { data: saleDisposition } = await supabase
      .from('dispositions')
      .select('id')
      .eq('label', 'Sale Made')
      .single();

    // Get stats in parallel
    const [
      usersByRole,
      transferStats,
      outcomeStats,
      recentTransfers,
      topPerformers
    ] = await Promise.all([
      // User stats by role - simple query instead of RPC
      supabase
        .from('users')
        .select('role')
        .eq('company_id', id)
        .eq('is_active', true),
      
      // Transfer stats
      Promise.all([
        supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('company_id', id),
        supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('company_id', id).gte('created_at', today.toISOString()),
        supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('company_id', id).gte('created_at', thirtyDaysAgo.toISOString()),
      ]),

      // Outcome stats
      Promise.all([
        supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('company_id', id),
        supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('company_id', id).eq('disposition_id', saleDisposition?.id),
        supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('company_id', id).gte('created_at', thirtyDaysAgo.toISOString()),
      ]),

      // Recent transfers (last 5)
      supabase
        .from('transfers')
        .select(`
          id, caller_name, caller_phone, created_at,
          fronter:users!transfers_fronter_id_fkey (full_name)
        `)
        .eq('company_id', id)
        .order('created_at', { ascending: false })
        .limit(5),

      // Top closers by sales (last 30 days)
      supabase
        .from('outcomes')
        .select('closer_id, users!outcomes_closer_id_fkey (full_name)')
        .eq('company_id', id)
        .eq('disposition_id', saleDisposition?.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
    ]);

    // Count users by role
    const roleCounts = {};
    (usersByRole.data || []).forEach(u => {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
    });
    const userStats = Object.entries(roleCounts).map(([role, count]) => ({ role, count }));

    // Calculate top performers
    const closerCounts = {};
    (topPerformers.data || []).forEach(o => {
      const name = o.users?.full_name || 'Unknown';
      closerCounts[name] = (closerCounts[name] || 0) + 1;
    });
    const topClosers = Object.entries(closerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, sales: count }));

    res.json({
      company,
      stats: {
        users: {
          total: userStats.reduce((sum, r) => sum + (r.count || 0), 0),
          byRole: userStats
        },
        transfers: {
          total: transferStats[0].count || 0,
          today: transferStats[1].count || 0,
          last30Days: transferStats[2].count || 0
        },
        outcomes: {
          total: outcomeStats[0].count || 0,
          sales: outcomeStats[1].count || 0,
          last30Days: outcomeStats[2].count || 0
        }
      },
      recentTransfers: recentTransfers.data || [],
      topPerformers: topClosers
    });
  } catch (err) {
    console.error('Get detailed company error:', err);
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
});

export default router;
