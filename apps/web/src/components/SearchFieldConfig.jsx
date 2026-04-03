import { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import axios from '../lib/axios';

const FIELDS = [
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'customer_phone', label: 'Customer Phone' },
  { key: 'customer_email', label: 'Customer Email' },
  { key: 'customer_address', label: 'Customer Address' },
  { key: 'customer_dob', label: 'Customer DOB' },
  { key: 'customer_gender', label: 'Customer Gender' },
  { key: 'car_make', label: 'Car Make' },
  { key: 'car_model', label: 'Car Model' },
  { key: 'car_year', label: 'Car Year' },
  { key: 'car_miles', label: 'Car Miles' },
  { key: 'car_vin', label: 'Car VIN' },
  { key: 'plan', label: 'Plan' },
  { key: 'client', label: 'Client' },
  { key: 'down_payment', label: 'Down Payment' },
  { key: 'monthly_payment', label: 'Monthly Payment' },
  { key: 'reference_no', label: 'Reference No' },
  { key: 'next_payment_note', label: 'Next Payment Note' },
  { key: 'closer_name', label: 'Closer Name' },
  { key: 'fronter_name', label: 'Fronter Name' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'disposition_code', label: 'Disposition Code' },
];

export default function SearchFieldConfig() {
  const [role, setRole] = useState('closer');
  const [scope, setScope] = useState('global');
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchConfig();
  }, [role, scope]);

  const fetchConfig = async () => {
    try {
      const { data } = await axios.get('/search-config');
      setFields(data.fields || {});
      setError('');
    } catch (err) {
      setError('Failed to fetch config');
      console.error(err);
    }
  };

  const toggleField = (key) => {
    setFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.patch('/search-config', {
        scope,
        role,
        fields,
      });
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save config');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const defaultFields = Object.fromEntries(FIELDS.map(f => [f.key, true]));
    setFields(defaultFields);
  };

  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 border border-cream-200 dark:border-dark-800 shadow-lg">
      <h2 className="text-xl font-bold text-primary-800 dark:text-primary-200 mb-6">
        Search Field Visibility
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
          >
            <option value="closer">Closer</option>
            <option value="company_admin">Company Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Scope
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
          >
            <option value="global">Global</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Global applies to all companies
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="bg-cream-50 dark:bg-dark-800 rounded-lg p-4 mb-6 border border-cream-200 dark:border-dark-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Toggle fields to show/hide in search results for {role} role
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FIELDS.map((field) => (
            <label
              key={field.key}
              className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-cream-100 dark:hover:bg-dark-700 transition"
            >
              <input
                type="checkbox"
                checked={fields[field.key] !== false}
                onChange={() => toggleField(field.key)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition font-medium"
        >
          <Save size={18} /> Save Configuration
        </button>
        <button
          onClick={handleReset}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg transition font-medium"
        >
          <RotateCcw size={18} /> Reset to Defaults
        </button>
      </div>
    </div>
  );
}
