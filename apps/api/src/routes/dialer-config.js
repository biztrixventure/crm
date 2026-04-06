import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /dialer-config - Get dialer config (closers get masked password)
router.get(
  '/',
  roleGuard('closer', 'company_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('dialer_config')
        .select('*')
        .single();

      // Handle table not existing or no rows
      if (error) {
        // PGRST116 = no rows, 42P01 = table doesn't exist
        if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
          return res.json({
            config: null,
            message: 'Dialer not configured',
          });
        }
        throw error;
      }

      if (!data) {
        return res.json({
          config: null,
          message: 'Dialer not configured',
        });
      }

      // Return full config (needed for client-side calls)
      res.json({
        config: {
          dialer_url: data.dialer_url,
          api_user: data.api_user,
          api_pass: data.api_pass,
          api_path: data.api_path,
          is_active: data.is_active,
          updated_at: data.updated_at,
        },
      });
    } catch (err) {
      console.error('Get dialer config error:', err);
      // Return null config instead of 500 so frontend doesn't break
      res.json({
        config: null,
        message: 'Dialer config unavailable',
      });
    }
  }
);

// PUT /dialer-config - Update dialer config (super_admin only)
router.put(
  '/',
  roleGuard('super_admin'),
  async (req, res) => {
    const { dialer_url, api_user, api_pass, api_path, is_active } = req.body;

    try {
      // Get existing config
      const { data: existing } = await supabase
        .from('dialer_config')
        .select('id')
        .single();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('dialer_config')
          .update({
            dialer_url: dialer_url?.trim() || '',
            api_user: api_user?.trim() || '',
            api_pass: api_pass || '',
            api_path: api_path?.trim() || '/vicidial/non_agent_api.php',
            is_active: is_active ?? false,
            updated_at: new Date().toISOString(),
            updated_by: req.user.id,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return res.json({ config: data, message: 'Dialer config updated' });
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('dialer_config')
          .insert({
            dialer_url: dialer_url?.trim() || '',
            api_user: api_user?.trim() || '',
            api_pass: api_pass || '',
            api_path: api_path?.trim() || '/vicidial/non_agent_api.php',
            is_active: is_active ?? false,
            updated_by: req.user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return res.json({ config: data, message: 'Dialer config created' });
      }
    } catch (err) {
      console.error('Update dialer config error:', err);
      res.status(500).json({ error: 'Failed to update dialer config' });
    }
  }
);

// POST /dialer-config/test - Test dialer connection (super_admin only)
router.post(
  '/test',
  roleGuard('super_admin'),
  async (req, res) => {
    const { dialer_url, api_user, api_pass, api_path } = req.body;

    if (!dialer_url || !api_user || !api_pass) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // We can't test from server (that's the whole problem)
    // Return instructions for client-side testing
    res.json({
      message: 'Connection test must be performed from client browser',
      test_url: `${dialer_url}${api_path || '/vicidial/non_agent_api.php'}?function=lead_search&user=${api_user}&pass=${api_pass}&source=test&phone_number=0000000000&stage=pipe&header=YES`,
    });
  }
);

export default router;
