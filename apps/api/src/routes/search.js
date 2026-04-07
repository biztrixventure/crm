import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to normalize phone numbers
function normalizePhoneLocal(phone) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Support E.164 or just 10 digits
  if (digits.startsWith('1')) {
    return digits.substring(1); // Remove leading 1
  }
  return digits.slice(-10); // Get last 10 digits
}

// GET /search/number - Search for customer by phone number (sold/not sold status)
router.get(
  '/number',
  roleGuard('super_admin', 'company_admin', 'closer', 'closer_manager', 'compliance_manager', 'compliance_agent', 'operations_manager'),
  async (req, res) => {
    const { phone } = req.query;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
      const normalizedPhone = normalizePhoneLocal(phone);

      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      // Search in multiple places separately to handle errors gracefully
      let transfersData = [];
      let closerRecordsData = [];

      // Search transfers
      try {
        const { data, error } = await supabase
          .from('transfers')
          .select(
            `
            id,
            customer_phone,
            customer_name,
            company_id,
            closer_id,
            fronter_id,
            status,
            created_at,
            companies!transfers_company_id_fkey (id, name, display_name),
            closer:users!transfers_closer_id_fkey (id, full_name),
            fronter:users!transfers_fronter_id_fkey (id, full_name)
          `
          )
          .ilike('customer_phone', `%${normalizedPhone}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Transfers search error:', error);
        } else if (data) {
          transfersData = data;
        }
      } catch (err) {
        console.error('Transfers query exception:', err);
      }

      // Search closer records
      try {
        const { data, error } = await supabase
          .from('closer_records')
          .select(
            `
            id,
            customer_phone,
            customer_name,
            customer_email,
            vin,
            record_date,
            status,
            created_at,
            company_id,
            closer_id,
            companies!closer_records_company_id_fkey (id, name, display_name),
            closer:users!closer_records_closer_id_fkey (id, full_name),
            dispositions (id, label)
          `
          )
          .ilike('customer_phone', `%${normalizedPhone}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Closer records search error:', error);
        } else if (data) {
          closerRecordsData = data;
        }
      } catch (err) {
        console.error('Closer records query exception:', err);
      }

      // Safely map results
      const transferResults = (transfersData || []).map((t) => ({
        type: 'transfer',
        id: t.id,
        customer_phone: t.customer_phone,
        customer_name: t.customer_name,
        company: t.companies?.display_name || t.companies?.name || 'N/A',
        status: t.status,
        closer_name: t.closer?.full_name || 'Unknown',
        fronter_name: t.fronter?.full_name || null,
        created_at: t.created_at,
        is_sold: false, // Transfers are not yet completed sales
      }));

      const recordResults = (closerRecordsData || []).map((r) => ({
        type: 'record',
        id: r.id,
        customer_phone: r.customer_phone,
        customer_name: r.customer_name,
        customer_email: r.customer_email || null,
        vin: r.vin || null,
        company: r.companies?.display_name || r.companies?.name || 'N/A',
        status: r.status,
        disposition: r.dispositions?.label || null,
        closer_name: r.closer?.full_name || 'Unknown',
        created_at: r.created_at,
        is_sold: r.dispositions?.label?.toLowerCase() === 'sold', // Determine if sold
      }));

      const results = [...transferResults, ...recordResults];

      res.json({ results, count: results.length });
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }
);

export default router;
