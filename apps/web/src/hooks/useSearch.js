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

  // Fetch from ViciDial (client-side)
  async function fetchViciDial(phoneDigits) {
    if (!dialerConfig?.is_active || !dialerConfig?.dialer_url) {
      return null;
    }

    const baseUrl = `${dialerConfig.dialer_url}${dialerConfig.api_path || '/vicidial/non_agent_api.php'}`;
    const baseParams = `user=${dialerConfig.api_user}&pass=${dialerConfig.api_pass}&source=test&stage=pipe&header=YES`;

    try {
      // 1. Lead Search by Phone
      const leadSearchUrl = `${baseUrl}?function=lead_search&${baseParams}&phone_number=${phoneDigits}`;
      const leadSearchRes = await fetch(leadSearchUrl, { mode: 'cors' });
      const leadSearchText = await leadSearchRes.text();
      const leadSearchData = parseViciDialResponse(leadSearchText);

      let leadId = null;
      let leadInfo = null;

      if (leadSearchData.data?.length > 0) {
        leadId = leadSearchData.data[0]?.lead_id;
        
        // 2. Lead All Info (if we have lead_id)
        if (leadId) {
          const leadInfoUrl = `${baseUrl}?function=lead_all_info&${baseParams}&lead_id=${leadId}`;
          const leadInfoRes = await fetch(leadInfoUrl, { mode: 'cors' });
          const leadInfoText = await leadInfoRes.text();
          const leadInfoData = parseViciDialResponse(leadInfoText);
          if (leadInfoData.data?.length > 0) {
            leadInfo = leadInfoData.data[0];
          }
        }
      }

      // 3. Phone Number Log (call history)
      const callLogUrl = `${baseUrl}?function=phone_number_log&${baseParams}&phone_number=${phoneDigits}&type=ALL`;
      const callLogRes = await fetch(callLogUrl, { mode: 'cors' });
      const callLogText = await callLogRes.text();
      const callLogData = parseViciDialResponse(callLogText);

      return {
        lead_id: leadId,
        lead_info: leadInfo,
        call_history: callLogData.data || [],
        raw_lead_search: leadSearchText,
      };
    } catch (err) {
      console.error('ViciDial fetch error:', err);
      return { error: err.message };
    }
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
          vicidial_available: !!vicidialData && !vicidialData.error,
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
        vicidial_available: !!vicidialData && !vicidialData.error,
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

