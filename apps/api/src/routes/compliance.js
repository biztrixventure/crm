import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { notifyComplianceManagerEvent, notifyComplianceAgentEvent } from '../services/notification.js';
import { createBatchSchema, submitReviewSchema, addDncSchema } from '../schemas/compliance.schema.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Check if user is compliance manager or compliance agent
function ensureComplianceRole(req, res, next) {
  const { role } = req.user;
  if (!['compliance_manager', 'compliance_agent'].includes(role)) {
    return res.status(403).json({ error: 'Compliance role required' });
  }
  next();
}

// Compliance manager only
function ensureComplianceManager(req, res, next) {
  const { role } = req.user;
  if (role !== 'compliance_manager') {
    return res.status(403).json({ error: 'Compliance manager role required' });
  }
  next();
}

// Compliance agent only
function ensureComplianceAgent(req, res, next) {
  const { role } = req.user;
  if (role !== 'compliance_agent') {
    return res.status(403).json({ error: 'Compliance agent role required' });
  }
  next();
}

// Helper: Check if compliance manager can access company (via assignment or no restrictions)
async function canAccessCompany(managerId, companyId) {
  // Get assignments for this manager
  const { data: assignments, error } = await supabase
    .from('compliance_company_assignments')
    .select('company_id')
    .eq('compliance_manager_id', managerId);

  if (error) throw error;

  // If no assignments, manager sees all companies (default open access)
  if (!assignments || assignments.length === 0) {
    return true;
  }

  // Otherwise, check if company is in assigned list
  return assignments.some((a) => a.company_id === companyId);
}

// ============================================================
// CLOSER RECORDS (read-only for compliance)
// ============================================================

router.use(ensureComplianceRole);

// GET /compliance/records - Closer records [manager: all, agent: assigned batches only]
router.get('/records', async (req, res) => {
  const { role, id: userId } = req.user;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { company_id, from, to, status } = req.query;

  try {
    if (role === 'compliance_agent') {
      // Agent can only see records from batches assigned to them
      const { data: batches, error: batchesError } = await supabase
        .from('compliance_batches')
        .select('id')
        .eq('assigned_to', userId);

      if (batchesError) throw batchesError;

      const batchIds = (batches || []).map((b) => b.id);

      if (batchIds.length === 0) {
        return res.json({ records: [], pagination: { limit, offset, hasMore: false } });
      }

      // Get records from these batches
      let query = supabase
        .from('compliance_reviews')
        .select(`
          closer_record_id,
          status,
          flag_reason,
          flag_notes,
          reviewed_at,
          closer_records!compliance_reviews_closer_record_id_fkey (
            id,
            customer_phone,
            customer_name,
            vin,
            status,
            record_date,
            company_id,
            closer_id,
            disposition_id,
            users!closer_records_closer_id_fkey (full_name, email),
            companies!closer_records_company_id_fkey (name, display_name)
          )
        `)
        .in('batch_id', batchIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit);

      const { data: reviews, error: reviewsError } = await query;

      if (reviewsError) throw reviewsError;

      res.json({
        records: reviews || [],
        pagination: { limit, offset, hasMore: reviews && reviews.length > limit },
      });
    } else {
      // Manager sees all records (optionally filtered by assigned companies)
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

      if (company_id) {
        // Check if manager can access this company
        const canAccess = await canAccessCompany(userId, company_id);
        if (!canAccess) {
          return res.status(403).json({ error: 'Cannot access this company' });
        }
        query = query.eq('company_id', company_id);
      }

      if (status) query = query.eq('status', status);
      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: records, error } = await query;

      if (error) throw error;

      res.json({
        records: records || [],
        pagination: { limit, offset, hasMore: records && records.length > limit },
      });
    }
  } catch (err) {
    console.error('Get compliance records error:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ============================================================
// COMPLIANCE BATCHES
// ============================================================

// POST /compliance/batches - Create batch [manager only]
router.post('/batches', ensureComplianceManager, validate(createBatchSchema), async (req, res) => {
  const { company_id, date_from, date_to, assign_to } = req.body;
  const { id: userId } = req.user;

  try {
    // Check if manager can access company
    const canAccess = await canAccessCompany(userId, company_id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Cannot access this company' });
    }

    // Find closer_records in date range for this company
    const { data: records, error: recordsError } = await supabase
      .from('closer_records')
      .select('id')
      .eq('company_id', company_id)
      .gte('record_date', date_from)
      .lte('record_date', date_to);

    if (recordsError) throw recordsError;

    const totalRecords = records?.length || 0;

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from('compliance_batches')
      .insert([
        {
          company_id,
          date_from,
          date_to,
          created_by: userId,
          assigned_to: assign_to || null,
          status: 'pending',
          total_records: totalRecords,
        },
      ])
      .select();

    if (batchError) throw batchError;

    const batchId = batch[0].id;

    // Create compliance_reviews for each record (all pending)
    if (records && records.length > 0) {
      const reviewsToInsert = records.map((rec) => ({
        batch_id: batchId,
        closer_record_id: rec.id,
        reviewed_by: assign_to || userId, // Agent or manager if no agent
        status: 'pending',
      }));

      const { error: reviewsError } = await supabase
        .from('compliance_reviews')
        .insert(reviewsToInsert);

      if (reviewsError) throw reviewsError;

      // Notify agent if assigned
      if (assign_to) {
        await notifyComplianceAgentEvent({
          eventType: 'batch_assigned',
          message: `New compliance batch assigned to you (${totalRecords} records)`,
          userId: assign_to,
          batchId,
        });
      }
    }

    res.status(201).json({
      batch: {
        ...batch[0],
        total_records: totalRecords,
      },
      message: 'Batch created successfully',
    });
  } catch (err) {
    console.error('Create batch error:', err);
    res.status(500).json({
      error: 'Failed to create batch',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// GET /compliance/batches - List batches [manager: all, agent: own]
router.get('/batches', async (req, res) => {
  const { role, id: userId } = req.user;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { status } = req.query;

  try {
    let query = supabase
      .from('compliance_batches')
      .select(`
        *,
        company:companies!compliance_batches_company_id_fkey (id, name, display_name),
        assigned_to_user:users!compliance_batches_assigned_to_fkey (id, full_name, email),
        created_by_user:users!compliance_batches_created_by_fkey (id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (role === 'compliance_agent') {
      // Agent only sees batches assigned to them
      query = query.eq('assigned_to', userId);
    }

    if (status) query = query.eq('status', status);

    const { data: batches, error } = await query;

    if (error) throw error;

    res.json({
      batches: batches || [],
      pagination: { limit, offset, hasMore: batches && batches.length > limit },
    });
  } catch (err) {
    console.error('Get batches error:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// GET /compliance/batches/:id - Batch detail with all records
router.get('/batches/:id', async (req, res) => {
  const { id: batchId } = req.params;
  const { role, id: userId } = req.user;

  try {
    // Get batch
    const { data: batch, error: batchError } = await supabase
      .from('compliance_batches')
      .select(`
        *,
        company:companies!compliance_batches_company_id_fkey (id, name, display_name),
        assigned_to_user:users!compliance_batches_assigned_to_fkey (id, full_name, email),
        created_by_user:users!compliance_batches_created_by_fkey (id, full_name, email)
      `)
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Check access: agent must be assigned to batch
    if (role === 'compliance_agent' && batch.assigned_to !== userId) {
      return res.status(403).json({ error: 'Cannot access this batch' });
    }

    // Get all reviews + records in this batch
    const { data: reviews, error: reviewsError } = await supabase
      .from('compliance_reviews')
      .select(`
        *,
        closer_records!compliance_reviews_closer_record_id_fkey (
          id,
          customer_phone,
          customer_name,
          vin,
          reference_no,
          plan_id,
          client_id,
          status,
          record_date,
          created_at,
          disposition_id,
          plans!closer_records_plan_id_fkey (id, name),
          clients!closer_records_client_id_fkey (id, name),
          dispositions!closer_records_disposition_id_fkey (id, label),
          closer:users!closer_records_closer_id_fkey (id, full_name, email)
        )
      `)
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;

    res.json({
      batch,
      records: reviews || [],
    });
  } catch (err) {
    console.error('Get batch detail error:', err);
    res.status(500).json({ error: 'Failed to fetch batch detail' });
  }
});

// PATCH /compliance/batches/:id/assign - Assign/reassign agent [manager only, pending batches only]
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

    // Verify new agent is compliance_agent
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', assign_to)
      .eq('role', 'compliance_agent')
      .single();

    if (agentError || !agent) {
      return res.status(400).json({ error: 'Invalid compliance agent id' });
    }

    // Update batch
    const { data: updated, error: updateError } = await supabase
      .from('compliance_batches')
      .update({ assigned_to: assign_to })
      .eq('id', batchId)
      .select();

    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Notify agent
    await notifyComplianceAgentEvent({
      eventType: 'batch_assigned',
      message: `New compliance batch assigned to you (${updated[0].total_records} records)`,
      userId: assign_to,
      batchId,
    });

    res.json({
      batch: updated[0],
      message: 'Batch assigned successfully',
    });
  } catch (err) {
    console.error('Assign batch error:', err);
    res.status(500).json({ error: 'Failed to assign batch' });
  }
});

// PATCH /compliance/batches/:id/complete - Mark batch complete [agent only]
router.patch('/batches/:id/complete', ensureComplianceAgent, async (req, res) => {
  const { id: batchId } = req.params;
  const { id: userId } = req.user;

  try {
    // Get batch - verify it's assigned to agent
    const { data: batch, error: batchError } = await supabase
      .from('compliance_batches')
      .select('id, assigned_to')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (batch.assigned_to !== userId) {
      return res.status(403).json({ error: 'Cannot complete a batch not assigned to you' });
    }

    // Check all records are reviewed (no pending reviews)
    const { data: pendingReviews, error: pendingError } = await supabase
      .from('compliance_reviews')
      .select('id')
      .eq('batch_id', batchId)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    if (pendingReviews && pendingReviews.length > 0) {
      return res.status(422).json({
        error: 'Cannot mark batch complete',
        message: 'All records must be reviewed before completing the batch',
      });
    }

    // Mark batch complete
    const { data: updated, error: updateError } = await supabase
      .from('compliance_batches')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', batchId)
      .select();

    if (updateError) throw updateError;

    // Notify manager who created batch
    const { data: batchData } = await supabase
      .from('compliance_batches')
      .select('created_by')
      .eq('id', batchId)
      .single();

    if (batchData) {
      await notifyComplianceManagerEvent({
        eventType: 'batch_completed',
        message: 'A compliance agent has completed a batch',
        userId: batchData.created_by,
        batchId,
      });
    }

    res.json({
      batch: updated[0],
      message: 'Batch marked as complete',
    });
  } catch (err) {
    console.error('Complete batch error:', err);
    res.status(500).json({ error: 'Failed to complete batch' });
  }
});

// ============================================================
// COMPLIANCE REVIEWS
// ============================================================

// POST /compliance/reviews - Submit review (flag/approve) for a record
router.post('/reviews', validate(submitReviewSchema), async (req, res) => {
  const { batch_id, closer_record_id, status, flag_reason, flag_notes } = req.body;
  const { id: userId } = req.user;

  try {
    // Get batch to verify access
    const { data: batch, error: batchError } = await supabase
      .from('compliance_batches')
      .select('id, assigned_to, created_by')
      .eq('id', batch_id)
      .single();

    if (batchError || !batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Only assigned agent or creating manager can review
    const { role } = req.user;
    if (role === 'compliance_agent' && batch.assigned_to !== userId) {
      return res.status(403).json({ error: 'Cannot review records in this batch' });
    }

    // If marking issue_found, flag_reason is required
    if (status === 'issue_found' && !flag_reason) {
      return res.status(422).json({
        error: 'flag_reason is required when marking as issue_found',
      });
    }

    // Upsert review record
    const { data: review, error: reviewError } = await supabase
      .from('compliance_reviews')
      .upsert(
        {
          batch_id,
          closer_record_id,
          reviewed_by: userId,
          status: status,
          flag_reason: status === 'issue_found' ? flag_reason : null,
          flag_notes,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'batch_id,closer_record_id' }
      )
      .select();

    if (reviewError) throw reviewError;

    // Update batch counters
    const { data: batchReviews } = await supabase
      .from('compliance_reviews')
      .select('status')
      .eq('batch_id', batch_id);

    const reviewedRecords = batchReviews?.filter((r) => r.status !== 'pending').length || 0;
    const flaggedRecords = batchReviews?.filter((r) => r.status === 'issue_found').length || 0;
    const approvedRecords = batchReviews?.filter((r) => r.status === 'approved').length || 0;

    await supabase
      .from('compliance_batches')
      .update({
        reviewed_records: reviewedRecords,
        flagged_records: flaggedRecords,
        approved_records: approvedRecords,
      })
      .eq('id', batch_id);

    // Notify manager if issue flagged
    if (status === 'issue_found') {
      await notifyComplianceManagerEvent({
        eventType: 'record_flagged',
        message: `A record has been flagged: ${flag_reason}`,
        userId: batch.created_by,
        batchId: batch_id,
        recordId: closer_record_id,
      });
    }

    res.json({
      review: review[0],
      message: 'Review submitted successfully',
    });
  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /compliance/reviews/:record_id - Get review status for a record
router.get('/reviews/:record_id', async (req, res) => {
  const { record_id } = req.params;

  try {
    const { data: reviews, error } = await supabase
      .from('compliance_reviews')
      .select('*')
      .eq('closer_record_id', record_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ reviews: reviews || [] });
  } catch (err) {
    console.error('Get review status error:', err);
    res.status(500).json({ error: 'Failed to fetch review status' });
  }
});

// ============================================================
// DNC LIST (Compliance Manager only)
// ============================================================

// GET /compliance/dnc - List DNC numbers [manager only]
router.get('/dnc', ensureComplianceManager, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { is_active } = req.query;

  try {
    let query = supabase
      .from('dnc_list')
      .select(`
        *,
        added_by_user:users!dnc_list_added_by_fkey (id, full_name, email),
        removed_by_user:users!dnc_list_removed_by_fkey (id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (typeof is_active === 'string') {
      query = query.eq('is_active', is_active === 'true');
    } else {
      query = query.eq('is_active', true);
    }

    const { data: numbers, error } = await query;

    if (error) throw error;

    res.json({
      dnc_list: numbers || [],
      pagination: { limit, offset, hasMore: numbers && numbers.length > limit },
    });
  } catch (err) {
    console.error('Get DNC list error:', err);
    res.status(500).json({ error: 'Failed to fetch DNC list' });
  }
});

// POST /compliance/dnc - Add to DNC [manager only]
router.post('/dnc', ensureComplianceManager, validate(addDncSchema), async (req, res) => {
  const { phone_number, reason, notes } = req.body;
  const { id: userId } = req.user;

  try {
    // Normalize phone to E.164 format
    const normalized = normalizePhoneE164(phone_number);

    // Check if already on DNC
    const { data: existing } = await supabase
      .from('dnc_list')
      .select('id, is_active')
      .eq('phone_number', normalized);

    if (existing && existing.length > 0 && existing[0].is_active) {
      return res.status(409).json({
        error: 'Already on DNC list',
        message: `This number is already in the DNC list`,
      });
    }

    const { data: dnc, error } = await supabase
      .from('dnc_list')
      .insert([
        {
          phone_number: normalized,
          reason,
          notes,
          added_by: userId,
          is_active: true,
          vicidial_sync_pending: true,
        },
      ])
      .select();

    if (error) {
      if (error.message.includes('unique')) {
        return res.status(409).json({
          error: 'Number already on DNC',
          message: `Phone number ${normalized} is already in the DNC list`,
        });
      }
      throw error;
    }

    res.status(201).json({
      dnc: dnc[0],
      message: 'Number added to DNC list',
    });
  } catch (err) {
    console.error('Add DNC error:', err);
    res.status(500).json({ error: 'Failed to add number to DNC' });
  }
});

// PATCH /compliance/dnc/:id - Remove from DNC (soft delete) [manager only]
router.patch('/dnc/:id', ensureComplianceManager, async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const { data: dnc, error } = await supabase
      .from('dnc_list')
      .update({
        is_active: false,
        removed_by: userId,
        removed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!dnc || dnc.length === 0) {
      return res.status(404).json({ error: 'DNC record not found' });
    }

    res.json({
      dnc: dnc[0],
      message: 'Number removed from DNC list',
    });
  } catch (err) {
    console.error('Remove DNC error:', err);
    res.status(500).json({ error: 'Failed to remove number from DNC' });
  }
});

// ============================================================
// COMPLIANCE COMPANY ASSIGNMENTS (Manager only)
// ============================================================

// GET /compliance/assignments - Company assignments for this manager
router.get('/assignments', ensureComplianceManager, async (req, res) => {
  const { id: userId } = req.user;

  try {
    const { data: assignments, error } = await supabase
      .from('compliance_company_assignments')
      .select(`
        *,
        company:companies!compliance_company_assignments_company_id_fkey (id, name, display_name)
      `)
      .eq('compliance_manager_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ assignments: assignments || [] });
  } catch (err) {
    console.error('Get assignments error:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// ============================================================
// HELPERS
// ============================================================

function normalizePhoneE164(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
}

export default router;
