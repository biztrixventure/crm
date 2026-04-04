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

// GET /search/number - Comprehensive search: CRM + ViciDial with merged timeline
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

      // Step 1: Check Redis cache for sold status
      const redis = getRedis();
      let soldStatus = null;
      if (isRedisConnected() && redis) {
        const cacheKey = `sold:${normalizedPhone}`;
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          soldStatus = cached === 'yes';
        }
      }

      // Step 2: Query CRM outcomes/closer records
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
          vicidial_lead_id,
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

      // Step 3: Get ViciDial call history
      let vicidialCalls = [];
      let vicidialAvailable = false;
      
      if (vicidial.isConfigured()) {
        try {
          vicidialAvailable = true;
          
          // Check Redis cache for ViciDial log
          let vdLogData = null;
          if (isRedisConnected() && redis) {
            const vdCacheKey = `vdlog:${normalizedPhone}`;
            const vdCached = await redis.get(vdCacheKey);
            if (vdCached) {
              vdLogData = JSON.parse(vdCached);
            }
          }

          // Fetch from ViciDial if not cached
          if (!vdLogData) {
            const calls = await vicidial.getPhoneNumberLog(phoneDigits);
            vdLogData = calls || [];
            
            // Cache ViciDial log (1h TTL)
            if (isRedisConnected() && redis && vdLogData.length > 0) {
              const vdCacheKey = `vdlog:${normalizedPhone}`;
              await redis.setex(vdCacheKey, 3600, JSON.stringify(vdLogData));
            }
          }

          // Step 4: Resolve agent names for ViciDial calls
          for (const call of vdLogData) {
            let agentName = null;
            let agentSource = null;

            // Try to match with CRM record by vicidial_lead_id
            if (call.list_id) {
              const crmMatch = crmRecords?.find(r => {
                if (!r.vicidial_lead_id || r.vicidial_lead_id !== call.list_id) {
                  return false;
                }
                try {
                  const timeDiff = Math.abs(new Date(r.created_at) - new Date(call.call_datetime));
                  return timeDiff < 1800000; // 30 min window
                } catch (e) {
                  return false;
                }
              });
              if (crmMatch && crmMatch.closer?.full_name) {
                agentName = crmMatch.closer.full_name;
                agentSource = 'crm_match';
              }
            }

            // Fallback: Check agent cache in Redis
            if (!agentName && isRedisConnected() && redis && call.campaign_id) {
              const agentCacheKey = `agent_cache:${call.campaign_id}`;
              const cached = await redis.get(agentCacheKey);
              if (cached) {
                agentName = cached;
                agentSource = 'cache';
              }
            }

            // Fallback: Show list_id
            if (!agentName) {
              agentName = call.list_id ? `Agent ID: ${call.list_id}` : 'Unknown Agent';
              agentSource = 'fallback';
            }

            call.agent_name = agentName;
            call.agent_source = agentSource;
          }

          vicidialCalls = vdLogData;

          // Optionally fetch and cache logged-in agents for future calls
          if (crmRecords?.length > 0 && isRedisConnected() && redis) {
            const campaignId = vicidialCalls[0]?.campaign_id;
            if (campaignId) {
              const agents = await vicidial.getLoggedInAgents(campaignId);
              for (const [userId, agentName] of Object.entries(agents)) {
                await redis.setex(`agent_cache:${userId}`, 60, agentName);
              }
            }
          }
        } catch (vdErr) {
          console.error('ViciDial fetch error (non-fatal):', vdErr.message);
          vicidialAvailable = false;
          vicidialCalls = [];
        }
      }

      // Step 5: Build merged timeline
      const mergedTimeline = [];

      // Add ViciDial calls to timeline
      for (const call of vicidialCalls) {
        mergedTimeline.push({
          timestamp: call.call_datetime,
          type: 'vicidial_call',
          disposition_code: call.disposition_code,
          duration_display: call.duration_display,
          agent_name: call.agent_name,
          summary: `${call.disposition_code} — ${call.duration_display} — ${call.agent_name}`,
        });
      }

      // Add CRM records to timeline
      for (const record of crmRecords || []) {
        mergedTimeline.push({
          timestamp: record.created_at,
          type: 'crm_record',
          record_id: record.id,
          policy_number: record.policy_number,
          summary: `Policy ${record.policy_number} — ${record.car_year} ${record.car_make} ${record.car_model} — ${record.plan} — ${record.client}`,
        });
      }

      // Sort timeline by timestamp (newest first)
      mergedTimeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Step 6: Apply field visibility filter
      // TODO: Load search_field_config for requester's role and filter fields

      // Step 7: Build response
      res.json({
        phone: normalizedPhone,
        sold: soldStatus,
        total_policies: crmRecords?.length || 0,
        vicidial_available: vicidialAvailable,
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
          fronter_name: r.fronter_name, // TODO: add to outcomes table
          company_name: r.company?.display_name || r.company?.name,
          disposition_code: r.dispositions?.label,
          remarks: r.remarks || '',
        })),
        vicidial_calls: vicidialCalls,
        merged_timeline: mergedTimeline,
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
