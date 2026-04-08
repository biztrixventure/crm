import { useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  SearchIcon,
  SquarePenIcon as EditIcon,
  UserRoundPlusIcon,
  UsersIcon,
  XIcon,
  CheckIcon,
  EyeIcon,
} from 'lucide-animated';
import { Trash2 as TrashIcon } from 'lucide-react';
import api from '../../lib/axios';
import { cn, formatDateTime, roleLabels } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';
import toast from 'react-hot-toast';

const roleOptions = [
  'super_admin',
  'readonly_admin',
  'company_admin',
  'closer',
  'fronter',
  'closer_manager',
  'operations_manager',
  'compliance_manager',
  'compliance_agent',
];

export default function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [managers, setManagers] = useState([]); // For closer manager assignment
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsFormData, setDetailsFormData] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'fronter',
    company_id: '',
    managed_by: '', // For assigning closer to a manager
    is_active: true,
  });

  const canManage = currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canCreate = canManage;

  const availableRoles = useMemo(() => {
    if (isSuperAdmin) return roleOptions;
    if (currentUser?.role === 'company_admin') return ['fronter'];
    return [];
  }, [isSuperAdmin, currentUser?.role]);

  const requiresCompany = ['company_admin', 'fronter'].includes(formData.role);
  const isBizTrixInternal = ['closer_manager', 'operations_manager', 'compliance_manager', 'compliance_agent'].includes(formData.role);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const usersRes = await api.get('/users?limit=100', { timeout: 30000 });
      setUsers(usersRes.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users data:', error);
      toast.error(error.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompaniesIfNeeded() {
    if (!isSuperAdmin || managers.length > 0) return; // Check managers, not companies
    try {
      const companiesRes = await api.get('/companies', { timeout: 15000 });
      setCompanies(companiesRes.data.companies || []);

      // Also fetch closer managers for assignment
      const managersRes = await api.get('/users?role=closer_manager&limit=50', { timeout: 15000 });
      setManagers(managersRes.data.users || []);
    } catch (error) {
      console.error('Failed to fetch companies/managers data:', error);
      toast.error(error.response?.data?.error || 'Failed to fetch companies');
    }
  }

  function resetForm() {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: currentUser?.role === 'company_admin' ? 'fronter' : 'fronter',
      company_id: currentUser?.role === 'company_admin' ? currentUser?.companyId || '' : '',
      managed_by: '',
      is_active: true,
    });
    setEditingUser(null);
    setShowModal(false);
  }

  function handleEdit(user) {
    fetchCompaniesIfNeeded();
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      role: user.role || 'fronter',
      company_id: user.company_id || '',
      managed_by: user.managed_by || '',
      is_active: user.is_active ?? true,
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      email: formData.email.trim(),
      full_name: formData.full_name.trim(),
      role: formData.role,
      company_id: requiresCompany ? (formData.company_id || null) : null,
      is_active: !!formData.is_active,
    };

    // Add managed_by for closers if assigning to a manager
    if (formData.role === 'closer' && formData.managed_by) {
      payload.managed_by = formData.managed_by;
    }

    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users', {
          ...payload,
          password: formData.password,
        });
      }
      await fetchUsers();
      resetForm();
    } catch (error) {
      console.error('Failed to save user:', error);
      toast.error(error.response?.data?.error || 'Failed to save user');
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
      await fetchUsers();
    } catch (error) {
      console.error('Failed to update user status:', error);
      toast.error(error.response?.data?.error || 'Failed to update user status');
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Are you sure you want to delete ${user.full_name} (${user.email})? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      toast.success(`User ${user.email} deleted successfully`);
      await fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  }

  async function handleForceDelete(user) {
    const confirmMsg = `FORCE DELETE: ${user.full_name} (${user.email})\n\nThis will DELETE:\n- All their outcomes/records\n- All their transfers\n- All related compliance batches\n- Their auth account\n- Their user account\n\nThis action CANNOT be undone. Are you certain?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const response = await api.delete(`/users/${user.id}/force`);
      toast.success(`User force deleted! All records removed.`, {
        duration: 5000,
      });
      toast.success(`${user.email} removed from system`, {
        duration: 3000,
      });
      await fetchUsers();
    } catch (error) {
      console.error('Failed to force delete user:', error);
      toast.error(error.response?.data?.error || 'Failed to force delete user');
    }
  }

  // Determine if current user can delete a specific user
  function canDeleteUser(user) {
    if (!canManage) return false;

    const isSuperAdmin = currentUser?.role === 'super_admin';
    const isCompanyAdmin = currentUser?.role === 'company_admin';
    const isCloserManager = currentUser?.role === 'closer_manager';
    const isOperationsManager = currentUser?.role === 'operations_manager';

    // Operations managers cannot delete anyone (read-only)
    if (isOperationsManager) return false;

    // Super admins cannot delete other super admins or readonly admins
    if (isSuperAdmin) {
      return !['super_admin', 'readonly_admin'].includes(user.role);
    }

    // Company admins can delete users from their company (except super admin, readonly admin, or other company admins)
    if (isCompanyAdmin) {
      if (user.company_id !== currentUser?.companyId) return false;
      return !['super_admin', 'readonly_admin', 'company_admin'].includes(user.role);
    }

    // Closer managers can only delete closers they manage
    if (isCloserManager) {
      return user.role === 'closer' && user.managed_by === currentUser?.id;
    }

    return false;
  }

  // View user details
  async function handleViewDetails(user) {
    setSelectedUser(user);
    setShowDetailModal(true);
    setDetailsLoading(true);
    setIsEditingDetails(false);

    try {
      const res = await api.get(`/users/${user.id}`);
      setUserDetails(res.data.user);
      setDetailsFormData({
        full_name: res.data.user.full_name,
        email: res.data.user.email,
        company_id: res.data.user.company_id,
        managed_by: res.data.user.managed_by,
        is_active: res.data.user.is_active,
      });
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      toast.error('Failed to fetch user details');
    } finally {
      setDetailsLoading(false);
    }
  }

  // Save user detail changes
  async function handleSaveDetails() {
    try {
      const res = await api.patch(`/users/${userDetails.id}`, detailsFormData);
      setUserDetails(res.data.user);
      setIsEditingDetails(false);
      await fetchUsers();
      toast.success('User updated successfully');
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error.response?.data?.error || 'Failed to update user');
    }
  }
    const q = searchTerm.toLowerCase();
    const companyName = u.companies?.display_name || '';
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      companyName.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-cream-200 dark:bg-dark-800 rounded-xl w-64" />
        <div className="h-64 bg-cream-200 dark:bg-dark-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent flex items-center gap-2">
            <UsersIcon size={32} className="text-primary-500 dark:text-primary-400" />
            Users Management
          </h1>
          <p className="text-primary-600/70 dark:text-primary-400/70 mt-1">Manage users, roles, and account status</p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              fetchCompaniesIfNeeded();
              setShowModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 text-white rounded-xl font-medium hover:from-primary-600 hover:to-primary-500 dark:hover:from-primary-500 dark:hover:to-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary-400/30 dark:shadow-primary-900/30 hover:scale-105"
          >
            <PlusIcon size={20} />
            Add User
          </button>
        )}
      </div>

      <div className="relative">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400 dark:text-primary-500" />
        <input
          type="text"
          placeholder="Search users by name, email, role, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-900/50 text-primary-800 dark:text-primary-100 placeholder-primary-400/60 dark:placeholder-primary-600/60 focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:border-primary-400 dark:focus:border-primary-500 transition-all"
        />
      </div>

      <div className="bg-white/80 dark:bg-dark-900/80 rounded-2xl border border-cream-200/60 dark:border-dark-800/60 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 dark:bg-dark-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">2FA</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Created</th>
                {canManage && <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-dark-800">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-cream-50 dark:hover:bg-dark-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary-800 dark:text-primary-100">{u.full_name}</p>
                    <p className="text-xs text-primary-500 dark:text-primary-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-lg text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">
                    {u.companies?.display_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-lg text-xs',
                        u.totp_enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      )}
                    >
                      {u.totp_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-lg text-xs',
                        u.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      )}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary-600 dark:text-primary-400">{formatDateTime(u.created_at)}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(u)}
                          className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-1 hover:scale-105 transition-transform"
                          title="View detailed information"
                        >
                          <EyeIcon size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(u)}
                          className="px-3 py-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs flex items-center gap-1 hover:scale-105 transition-transform"
                        >
                          <EditIcon size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs',
                            u.is_active
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          )}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {canDeleteUser(u) && (
                          <>
                            <button
                              onClick={() => handleDelete(u)}
                              className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-1 hover:scale-105 transition-transform hover:bg-red-200 dark:hover:bg-red-900/50"
                              title={`Delete ${u.full_name}`}
                            >
                              <TrashIcon size={14} />
                              Delete
                            </button>
                            {isSuperAdmin && !['super_admin', 'readonly_admin'].includes(u.role) && (
                              <button
                                onClick={() => handleForceDelete(u)}
                                className="px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs flex items-center gap-1 hover:scale-105 transition-transform hover:bg-orange-200 dark:hover:bg-orange-900/50"
                                title={`Force delete ${u.full_name} (will orphan records)`}
                              >
                                <TrashIcon size={14} />
                                Force Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-10">
          <UserRoundPlusIcon size={52} className="mx-auto text-primary-400 dark:text-primary-500 mb-2" />
          <p className="text-primary-600 dark:text-primary-400">No users found</p>
        </div>
      )}

      {showModal && canCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-xl border border-cream-200 dark:border-dark-800 shadow-2xl">
            <div className="p-5 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/20">
                <XIcon size={18} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Full Name</label>
                <input
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData((v) => ({ ...v, full_name: e.target.value }))}
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
                  onChange={(e) => setFormData((v) => ({ ...v, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                  placeholder="user@company.com"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData((v) => ({ ...v, password: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData((v) => ({ ...v, role: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                    disabled={!isSuperAdmin}
                  >
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role] || role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Company</label>
                  <select
                    value={formData.company_id || ''}
                    onChange={(e) => setFormData((v) => ({ ...v, company_id: e.target.value }))}
                    disabled={!requiresCompany || currentUser?.role === 'company_admin'}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100 disabled:opacity-60"
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editingUser && formData.role === 'closer' && isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                    Assign to Manager <span className="text-xs text-primary-500">(Optional)</span>
                  </label>
                  <select
                    value={formData.managed_by || ''}
                    onChange={(e) => setFormData((v) => ({ ...v, managed_by: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
                  >
                    <option value="">No manager (unassigned)</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name} ({manager.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                    If assigned, this closer will appear in the manager's team
                  </p>
                </div>
              )}

              {editingUser && (
                <label className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData((v) => ({ ...v, is_active: e.target.checked }))}
                  />
                  Active user
                </label>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-cream-200 dark:bg-dark-700 text-primary-700 dark:text-primary-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 text-white flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                >
                  <CheckIcon size={16} />
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && userDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">User Details</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setUserDetails(null);
                  setIsEditingDetails(false);
                }}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <XIcon size={20} className="text-white" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary-300 border-t-primary-600 rounded-full mx-auto" />
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveDetails(); }} className="p-6 space-y-4">
                {/* Basic Info */}
                <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4">
                  <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-3">Basic Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Full Name</label>
                      {isEditingDetails ? (
                        <input
                          type="text"
                          value={detailsFormData.full_name}
                          onChange={(e) => setDetailsFormData({ ...detailsFormData, full_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-800 dark:text-primary-100"
                        />
                      ) : (
                        <p className="text-primary-800 dark:text-primary-100">{userDetails.full_name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Email</label>
                      <p className="text-primary-800 dark:text-primary-100 text-sm">{userDetails.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Role</label>
                      <p className="text-primary-800 dark:text-primary-100 text-sm font-mono bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded w-fit">{userDetails.role}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Status</label>
                      <p className={cn("text-sm font-semibold px-2 py-1 rounded w-fit", userDetails.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300")}>
                        {userDetails.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Business Logic */}
                {isSuperAdmin && (
                  <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4">
                    <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-3">Business Logic {isEditingDetails ? '(Editable)' : ''}</h3>
                    <div className="space-y-3">
                      {userDetails.companies && (
                        <div>
                          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Company</label>
                          <p className="text-primary-800 dark:text-primary-100 text-sm">{userDetails.companies?.display_name || 'None (BizTrix Internal)'}</p>
                        </div>
                      )}
                      {['closer', 'fronter', 'company_admin'].includes(userDetails.role) && (
                        <div>
                          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Company Assignment</label>
                          {isEditingDetails ? (
                            <select
                              value={detailsFormData.company_id || ''}
                              onChange={(e) => setDetailsFormData({ ...detailsFormData, company_id: e.target.value || null })}
                              className="w-full px-3 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-800 dark:text-primary-100"
                            >
                              <option value="">None</option>
                              {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.display_name}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-primary-600 dark:text-primary-400">{detailsFormData.company_id ? companies.find(c => c.id === detailsFormData.company_id)?.display_name : 'Not assigned'}</p>
                          )}
                        </div>
                      )}
                      {userDetails.role === 'closer' && (
                        <div>
                          <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">Assigned Manager</label>
                          {isEditingDetails ? (
                            <select
                              value={detailsFormData.managed_by || ''}
                              onChange={(e) => setDetailsFormData({ ...detailsFormData, managed_by: e.target.value || null })}
                              className="w-full px-3 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-800 dark:text-primary-100"
                            >
                              <option value="">No manager (unassigned)</option>
                              {managers.map(m => (
                                <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-primary-600 dark:text-primary-400">
                              {managers.find(m => m.id === detailsFormData.managed_by)?.full_name || 'Not assigned'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Audit Info */}
                <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4">
                  <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-3">Audit Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-primary-600 dark:text-primary-400">Created:</span>
                      <span className="text-primary-800 dark:text-primary-100 font-mono">{formatDateTime(userDetails.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-primary-600 dark:text-primary-400">Created By:</span>
                      <span className="text-primary-800 dark:text-primary-100 font-mono">{userDetails.created_by || 'System'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  {isSuperAdmin && !isEditingDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingDetails(true);
                        fetchCompaniesIfNeeded();
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-500 text-white font-medium transition-colors"
                    >
                      Edit Details
                    </button>
                  )}
                  {isEditingDetails && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingDetails(false);
                          setDetailsFormData({
                            full_name: userDetails.full_name,
                            email: userDetails.email,
                            company_id: userDetails.company_id,
                            managed_by: userDetails.managed_by,
                            is_active: userDetails.is_active,
                          });
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-cream-200 dark:bg-dark-700 text-primary-700 dark:text-primary-300 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckIcon size={16} />
                        Save Changes
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      setUserDetails(null);
                      setIsEditingDetails(false);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-cream-200 dark:bg-dark-700 text-primary-700 dark:text-primary-300 font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
