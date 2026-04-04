import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard, featureGuard } from '../middleware/role.js';
import { validateQuery } from '../middleware/validate.js';
import { searchNumberSchema } from '../schemas/number.schema.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { getRedis, isRedisConnected, markNumberSold } from '../services/redis.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Normalize phone to E.164 format
function normalizeToE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return `+${digits}`;
}

// GET /search/number - CRM number search
router.get(
  '/number',
  searchLimiter,
  roleGuard('closer', 'company_admin', 'super_admin'),
  async (req, res, next) => {
    // Company admin needs feature flag
    if (req.user.role === 'company_admin') {
      return featureGuard('number_search')(req, res, next);
    }
    next();
  },
  validateQuery(searchNumberSchema),
  async (req, res) => {
    const { q: phone } = req.query;

    try {
      const normalizedPhone = normalizeToE164(phone);

      // Check Redis cache for sold status
      const redis = getRedis();
      let soldStatus = null;
      if (isRedisConnected() && redis) {
        const cacheKey = `sold:${normalizedPhone}`;
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          soldStatus = cached === 'yes';
        }
      }

      // Query CRM outcomes/closer records
      const { data: saleDisposition } = await supabase
        .from('dispositions')
        .select('id')
        .eq('label', 'Sale Made')
        .single();

      const { data: crmRecords, error: crmError } = await supabase
        .from('outcomes')
        .select(`
          id,
          customer_phone,
          customer_name,
          customer_email,
          customer_address,
          customer_dob,
          customer_gender,
          car_make,
          car_model,
          car_year,
          car_miles,
          car_vin,
          plan,
          client,
          down_payment,
          monthly_payment,
          reference_no,
          next_payment_note,
          remarks,
          created_at,
          policy_number,
          previous_record_id,
          status,
          disposition_id,
          closer:users!outcomes_closer_id_fkey (id, full_name),
          company:companies!outcomes_company_id_fkey (id, name, display_name),
          dispositions (id, label)
        `)
        .eq('customer_phone', normalizedPhone)
        .order('created_at', { ascending: false });

      if (crmError) throw crmError;

      // Determine sold status from CRM if not cached
      if (soldStatus === null) {
        soldStatus = saleDisposition && crmRecords?.some(o => o.disposition_id === saleDisposition.id);
        // Write to Redis cache (24h TTL)
        if (isRedisConnected() && redis) {
          await redis.setex(`sold:${normalizedPhone}`, 86400, soldStatus ? 'yes' : 'no');
        }
      }

      // Build response
      res.json({
        phone: normalizedPhone,
        sold: soldStatus,
        total_policies: crmRecords?.length || 0,
        crm_records: (crmRecords || []).map(r => ({
          id: r.id,
          policy_number: r.policy_number,
          previous_record_id: r.previous_record_id,
          record_date: r.created_at?.split('T')[0],
          status: r.status,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          customer_email: r.customer_email || 'Not available',
          customer_address: r.customer_address,
          customer_dob: r.customer_dob,
          customer_gender: r.customer_gender,
          car_make: r.car_make,
          car_model: r.car_model,
          car_year: r.car_year,
          car_miles: r.car_miles,
          car_vin: r.car_vin,
          plan: r.plan,
          client: r.client,
          down_payment: r.down_payment,
          monthly_payment: r.monthly_payment,
          reference_no: r.reference_no,
          next_payment_note: r.next_payment_note,
          closer_name: r.closer?.full_name,
          fronter_name: r.fronter_name,
          company_name: r.company?.display_name || r.company?.name,
          disposition_code: r.dispositions?.label,
          remarks: r.remarks || '',
        })),
      });
    } catch (err) {
      console.error('Number search error:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
      });
      res.status(500).json({ 
        error: 'Search failed',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  }
);

export default router;
