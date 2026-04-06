import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

export default function OperationsCallbacks() {
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchCallbacks() {
      try {
        const res = await api.get('/operations/callbacks?limit=100');
        setCallbacks(res.data.callbacks || []);
      } catch (error) {
        console.error('Failed to fetch callbacks:', error);
        toast.error('Failed to load callbacks');
      } finally {
        setLoading(false);
      }
    }
    fetchCallbacks();
  }, []);

  const filtered = callbacks.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.customer_name?.toLowerCase().includes(q) ||
      c.customer_phone?.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">All Callbacks</h2>
        <p className="text-sm text-primary-600 dark:text-primary-400">Read-only view</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400" />
        <input
          type="text"
          placeholder="Search by customer name, phone, or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-primary-800 dark:text-primary-100"
        />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-x-auto border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full min-w-max">
          <thead className="bg-cream-100 dark:bg-dark-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Best Time</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Notes</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No callbacks found
                </td>
              </tr>
            ) : (
              filtered.map((callback) => (
                <tr key={callback.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50">
                  <td className="px-6 py-4 font-medium text-primary-900 dark:text-primary-100">{callback.customer_name}</td>
                  <td className="px-6 py-4 text-primary-700 dark:text-primary-300">{callback.customer_phone}</td>
                  <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300">{formatDateTime(callback.best_time)}</td>
                  <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300 max-w-xs truncate">{callback.notes || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        callback.is_fired
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      }`}
                    >
                      {callback.is_fired ? 'Completed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">{formatDateTime(callback.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
