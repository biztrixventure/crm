import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Save, Loader2, Phone, Link, User, Key, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function DialerSettings() {
  const [config, setConfig] = useState({
    dialer_url: '',
    api_user: '',
    api_pass: '',
    api_path: '/vicidial/non_agent_api.php',
    is_active: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await api.get('/dialer-config');
      if (res.data.config) {
        setConfig({
          dialer_url: res.data.config.dialer_url || '',
          api_user: res.data.config.api_user || '',
          api_pass: res.data.config.api_pass || '',
          api_path: res.data.config.api_path || '/vicidial/non_agent_api.php',
          is_active: res.data.config.is_active || false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch dialer config:', error);
      toast.error('Failed to load dialer settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put('/dialer-config', config);
      toast.success('Dialer settings saved!');
    } catch (error) {
      console.error('Failed to save dialer config:', error);
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!config.dialer_url || !config.api_user || !config.api_pass) {
      toast.error('Please fill all required fields first');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Build test URL for client-side request
      const testUrl = `${config.dialer_url}${config.api_path}?function=lead_search&user=${config.api_user}&pass=${config.api_pass}&source=test&phone_number=0000000000&stage=pipe&header=YES`;
      
      const response = await fetch(testUrl, {
        method: 'GET',
        mode: 'cors',
      });
      
      const text = await response.text();
      
      if (text.includes('ERROR') || !response.ok) {
        setTestResult({ success: false, message: text || 'Connection failed' });
      } else {
        setTestResult({ success: true, message: 'Connection successful! API is responding.' });
      }
    } catch (error) {
      console.error('Dialer test error:', error);
      setTestResult({ 
        success: false, 
        message: `Connection failed: ${error.message}. This may be a CORS issue - the dialer may still work from closer browsers.`
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Dialer Settings</h1>
        <div className="h-64 rounded-xl bg-cream-200 dark:bg-dark-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Dialer Settings</h1>
          <p className="text-sm text-primary-500 dark:text-primary-400 mt-1">
            Configure ViciDial connection for closer number search
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.is_active ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
              <CheckCircle size={16} /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium">
              <XCircle size={16} /> Inactive
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Client-Side API Calls</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              API calls to the dialer are made directly from the closer's browser (not the server). 
              This is required because the dialer may not respond to server-side requests. 
              Credentials will be visible in browser network requests.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-800/60 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              <Link size={16} className="inline mr-1.5" />
              Dialer URL
            </label>
            <input
              type="url"
              value={config.dialer_url}
              onChange={(e) => setConfig({ ...config, dialer_url: e.target.value })}
              placeholder="https://wavetechnew.i5.tel"
              className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            />
            <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">
              Base URL of the ViciDial server (without trailing slash)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              <User size={16} className="inline mr-1.5" />
              API Username
            </label>
            <input
              type="text"
              value={config.api_user}
              onChange={(e) => setConfig({ ...config, api_user: e.target.value })}
              placeholder="apiuser"
              className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              <Key size={16} className="inline mr-1.5" />
              API Password
            </label>
            <input
              type="text"
              value={config.api_pass}
              onChange={(e) => setConfig({ ...config, api_pass: e.target.value })}
              placeholder="apiuser123"
              className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              <Phone size={16} className="inline mr-1.5" />
              API Path
            </label>
            <input
              type="text"
              value={config.api_path}
              onChange={(e) => setConfig({ ...config, api_path: e.target.value })}
              placeholder="/vicidial/non_agent_api.php"
              className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            />
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.is_active}
                onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                className="w-5 h-5 rounded border-2 border-primary-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                Enable Dialer Integration
              </span>
            </label>
          </div>
        </div>

        {testResult && (
          <div className={`p-4 rounded-xl ${testResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              )}
              <p className={`text-sm ${testResult.success 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
              }`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-cream-200 dark:border-dark-700">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-400 hover:from-primary-600 hover:to-primary-500 disabled:opacity-70 text-white font-medium rounded-xl transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Settings
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !config.dialer_url || !config.api_user || !config.api_pass}
            className="flex items-center gap-2 px-6 py-3 border-2 border-primary-300 dark:border-dark-600 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-dark-800 disabled:opacity-50 font-medium rounded-xl transition-all"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <ExternalLink size={18} />
                Test Connection
              </>
            )}
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-800/60">
        <h2 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-4">API Endpoints Used</h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-cream-50 dark:bg-dark-800 rounded-lg">
            <p className="font-medium text-primary-700 dark:text-primary-300">1. Lead Search (by phone)</p>
            <code className="text-xs text-primary-500 dark:text-primary-400 break-all">
              ?function=lead_search&phone_number=PHONENUMBER&stage=pipe&header=YES
            </code>
          </div>
          <div className="p-3 bg-cream-50 dark:bg-dark-800 rounded-lg">
            <p className="font-medium text-primary-700 dark:text-primary-300">2. Phone Number Log (call history)</p>
            <code className="text-xs text-primary-500 dark:text-primary-400 break-all">
              ?function=phone_number_log&phone_number=PHONENUMBER&stage=pipe&header=YES&type=ALL
            </code>
          </div>
          <div className="p-3 bg-cream-50 dark:bg-dark-800 rounded-lg">
            <p className="font-medium text-primary-700 dark:text-primary-300">3. Lead All Info (full details)</p>
            <code className="text-xs text-primary-500 dark:text-primary-400 break-all">
              ?function=lead_all_info&lead_id=LEADID&stage=pipe&header=YES
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
