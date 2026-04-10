import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createDispositionSchema, updateDispositionSchema } from '../schemas/disposition.schema.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /dispositions - List active dispositions
router.get('/', async (req, res) => {
  try {
    const { data: dispositions, error } = await supabase
      .from('dispositions')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('label');

    if (error) throw error;

    res.json({ dispositions });
  } catch (err) {
    console.error('Get dispositions error:', err);
    res.status(500).json({ error: 'Failed to fetch dispositions' });
  }
});

// POST /dispositions - Create disposition (Super Admin only)
router.post('/', validate(createDispositionSchema), async (req, res) => {
  const { label, is_default } = req.body;
  const { id: userId } = req.user;

  try {
    // Check for duplicate label
    const { data: existing } = await supabase
      .from('dispositions')
      .select('id')
      .ilike('label', label)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Disposition with this label already exists' });
    }

    const { data: disposition, error } = await supabase
      .from('dispositions')
      .insert({
        label,
        is_default: is_default || false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ disposition });
  } catch (err) {
    console.error('Create disposition error:', err);
    res.status(500).json({ error: 'Failed to create disposition' });
  }
});

// PATCH /dispositions/:id - Update disposition (Super Admin only)
router.patch('/:id', validate(updateDispositionSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Check if exists
    const { data: existing, error: fetchError } = await supabase
      .from('dispositions')
      .select('id, is_default')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Disposition not found' });
    }

    // Prevent deactivating default dispositions
    if (existing.is_default && updates.is_active === false) {
      return res.status(422).json({ error: 'Cannot deactivate default dispositions' });
    }

    // Check for duplicate label if updating
    if (updates.label) {
      const { data: duplicate } = await supabase
        .from('dispositions')
        .select('id')
        .ilike('label', updates.label)
        .neq('id', id)
        .single();

      if (duplicate) {
        return res.status(409).json({ error: 'Disposition with this label already exists' });
      }
    }

    const { data: disposition, error } = await supabase
      .from('dispositions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ disposition });
  } catch (err) {
    console.error('Update disposition error:', err);
    res.status(500).json({ error: 'Failed to update disposition' });
  }
});

export default router;
