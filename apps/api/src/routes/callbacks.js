import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCallbackSchema, updateCallbackSchema } from '../schemas/callback.schema.js';
import { addCallbackToQueue } from '../services/redis.js';
import { createNotification } from '../services/notification.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /callbacks - List callbacks for current user
router.get('/', async (req, res) => {
  const { id: userId, role, companyId } = req.user;
  const { include_fired } = req.query;

  try {
    let query = supabase
      .from('callbacks')
      .select('*')
      .order('best_time', { ascending: true });

    // Role-based filtering
    if (role === 'fronter' || role === 'closer' || role === 'closer_manager') {
      query = query.eq('created_by', userId);
    } else if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    } else if (role === 'operations_manager') {
      // Operations manager can see all callbacks
    }

    // Optionally filter out fired callbacks
    if (!include_fired || include_fired !== 'true') {
      query = query.eq('is_fired', false);
    }

    const { data: callbacks, error } = await query;

    if (error) throw error;

    res.json({ callbacks });
  } catch (err) {
    console.error('Get callbacks error:', err);
    res.status(500).json({ error: 'Failed to fetch callbacks' });
  }
});

// POST /callbacks - Create callback (Fronter, Closer, or Closer Manager)
router.post('/', validate(createCallbackSchema), async (req, res) => {
  const { id: userId, companyId, role } = req.user;
  const { customer_name, customer_phone, best_time, notes } = req.body;

  try {
    const { data: callback, error } = await supabase
      .from('callbacks')
      .insert({
        created_by: userId,
        company_id: companyId,
        customer_name,
        customer_phone,
        best_time,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    // Add to Redis queue for worker to process
    const timestamp = new Date(best_time).getTime() / 1000;
    await addCallbackToQueue(callback.id, timestamp);

    // Create notification for callback scheduled (persistent)
    const callbackTime = new Date(best_time).toLocaleString();
    await createNotification(
      userId,
      'callback:created',
      'Callback Scheduled',
      `Callback reminder scheduled for ${customer_name} at ${callbackTime}`,
      {
        callbackId: callback.id,
        customerName: customer_name,
        customerPhone: customer_phone,
        bestTime: best_time,
      },
      companyId,
      role
    );

    res.status(201).json({ callback });
  } catch (err) {
    console.error('Create callback error:', err);
    res.status(500).json({ error: 'Failed to create callback' });
  }
});

// PATCH /callbacks/:id - Update callback
router.patch('/:id', validate(updateCallbackSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { id: userId, role, companyId } = req.user;

  try {
    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('callbacks')
      .select('id, created_by, company_id, is_fired')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Callback not found' });
    }

    // Authorization
    if (role === 'fronter' || role === 'closer') {
      if (existing.created_by !== userId) {
        return res.status(403).json({ error: 'Cannot edit callbacks created by others' });
      }
    } else if (role === 'company_admin') {
      if (existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Cannot edit callbacks from other companies' });
      }
    }

    // Prevent editing fired callbacks
    if (existing.is_fired) {
      return res.status(422).json({ error: 'Cannot edit a callback that has already fired' });
    }

    const { data: callback, error } = await supabase
      .from('callbacks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update Redis queue if best_time changed
    if (updates.best_time) {
      const timestamp = new Date(updates.best_time).getTime() / 1000;
      await addCallbackToQueue(callback.id, timestamp);
    }

    res.json({ callback });
  } catch (err) {
    console.error('Update callback error:', err);
    res.status(500).json({ error: 'Failed to update callback' });
  }
});

// DELETE /callbacks/:id - Delete callback
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { id: userId, role, companyId } = req.user;

  try {
    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('callbacks')
      .select('id, created_by, company_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Callback not found' });
    }

    // Authorization
    if (role === 'fronter' || role === 'closer') {
      if (existing.created_by !== userId) {
        return res.status(403).json({ error: 'Cannot delete callbacks created by others' });
      }
    } else if (role === 'company_admin') {
      if (existing.company_id !== companyId) {
        return res.status(403).json({ error: 'Cannot delete callbacks from other companies' });
      }
    }

    const { error } = await supabase
      .from('callbacks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Callback deleted successfully' });
  } catch (err) {
    console.error('Delete callback error:', err);
    res.status(500).json({ error: 'Failed to delete callback' });
  }
});

export default router;
