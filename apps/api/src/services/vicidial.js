import axios from 'axios';

const VICIDIAL_BASE = process.env.VICIDIAL_URL;
const API_PATH = process.env.VICIDIAL_API_PATH || '/vicidial/non_agent_api.php';
const API_USER = process.env.VICIDIAL_API_USER;
const API_PASS = process.env.VICIDIAL_API_PASS;

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  return {
    e164: `+1${ten}`,
    ten: ten,
  };
}

function isConfigured() {
  return !!(VICIDIAL_BASE && API_USER && API_PASS);
}

async function searchLead(phone10digit) {
  if (!isConfigured()) {
    console.warn('ViciDial not configured');
    return null;
  }

  try {
    const url = `${VICIDIAL_BASE}${API_PATH}`;
    const params = new URLSearchParams({
      source: 'test',
      user: API_USER,
      pass: API_PASS,
      function: 'lead_search',
      phone_number: phone10digit,
      query_fields: 'lead_id,first_name,last_name,phone_number,address1,city,state,zip_code,email,date_of_birth,gender,comments,status,user,entry_date',
    });

    const res = await axios.get(`${url}?${params}`, { timeout: 10000 });
    return parseViciDialResponse(res.data);
  } catch (err) {
    console.error('ViciDial lead search error:', err.message);
    return null;
  }
}

async function getLeadDispositions(leadId) {
  if (!isConfigured()) {
    console.warn('ViciDial not configured');
    return [];
  }

  try {
    const url = `${VICIDIAL_BASE}${API_PATH}`;
    const params = new URLSearchParams({
      source: 'test',
      user: API_USER,
      pass: API_PASS,
      function: 'get_call_notes',
      lead_id: leadId,
    });

    const res = await axios.get(`${url}?${params}`, { timeout: 10000 });
    return parseDispositions(res.data);
  } catch (err) {
    console.error('ViciDial disposition fetch error:', err.message);
    return [];
  }
}

function parseViciDialResponse(data) {
  // ViciDial returns either JSON or text format
  // Expected format: lead records separated by |
  if (!data || data.includes('ERROR')) {
    return [];
  }

  // Parse simple format: lead_id|first_name|last_name|phone|address|city|state|zip|email|dob|gender|comments
  const lines = data.split('\n').filter(l => l.trim() && !l.includes('ERROR'));
  return lines.map(line => {
    const parts = line.split('|');
    return {
      lead_id: parts[0]?.trim(),
      first_name: parts[1]?.trim() || '',
      last_name: parts[2]?.trim() || '',
      phone_number: parts[3]?.trim() || '',
      address: parts[4]?.trim() || '',
      city: parts[5]?.trim() || '',
      state: parts[6]?.trim() || '',
      zip_code: parts[7]?.trim() || '',
      email: parts[8]?.trim() || '',
      date_of_birth: parts[9]?.trim() || '',
      gender: parts[10]?.trim() || '',
      comments: parts[11]?.trim() || '',
    };
  });
}

function parseDispositions(data) {
  // Format: date|time|agent|disposition_code|duration|comments
  if (!data || data.includes('ERROR')) {
    return [];
  }

  const SKIP_DISPOSITIONS = ['NA', 'DROP', 'BUSY', 'INCALL', ''];
  const lines = data.split('\n').filter(l => l.trim() && !l.includes('ERROR'));
  
  return lines
    .map(line => {
      const parts = line.split('|');
      const dispo = parts[3]?.trim() || '';
      
      // Skip calls where closer didn't actually speak to customer
      if (SKIP_DISPOSITIONS.includes(dispo)) {
        return null;
      }

      return {
        call_date: `${parts[0]?.trim()} ${parts[1]?.trim()}`,
        agent: parts[2]?.trim() || 'Unknown',
        disposition_code: dispo,
        duration_seconds: parseInt(parts[4]?.trim() || '0'),
        comments: parts[5]?.trim() || '',
      };
    })
    .filter(d => d !== null);
}

export default {
  isConfigured,
  normalizePhone,
  searchLead,
  getLeadDispositions,
};
