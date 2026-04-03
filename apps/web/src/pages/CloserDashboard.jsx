import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../lib/axios';
import { useSearch } from '../hooks/useSearch';
import {
  Phone,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { formatDateTime, cn } from '../lib/utils';

// Number Search component
function NumberSearch() {
  const { query, result, isLoading, error, handleQueryChange, clearSearch } = useSearch();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Number Search
      </h2>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Enter phone number..."
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className={cn(
          'mt-4 p-4 rounded-lg flex items-center gap-3',
          result.sold
            ? 'bg-red-50 dark:bg-red-900/50'
            : 'bg-green-50 dark:bg-green-900/50'
        )}>
          {result.sold ? (
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          )}
          <div>
            <p className={cn(
              'font-semibold',
              result.sold
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            )}>
              {result.sold ? 'SOLD' : 'NOT SOLD'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {result.phone}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Outcome Form component
function OutcomeForm({ onSubmit }) {
  const [companies, setCompanies] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [formData, setFormData] = useState({
    company_id: '',
    customer_phone: '',
    customer_name: '',
    disposition_id: '',
    remarks: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [companiesRes, dispositionsRes] = await Promise.all([
          api.get('/companies'),
          api.get('/dispositions'),
        ]);
        setCompanies(companiesRes.data.companies?.filter(c => c.is_active) || []);
        setDispositions(dispositionsRes.data.dispositions || []);
      } catch (error) {
        console.error('Failed to fetch form data:', error);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/outcomes', formData);
      setFormData({
        company_id: '',
        customer_phone: '',
        customer_name: '',
        disposition_id: '',
        remarks: '',
      });
      onSubmit?.();
    } catch (error) {
      console.error('Failed to submit outcome:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Record Outcome
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company
            </label>
            <select
              value={formData.company_id}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Disposition
            </label>
            <select
              value={formData.disposition_id}
              onChange={(e) => setFormData({ ...formData, disposition_id: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select disposition...</option>
              {dispositions.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer Phone
            </label>
            <input
              type="tel"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Remarks
          </label>
          <textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Submitting...' : 'Submit Outcome'}
        </button>
      </form>
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Closer Dashboard
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OutcomeForm />
        <NumberSearch />
      </div>
    </div>
  );
}

function Outcomes() {
  return <div className="text-gray-900 dark:text-white">My Outcomes - Coming soon</div>;
}

function Callbacks() {
  return <div className="text-gray-900 dark:text-white">Callbacks - Coming soon</div>;
}

export default function CloserDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="outcomes/*" element={<Outcomes />} />
      <Route path="callbacks/*" element={<Callbacks />} />
    </Routes>
  );
}
