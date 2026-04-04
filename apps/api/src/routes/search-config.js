import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

const DEFAULT_FIELDS = {
  customer_name: true,
  customer_phone: true,
  customer_email: true,
  customer_address: true,
  customer_dob: true,
  customer_gender: true,
  car_make: true,
  car_model: true,
  car_year: true,
  car_miles: true,
  car_vin: true,
  plan: true,
  client: true,
  down_payment: true,
  monthly_payment: true,
  reference_no: true,
  next_payment_note: true,
  closer_name: true,
  fronter_name: true,
  company_name: true,
  disposition_code: true,
};

// GET /search-config - Get field visibility config for current user
router.get('/', async (req, res) => {
  try {
    const scope = req.user.role === 'super_admin' ? 'global' : req.user.company_id;
    const role = req.user.role === 'company_admin' ? 'company_admin' : 'closer';

    const { data: config, error } = await supabase
      .from('search_field_config')
      .select('*')
      .eq('scope', scope)
      .eq('role', role)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase error:', error);
      throw error;
    }

    // Return config or defaults
    const fields = config?.fields || DEFAULT_FIELDS;

    res.json({ fields, scope, role });
  } catch (err) {
    console.error('Get search config error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch config' });
  }
});

// PATCH /search-config - Update field visibility (Super Admin only)
router.patch('/', roleGuard('super_admin'), async (req, res) => {
  const { scope, role, fields } = req.body;

  if (!scope || !role || !fields) {
    return res.status(400).json({ error: 'Missing scope, role, or fields' });
  }

  try {
    // Check if config exists
    const { data: existing } = await supabase
      .from('search_field_config')
      .select('id')
      .eq('scope', scope)
      .eq('role', role)
      .single();

    let result;
    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('search_field_config')
        .update({
          fields,
          updated_by: req.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('search_field_config')
        .insert([
          {
            scope,
            role,
            fields,
            updated_by: req.user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ config: result });
  } catch (err) {
    console.error('Update search config error:', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

export default router;
