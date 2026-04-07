const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ujxrlkbatxmunrwjkaxx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeHJsa2JhdHhtdW5yd2prYXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIxODc0MSwiZXhwIjoyMDkwNzk0NzQxfQ.OTDNxjeZP5UTPk6ykte6oHDWaNcD6i4xobKPQ7oEvEg'
);

async function testSearch() {
  console.log('🔍 Testing Search Logic for Closer Manager\n');

  // Get manager details
  const { data: manager } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'closerm1@t.com');

  const managerId = manager[0].id;
  console.log(`Manager ID: ${managerId}\n`);

  // Simulate search logic - Step 1: Get managed closers
  const { data: managedClosers, error: closersError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('managed_by', managerId)
    .eq('role', 'closer');

  console.log('1️⃣  Managed Closers:');
  if (managedClosers && managedClosers.length > 0) {
    console.log(JSON.stringify(managedClosers, null, 2));
  } else {
    console.log('❌ No managed closers found!');
  }

  if (!managedClosers || managedClosers.length === 0) {
    console.log('\n❌ ERROR: Manager has no managed closers!');
    process.exit(1);
  }

  const closerIds = managedClosers.map(c => c.id);
  console.log(`\nCloser IDs to search: ${closerIds.join(', ')}\n`);

  // Step 2: Search records with those closer IDs
  const phoneQuery = '2345'; // Test search
  
  console.log(`2️⃣  Searching for phone: ${phoneQuery}`);
  const { data: records, error: recordError } = await supabase
    .from('closer_records')
    .select('id, customer_name, customer_phone, closer_id')
    .in('closer_id', closerIds)
    .ilike('customer_phone', `%${phoneQuery}%`);

  if (recordError) {
    console.error('❌ Record search error:', recordError);
    process.exit(1);
  }

  console.log(`\nRecords found: ${records?.length || 0}`);
  if (records && records.length > 0) {
    console.log(JSON.stringify(records, null, 2));
  } else {
    console.log('❌ No records found for that phone number');
    
    // Debug: Show all records for this closer
    const { data: allRecords } = await supabase
      .from('closer_records')
      .select('id, customer_name, customer_phone, closer_id')
      .in('closer_id', closerIds);
    
    console.log(`\n3️⃣  DEBUG: All records for managed closers: ${allRecords?.length || 0}`);
    if (allRecords && allRecords.length > 0) {
      console.log(JSON.stringify(allRecords, null, 2));
    }
  }

  process.exit(0);
}

testSearch().catch(console.error);
