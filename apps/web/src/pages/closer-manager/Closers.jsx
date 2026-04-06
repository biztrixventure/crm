import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Plus, Edit2, Trash2 } from 'lucide-react';

export default function CloserManagerClosers() {
  const [closers, setClosers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClosers() {
      try {
        const res = await api.get('/closer-manager/closers?limit=50');
        setClosers(res.data.closers || []);
      } catch (error) {
        console.error('Failed to fetch closers:', error);
        toast.error('Failed to load closers');
      } finally {
        setLoading(false);
      }
    }
    fetchClosers();
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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">All Closers</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
          <Plus size={18} />
          Add Closer
        </button>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-hidden border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Joined</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-primary-900 dark:text-primary-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {closers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No closers found
                </td>
              </tr>
            ) : (
              closers.map((closer) => (
                <tr key={closer.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">{closer.full_name}</td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">{closer.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      closer.is_active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {closer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {new Date(closer.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm flex justify-end gap-2">
                    <button className="p-2 hover:bg-primary-100 dark:hover:bg-dark-600 rounded-lg transition-colors">
                      <Edit2 size={16} className="text-primary-600 dark:text-primary-400" />
                    </button>
                    <button className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                    </button>
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
