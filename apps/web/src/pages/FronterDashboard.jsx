import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { PlusIcon, SearchIcon } from 'lucide-animated';
import { Phone, Send, Loader2 } from 'lucide-react';
import { formatDateTime, cn, normalizePhone } from '../lib/utils';
import CallbacksManager from '../components/CallbacksManager';

const initialForm = {
  closer_id: '',
  customer_name: '',
  customer_phone: '',
  car_make: '',
  car_model: '',
  car_year: '',
  zip_code: '',
  city: '',
  state: '',
  miles: '',
  notes: '',
};

function TransferForm({ onSubmit }) {
  const [closers, setClosers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchClosers() {
      try {
        const response = await api.get('/users/closers/list');
        setClosers(response.data.closers || []);
      } catch (error) {
        console.error('Failed to fetch closers:', error);
        toast.error('Failed to load closers');
      }
    }
    fetchClosers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        customer_phone: normalizePhone(formData.customer_phone),
        car_make: formData.car_make || null,
        car_model: formData.car_model || null,
        car_year: formData.car_year || null,
        zip_code: formData.zip_code || null,
        city: formData.city || null,
        state: formData.state || null,
        miles: formData.miles || null,
        notes: formData.notes || null,
      };
      await api.post('/transfers', payload);
      toast.success('Transfer submitted successfully!');
      setFormData(initialForm);
      onSubmit?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit transfer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-800/60">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/40">
          <Phone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-primary-800 dark:text-primary-200">New Transfer</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldSelect label="Closer *" required value={formData.closer_id} onChange={(v) => setFormData((s) => ({ ...s, closer_id: v }))}>
            <option value="">Select closer...</option>
            {closers.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </FieldSelect>

          <FieldInput label="Customer Name *" required value={formData.customer_name} onChange={(v) => setFormData((s) => ({ ...s, customer_name: v }))} />
          <FieldInput label="Customer Phone *" required value={formData.customer_phone} onChange={(v) => setFormData((s) => ({ ...s, customer_phone: v }))} placeholder="+1 555 123 4567" />
          <FieldInput label="Car Make" value={formData.car_make} onChange={(v) => setFormData((s) => ({ ...s, car_make: v }))} />
          <FieldInput label="Car Model" value={formData.car_model} onChange={(v) => setFormData((s) => ({ ...s, car_model: v }))} />
          <FieldInput label="Car Year" value={formData.car_year} onChange={(v) => setFormData((s) => ({ ...s, car_year: v }))} maxLength={4} />
          <FieldInput label="ZIP Code" value={formData.zip_code} onChange={(v) => setFormData((s) => ({ ...s, zip_code: v }))} />
          <FieldInput label="City" value={formData.city} onChange={(v) => setFormData((s) => ({ ...s, city: v }))} />
          <FieldInput label="State" value={formData.state} onChange={(v) => setFormData((s) => ({ ...s, state: v }))} />
          <FieldInput label="Miles" value={formData.miles} onChange={(v) => setFormData((s) => ({ ...s, miles: v }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 hover:from-primary-600 hover:to-primary-500 text-white font-medium rounded-xl transition-all disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit Transfer
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function FieldInput({ label, value, onChange, required, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
        {...rest}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
      >
        {children}
      </select>
    </div>
  );
}

function TransfersTable({ compact = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  async function fetchTransfers() {
    try {
      const res = await api.get('/transfers?limit=50&page=1');
      setItems(res.data.transfers || []);
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransfers();
  }, []);

  const filtered = items.filter((t) => {
    const q = query.toLowerCase();
    return (
      (t.customer_name || '').toLowerCase().includes(q) ||
      (t.customer_phone || '').toLowerCase().includes(q) ||
      (t.closer?.full_name || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="h-32 rounded-xl bg-cream-200 dark:bg-dark-800 animate-pulse" />;
  }

  return (
    <div className="bg-white/80 dark:bg-dark-900/80 rounded-2xl border border-cream-200/60 dark:border-dark-800/60 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-cream-200/60 dark:border-dark-800/60 flex items-center justify-between">
        <h3 className="font-semibold text-primary-800 dark:text-primary-200">{compact ? 'Recent Transfers' : 'My Transfers'}</h3>
        <div className="relative w-64 max-w-full">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
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
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Closer</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-800">
            {filtered.slice(0, compact ? 8 : filtered.length).map((t) => (
              <tr key={t.id} className="hover:bg-cream-50 dark:hover:bg-dark-800/40">
                <td className="px-4 py-3 text-sm text-primary-800 dark:text-primary-100">{t.customer_name}</td>
                <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{t.customer_phone}</td>
                <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{t.closer?.full_name || '-'}</td>
                <td className="px-4 py-3 text-xs text-primary-500 dark:text-primary-400">{formatDateTime(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="p-4 text-sm text-primary-500 dark:text-primary-400">No transfers found.</p>}
    </div>
  );
}

function Overview() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Fronter Dashboard</h1>
        <button
          onClick={() => setRefreshKey((v) => v + 1)}
          className="px-3 py-2 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm flex items-center gap-2"
        >
          <PlusIcon size={16} />
          Refresh
        </button>
      </div>
      <TransferForm onSubmit={() => setRefreshKey((v) => v + 1)} />
      <div key={refreshKey}>
        <TransfersTable compact />
      </div>
    </div>
  );
}

function Transfers() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">My Transfers</h1>
      <TransfersTable />
    </div>
  );
}

function Numbers() {
  return <div className="text-primary-800 dark:text-primary-200">My Numbers - Coming soon</div>;
}

function Callbacks() {
  return <CallbacksManager title="My Callbacks" />;
}

export default function FronterDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="transfers/*" element={<Transfers />} />
      <Route path="numbers/*" element={<Numbers />} />
      <Route path="callbacks/*" element={<Callbacks />} />
    </Routes>
  );
}
