import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createOutcomeSchema, outcomeQuerySchema } from '../schemas/outcome.schema.js';
import { notifySaleMade } from '../services/notification.js';
import { markNumberSold } from '../services/redis.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Normalize phone to E.164
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
}

// GET /outcomes - List outcomes
router.get('/', validateQuery(outcomeQuerySchema), async (req, res) => {
  const { role, companyId, id: userId } = req.user;
  const { from, to, company_id, closer_id, disposition_id, page, limit } = req.query;

  try {
    let query = supabase
      .from('outcomes')
      .select(`
        *,
        closer:users!outcomes_closer_id_fkey (id, full_name, email),
        company:companies!outcomes_company_id_fkey (id, name, display_name),
        dispositions (id, label)
      `)
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (role === 'closer') {
      query = query.eq('closer_id', userId);
    } else if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    } else if (['super_admin', 'readonly_admin'].includes(role) && company_id) {
      query = query.eq('company_id', company_id);
    }

    // Additional filters
    if (closer_id) query = query.eq('closer_id', closer_id);
    if (disposition_id) query = query.eq('disposition_id', disposition_id);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    // Pagination with hasMore detection (no full table scan)
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit); // Request limit+1 to detect hasMore

    const { data: outcomes, error } = await query;

    if (error) throw error;

    // hasMore is true if we got more records than requested
    const hasMore = outcomes.length > limit;
    const paginatedOutcomes = outcomes.slice(0, limit);

    res.json({
      outcomes: paginatedOutcomes,
      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (err) {
    console.error('Get outcomes error:', err);
    res.status(500).json({ error: 'Failed to fetch outcomes' });
  }
});

// POST /outcomes - Create outcome (Closer only)
router.post('/', roleGuard('closer'), validate(createOutcomeSchema), async (req, res) => {
  const { id: closerId } = req.user;
  const { transfer_id, company_id, customer_phone, customer_name, disposition_id, remarks } = req.body;

  try {
    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, display_name')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Verify disposition exists
    const { data: disposition, error: dispError } = await supabase
      .from('dispositions')
      .select('id, label')
      .eq('id', disposition_id)
      .eq('is_active', true)
      .single();

    if (dispError || !disposition) {
      return res.status(404).json({ error: 'Disposition not found' });
    }

    // Normalize phone
    const normalizedPhone = normalizePhone(customer_phone);

    // Create outcome
    const { data: outcome, error } = await supabase
      .from('outcomes')
      .insert({
        transfer_id,
        company_id,
        closer_id: closerId,
        customer_phone: normalizedPhone,
        customer_name,
        disposition_id,
        remarks,
      })
      .select(`
        *,
        closer:users!outcomes_closer_id_fkey (id, full_name, email),
        company:companies!outcomes_company_id_fkey (id, name, display_name),
        dispositions (id, label)
      `)
      .single();

    if (error) throw error;

    // If Sale Made, mark number as sold in Redis and notify company
    if (disposition.label === 'Sale Made') {
      await markNumberSold(normalizedPhone, true);
      
      // Get closer name for notification
      const { data: closer } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', closerId)
        .single();

      notifySaleMade(company_id, outcome, closer?.full_name || 'Unknown');
    }

    res.status(201).json({ outcome });
  } catch (err) {
    console.error('Create outcome error:', err);
    res.status(500).json({ error: 'Failed to create outcome' });
  }
});

// GET /outcomes/:id - Get single outcome
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { role, companyId, id: userId } = req.user;

  try {
    let query = supabase
      .from('outcomes')
      .select(`
        *,
        closer:users!outcomes_closer_id_fkey (id, full_name, email),
        company:companies!outcomes_company_id_fkey (id, name, display_name),
        dispositions (id, label),
        transfers (
          id,
          customer_name,
          customer_phone,
          car_make,
          car_model,
          fronter:users!transfers_fronter_id_fkey (full_name)
        )
      `)
      .eq('id', id);

    // Role-based access
    if (role === 'closer') {
      query = query.eq('closer_id', userId);
    } else if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: outcome, error } = await query.single();

    if (error || !outcome) {
      return res.status(404).json({ error: 'Outcome not found' });
    }

    res.json({ outcome });
  } catch (err) {
    console.error('Get outcome error:', err);
    res.status(500).json({ error: 'Failed to fetch outcome' });
  }
});

// POST /outcomes/:id/new-policy - Create new policy linked to existing outcome
router.post('/:id/new-policy', roleGuard('closer'), validate(createOutcomeSchema), async (req, res) => {
  const { id: existingOutcomeId } = req.params;
  const { id: closerId } = req.user;
  const { transfer_id, company_id, customer_phone, customer_name, disposition_id, remarks } = req.body;

  try {
    // Verify existing outcome exists
    const { data: existing, error: existingError } = await supabase
      .from('outcomes')
      .select('id, customer_phone, customer_name')
      .eq('id', existingOutcomeId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Existing outcome not found' });
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, display_name')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Verify disposition exists
    const { data: disposition, error: dispError } = await supabase
      .from('dispositions')
      .select('id, label')
      .eq('id', disposition_id)
      .eq('is_active', true)
      .single();

    if (dispError || !disposition) {
      return res.status(404).json({ error: 'Disposition not found' });
    }

    // Normalize phone
    const normalizedPhone = normalizePhone(customer_phone);

    // Create new outcome linked to existing
    const { data: newOutcome, error } = await supabase
      .from('outcomes')
      .insert({
        transfer_id,
        company_id,
        closer_id: closerId,
        customer_phone: normalizedPhone,
        customer_name,
        disposition_id,
        remarks,
        linked_outcome_id: existingOutcomeId,
      })
      .select(`
        *,
        closer:users!outcomes_closer_id_fkey (id, full_name, email),
        company:companies!outcomes_company_id_fkey (id, name, display_name),
        dispositions (id, label)
      `)
      .single();

    if (error) throw error;

    // If Sale Made, mark number as sold and notify
    if (disposition.label === 'Sale Made') {
      await markNumberSold(normalizedPhone, true);
      
      const { data: closer } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', closerId)
        .single();

      notifySaleMade(company_id, newOutcome, closer?.full_name || 'Unknown');
    }

    res.status(201).json({ outcome: newOutcome, linkedTo: existingOutcomeId });
  } catch (err) {
    console.error('Create linked outcome error:', err);
    res.status(500).json({ error: 'Failed to create new policy' });
  }
});

export default router;
