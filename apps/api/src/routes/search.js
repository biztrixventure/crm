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
    const { id: userId, role, companyId } = req.user;

    console.log('🔍 SEARCH API CALLED:');
    console.log(`   Phone: ${phone}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Role: ${role}`);
    console.log(`   Company ID: ${companyId}`);

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
      const normalizedPhone = normalizePhoneLocal(phone);
      console.log(`   Normalized: ${normalizedPhone}`);

      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      let transfersData = [];
      let closerRecordsData = [];

      // Build filters based on user role
      let transferFilter = null;
      let recordFilter = null;

      if (role === 'closer') {
        // Closers can only search their own records/transfers
        transferFilter = (query) => query.eq('closer_id', userId);
        recordFilter = (query) => query.eq('closer_id', userId);
      } else if (role === 'closer_manager') {
        // Closer managers can search records from their managed closers only
        // First get all closers managed by this manager
        try {
          console.log(`   [closer_manager] Fetching closers managed by ${userId}`);
          const { data: managedClosers, error: closersError } = await supabase
            .from('users')
            .select('id')
            .eq('managed_by', userId)
            .eq('role', 'closer');

          if (closersError) {
            console.error('❌ Error fetching managed closers:', closersError);
            return res.json({ results: [], count: 0 });
          }

          console.log(`   [closer_manager] Found ${managedClosers?.length || 0} managed closers`);
          if (managedClosers && managedClosers.length > 0) {
            console.log(`   [closer_manager] Closer IDs:`, managedClosers.map(c => c.id));
          }

          const closerIds = (managedClosers || []).map(c => c.id);

          if (!closerIds || closerIds.length === 0) {
            // No managed closers, return empty results
            console.log(`   [closer_manager] ⚠️  No managed closers found, returning empty`);
            return res.json({ results: [], count: 0 });
          }

          // Filter by managed closers
          transferFilter = (query) => query.in('closer_id', closerIds);
          recordFilter = (query) => query.in('closer_id', closerIds);
        } catch (err) {
          console.error('❌ Error in closer_manager managed closers lookup:', err);
          return res.json({ results: [], count: 0 });
        }
      } else if (role === 'company_admin') {
        // Company admins can only search their company's records
        if (!companyId) {
          return res.status(403).json({ error: 'Company admin missing company_id' });
        }
        transferFilter = (query) => query.eq('company_id', companyId);
        recordFilter = (query) => query.eq('company_id', companyId);
      } else if (role === 'compliance_manager' || role === 'operations_manager') {
        // These roles can search all records
        transferFilter = (query) => query;
        recordFilter = (query) => query;
      } else if (role === 'compliance_agent') {
        // Agents can search records from their assigned batches only
        // Get their assigned batches → compliance reviews → closer records
        try {
          const { data: batches, error: batchError } = await supabase
            .from('compliance_batches')
            .select('id')
            .eq('assigned_to', userId);

          if (batchError) {
            console.error('Error fetching agent batches:', batchError);
            return res.json({ results: [], count: 0 });
          }

          if (!batches || batches.length === 0) {
            // No batches assigned, return empty results
            return res.json({ results: [], count: 0 });
          }

          const batchIds = batches.map(b => b.id);

          // Get closer_record_ids from compliance_reviews for these batches
          const { data: reviews, error: reviewError } = await supabase
            .from('compliance_reviews')
            .select('closer_record_id')
            .in('batch_id', batchIds);

          if (reviewError) {
            console.error('Error fetching compliance reviews:', reviewError);
            return res.json({ results: [], count: 0 });
          }

          if (!reviews || reviews.length === 0) {
            return res.json({ results: [], count: 0 });
          }

          const recordIds = reviews.map(r => r.closer_record_id);
          // Filter by records assigned to this agent's batches
          recordFilter = (query) => query.in('id', recordIds);
        } catch (err) {
          console.error('Error in compliance agent batch lookup:', err);
          return res.json({ results: [], count: 0 });
        }
        // Transfers are not relevant for compliance agents
        transferFilter = () => null;
      } else if (role === 'super_admin') {
        // Super admins can search all records
        transferFilter = (query) => query;
        recordFilter = (query) => query;
      }

      // Search transfers with filter
      if (transferFilter) {
        try {
          let query = supabase
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

          // Apply role-based filter
          query = transferFilter(query);
          if (query) {
            const { data, error } = await query;
            if (error) {
              console.error('Transfers search error:', error);
            } else if (data) {
              transfersData = data;
            }
          }
        } catch (err) {
          console.error('Transfers query exception:', err);
        }
      }

      // Search closer records with filter
      if (recordFilter) {
        try {
          let query = supabase
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
              dispositions!closer_records_disposition_id_fkey (id, label)
            `
            )
            .ilike('customer_phone', `%${normalizedPhone}%`)
            .order('created_at', { ascending: false })
            .limit(10);

          // Apply role-based filter
          query = recordFilter(query);
          if (query) {
            const { data, error } = await query;
            if (error) {
              console.error('Closer records search error:', error);
            } else if (data) {
              closerRecordsData = data;
            }
          }
        } catch (err) {
          console.error('Closer records query exception:', err);
        }
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

      const recordResults = (closerRecordsData || []).map((r) => {
        // Flexible disposition check - supports multiple "sold" labels
        const dispositionLabel = r.dispositions?.label?.toLowerCase().trim() || '';
        const soldLabels = ['sale made', 'sold', 'sale', 'closed won', 'sold (auto)', 'sold (rv)'];
        const isSold = soldLabels.includes(dispositionLabel);

        return {
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
          is_sold: isSold,
        };
      });

      const results = [...transferResults, ...recordResults];

      console.log(`✅ SEARCH COMPLETE:`);
      console.log(`   Transfers: ${transferResults.length}`);
      console.log(`   Records: ${recordResults.length}`);
      console.log(`   Total: ${results.length}`);

      res.json({ results, count: results.length });
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }
);

export default router;
