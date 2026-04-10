import { Router } from 'express';
import { format } from 'fast-csv';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createTransferSchema, updateTransferSchema, transferQuerySchema } from '../schemas/transfer.schema.js';
import { notifyTransferCreatedPersistent, createNotification, emitToUser } from '../services/notification.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /transfers - List transfers
router.get('/', validateQuery(transferQuerySchema), async (req, res) => {
  const { role, companyId, id: userId } = req.user;
  const { from, to, company_id, fronter_id, closer_id, page, limit } = req.query;

  try {
    let query = supabase
      .from('transfers')
      .select(`
        *,
        fronter:users!transfers_fronter_id_fkey (id, full_name, email),
        closer:users!transfers_closer_id_fkey (id, full_name, email),
        company:companies!transfers_company_id_fkey (id, name, display_name),
        outcomes (id, disposition_id, dispositions (label))
      `)
      .order('created_at', { ascending: false });

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

    // Additional filters
    if (fronter_id) query = query.eq('fronter_id', fronter_id);
    if (closer_id) query = query.eq('closer_id', closer_id);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    // Pagination with hasMore detection (no full table scan)
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit); // Request limit+1 to detect hasMore

    const { data: transfers, error } = await query;

    if (error) throw error;

    // hasMore is true if we got more records than requested
    const hasMore = transfers.length > limit;
    const paginatedTransfers = transfers.slice(0, limit);

    res.json({
      transfers: paginatedTransfers,
      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (err) {
    console.error('Get transfers error:', err);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// POST /transfers - Create transfer (Fronter only)
router.post('/', validate(createTransferSchema), async (req, res) => {
  const { id: fronterId, companyId } = req.user;
  const transferData = req.body;

  try {
    // Verify closer exists and is active
    const { data: closer, error: closerError } = await supabase
      .from('users')
      .select('id, full_name, role, is_active, manager_id')
      .eq('id', transferData.closer_id)
      .single();

    if (closerError || !closer) {
      return res.status(404).json({ error: 'Closer not found' });
    }
    if (closer.role !== 'closer') {
      return res.status(422).json({ error: 'Selected user is not a closer' });
    }
    if (!closer.is_active) {
      return res.status(422).json({ error: 'Selected closer is not active' });
    }

    // Get company name for notification
    const { data: company } = await supabase
      .from('companies')
      .select('display_name')
      .eq('id', companyId)
      .single();

    // Create transfer
    const { data: transfer, error } = await supabase
      .from('transfers')
      .insert({
        ...transferData,
        company_id: companyId,
        fronter_id: fronterId,
      })
      .select(`
        *,
        fronter:users!transfers_fronter_id_fkey (id, full_name, email),
        closer:users!transfers_closer_id_fkey (id, full_name, email),
        company:companies!transfers_company_id_fkey (id, name, display_name)
      `)
      .single();

    if (error) throw error;

    // Notify closer about new transfer (persistent)
    await notifyTransferCreatedPersistent(
      transferData.closer_id,
      transfer,
      company?.display_name || 'Unknown',
      companyId,
      'closer'
    );

    // Notify the closer's manager (if they have one)
    if (closer.manager_id) {
      try {
        await createNotification(
          closer.manager_id,
          'transfer:assigned',
          'Transfer Assigned',
          `Transfer assigned to ${closer.full_name} from ${company?.display_name || 'Unknown'}`,
          {
            transferId: transfer.id,
            closerId: closer.id,
            closerName: closer.full_name,
            customerName: transfer.customer_name,
            customerPhone: transfer.customer_phone,
            companyName: company?.display_name || 'Unknown'
          },
          companyId,
          'closer_manager'
        );

        // Emit socket event to manager
        emitToUser(closer.manager_id, 'transfer:assigned', {
          id: transfer.id,
          type: 'transfer:assigned',
          title: 'Transfer Assigned',
          message: `Transfer assigned to ${closer.full_name}`,
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: {
            transferId: transfer.id,
            closerId: closer.id,
            closerName: closer.full_name
          }
        });
      } catch (err) {
        console.error('Failed to notify manager:', err);
      }
    }

    // Notify the fronter (confirmation)
    try {
      await createNotification(
        fronterId,
        'transfer:created',
        'Transfer Submitted',
        `Transfer to ${closer.full_name} for ${transfer.customer_name} has been successfully submitted`,
        {
          transferId: transfer.id,
          closerId: closer.id,
          closerName: closer.full_name,
          customerName: transfer.customer_name,
          customerPhone: transfer.customer_phone,
          companyName: company?.display_name || 'Unknown'
        },
        companyId,
        'fronter'
      );

      // Emit socket event to fronter
      emitToUser(fronterId, 'transfer:created', {
        id: transfer.id,
        type: 'transfer:created',
        title: 'Transfer Submitted',
        message: `Transfer to ${closer.full_name} has been submitted`,
        is_read: false,
        created_at: new Date().toISOString(),
        metadata: {
          transferId: transfer.id,
          closerId: closer.id,
          closerName: closer.full_name
        }
      });
    } catch (err) {
      console.error('Failed to notify fronter:', err);
    }

    res.status(201).json({ transfer });
  } catch (err) {
    console.error('Create transfer error:', err);
    res.status(500).json({ error: 'Failed to create transfer' });
  }
});

// GET /transfers/:id - Get single transfer
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { role, companyId, id: userId } = req.user;

  try {
    let query = supabase
      .from('transfers')
      .select(`
        *,
        fronter:users!transfers_fronter_id_fkey (id, full_name, email),
        closer:users!transfers_closer_id_fkey (id, full_name, email),
        company:companies!transfers_company_id_fkey (id, name, display_name),
        outcomes (
          id,
          customer_phone,
          customer_name,
          remarks,
          created_at,
          dispositions (id, label)
        )
      `)
      .eq('id', id);

    // Role-based access
    if (role === 'fronter') {
      query = query.eq('fronter_id', userId);
    } else if (role === 'closer') {
      query = query.eq('closer_id', userId);
    } else if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: transfer, error } = await query.single();

    if (error || !transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    res.json({ transfer });
  } catch (err) {
    console.error('Get transfer error:', err);
    res.status(500).json({ error: 'Failed to fetch transfer' });
  }
});

// PATCH /transfers/:id - Edit transfer
router.patch(
  '/:id',
  validate(updateTransferSchema),
  async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const { role, companyId, id: userId } = req.user;

    try {
      // Verify transfer exists and belongs to company
      const { data: existing, error: fetchError } = await supabase
        .from('transfers')
        .select('id, company_id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Transfer not found' });
      }

      if (role === 'company_admin' && existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Cannot edit transfers from other companies' });
      }

      const { data: transfer, error } = await supabase
        .from('transfers')
        .update({
          ...updates,
          updated_by: userId,
        })
        .eq('id', id)
        .select(`
          *,
          fronter:users!transfers_fronter_id_fkey (id, full_name, email),
          closer:users!transfers_closer_id_fkey (id, full_name, email),
          company:companies!transfers_company_id_fkey (id, name, display_name)
        `)
        .single();

      if (error) throw error;

      res.json({ transfer });
    } catch (err) {
      console.error('Update transfer error:', err);
      res.status(500).json({ error: 'Failed to update transfer' });
    }
  }
);

// GET /transfers/export - CSV export
router.get(
  '/export/csv',
  async (req, res) => {
    const { role, companyId } = req.user;
    const { from, to, company_id } = req.query;

    try {
      let query = supabase
        .from('transfers')
        .select(`
          id,
          customer_name,
          customer_phone,
          car_make,
          car_model,
          car_year,
          zip_code,
          city,
          state,
          miles,
          notes,
          created_at,
          fronter:users!transfers_fronter_id_fkey (full_name),
          closer:users!transfers_closer_id_fkey (full_name),
          company:companies!transfers_company_id_fkey (display_name)
        `)
        .order('created_at', { ascending: false });

      // Company isolation
      if (role === 'company_admin') {
        query = query.eq('company_id', companyId);
      } else if (company_id) {
        query = query.eq('company_id', company_id);
      }

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data: transfers, error } = await query;

      if (error) throw error;

      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transfers-${new Date().toISOString().split('T')[0]}.csv"`);

      // Stream CSV
      const csvStream = format({ headers: true });
      csvStream.pipe(res);

      for (const t of transfers) {
        csvStream.write({
          'Date': new Date(t.created_at).toLocaleString(),
          'Company': t.company?.display_name || '',
          'Fronter': t.fronter?.full_name || '',
          'Closer': t.closer?.full_name || '',
          'Customer Name': t.customer_name,
          'Phone': t.customer_phone,
          'Car Make': t.car_make || '',
          'Car Model': t.car_model || '',
          'Car Year': t.car_year || '',
          'ZIP': t.zip_code || '',
          'City': t.city || '',
          'State': t.state || '',
          'Miles': t.miles || '',
          'Notes': t.notes || '',
        });
      }

      csvStream.end();
    } catch (err) {
      console.error('Export transfers error:', err);
      res.status(500).json({ error: 'Failed to export transfers' });
    }
  }
);

export default router;
