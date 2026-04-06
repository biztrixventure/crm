import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { normalizePhone } from '../lib/phone.js';

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

// GET /search/number - Search for customer by phone number
router.get(
  '/number',
  roleGuard('closer', 'closer_manager', 'operations_manager'),
  async (req, res) => {
    const { phone } = req.query;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
      const normalizedPhone = normalizePhoneLocal(phone);

      // Search in multiple places:
      // 1. Transfers (recent transfers)
      // 2. Closer records (past sales)
      // 3. Phone number log (if available)

      const [transfers, closerRecords] = await Promise.all([
        // Search transfers
        supabase
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
          .limit(10),

        // Search closer records
        supabase
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
          .limit(10),
      ]);

      if (transfers.error) throw transfers.error;
      if (closerRecords.error) throw closerRecords.error;

      const results = [
        ...(transfers.data || []).map((t) => ({
          type: 'transfer',
          id: t.id,
          customer_phone: t.customer_phone,
          customer_name: t.customer_name,
          company: t.companies?.display_name || t.companies?.name,
          status: t.status,
          closer_name: t.closer?.full_name,
          fronter_name: t.fronter?.full_name,
          created_at: t.created_at,
        })),
        ...(closerRecords.data || []).map((r) => ({
          type: 'record',
          id: r.id,
          customer_phone: r.customer_phone,
          customer_name: r.customer_name,
          customer_email: r.customer_email,
          vin: r.vin,
          company: r.companies?.display_name || r.companies?.name,
          status: r.status,
          disposition: r.dispositions?.label,
          closer_name: r.closer?.full_name,
          created_at: r.created_at,
        })),
      ];

      res.json({ results, count: results.length });
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

export default router;
