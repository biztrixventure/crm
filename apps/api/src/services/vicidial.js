import axios from 'axios';

const VICIDIAL_BASE = process.env.VICIDIAL_URL;
const API_PATH = process.env.VICIDIAL_API_PATH || '/vicidial/non_agent_api.php';
const API_USER = process.env.VICIDIAL_API_USER;
const API_PASS = process.env.VICIDIAL_API_PASS;
const MIN_CALL_DURATION = parseInt(process.env.VICIDIAL_MIN_CALL_DURATION || '60');

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

// Get full call history for a phone number
async function getPhoneNumberLog(phone10digit) {
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
      function: 'phone_number_log',
      phone_number: phone10digit,
    });

    const res = await axios.get(`${url}?${params}`, { timeout: 10000 });
    return parsePhoneNumberLog(res.data);
  } catch (err) {
    console.error('ViciDial phone_number_log error:', err.message);
    return [];
  }
}

// Get live logged-in agents
async function getLoggedInAgents(campaignId) {
  if (!isConfigured()) {
    console.warn('ViciDial not configured');
    return {};
  }

  try {
    const url = `${VICIDIAL_BASE}${API_PATH}`;
    const params = new URLSearchParams({
      source: 'test',
      user: API_USER,
      pass: API_PASS,
      function: 'logged_in_agents',
      campaign_id: campaignId,
    });

    const res = await axios.get(`${url}?${params}`, { timeout: 10000 });
    return parseLoggedInAgents(res.data);
  } catch (err) {
    console.error('ViciDial logged_in_agents error:', err.message);
    return {};
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

// Parse phone_number_log response
// Format: phone|datetime|list_id|duration|disposition|call_type|status|extra|campaign_id
function parsePhoneNumberLog(data) {
  if (!data || data.includes('ERROR')) {
    return [];
  }

  const lines = data.split('\n').filter(l => l.trim() && !l.includes('ERROR'));
  
  return lines
    .map(line => {
      const parts = line.split('|');
      const durationSeconds = parseInt(parts[3]?.trim() || '0');
      
      // Filter: keep only calls > MIN_CALL_DURATION (real conversations)
      if (durationSeconds <= MIN_CALL_DURATION) {
        return null;
      }

      return {
        phone_number: parts[0]?.trim() || '',
        call_datetime: parts[1]?.trim() || '',
        list_id: parts[2]?.trim() || '',
        duration_seconds: durationSeconds,
        duration_display: formatDuration(durationSeconds),
        disposition_code: parts[4]?.trim() || '',
        call_type: parts[5]?.trim() || '',
        status: parts[6]?.trim() || '',
        campaign_id: parts[8]?.trim() || '',
        agent_name: null, // Will be resolved later
        agent_source: null, // crm_match | cache | fallback
      };
    })
    .filter(d => d !== null)
    .sort((a, b) => new Date(b.call_datetime) - new Date(a.call_datetime)); // Newest first
}

// Parse logged_in_agents response
// Format: user_id|campaign_id|phone_ext|agent_status|lead_id|call_id|duration_sec|agent_name|server|flag
function parseLoggedInAgents(data) {
  if (!data || data.includes('ERROR')) {
    return {};
  }

  const agentMap = {};
  const lines = data.split('\n').filter(l => l.trim() && !l.includes('ERROR'));
  
  lines.forEach(line => {
    const parts = line.split('|');
    const userId = parts[0]?.trim();
    const agentName = parts[7]?.trim();
    
    if (userId && agentName) {
      agentMap[userId] = agentName;
    }
  });

  return agentMap;
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

// Format duration in seconds to "Xm Ys" format
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}

export default {
  isConfigured,
  normalizePhone,
  searchLead,
  getPhoneNumberLog,
  getLoggedInAgents,
  getLeadDispositions,
  formatDuration,
};
