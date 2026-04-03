import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validateRequest } from '../middleware/validate.js';
import z from 'zod';

const router = Router();

router.use(authenticate);

const planSchema = z.object({
  name: z.string().min(1, 'Plan name required'),
});

// GET /plans - List active plans
router.get('/', async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ plans: plans || [] });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// POST /plans - Create plan (Super Admin only)
router.post('/', roleGuard('super_admin'), validateRequest(planSchema), async (req, res) => {
  const { name } = req.body;

  try {
    const { data: plan, error } = await supabase
      .from('plans')
      .insert([
        {
          name,
          created_by: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ plan });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// PATCH /plans/:id - Update or deactivate plan (Super Admin only)
router.patch('/:id', roleGuard('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: plan, error } = await supabase
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ plan });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

export default router;
