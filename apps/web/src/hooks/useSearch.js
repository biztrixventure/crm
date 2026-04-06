import { useState, useCallback, useEffect } from 'react';
import api from '../lib/axios';
import { debounce } from '../lib/utils';

// Parse ViciDial pipe-delimited response with header
function parseViciDialResponse(text, hasHeader = true) {
  if (!text || text.includes('ERROR')) {
    return { error: text || 'Unknown error', data: null };
  }
  
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    return { error: null, data: [] };
  }
  
  if (hasHeader && lines.length > 0) {
    const headers = lines[0].split('|').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows = lines.slice(1).map(line => {
      const values = line.split('|');
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i]?.trim() || '';
      });
      return obj;
    });
    return { error: null, data: rows, headers };
  }
  
  return { error: null, data: lines };
}

// Parse lead_all_info response by field index (API 1)
// Field indices as per ViciDial spec
function parseLeadAllInfo(text) {
  if (!text || text.includes('ERROR')) {
    return null;
  }
  
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  
  // First line is headers, second line is data
  const values = lines[1]?.split('|') || [];
  
  return {
    status: values[0]?.trim() || '',        // Index 0 - Lead status (can be outdated)
    user: values[1]?.trim() || '',          // Index 1 - Agent ID
    list_id: values[4]?.trim() || '',       // Index 4 - Campaign/List
    phone_code: values[6]?.trim() || '',    // Index 6 - Country code
    phone_number: values[7]?.trim() || '',  // Index 7 - Customer phone
    first_name: values[9]?.trim() || '',    // Index 9 - First name
    last_name: values[11]?.trim() || '',    // Index 11 - Last name
    address1: values[12]?.trim() || '',     // Index 12 - Street address
    address2: values[13]?.trim() || '',     // Index 13 - Make (vehicle)
    address3: values[14]?.trim() || '',     // Index 14 - Model (vehicle)
    city: values[15]?.trim() || '',         // Index 15 - City
    state: values[16]?.trim() || '',        // Index 16 - State (may contain year)
    postal_code: values[18]?.trim() || '',  // Index 18 - ZIP
    country_code: values[19]?.trim() || '', // Index 19 - Country
    email: values[23]?.trim() || '',        // Index 23 - Email
    lead_id: values[33]?.trim() || '',      // Index 33 - Lead ID
  };
}

// Extract year from potentially misplaced fields
function extractYear(value) {
  if (!value) return '';
  // Look for 4-digit year pattern (19xx or 20xx)
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

// Normalize ViciDial data into clean CRM format
// CRITICAL: API 2 (phone_number_log) disposition takes priority over API 1 status
function normalizeViciDialData(leadInfo, callHistory, recordings) {
  const result = {
    full_name: null,
    phone: null,
    email: null,
    address: null,
    vehicle: null,
    agent: null,
    call_details: null,
    recording: null,
    missing_fields: [],
  };

  // From Lead Info (API 1)
  if (leadInfo) {
    // Full name
    const firstName = leadInfo.first_name || '';
    const lastName = leadInfo.last_name || '';
    result.full_name = [firstName, lastName].filter(Boolean).join(' ') || null;
    
    // Phone
    result.phone = leadInfo.phone_number || null;
    
    // Email
    result.email = leadInfo.email || null;
    
    // Address - combine address1 + city + state + postal_code
    const addressParts = [
      leadInfo.address1,
      leadInfo.city,
      leadInfo.state,
      leadInfo.postal_code
    ].filter(Boolean);
    result.address = addressParts.length > 0 ? addressParts.join(', ') : null;
    
    // Vehicle - make from address2, model from address3
    const make = leadInfo.address2 || '';
    const model = leadInfo.address3 || '';
    // Year might be in state field (bad data mapping)
    let year = extractYear(leadInfo.state) || extractYear(leadInfo.address1) || '';
    
    if (make || model || year) {
      result.vehicle = {
        year: year || null,
        make: make || null,
        model: model || null,
      };
    }
    
    // Agent from API 1 (will be overwritten by API 2 if available)
    result.agent = leadInfo.user || null;
  } else {
    result.missing_fields.push('lead_info');
  }

  // From Call History (API 2) - TRUST THIS FOR DISPOSITION
  if (callHistory && callHistory.length > 0) {
    // Get most recent call (first in array, should be sorted newest first)
    const latestCall = callHistory[0];
    
    result.call_details = {
      call_date: latestCall.call_date || null,
      duration_seconds: parseInt(latestCall.length_in_sec || '0', 10),
      disposition: latestCall.lead_status || latestCall.status || null, // ALWAYS use API 2 disposition
      hangup: latestCall.hangup_reason || null,
    };
    
    // Agent from API 2 takes priority
    if (latestCall.user) {
      result.agent = latestCall.user;
    }
  } else {
    result.call_details = null;
  }

  // From Recordings (API 3)
  if (recordings && recordings.length > 0) {
    // Get most recent recording
    const latestRecording = recordings[0];
    result.recording = latestRecording.location || null;
  } else {
    result.recording = null;
  }

  // Clean up missing_fields
  if (result.missing_fields.length === 0) {
    delete result.missing_fields;
  }

  return result;
}

export function useSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialerConfig, setDialerConfig] = useState(null);
  const [dialerLoading, setDialerLoading] = useState(true);

  // Fetch dialer config on mount
  useEffect(() => {
    async function fetchDialerConfig() {
      try {
        const res = await api.get('/dialer-config');
        if (res.data.config?.is_active) {
          setDialerConfig(res.data.config);
        }
      } catch (err) {
        console.log('Dialer config not available:', err.message);
      } finally {
        setDialerLoading(false);
      }
    }
    fetchDialerConfig();
  }, []);

  // Fetch from ViciDial via server proxy (bypasses CORS)
  async function fetchViciDial(phoneDigits) {
    if (!dialerConfig?.is_active) {
      return null;
    }

    let leadId = null;
    let leadInfo = null;
    let callHistory = [];
    let recordings = [];
    const errors = [];

    try {
      // API 1: Lead Search by Phone → get lead_id (via server proxy)
      const leadSearchRes = await api.post('/vicidial-proxy/lead-search', { 
        phone_number: phoneDigits 
      });
      
      console.log('Lead search response:', leadSearchRes.data);
      
      if (leadSearchRes.data.success && leadSearchRes.data.data) {
        const leadSearchData = parseViciDialResponse(leadSearchRes.data.data);
        console.log('Parsed lead search:', leadSearchData);
        if (leadSearchData.data?.length > 0) {
          leadId = leadSearchData.data[0]?.lead_id;
          console.log('Found lead_id:', leadId);
        }
      }

      // API 1b: Lead All Info (if we have lead_id)
      if (leadId) {
        const leadInfoRes = await api.post('/vicidial-proxy/lead-info', { 
          lead_id: leadId 
        });
        console.log('Lead info response:', leadInfoRes.data);
        if (leadInfoRes.data.success && leadInfoRes.data.data) {
          leadInfo = parseLeadAllInfo(leadInfoRes.data.data);
          console.log('Parsed lead info:', leadInfo);
        }
      }
    } catch (err) {
      console.error('ViciDial lead search error:', err);
      errors.push('lead_search');
    }

    try {
      // API 2: Phone Number Log (call history) - CRITICAL for disposition
      const callLogRes = await api.post('/vicidial-proxy/phone-log', { 
        phone_number: phoneDigits 
      });
      console.log('Call log response:', callLogRes.data);
      if (callLogRes.data.success && callLogRes.data.data) {
        const callLogData = parseViciDialResponse(callLogRes.data.data);
        console.log('Parsed call log:', callLogData);
        callHistory = callLogData.data || [];
      }
    } catch (err) {
      console.error('ViciDial call log error:', err);
      errors.push('phone_number_log');
    }

    try {
      // API 3: Recording Lookup (if we have lead_id)
      if (leadId) {
        const recordingRes = await api.post('/vicidial-proxy/recording', { 
          lead_id: leadId 
        });
        console.log('Recording response:', recordingRes.data);
        if (recordingRes.data.success && recordingRes.data.data) {
          const recordingData = parseViciDialResponse(recordingRes.data.data);
          recordings = recordingData.data || [];
        }
      }
    } catch (err) {
      console.error('ViciDial recording lookup error:', err);
      errors.push('recording_lookup');
    }

    // Normalize all data into clean format
    const normalized = normalizeViciDialData(leadInfo, callHistory, recordings);
    console.log('Normalized ViciDial data:', normalized);

    return {
      lead_id: leadId,
      normalized: normalized,
      raw: {
        lead_info: leadInfo,
        call_history: callHistory,
        recordings: recordings,
      },
      errors: errors.length > 0 ? errors : null,
    };
  }

  const searchNumber = useCallback(
    debounce(async (phone) => {
      if (!phone || phone.replace(/\D/g, '').length < 10) {
        setResult(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const phoneDigits = phone.replace(/\D/g, '').slice(-10);
        
        // Fetch CRM data from server
        const crmResponse = await api.get('/search/number', {
          params: { q: phone },
        });
        
        // Fetch ViciDial data from client (if configured)
        let vicidialData = null;
        if (dialerConfig?.is_active) {
          vicidialData = await fetchViciDial(phoneDigits);
        }

        setResult({
          ...crmResponse.data,
          vicidial: vicidialData,
          vicidial_available: !!vicidialData && !vicidialData.errors?.length,
        });
      } catch (err) {
        setError(err.response?.data?.error || 'Search failed');
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [dialerConfig]
  );

  const handleQueryChange = (value) => {
    // Strip non-digits except + for display
    const cleaned = value.replace(/[^\d+\-() ]/g, '');
    setQuery(cleaned);
    searchNumber(cleaned);
  };

  const submitSearch = async () => {
    if (!query || query.replace(/\D/g, '').length < 10) {
      setError('Please enter at least 10 digits');
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const phoneDigits = query.replace(/\D/g, '').slice(-10);
      
      // Fetch CRM data from server
      const crmResponse = await api.get('/search/number', {
        params: { q: query },
        timeout: 10000,
      });
      
      // Fetch ViciDial data from client (if configured)
      let vicidialData = null;
      if (dialerConfig?.is_active) {
        vicidialData = await fetchViciDial(phoneDigits);
      }

      setResult({
        ...crmResponse.data,
        vicidial: vicidialData,
        vicidial_available: !!vicidialData && !vicidialData.errors?.length,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResult(null);
    setError(null);
  };

  return {
    query,
    result,
    isLoading,
    error,
    handleQueryChange,
    clearSearch,
    submitSearch,
    dialerConfig,
    dialerLoading,
  };
}

