import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function CloserManagerTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransfers() {
      try {
        const res = await api.get('/closer-manager/transfers?limit=100');
        setTransfers(res.data.transfers || []);
      } catch (error) {
        console.error('Failed to fetch transfers:', error);
        toast.error('Failed to load transfers');
      } finally {
        setLoading(false);
      }
    }
    fetchTransfers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">All Transfers (Read-Only)</h2>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-hidden border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Fronter</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Closer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Company</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No transfers found
                </td>
              </tr>
            ) : (
              transfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {new Date(transfer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">
                    {transfer.fronter?.full_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">
                    {transfer.closer?.full_name || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {transfer.company?.display_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {transfer.customer_phone || 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
