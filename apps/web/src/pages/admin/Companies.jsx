import { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  SearchIcon, 
  SquarePenIcon as EditIcon, 
  DeleteIcon as TrashIcon, 
  XIcon,
  CheckIcon,
  SettingsIcon,
} from 'lucide-animated';
import { Building2 } from 'lucide-react';
import api from '../../lib/axios';
import { cn } from '../../lib/utils';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    slug: '',
    feature_flags: {
      enableCallbacks: true,
      enableNumberLists: true,
      maxTransfersPerDay: 1000,
    },
    is_active: true,
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data.companies || []);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingCompany) {
        await api.patch(`/companies/${editingCompany.id}`, formData);
      } else {
        await api.post('/companies', formData);
      }
      await fetchCompanies();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save company:', error);
      alert(error.response?.data?.error || 'Failed to save company');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this company?')) return;
    
    try {
      await api.delete(`/companies/${id}`);
      await fetchCompanies();
    } catch (error) {
      console.error('Failed to delete company:', error);
      alert(error.response?.data?.error || 'Failed to delete company');
    }
  }

  function handleEdit(company) {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      display_name: company.display_name,
      slug: company.slug,
      feature_flags: company.feature_flags || {},
      is_active: company.is_active,
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingCompany(null);
    setFormData({
      name: '',
      display_name: '',
      slug: '',
      feature_flags: {
        enableCallbacks: true,
        enableNumberLists: true,
        maxTransfersPerDay: 1000,
      },
      is_active: true,
    });
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            Companies Management
          </h1>
          <p className="text-primary-600/70 dark:text-primary-400/70 mt-1">Manage all companies in the system</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 text-white rounded-xl font-medium hover:from-primary-600 hover:to-primary-500 dark:hover:from-primary-500 dark:hover:to-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary-400/30 dark:shadow-primary-900/30 hover:scale-105"
        >
          <PlusIcon size={20} />
          Add Company
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400 dark:text-primary-500" />
        <input
          type="text"
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-900/50 text-primary-800 dark:text-primary-100 placeholder-primary-400/60 dark:placeholder-primary-600/60 focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:border-primary-400 dark:focus:border-primary-500 transition-all"
        />
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((company) => (
          <div
            key={company.id}
            className="bg-white dark:bg-dark-900/80 rounded-2xl p-6 shadow-lg shadow-primary-200/50 dark:shadow-dark-950/50 border border-cream-200/50 dark:border-dark-800/50 hover:shadow-xl hover:shadow-primary-300/30 dark:hover:shadow-dark-950/70 transition-all hover:scale-105"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-500 dark:from-primary-600 dark:to-primary-700 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-primary-800 dark:text-primary-100">{company.display_name}</h3>
                  <p className="text-sm text-primary-500 dark:text-primary-400">{company.slug}</p>
                </div>
              </div>
              <span
                className={cn(
                  'px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1',
                  company.is_active
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                )}
              >
                <div className={cn('w-2 h-2 rounded-full animate-pulse', company.is_active ? 'bg-green-500' : 'bg-red-500')} />
                {company.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-600 dark:text-primary-400">Transfers</span>
                <span className="font-bold text-primary-800 dark:text-primary-200">{company.stats?.transferCount || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-600 dark:text-primary-400">Sales</span>
                <span className="font-bold text-primary-800 dark:text-primary-200">{company.stats?.salesCount || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-600 dark:text-primary-400">Users</span>
                <span className="font-bold text-primary-800 dark:text-primary-200">{company.stats?.userCount || 0}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(company)}
                className="flex-1 px-3 py-2 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 hover:scale-105"
              >
                <EditIcon size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(company.id)}
                className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 hover:scale-105"
              >
                <TrashIcon size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 mx-auto text-primary-300 dark:text-primary-600 mb-4 animate-pulse" />
          <p className="text-primary-600 dark:text-primary-400">No companies found</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-white/20 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                <XIcon size={20} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100 focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:border-primary-400 dark:focus:border-primary-500 transition-all"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100 focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:border-primary-400 dark:focus:border-primary-500 transition-all"
                    placeholder="Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                    Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-cream-300 bg-cream-50/50 text-primary-800 focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
                    placeholder="acme-corp"
                  />
                </div>
              </div>

              <div className="bg-cream-100 rounded-xl p-4">
                <h3 className="font-semibold text-primary-800 mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Feature Flags
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.feature_flags.enableCallbacks}
                      onChange={(e) => setFormData({
                        ...formData,
                        feature_flags: { ...formData.feature_flags, enableCallbacks: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-cream-300 text-primary-600 focus:ring-primary-400"
                    />
                    <span className="text-sm text-primary-700">Enable Callbacks</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.feature_flags.enableNumberLists}
                      onChange={(e) => setFormData({
                        ...formData,
                        feature_flags: { ...formData.feature_flags, enableNumberLists: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-cream-300 text-primary-600 focus:ring-primary-400"
                    />
                    <span className="text-sm text-primary-700">Enable Number Lists</span>
                  </label>
                  <div>
                    <label className="block text-sm text-primary-700 mb-1">
                      Max Transfers Per Day
                    </label>
                    <input
                      type="number"
                      value={formData.feature_flags.maxTransfersPerDay}
                      onChange={(e) => setFormData({
                        ...formData,
                        feature_flags: { ...formData.feature_flags, maxTransfersPerDay: parseInt(e.target.value) }
                      })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-cream-300 bg-white text-primary-800 focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-cream-300 text-primary-600 focus:ring-primary-400"
                />
                <span className="text-sm font-medium text-primary-700">Active</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 bg-cream-200 dark:bg-dark-700 hover:bg-cream-300 dark:hover:bg-dark-600 text-primary-700 dark:text-primary-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 hover:from-primary-600 hover:to-primary-500 dark:hover:from-primary-500 dark:hover:to-primary-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105"
                >
                  <CheckIcon size={20} />
                  {editingCompany ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
