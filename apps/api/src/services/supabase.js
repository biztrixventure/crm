import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate required credentials
if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing required Supabase environment variables:');
  if (!supabaseUrl) console.error('   - SUPABASE_URL');
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_KEY');
  if (!supabaseAnonKey) console.error('   - SUPABASE_ANON_KEY');
  throw new Error('Missing required Supabase credentials. Cannot start API.');
}

// Service role client - bypasses RLS, used for database queries
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Anon client - used for authentication (signInWithPassword)
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;
