import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function ComplianceRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await api.get('/compliance/records?limit=100');
        setRecords(res.data.records || []);
      } catch (error) {
        console.error('Failed to fetch records:', error);
        toast.error('Failed to load records');
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
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
      <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">Closer Records</h2>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-x-auto border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600 sticky top-0">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Closer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">VIN</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Reference</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Company</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No records found
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400 whitespace-nowrap">
                    {new Date(record.record_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">
                    {record.closer?.full_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-900 dark:text-primary-100">
                    {record.customer_name}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-primary-600 dark:text-primary-400 whitespace-nowrap">
                    {record.vin?.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {record.reference_no}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {record.company?.display_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      {record.status}
                    </span>
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
