import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

function getSafePagination(page, limit) {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  return { safePage, safeLimit };
}

function getRecentWindow(from, to) {
  if (from || to) {
    return { from, to };
  }
  const now = new Date();
  const last30Days = new Date(now);
  last30Days.setDate(now.getDate() - 30);
  return { from: last30Days.toISOString(), to: now.toISOString() };
}

// GET /audit - List audit logs
router.get('/', async (req, res) => {
  const { 
    user_id, 
    event, 
    from, 
    to, 
    page = 1,
    limit = 20,
  } = req.query;

  try {
    const { safePage, safeLimit } = getSafePagination(page, limit);
    const dateWindow = getRecentWindow(from, to);

    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        user_id,
        event,
        ip_address,
        user_agent,
        metadata,
        created_at,
        user:users!audit_logs_user_id_fkey (
          id,
          email,
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false });

    // Filters
    if (user_id) query = query.eq('user_id', user_id);
    if (event) query = query.eq('event', event);
    if (dateWindow.from) query = query.gte('created_at', dateWindow.from);
    if (dateWindow.to) query = query.lte('created_at', dateWindow.to);

    // Pagination without expensive exact count
    const offset = (safePage - 1) * safeLimit;
    query = query.range(offset, offset + safeLimit);

    const { data: logs, error } = await query;

    if (error) throw error;
    const rows = logs || [];
    const hasMore = rows.length > safeLimit;
    const visibleRows = hasMore ? rows.slice(0, safeLimit) : rows;

    res.json({
      logs: visibleRows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        hasMore,
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
    const dateWindow = getRecentWindow(from, to);

    // Only get counts for the windowed period (last 30 days by default)
    // Skip all-time counts as they can cause timeouts on large tables
    const [windowLogins, windowFailedLogins, windowTwoFaSetups] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_success')
        .gte('created_at', dateWindow.from)
        .lte('created_at', dateWindow.to),
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_failed')
        .gte('created_at', dateWindow.from)
        .lte('created_at', dateWindow.to),
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', '2fa_setup')
        .gte('created_at', dateWindow.from)
        .lte('created_at', dateWindow.to),
    ]);

    res.json({
      stats: {
        windowLogins: windowLogins.count || 0,
        windowFailedLogins: windowFailedLogins.count || 0,
        windowTwoFaSetups: windowTwoFaSetups.count || 0,
        period: {
          from: dateWindow.from,
          to: dateWindow.to,
        }
      },
    });
  } catch (err) {
    console.error('Get audit stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
