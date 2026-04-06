import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

export default function ComplianceBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isManager = user?.role === 'compliance_manager';

  useEffect(() => {
    async function fetchBatches() {
      try {
        const res = await api.get('/compliance/batches?limit=50');
        setBatches(res.data.batches || []);
      } catch (error) {
        console.error('Failed to fetch batches:', error);
        toast.error('Failed to load batches');
      } finally {
        setLoading(false);
      }
    }
    fetchBatches();
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">
          {isManager ? 'Compliance Batches' : 'My Assigned Batches'}
        </h2>
        {isManager && (
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
            <Plus size={18} />
            Create Batch
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-hidden border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Company</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date Range</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Records</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Reviewed</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Flagged</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No batches found
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">
                    {batch.company?.display_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {batch.date_from} to {batch.date_to}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-primary-900 dark:text-primary-100">
                    {batch.total_records}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-primary-900 dark:text-primary-100">
                    {batch.reviewed_records}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-red-600 dark:text-red-400">
                    {batch.flagged_records}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      batch.status === 'pending'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : batch.status === 'in_progress'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {batch.status === 'in_progress' ? 'In Progress' : batch.status === 'completed' ? 'Completed' : 'Pending'}
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
