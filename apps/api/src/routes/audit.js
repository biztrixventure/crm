import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';

const router = Router();

// All routes require authentication and super admin role
router.use(authenticate);
router.use(roleGuard('super_admin', 'readonly_admin'));

// GET /audit - List audit logs
router.get('/', async (req, res) => {
  const { 
    user_id, 
    event, 
    from, 
    to, 
    page = 1, 
    limit = 50 
  } = req.query;

  try {
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users!audit_logs_user_id_fkey (
          id,
          email,
          full_name,
          role
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filters
    if (user_id) query = query.eq('user_id', user_id);
    if (event) query = query.eq('event', event);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: logs, error, count } = await query;

    if (error) throw error;

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /audit/events - Get distinct event types
router.get('/events', async (req, res) => {
  try {
    // Return the allowed event types
    res.json({
      events: [
        'login_success',
        'login_failed',
        'logout',
        '2fa_setup',
        'totp_verify_failed',
        'password_reset',
        'number_assignment',
      ],
    });
  } catch (err) {
    console.error('Get audit events error:', err);
    res.status(500).json({ error: 'Failed to fetch event types' });
  }
});

// GET /audit/stats - Get audit statistics
router.get('/stats', async (req, res) => {
  const { from, to } = req.query;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let baseQuery = supabase.from('audit_logs').select('event', { count: 'exact', head: true });
    
    if (from) baseQuery = baseQuery.gte('created_at', from);
    if (to) baseQuery = baseQuery.lte('created_at', to);

    const [totalLogins, failedLogins, todayLogins, twoFaSetups] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_success'),
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_failed'),
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_success')
        .gte('created_at', today.toISOString()),
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', '2fa_setup'),
    ]);

    res.json({
      stats: {
        totalLogins: totalLogins.count || 0,
        failedLogins: failedLogins.count || 0,
        todayLogins: todayLogins.count || 0,
        twoFaSetups: twoFaSetups.count || 0,
      },
    });
  } catch (err) {
    console.error('Get audit stats error:', err);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

export default router;
