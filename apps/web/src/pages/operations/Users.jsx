import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';
import { formatDateTime, roleLabels } from '../../lib/utils';

export default function OperationsUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get('/operations/users?limit=100');
        setUsers(res.data.users || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.companies?.display_name?.toLowerCase().includes(q)
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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">All Users</h2>
        <p className="text-sm text-primary-600 dark:text-primary-400">Read-only view • {filtered.length} users</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400" />
        <input
          type="text"
          placeholder="Search by name, email, role, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-primary-800 dark:text-primary-100"
        />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-x-auto border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full min-w-max">
          <thead className="bg-cream-100 dark:bg-dark-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Role</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Company</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No users found
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50">
                  <td className="px-6 py-4 font-medium text-primary-900 dark:text-primary-100">{user.full_name}</td>
                  <td className="px-6 py-4 text-primary-700 dark:text-primary-300">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-primary-700 dark:text-primary-300">{user.companies?.display_name || 'BizTrixVenture'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">{formatDateTime(user.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
