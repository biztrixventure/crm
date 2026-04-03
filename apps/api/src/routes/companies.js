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

// GET /companies - List all companies (Super Admin / Readonly Admin)
router.get('/', roleGuard('super_admin', 'readonly_admin'), async (req, res) => {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        *,
        users!users_company_id_fkey (count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const [transferCount, salesCount] = await Promise.all([
          supabase
            .from('transfers')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),
          supabase
            .from('outcomes')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .eq('disposition_id', (
              await supabase
                .from('dispositions')
                .select('id')
                .eq('label', 'Sale Made')
                .single()
            ).data?.id),
        ]);

        return {
          ...company,
          stats: {
            transferCount: transferCount.count || 0,
            salesCount: salesCount.count || 0,
            userCount: company.users?.[0]?.count || 0,
          },
        };
      })
    );

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

export default router;
