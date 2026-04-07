const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ujxrlkbatxmunrwjkaxx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeHJsa2JhdHhtdW5yd2prYXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIxODc0MSwiZXhwIjoyMDkwNzk0NzQxfQ.OTDNxjeZP5UTPk6ykte6oHDWaNcD6i4xobKPQ7oEvEg'
);

async function checkData() {
  console.log('=== Checking Data ===\n');

  // Check closer1@t.com details
  const { data: closer1 } = await supabase
    .from('users')
    .select('id, email, full_name, role, managed_by')
    .eq('email', 'closer1@t.com');
  
  console.log('closer1@t.com:', JSON.stringify(closer1, null, 2));

  // Check outcomes for closer1
  if (closer1 && closer1.length > 0) {
    const closerId = closer1[0].id;
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('id, customer_name, customer_phone, closer_id, created_at')
      .eq('closer_id', closerId);
    
    console.log(`\nOutcomes for closer1 (${closerId}): ${outcomes?.length || 0} records`);
    if (outcomes && outcomes.length > 0) {
      console.log(outcomes.slice(0, 2));
    }

    // Check closer_records for closer1
    const { data: records } = await supabase
      .from('closer_records')
      .select('id, customer_name, customer_phone, closer_id, created_at')
      .eq('closer_id', closerId);
    
    console.log(`\nCloser records for closer1: ${records?.length || 0} records`);
    if (records && records.length > 0) {
      console.log(records.slice(0, 2));
    }
  }

  // Check closerm1 and their managed closers
  const { data: closerm1 } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', 'closerm1@t.com');
  
  console.log('\ncloserm1@t.com:', JSON.stringify(closerm1, null, 2));

  if (closerm1 && closerm1.length > 0) {
    const managerId = closerm1[0].id;
    const { data: managed } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('managed_by', managerId);
    
    console.log(`\nClosers managed by closerm1: ${managed?.length || 0}`);
    console.log(JSON.stringify(managed, null, 2));
  }
}

checkData().catch(console.error);
