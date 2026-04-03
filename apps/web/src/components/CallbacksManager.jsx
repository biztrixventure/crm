import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, SearchIcon, XIcon, CheckIcon, SquarePenIcon as EditIcon, DeleteIcon as TrashIcon } from 'lucide-animated';
import api from '../lib/axios';
import { formatDateTime, normalizePhone, cn } from '../lib/utils';

const initialForm = {
  customer_name: '',
  customer_phone: '',
  best_time: '',
  notes: '',
};

export default function CallbacksManager({ title = 'Callbacks' }) {
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
  const [includeFired, setIncludeFired] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  async function fetchCallbacks() {
    try {
      setLoading(true);
      const res = await api.get('/callbacks', { params: { include_fired: includeFired } });
      setCallbacks(res.data.callbacks || []);
    } catch (error) {
      console.error('Failed to fetch callbacks:', error);
      toast.error(error.response?.data?.error || 'Failed to load callbacks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCallbacks();
  }, [includeFired]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return callbacks.filter((c) =>
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_phone || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  }, [callbacks, query]);

  function openCreate() {
    setEditing(null);
    setFormData(initialForm);
    setShowModal(true);
  }

  function openEdit(callback) {
    setEditing(callback);
    setFormData({
      customer_name: callback.customer_name || '',
      customer_phone: callback.customer_phone || '',
      best_time: callback.best_time ? new Date(callback.best_time).toISOString().slice(0, 16) : '',
      notes: callback.notes || '',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setFormData(initialForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      customer_name: formData.customer_name.trim(),
      customer_phone: normalizePhone(formData.customer_phone),
      best_time: new Date(formData.best_time).toISOString(),
      notes: formData.notes?.trim() || null,
    };

    try {
      if (editing) {
        await api.patch(`/callbacks/${editing.id}`, payload);
        toast.success('Callback updated');
      } else {
        await api.post('/callbacks', payload);
        toast.success('Callback created');
      }
      closeModal();
      await fetchCallbacks();
    } catch (error) {
      console.error('Failed to save callback:', error);
      toast.error(error.response?.data?.error || 'Failed to save callback');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(callbackId) {
    if (!window.confirm('Delete this callback?')) return;
    try {
      await api.delete(`/callbacks/${callbackId}`);
      toast.success('Callback deleted');
      await fetchCallbacks();
    } catch (error) {
      console.error('Failed to delete callback:', error);
      toast.error(error.response?.data?.error || 'Failed to delete callback');
    }
  }

  if (loading) {
    return <div className="h-32 rounded-xl bg-cream-200 dark:bg-dark-800 animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">{title}</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 text-white text-sm font-medium flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <PlusIcon size={16} />
          New Callback
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search callbacks..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-900 text-primary-800 dark:text-primary-100"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
          <input
            type="checkbox"
            checked={includeFired}
            onChange={(e) => setIncludeFired(e.target.checked)}
          />
          Show fired callbacks
        </label>
      </div>

      <div className="bg-white/80 dark:bg-dark-900/80 rounded-2xl border border-cream-200/60 dark:border-dark-800/60 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 dark:bg-dark-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Best Time</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-dark-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-cream-50 dark:hover:bg-dark-800/40">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-primary-800 dark:text-primary-100">{c.customer_name}</p>
                    <p className="text-xs text-primary-500 dark:text-primary-400">{c.notes || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{c.customer_phone}</td>
                  <td className="px-4 py-3 text-xs text-primary-600 dark:text-primary-400">{formatDateTime(c.best_time)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-lg text-xs',
                        c.is_fired
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      )}
                    >
                      {c.is_fired ? 'Fired' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        disabled={c.is_fired}
                        className="px-3 py-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <EditIcon size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-1"
                      >
                        <TrashIcon size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-primary-500 dark:text-primary-400">No callbacks found.</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl border border-cream-200 dark:border-dark-800 shadow-2xl">
            <div className="p-4 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-semibold">{editing ? 'Edit Callback' : 'Create Callback'}</h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-white/20">
                <XIcon size={16} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <label className="block text-sm text-primary-700 dark:text-primary-300">
                Customer Name
                <input
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData((s) => ({ ...s, customer_name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                />
              </label>
              <label className="block text-sm text-primary-700 dark:text-primary-300">
                Customer Phone
                <input
                  required
                  value={formData.customer_phone}
                  onChange={(e) => setFormData((s) => ({ ...s, customer_phone: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                />
              </label>
              <label className="block text-sm text-primary-700 dark:text-primary-300">
                Best Time
                <input
                  type="datetime-local"
                  required
                  value={formData.best_time}
                  onChange={(e) => setFormData((s) => ({ ...s, best_time: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                />
              </label>
              <label className="block text-sm text-primary-700 dark:text-primary-300">
                Notes
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData((s) => ({ ...s, notes: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                />
              </label>

              <div className="pt-1 flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 px-3 py-2 rounded-xl bg-cream-200 dark:bg-dark-700 text-primary-700 dark:text-primary-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 text-white flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  <CheckIcon size={14} />
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
