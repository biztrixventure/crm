import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import z from 'zod';

const router = Router();

router.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1, 'Client name required'),
});

// GET /clients - List active clients
router.get('/', async (req, res) => {
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ clients: clients || [] });
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST /clients - Create client (Super Admin only)
router.post('/', roleGuard('super_admin'), validate(clientSchema), async (req, res) => {
  const { name } = req.body;

  try {
    const { data: client, error } = await supabase
      .from('clients')
      .insert([
        {
          name,
          created_by: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ client });
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PATCH /clients/:id - Update or deactivate client (Super Admin only)
router.patch('/:id', roleGuard('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: client, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ client });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

export default router;
