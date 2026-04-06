import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Trophy } from 'lucide-react';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
];

export default function CloserManagerPerformance() {
  const [period, setPeriod] = useState('today');
  const [closers, setClosers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPerformance() {
      setLoading(true);
      try {
        const res = await api.get(`/closer-manager/performance?period=${period}`);
        setClosers(res.data.leaderboard || []);
      } catch (error) {
        console.error('Failed to fetch performance:', error);
        toast.error('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    }
    fetchPerformance();
  }, [period]);

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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">Performance Leaderboard</h2>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                period === p.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-cream-200 dark:bg-dark-700 text-primary-900 dark:text-primary-100 hover:bg-cream-300 dark:hover:bg-dark-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-hidden border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Rank</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Name</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Sales</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Transfers</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Callbacks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {closers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No data available
                </td>
              </tr>
            ) : (
              closers.map((closer, index) => (
                <tr key={closer.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-primary-900 dark:text-primary-100">
                    <div className="flex items-center gap-2">
                      {index < 3 && <Trophy size={18} className={
                        index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-700'
                      } />}
                      #{index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">{closer.full_name}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-green-600 dark:text-green-400">{closer.total_sales}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-blue-600 dark:text-blue-400">{closer.total_transfers}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-primary-600 dark:text-primary-400">{closer.callbacks_pending}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
