import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

export default function CloserManagerClosers() {
  const [closers, setClosers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    is_active: true,
  });

  useEffect(() => {
    fetchClosers();
  }, []);

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

  function openCreateModal() {
    setEditing(null);
    setFormData({
      full_name: '',
      email: '',
      password: '',
      is_active: true,
    });
    setShowModal(true);
  }

  function openEditModal(closer) {
    setEditing(closer);
    setFormData({
      full_name: closer.full_name,
      email: closer.email,
      password: '',
      is_active: closer.is_active,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setFormData({
      full_name: '',
      email: '',
      password: '',
      is_active: true,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!editing && !formData.password) {
      toast.error('Password is required for new closers');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        role: 'closer',
        company_id: null,
      };

      if (editing) {
        // Edit mode
        if (formData.password) {
          payload.password = formData.password;
        }
        payload.is_active = formData.is_active;
        await api.patch(`/closer-manager/closers/${editing.id}`, payload);
        toast.success('Closer updated successfully');
      } else {
        // Create mode
        payload.password = formData.password;
        await api.post('/closer-manager/closers', payload);
        toast.success('Closer created successfully');
      }

      closeModal();
      await fetchClosers();
    } catch (error) {
      console.error('Failed to save closer:', error);
      toast.error(error.response?.data?.error || 'Failed to save closer');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(closerId) {
    if (!window.confirm('Are you sure? This will deactivate the closer account.')) return;

    try {
      await api.patch(`/closer-manager/closers/${closerId}`, {
        is_active: false,
      });
      toast.success('Closer deactivated');
      await fetchClosers();
    } catch (error) {
      console.error('Failed to delete closer:', error);
      toast.error('Failed to deactivate closer');
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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">All Closers</h2>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
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
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        closer.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {closer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">{formatDateTime(closer.created_at)}</td>
                  <td className="px-6 py-4 text-right text-sm flex justify-end gap-2">
                    <button
                      onClick={() => openEditModal(closer)}
                      className="p-2 hover:bg-primary-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} className="text-primary-600 dark:text-primary-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(closer.id)}
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

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-md border border-cream-200 dark:border-dark-800 shadow-2xl">
            <div className="p-5 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editing ? 'Edit Closer' : 'Create New Closer'}</h3>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-white/20">
                <X size={18} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                  placeholder="closer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                  Password {editing && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  required={!editing}
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                  placeholder="Minimum 8 characters"
                />
              </div>

              {editing && (
                <label className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active
                </label>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-cream-200 dark:bg-dark-700 text-primary-700 dark:text-primary-300 hover:bg-cream-300 dark:hover:bg-dark-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 text-white flex items-center justify-center gap-2 hover:scale-105 transition-transform disabled:opacity-70"
                >
                  <Check size={16} />
                  {saving ? 'Saving...' : editing ? 'Update Closer' : 'Create Closer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
