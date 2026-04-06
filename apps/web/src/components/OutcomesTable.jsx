import { useState, useEffect } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { SearchIcon } from 'lucide-animated';
import { formatDateTime } from '../lib/utils';

export default function OutcomesTable({ compact = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function fetchOutcomes() {
      try {
        const res = await api.get('/outcomes?limit=100&page=1');
        setItems(res.data.outcomes || []);
      } catch (error) {
        console.error('Failed to fetch records:', error);
        toast.error('Failed to load records');
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
        <h3 className="font-semibold text-primary-800 dark:text-primary-200">{compact ? 'Recent Records' : 'Record History'}</h3>
        <div className="relative w-64 max-w-full">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records..."
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
              <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Status</th>
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
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                    o.status === 'SOLD'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-lg text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                    {o.dispositions?.label || o.disposition_id || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-primary-500 dark:text-primary-400">{formatDateTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="p-4 text-sm text-primary-500 dark:text-primary-400">No records found.</p>}
    </div>
  );
}
