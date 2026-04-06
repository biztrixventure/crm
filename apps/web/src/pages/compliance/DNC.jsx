import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

export default function ComplianceDNC() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'compliance_manager';

  if (!isManager) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl p-6">
        <p className="text-yellow-800 dark:text-yellow-300 font-medium">Access Denied</p>
        <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">Only compliance managers can manage the DNC list.</p>
      </div>
    );
  }
  const [dncList, setDncList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchDNCList();
  }, []);

  async function fetchDNCList() {
    try {
      const res = await api.get('/compliance/dnc?limit=100');
      setDncList(res.data.dnc_list || []);
    } catch (error) {
      console.error('Failed to fetch DNC list:', error);
      toast.error('Failed to load DNC list');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDNC(e) {
    e.preventDefault();
    if (!phone) {
      toast.error('Phone number is required');
      return;
    }

    try {
      await api.post('/compliance/dnc', { phone_number: phone, reason, notes });
      toast.success('Number added to DNC list');
      setPhone('');
      setReason('');
      setNotes('');
      setShowForm(false);
      fetchDNCList();
    } catch (error) {
      console.error('Failed to add to DNC:', error);
      toast.error(error.response?.data?.message || 'Failed to add number to DNC');
    }
  }

  async function handleRemoveDNC(id) {
    if (!window.confirm('Are you sure you want to remove this number from DNC?')) return;

    try {
      await api.patch(`/compliance/dnc/${id}`);
      toast.success('Number removed from DNC list');
      fetchDNCList();
    } catch (error) {
      console.error('Failed to remove from DNC:', error);
      toast.error('Failed to remove number');
    }
  }

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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">DNC List Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Number
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg p-6 border border-cream-200/50 dark:border-dark-700/50">
          <form onSubmit={handleAddDNC} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567 or 5551234567"
                className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Customer request, fraud, etc."
                className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 h-20 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                Add to DNC
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-cream-200 dark:bg-dark-700 text-primary-900 dark:text-primary-100 rounded-lg transition-colors hover:bg-cream-300 dark:hover:bg-dark-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-hidden border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Phone Number</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Reason</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Notes</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Added By</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date Added</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-primary-900 dark:text-primary-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {dncList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No numbers on DNC list
                </td>
              </tr>
            ) : (
              dncList.map((entry) => (
                <tr key={entry.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-primary-900 dark:text-primary-100">
                    {entry.phone_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {entry.reason || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400 max-w-xs truncate">
                    {entry.notes || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {entry.added_by_user?.full_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRemoveDNC(entry.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
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
