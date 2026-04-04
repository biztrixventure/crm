import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard, featureGuard } from '../middleware/role.js';
import { validateQuery } from '../middleware/validate.js';
import { searchNumberSchema } from '../schemas/number.schema.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { getRedis, isRedisConnected, markNumberSold } from '../services/redis.js';
import vicidial from '../services/vicidial.js';

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

// GET /search/number - Comprehensive search: CRM + ViciDial
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
      const phoneDigits = normalizedPhone.replace(/\D/g, '').slice(-10);

      // Step 1: Check Redis cache for CRM result
      const redis = getRedis();
      let crmData = null;
      if (isRedisConnected() && redis) {
        const cacheKey = `sold:${normalizedPhone}`;
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          crmData = { isSold: cached === 'yes', source: 'cache' };
        }
      }

      // Step 2: Query CRM if not in cache
      if (!crmData) {
        const { data: saleDisposition } = await supabase
          .from('dispositions')
          .select('id')
          .eq('label', 'Sale Made')
          .single();

        const { data: outcomes, error } = await supabase
          .from('outcomes')
          .select(`
            id,
            customer_phone,
            customer_name,
            customer_email,
            remarks,
            created_at,
            closer:users!outcomes_closer_id_fkey (id, full_name),
            company:companies!outcomes_company_id_fkey (id, name, display_name),
            dispositions (id, label)
          `)
          .eq('customer_phone', normalizedPhone)
          .order('created_at', { ascending: false });

        if (error) throw error;

        crmData = {
          isSold: saleDisposition ? outcomes.some(o => o.disposition_id === saleDisposition.id) : false,
          outcomes: outcomes || [],
          source: 'database',
        };

        // Write to Redis cache (24h TTL)
        await markNumberSold(normalizedPhone, crmData.isSold);
      }

      // Step 3: Get ViciDial data if available (and not fully cached)
      let vicidialData = null;
      if (vicidial.isConfigured()) {
        // Check Redis cache for ViciDial data
        if (isRedisConnected() && redis && !crmData.outcomes) {
          const vdCacheKey = `vdlead:${normalizedPhone}`;
          const vdCached = await redis.get(vdCacheKey);
          if (vdCached) {
            vicidialData = JSON.parse(vdCached);
          }
        }

        // Fetch from ViciDial if not cached
        if (!vicidialData) {
          const leads = await vicidial.searchLead(phoneDigits);
          if (leads && leads.length > 0) {
            // Get dispositions for first lead
            const dispositions = await vicidial.getLeadDispositions(leads[0].lead_id);
            vicidialData = {
              leads,
              dispositions,
            };

            // Cache ViciDial data (1h TTL)
            if (isRedisConnected() && redis) {
              const vdCacheKey = `vdlead:${normalizedPhone}`;
              await redis.setex(vdCacheKey, 3600, JSON.stringify(vicidialData));
            }
          }
        }
      }

      // Step 4: Build response
      res.json({
        phone: normalizedPhone,
        sold: crmData.isSold,
        source: crmData.source,
        crm_records: crmData.outcomes || [],
        vicidial_available: vicidial.isConfigured(),
        vicidial_data: vicidialData,
      });
    } catch (err) {
      console.error('Number search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

export default router;
