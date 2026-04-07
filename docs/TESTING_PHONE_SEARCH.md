# Phone Number Search - Testing Guide

## 🧪 AUTOMATED TEST SCRIPT

Create a file `test-phone-search.js` in your project root:

```javascript
#!/usr/bin/env node

const http = require('http');

const API_URL = 'http://localhost:4000/api/v1';

// Test cases for phone search
const testCases = [
  {
    name: 'Search for 2025551234 (Company A)',
    phone: '2025551234',
    token: 'SUPER_ADMIN_TOKEN',
    expectedCount: 2, // 1 transfer + 1 record
  },
  {
    name: 'Search for 5555678901 (Company A NOT SOLD)',
    phone: '5555678901',
    token: 'SUPER_ADMIN_TOKEN',
    expectedCount: 1, // 1 record with Callback disposition
  },
  {
    name: 'Search for 7135551234 (Company B)',
    phone: '7135551234',
    token: 'COMPANY_B_TOKEN',
    expectedCount: 2, // 1 transfer + 1 record
  },
  {
    name: 'Search with formatting (202-555-1234)',
    phone: '202-555-1234',
    token: 'SUPER_ADMIN_TOKEN',
    expectedCount: 2,
  },
  {
    name: 'Search with E.164 format (+12025551234)',
    phone: '+12025551234',
    token: 'SUPER_ADMIN_TOKEN',
    expectedCount: 2,
  },
  {
    name: 'Search non-existent number',
    phone: '5551111111',
    token: 'SUPER_ADMIN_TOKEN',
    expectedCount: 0,
  },
];

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      host: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const request = http.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            status: response.statusCode,
            data: data,
          });
        }
      });
    });

    request.on('error', reject);
    request.end();
  });
}

async function runTests() {
  console.log('🧪 Phone Number Search - Test Suite\n');
  console.log('=' .repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`📝 ${testCase.name}`);
    console.log(`   Phone: ${testCase.phone}`);

    try {
      const response = await makeRequest(
        `/search/number?phone=${encodeURIComponent(testCase.phone)}`,
        testCase.token
      );

      if (response.status === 200) {
        const resultCount = response.data.results?.length || 0;
        const passed_test = resultCount === testCase.expectedCount;

        if (passed_test) {
          console.log(`   ✅ PASS: Got ${resultCount} result(s) as expected`);
          passed++;
        } else {
          console.log(`   ❌ FAIL: Got ${resultCount} results, expected ${testCase.expectedCount}`);
          console.log(`   Data: ${JSON.stringify(response.data.results)}`);
          failed++;
        }
      } else {
        console.log(`   ❌ FAIL: HTTP ${response.status}`);
        console.log(`   Error: ${response.data.error || 'Unknown error'}`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }

    console.log('');
  }

  console.log('=' .repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

## 🚀 MANUAL TESTING WITH CURL

### 1. Get Authentication Token

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@biztrix.local",
    "password": "your_password"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "user": {
#     "id": "...",
#     "email": "admin@biztrix.local",
#     "role": "super_admin"
#   }
# }

# Save the token:
export TOKEN="your_token_here"
```

### 2. Test Super Admin Search (All Records)

```bash
curl http://localhost:4000/api/v1/search/number?phone=2025551234 \
  -H "Authorization: Bearer $TOKEN"

# Response should include:
# - 1 transfer (pending) from Company A
# - 1 closer_record (sold) from Company A
```

### 3. Test Company Admin Search (Own Company Only)

```bash
curl http://localhost:4000/api/v1/search/number?phone=2025551234 \
  -H "Authorization: Bearer $COMPANY_TOKEN"

# Response same as above (Company A admin seeing their company)
```

### 4. Test Closer Search (Own Records Only)

```bash
curl http://localhost:4000/api/v1/search/number?phone=2025551234 \
  -H "Authorization: Bearer $CLOSER_TOKEN"

# Response should include only records for that closer
```

### 5. Test Compliance Agent Search (Batch Records Only)

```bash
curl http://localhost:4000/api/v1/search/number?phone=2025551234 \
  -H "Authorization: Bearer $COMPLIANCE_AGENT_TOKEN"

# Response only includes records from assigned batches
```

### 6. Test Various Phone Formats

```bash
# Formatted
curl "http://localhost:4000/api/v1/search/number?phone=%28202%29%20555-1234" \
  -H "Authorization: Bearer $TOKEN"

# E.164
curl "http://localhost:4000/api/v1/search/number?phone=%2B12025551234" \
  -H "Authorization: Bearer $TOKEN"

# Just digits
curl "http://localhost:4000/api/v1/search/number?phone=2025551234" \
  -H "Authorization: Bearer $TOKEN"

# 11 digits with leading 1
curl "http://localhost:4000/api/v1/search/number?phone=12025551234" \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Test No Results

```bash
curl "http://localhost:4000/api/v1/search/number?phone=5551111111" \
  -H "Authorization: Bearer $TOKEN"

# Response should be:
# {
#   "results": [],
#   "count": 0
# }
```

### 8. Test Invalid Input

```bash
# Missing phone parameter
curl http://localhost:4000/api/v1/search/number \
  -H "Authorization: Bearer $TOKEN"

# Response: 400 Bad Request - "Phone number is required"

# Invalid format
curl "http://localhost:4000/api/v1/search/number?phone=abcdefghij" \
  -H "Authorization: Bearer $TOKEN"

# Response: 400 Bad Request - "Invalid phone number format"
```

## 🔍 EXPECTED RESPONSE FORMAT

### Success Response (200)
```json
{
  "results": [
    {
      "type": "transfer",
      "id": "40000001-0000-0000-0000-000000000001",
      "customer_name": "John Doe",
      "customer_phone": "2025551234",
      "company": "Fake Auto Insurance",
      "status": "pending",
      "closer_name": "Bob Smith",
      "fronter_name": "Carol Davis",
      "created_at": "2024-04-07T12:00:00Z",
      "is_sold": false
    },
    {
      "type": "record",
      "id": "50000001-0000-0000-0000-000000000001",
      "customer_name": "John Doe",
      "customer_phone": "2025551234",
      "customer_email": "john@example.com",
      "vin": "1YVDP11C955123456",
      "company": "Fake Auto Insurance",
      "closer_name": "Bob Smith",
      "disposition": "Sold",
      "created_at": "2024-04-07T14:00:00Z",
      "is_sold": true
    }
  ],
  "count": 2
}
```

### Error Responses
```json
// 400 - Invalid input
{
  "error": "Phone number is required"
}

// 403 - Unauthorized role
{
  "error": "Role not authorized to search"
}

// 500 - Server error
{
  "error": "Search failed",
  "details": "Error message here (dev only)"
}
```

## ✅ TEST CHECKLIST

### Basic Functionality
- [ ] Search returns results for existing phone numbers
- [ ] Search returns empty results for non-existent numbers
- [ ] All phone formats accepted (10 digits, E.164, formatted)
- [ ] Phone normalization works correctly

### Result Format
- [ ] Transfers have type='transfer'
- [ ] Records have type='record'
- [ ] Sold records have is_sold=true
- [ ] Not-sold records have is_sold=false
- [ ] All fields populated correctly

### Role-Based Access
- [ ] Super Admin: sees all records
- [ ] Company Admin: sees only company records
- [ ] Closer: sees only own records
- [ ] Closer Manager: sees all closers' records
- [ ] Compliance Manager: sees all records
- [ ] Compliance Agent: sees only batch records
- [ ] Operations Manager: sees all records

### Multi-Tenant Isolation
- [ ] Company A users cannot see Company B records
- [ ] Closers cannot search other closers' records
- [ ] Company B admin blocked from Company A data

### Error Handling
- [ ] Missing phone parameter: 400 error
- [ ] Invalid phone format: 400 error
- [ ] Unauthorized role: 403 error (if not in allowed list)
- [ ] Database error: 500 error with debug info (dev only)

### Performance
- [ ] Response time < 500ms for typical queries
- [ ] Memory usage stable
- [ ] No N+1 queries
- [ ] Phone index being used

## 🐛 DEBUGGING TIPS

### Check Database Connection
```bash
# Are the indexes there?
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='closer_records';

# Check record count
SELECT COUNT(*) FROM closer_records;
SELECT COUNT(*) FROM transfers;

# Check dispositions
SELECT id, label FROM dispositions;
```

### Check API Logs
```bash
# In terminal where API is running, look for:
# - "Closer records search error" - Supabase query failed
# - "Transfers query exception" - Exception in transfers query
# - "Compliance agent batch lookup" - Agent batch filtering
```

### Enable Debug Mode
```bash
# Add to API startup
NODE_ENV=development npm run dev

# Will show:
# - SQL query details
# - Full error messages
# - Response data
```

### Test Phone Normalization
```javascript
// Frontend
const result = normalizePhone('(202) 555-1234');
console.log(result); // Should be "+12025551234"

// Backend
function normalizePhoneLocal(phone) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits.slice(-10);
}
console.log(normalizePhoneLocal('+12025551234')); // Should be "2025551234"
```

## 📋 TROUBLESHOOTING COMMON ISSUES

### Issue: "Search returns empty results"
1. Verify database has test data:
   ```sql
   SELECT * FROM transfers WHERE customer_phone = '2025551234';
   SELECT * FROM closer_records WHERE customer_phone = '2025551234';
   ```
2. Check phone format in database
3. Verify user's company_id matches record company_id

### Issue: "Dispositions not showing up"
1. Check foreign key constraint exists:
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name='closer_records' AND constraint_type='FOREIGN KEY';
   ```
2. Verify disposition_id references exist:
   ```sql
   SELECT * FROM closer_records WHERE disposition_id IS NULL;
   ```
3. Try explicit query with constraint name

### Issue: "Compliance agent sees no results"
1. Verify agent has assigned batches:
   ```sql
   SELECT * FROM compliance_batches WHERE assigned_to = 'agent_id';
   ```
2. Verify compliance_reviews exist for batches
3. Check closer_record_ids in reviews exist

### Issue: "API returns 5 00 error"
1. Check server logs
2. Verify Supabase credentials in .env
3. Test direct Supabase connection:
   ```javascript
   const { data, error } = await supabase.from('closer_records').select('*').limit(1);
   ```
