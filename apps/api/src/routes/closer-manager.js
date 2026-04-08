import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { notifyCloserManagerEvent, notifySaleMade } from '../services/notification.js';

const router = Router();

// All routes require authentication and closer_manager role
router.use(authenticate);
router.use(roleGuard('closer_manager'));

// ============================================================
// SCHEMA DEFINITIONS
// ============================================================

const createCloserSchema = {
  type: 'object',
  required: ['email', 'full_name', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    full_name: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 8 },
  },
  additionalProperties: false,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
async function transferHasCloserRecord(transferId) {
  const { data, error } = await supabase
    .from('closer_records')
    .select('id')
    .eq('transfer_id', transferId)
    .limit(1);

  if (error) throw error;
  return data && data.length > 0;
}

// Helper: Compute performance stats for a closer
async function getCloserPerformanceStats(closerId, period = 'today') {
  let dateFilter = new Date();

  switch (period) {
    case 'today':
      dateFilter.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      dateFilter.setDate(dateFilter.getDate() - 1);
      dateFilter.setHours(0, 0, 0, 0);
      break;
    case 'this_week':
      dateFilter.setDate(dateFilter.getDate() - dateFilter.getDay());
      dateFilter.setHours(0, 0, 0, 0);
      break;
    case 'this_month':
      dateFilter.setDate(1);
      dateFilter.setHours(0, 0, 0, 0);
      break;
  }

  const fromDate = dateFilter.toISOString();

  // Get transfers count
  const { data: transfers, error: transfersError } = await supabase
    .from('transfers')
    .select('id')
    .eq('closer_id', closerId)
    .gte('created_at', fromDate);

  if (transfersError) throw transfersError;

  // Get sales count (closer_records with status SOLD)
  const { data: sales, error: salesError } = await supabase
    .from('closer_records')
    .select('id')
    .eq('closer_id', closerId)
    .eq('status', 'SOLD')
    .gte('created_at', fromDate);

  if (salesError) throw salesError;

  // Get pending callbacks
  const { data: callbacks, error: callbacksError } = await supabase
    .from('callbacks')
    .select('id')
    .eq('created_by', closerId)
    .eq('is_fired', false);

  if (callbacksError) throw callbacksError;

  // Get dispositions breakdown
  const { data: dispositions, error: dispositionsError } = await supabase
    .from('closer_records')
    .select('disposition_id, dispositions!closer_records_disposition_id_fkey(label)')
    .eq('closer_id', closerId)
    .gte('created_at', fromDate);

  if (dispositionsError) throw dispositionsError;

  // Build dispositions map
  const dispositionMap = {};
  if (dispositions) {
    dispositions.forEach((rec) => {
      const label = rec.dispositions?.label || 'UNKNOWN';
      dispositionMap[label] = (dispositionMap[label] || 0) + 1;
    });
  }

  return {
    total_transfers: transfers?.length || 0,
    total_sales: sales?.length || 0,
    callbacks_pending: callbacks?.length || 0,
    dispositions: dispositionMap,
  };
}

// ============================================================
// CLOSERS MANAGEMENT
// ============================================================

// GET /closer-manager/closers - List all closers managed by this manager
router.get('/closers', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { id: managerId } = req.user;

  try {
    // Get closers managed by this manager
    const { data: closers, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        company_id
      `)
      .eq('managed_by', managerId)
      .eq('role', 'closer')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) throw error;

    // Enhance with stats
    const closersWithStats = await Promise.all(
      (closers || []).map(async (closer) => {
        const stats = await getCloserPerformanceStats(closer.id, 'today');
        return { ...closer, stats };
      })
    );

    res.json({
      closers: closersWithStats,
      pagination: {
        limit,
        offset,
        hasMore: closers && closers.length > limit,
      },
    });
  } catch (err) {
    console.error('Get closers error:', err);
    res.status(500).json({ error: 'Failed to fetch closers' });
  }
});

// POST /closer-manager/closers - Create a new closer account
router.post('/closers', validate(createCloserSchema), async (req, res) => {
  const { email, full_name, password } = req.body;
  const { id: creatorId } = req.user;

  console.log('📝 Creating closer:');
  console.log(`   Email: ${email}`);
  console.log(`   Full Name: ${full_name}`);
  console.log(`   Creator ID: ${creatorId}`);

  try {
    // Create user in Supabase Auth
    console.log('   Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('   ❌ Auth error:', authError);
      throw authError;
    }

    const userId = authData.user.id;
    console.log(`   ✅ Auth user created: ${userId}`);

    // Create user record with role = 'closer', company_id = null, and managed_by = creatorId
    console.log('   Step 2: Inserting into database...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          full_name,
          role: 'closer',
          company_id: null,
          managed_by: creatorId, // Link to the closer_manager who created them
          is_active: true,
          created_by: creatorId,
        },
      ])
      .select();

    if (userError) {
      console.error('   ❌ Database error:', userError);
      // Rollback: delete auth user
      console.log('   Rolling back: Deleting auth user...');
      await supabase.auth.admin.deleteUser(userId);
      throw userError;
    }

    console.log('   ✅ User inserted successfully');

    // Notify manager of new closer creation
    console.log('   Step 3: Sending notification...');
    try {
      await notifyCloserManagerEvent({
        eventType: 'new_closer_created',
        message: `New closer account created: ${full_name}`,
        userId: creatorId,
        closerId: userId,
      });
      console.log('   ✅ Notification sent');
    } catch (notifyErr) {
      console.warn('   ⚠️  Notification failed (non-critical):', notifyErr.message);
    }

    console.log('✅ Closer created successfully\n');
    res.status(201).json({
      closer: userRecord[0],
      message: 'Closer account created successfully',
    });
  } catch (err) {
    console.error('❌ Create closer error:', err);
    console.error('   Error details:', {
      message: err.message,
      code: err.code,
      status: err.status,
    });
    res.status(500).json({
      error: 'Failed to create closer account',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

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

// ============================================================
// PERFORMANCE & LEADERBOARD
// ============================================================

// GET /closer-manager/performance - Leaderboard with managed closers ranked by sales
router.get('/performance', async (req, res) => {
  const period = req.query.period || 'today'; // today, yesterday, this_week, this_month
  const { id: managerId } = req.user;

  try {
    // Get closers managed by this manager
    const { data: closers, error: closersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('managed_by', managerId)
      .eq('role', 'closer')
      .eq('is_active', true);

    if (closersError) throw closersError;

    // Compute performance for each closer
    const closerStats = await Promise.all(
      (closers || []).map(async (closer) => {
        const stats = await getCloserPerformanceStats(closer.id, period);
        return {
          ...closer,
          ...stats,
        };
      })
    );

    // Sort by total_sales descending (leaderboard)
    const leaderboard = closerStats.sort((a, b) => b.total_sales - a.total_sales);

    res.json({
      period,
      leaderboard,
    });
  } catch (err) {
    console.error('Get performance leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

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

// ============================================================
// CLOSER RECORDS
// ============================================================

// GET /closer-manager/records - View all closer records from managed closers
router.get('/records', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { closer_id, status, disposition_id } = req.query;
  const { id: managerId } = req.user;

  try {
    // First, get all closers managed by this manager
    const { data: managedClosers, error: closersError } = await supabase
      .from('users')
      .select('id')
      .eq('managed_by', managerId)
      .eq('role', 'closer');

    if (closersError) throw closersError;

    const closerIds = (managedClosers || []).map(c => c.id);

    // If no closers are managed, return empty results
    if (closerIds.length === 0) {
      return res.json({
        records: [],
        pagination: {
          limit,
          offset,
          hasMore: false,
        },
      });
    }

    // Get records from managed closers
    let query = supabase
      .from('closer_records')
      .select(`
        *,
        closer:users!closer_records_closer_id_fkey (id, full_name),
        disposition:dispositions (id, label)
      `)
      .in('closer_id', closerIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (closer_id) query = query.eq('closer_id', closer_id);
    if (status) query = query.eq('status', status);
    if (disposition_id) query = query.eq('disposition_id', disposition_id);

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
    res.status(500).json({
      error: 'Failed to fetch closer records',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ============================================================
// TRANSFERS
// ============================================================

// GET /closer-manager/transfers - View all transfers from managed closers (read-only)
router.get('/transfers', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { company_id, closer_id, from, to } = req.query;
  const { id: managerId } = req.user;

  try {
    // Get all closers managed by this manager
    const { data: managedClosers, error: closersError } = await supabase
      .from('users')
      .select('id')
      .eq('managed_by', managerId)
      .eq('role', 'closer');

    if (closersError) throw closersError;

    const closerIds = (managedClosers || []).map(c => c.id);

    // If no closers are managed, return empty results
    if (closerIds.length === 0) {
      return res.json({
        transfers: [],
        pagination: {
          limit,
          offset,
          hasMore: false,
        },
      });
    }

    let query = supabase
      .from('transfers')
      .select(`
        *,
        closer:users!transfers_closer_id_fkey (id, full_name, email),
        fronter:users!transfers_fronter_id_fkey (id, full_name, email),
        company:companies!transfers_company_id_fkey (id, name, display_name)
      `)
      .in('closer_id', closerIds)
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

export default router;
