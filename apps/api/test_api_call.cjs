const axios = require('axios');
const jwt = require('jsonwebtoken');

// Create a JWT token for the closer manager
const managerId = 'cd11b2a8-c64a-464c-b766-56a76d06717d';
const token = jwt.sign(
  {
    id: managerId,
    email: 'closerm1@t.com',
    role: 'closer_manager',
    companyId: null
  },
  'biztrix-crm-ultra-secure-jwt-secret-key-2024-v1'
);

console.log('🔐 Test JWT Token created for closer_manager');
console.log(`Manager ID: ${managerId}\n`);

// Test the API call
async function testAPI() {
  try {
    const normalizedPhone = '2345'; // 10 last digits
    const url = `http://localhost:4000/api/v1/search/number?phone=${encodeURIComponent(normalizedPhone)}`;

    console.log(`📊 Testing API Call:`);
    console.log(`GET ${url}\n`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ API Response Status:', response.status);
    console.log('📦 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ API Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAPI();
