import { Router } from 'express';
import axios from 'axios';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to get dialer config
async function getDialerConfig() {
  try {
    const { data, error } = await supabase
      .from('dialer_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error fetching dialer config:', err);
    return null;
  }
}

// POST /vicidial-proxy/lead-search - Search lead by phone number
router.post(
  '/lead-search',
  roleGuard('closer', 'company_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { phone_number } = req.body;

      if (!phone_number) {
        return res.status(400).json({ error: 'phone_number is required' });
      }

      const config = await getDialerConfig();
      if (!config) {
        return res.json({ data: null, success: false, error: 'Dialer not configured' });
      }

      const url = `${config.dialer_url}${config.api_path}?function=lead_search&user=${encodeURIComponent(config.api_user)}&pass=${encodeURIComponent(config.api_pass)}&source=test&phone_number=${encodeURIComponent(phone_number)}&stage=pipe&header=YES`;

      const response = await axios.get(url, { timeout: 15000 });
      res.json({ data: response.data, success: true });
    } catch (err) {
      console.error('ViciDial lead search error:', err.message);
      res.json({ data: null, success: false, error: err.message });
    }
  }
);

// POST /vicidial-proxy/phone-log - Get phone number call log
router.post(
  '/phone-log',
  roleGuard('closer', 'company_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { phone_number } = req.body;

      if (!phone_number) {
        return res.status(400).json({ error: 'phone_number is required' });
      }

      const config = await getDialerConfig();
      if (!config) {
        return res.json({ data: null, success: false, error: 'Dialer not configured' });
      }

      const url = `${config.dialer_url}${config.api_path}?function=phone_number_log&user=${encodeURIComponent(config.api_user)}&pass=${encodeURIComponent(config.api_pass)}&source=test&phone_number=${encodeURIComponent(phone_number)}&stage=pipe&header=YES&type=ALL`;

      const response = await axios.get(url, { timeout: 15000 });
      res.json({ data: response.data, success: true });
    } catch (err) {
      console.error('ViciDial phone log error:', err.message);
      res.json({ data: null, success: false, error: err.message });
    }
  }
);

// POST /vicidial-proxy/lead-info - Get full lead details by lead_id
router.post(
  '/lead-info',
  roleGuard('closer', 'company_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { lead_id } = req.body;

      if (!lead_id) {
        return res.status(400).json({ error: 'lead_id is required' });
      }

      const config = await getDialerConfig();
      if (!config) {
        return res.json({ data: null, success: false, error: 'Dialer not configured' });
      }

      const url = `${config.dialer_url}${config.api_path}?function=lead_all_info&user=${encodeURIComponent(config.api_user)}&pass=${encodeURIComponent(config.api_pass)}&source=test&lead_id=${encodeURIComponent(lead_id)}&stage=pipe&header=YES`;

      const response = await axios.get(url, { timeout: 15000 });
      res.json({ data: response.data, success: true });
    } catch (err) {
      console.error('ViciDial lead info error:', err.message);
      res.json({ data: null, success: false, error: err.message });
    }
  }
);

// POST /vicidial-proxy/recording - Get recording URL by lead_id
router.post(
  '/recording',
  roleGuard('closer', 'company_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { lead_id } = req.body;

      if (!lead_id) {
        return res.status(400).json({ error: 'lead_id is required' });
      }

      const config = await getDialerConfig();
      if (!config) {
        return res.json({ data: null, success: false, error: 'Dialer not configured' });
      }

      const url = `${config.dialer_url}${config.api_path}?function=recording_lookup&user=${encodeURIComponent(config.api_user)}&pass=${encodeURIComponent(config.api_pass)}&source=test&lead_id=${encodeURIComponent(lead_id)}&stage=pipe&header=YES`;

      const response = await axios.get(url, { timeout: 15000 });
      res.json({ data: response.data, success: true });
    } catch (err) {
      console.error('ViciDial recording error:', err.message);
      res.json({ data: null, success: false, error: err.message });
    }
  }
);

// POST /vicidial-proxy/test - Test connection (for admin settings)
router.post(
  '/test',
  roleGuard('super_admin'),
  async (req, res) => {
    try {
      const { dialer_url, api_user, api_pass, api_path } = req.body;

      if (!dialer_url || !api_user || !api_pass) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const path = api_path || '/vicidial/non_agent_api.php';
      const url = `${dialer_url}${path}?function=lead_search&user=${encodeURIComponent(api_user)}&pass=${encodeURIComponent(api_pass)}&source=test&phone_number=0000000000&stage=pipe&header=YES`;

      const response = await axios.get(url, { timeout: 15000 });
      const text = response.data;
      const textStr = typeof text === 'string' ? text : JSON.stringify(text);

      // Check if response indicates success (ViciDial returns specific text)
      const success = !textStr.includes('ERROR');

      res.json({
        success, 
        message: success ? 'Connection successful' : 'Connection failed',
        response: textStr.substring(0, 500) // First 500 chars for debugging
      });
    } catch (err) {
      console.error('ViciDial test error:', err.message);
      res.json({ 
        success: false, 
        error: 'Failed to connect to ViciDial', 
        details: err.message 
      });
    }
  }
);

export default router;
