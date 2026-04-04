import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useSearch } from '../hooks/useSearch';
import { SearchIcon } from 'lucide-animated';
import { Phone, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';
import { formatDateTime, cn, normalizePhone } from '../lib/utils';
import CallbacksManager from '../components/CallbacksManager';
import NewPolicyForm from '../components/NewPolicyForm';
import CloserRecordForm from '../components/CloserRecordForm';

// Number Search component
function NumberSearch() {
  const { query, result, isLoading, error, handleQueryChange, clearSearch, submitSearch } = useSearch();
  const [showNewPolicy, setShowNewPolicy] = useState(false);

  return (
    <>
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-800/60">
        <h2 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-4">
          Number Search
        </h2>
        
        <div className="relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitSearch();
              }
            }}
            placeholder="Enter phone number..."
            className="w-full pl-10 pr-24 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          />
          <button
            type="button"
            onClick={submitSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold transition-colors"
          >
            Search
          </button>
          {isLoading && (
            <Loader2 className="absolute right-20 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400 animate-spin" />
          )}
        </div>

        {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

        {result && (
          <div className={cn(
            'mt-4 p-4 rounded-lg flex items-center justify-between',
            result.sold
              ? 'bg-red-50 dark:bg-red-900/50'
              : 'bg-green-50 dark:bg-green-900/50'
          )}>
            <div className="flex items-center gap-3">
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
                  <p className="text-sm text-primary-500 dark:text-primary-400">
                    {result.phone}
                  </p>
                  <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">
                    Source: {result.source === 'cache' ? 'Redis cache' : 'Database'}
                  </p>
                </div>
              </div>

            {result.sold && (
              <button
                onClick={() => setShowNewPolicy(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition"
              >
                <Plus size={18} /> New Policy
              </button>
            )}
          </div>
        )}

        {(query || result || error) && (
          <button
            type="button"
            onClick={clearSearch}
            className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Clear Search
          </button>
        )}
      </div>

      {showNewPolicy && result?.sold && (
        <NewPolicyForm
          existingOutcome={result}
          onClose={() => setShowNewPolicy(false)}
          onSuccess={() => {
            setShowNewPolicy(false);
            clearSearch();
            toast.success('New policy created!');
          }}
        />
      )}
    </>
  );
}

// Outcome Form component
function OutcomeForm({ onSubmit }) {
  const [transfers, setTransfers] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [formData, setFormData] = useState({
    transfer_id: '',
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
        const [transfersRes, dispositionsRes] = await Promise.all([
          api.get('/transfers?limit=100&page=1'),
          api.get('/dispositions'),
        ]);
        setTransfers(transfersRes.data.transfers || []);
        setDispositions(dispositionsRes.data.dispositions || []);
      } catch (error) {
        console.error('Failed to fetch form data:', error);
        toast.error('Failed to load form options');
      }
    }
    fetchData();
  }, []);

  function handleTransferSelect(transferId) {
    const selected = transfers.find((t) => t.id === transferId);
    if (!selected) {
      setFormData((prev) => ({
        ...prev,
        transfer_id: '',
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      transfer_id: selected.id,
      company_id: selected.company_id || '',
      customer_name: selected.customer_name || '',
      customer_phone: selected.customer_phone || '',
    }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/outcomes', {
        ...formData,
        transfer_id: formData.transfer_id || null,
        customer_phone: normalizePhone(formData.customer_phone),
        remarks: formData.remarks || null,
      });
      toast.success('Outcome submitted successfully!');
      setFormData({
        transfer_id: '',
        company_id: '',
        customer_phone: '',
        customer_name: '',
        disposition_id: '',
        remarks: '',
      });
      onSubmit?.();
    } catch (error) {
      console.error('Failed to submit outcome:', error);
      toast.error(error.response?.data?.error || 'Failed to submit outcome');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-800/60">
      <h2 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-4">
        Record Outcome
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              Linked Transfer (Optional)
            </label>
            <select
              value={formData.transfer_id}
              onChange={(e) => handleTransferSelect(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            >
              <option value="">Manual entry...</option>
              {transfers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.customer_name} ({t.customer_phone}) - {t.company?.display_name || 'Unknown Company'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              Company
            </label>
            <select
              value={formData.company_id}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            >
              <option value="">Select company...</option>
              {Array.from(
                new Map(
                  transfers
                    .filter((t) => t.company_id && t.company?.display_name)
                    .map((t) => [t.company_id, { id: t.company_id, display_name: t.company.display_name }])
                ).values()
              ).map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              Disposition
            </label>
            <select
              value={formData.disposition_id}
              onChange={(e) => setFormData({ ...formData, disposition_id: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            >
              <option value="">Select disposition...</option>
              {dispositions.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
              Customer Phone
            </label>
            <input
              type="tel"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            Remarks
          </label>
          <textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 hover:from-primary-600 hover:to-primary-500 disabled:opacity-70 text-white font-medium rounded-xl transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Outcome'
          )}
        </button>
      </form>
    </div>
  );
}

function Overview() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">
        Closer Dashboard
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NumberSearch />
      </div>

      <div>
        <CloserRecordForm onSuccess={() => setRefreshKey((v) => v + 1)} />
      </div>

      <div key={refreshKey}>
        <OutcomesTable compact />
      </div>
    </div>
  );
}

function Outcomes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">My Outcomes</h1>
      <OutcomesTable />
    </div>
  );
}

function Callbacks() {
  return <CallbacksManager title="My Callbacks" />;
}

function OutcomesTable({ compact = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function fetchOutcomes() {
      try {
        const res = await api.get('/outcomes?limit=100&page=1');
        setItems(res.data.outcomes || []);
      } catch (error) {
        console.error('Failed to fetch outcomes:', error);
        toast.error('Failed to load outcomes');
      } finally {
        setLoading(false);
      }
    }
    fetchOutcomes();
  }, []);

  const filtered = items.filter((o) => {
    const q = query.toLowerCase();
    return (
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').toLowerCase().includes(q) ||
      (o.dispositions?.label || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="h-32 rounded-xl bg-cream-200 dark:bg-dark-800 animate-pulse" />;
  }

  return (
    <div className="bg-white/80 dark:bg-dark-900/80 rounded-2xl border border-cream-200/60 dark:border-dark-800/60 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-cream-200/60 dark:border-dark-800/60 flex items-center justify-between">
        <h3 className="font-semibold text-primary-800 dark:text-primary-200">{compact ? 'Recent Outcomes' : 'Outcome History'}</h3>
        <div className="relative w-64 max-w-full">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search outcomes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-sm text-primary-800 dark:text-primary-100"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Disposition</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-800">
            {filtered.slice(0, compact ? 8 : filtered.length).map((o) => (
              <tr key={o.id} className="hover:bg-cream-50 dark:hover:bg-dark-800/40">
                <td className="px-4 py-3 text-sm text-primary-800 dark:text-primary-100">{o.customer_name}</td>
                <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{o.customer_phone}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-lg text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                    {o.dispositions?.label || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-primary-500 dark:text-primary-400">{formatDateTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="p-4 text-sm text-primary-500 dark:text-primary-400">No outcomes found.</p>}
    </div>
  );
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
