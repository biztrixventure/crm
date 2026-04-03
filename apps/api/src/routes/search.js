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

// GET /search/number - Check if number is sold
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

      // Check Redis cache first when available
      const redis = getRedis();
      if (isRedisConnected() && redis) {
        const cacheKey = `sold:${normalizedPhone}`;
        const cached = await redis.get(cacheKey);

        if (cached !== null) {
          return res.json({
            phone: normalizedPhone,
            sold: cached === 'yes',
            source: 'cache',
          });
        }
      }

      // Cache miss - query database
      const { data: saleDisposition } = await supabase
        .from('dispositions')
        .select('id')
        .eq('label', 'Sale Made')
        .single();

      if (!saleDisposition) {
        return res.status(500).json({ error: 'System configuration error' });
      }

      const { data: outcome, error } = await supabase
        .from('outcomes')
        .select('id')
        .eq('customer_phone', normalizedPhone)
        .eq('disposition_id', saleDisposition.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const isSold = outcome !== null;

      // Write to Redis cache (24h TTL)
      await markNumberSold(normalizedPhone, isSold);

      res.json({
        phone: normalizedPhone,
        sold: isSold,
        source: 'database',
      });
    } catch (err) {
      console.error('Number search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

export default router;
