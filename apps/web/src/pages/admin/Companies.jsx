import { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  SearchIcon, 
  SquarePenIcon as EditIcon, 
  DeleteIcon as TrashIcon, 
  XIcon,
  CheckIcon,
  SettingsIcon,
  DownloadIcon,
  EyeIcon,
  UsersIcon,
  ActivityIcon,
} from 'lucide-animated';
import { Building2, Trophy, ArrowRight, Phone, Calendar, TrendingUp } from 'lucide-react';
import api from '../../lib/axios';
import { cn } from '../../lib/utils';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
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

  async function handleViewDetails(company) {
    setSelectedCompany(company);
    setShowDetailModal(true);
    setDetailsLoading(true);
    
    try {
      const res = await api.get(`/companies/${company.id}/detailed`);
      setCompanyDetails(res.data);
    } catch (error) {
      console.error('Failed to fetch company details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleExport(companyId, type) {
    try {
      const response = await api.get(`/companies/${companyId}/export?type=${type}&days=30`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-export-${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    }
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
                onClick={() => handleViewDetails(company)}
                className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 hover:scale-105"
              >
                <EyeIcon size={16} />
                View
              </button>
              <button
                onClick={() => handleEdit(company)}
                className="flex-1 px-3 py-2 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 hover:scale-105"
              >
                <EditIcon size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(company.id)}
                className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 hover:scale-105"
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

              <div className="bg-cream-100 dark:bg-dark-800 rounded-xl p-4">
                <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-3 flex items-center gap-2">
                  <SettingsIcon size={20} />
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

      {/* Company Detail Modal */}
      {showDetailModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedCompany.display_name}</h2>
                  <p className="text-white/70 text-sm">{selectedCompany.slug}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowDetailModal(false); setCompanyDetails(null); }}
                className="p-2 hover:bg-white/20 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                <XIcon size={20} className="text-white" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="p-8 space-y-4">
                <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-24 bg-cream-200 dark:bg-dark-800 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : companyDetails ? (
              <div className="p-6 space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                      <UsersIcon size={18} />
                      <span className="text-sm font-medium">Users</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{companyDetails.stats?.users?.total || 0}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/50">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                      <Phone size={18} />
                      <span className="text-sm font-medium">Transfers</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{companyDetails.stats?.transfers?.total || 0}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">{companyDetails.stats?.transfers?.today || 0} today</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200/50 dark:border-green-700/50">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                      <TrendingUp size={18} />
                      <span className="text-sm font-medium">Sales</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">{companyDetails.stats?.outcomes?.sales || 0}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-xl p-4 border border-amber-200/50 dark:border-amber-700/50">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                      <Calendar size={18} />
                      <span className="text-sm font-medium">30-Day Activity</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{companyDetails.stats?.transfers?.last30Days || 0}</p>
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top Performers */}
                  <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4 border border-cream-200/50 dark:border-dark-700/50">
                    <h3 className="font-bold text-primary-800 dark:text-primary-200 mb-3 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Top Closers (30 Days)
                    </h3>
                    {companyDetails.topPerformers?.length > 0 ? (
                      <div className="space-y-2">
                        {companyDetails.topPerformers.map((performer, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-dark-900/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                                idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                idx === 1 ? 'bg-gray-300 text-gray-700' :
                                idx === 2 ? 'bg-amber-600 text-white' :
                                'bg-cream-200 dark:bg-dark-700 text-primary-600 dark:text-primary-400'
                              )}>
                                {idx + 1}
                              </span>
                              <span className="text-sm font-medium text-primary-800 dark:text-primary-200">{performer.name}</span>
                            </div>
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">{performer.sales} sales</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-primary-500 dark:text-primary-400 italic">No sales data yet</p>
                    )}
                  </div>

                  {/* Recent Transfers */}
                  <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4 border border-cream-200/50 dark:border-dark-700/50">
                    <h3 className="font-bold text-primary-800 dark:text-primary-200 mb-3 flex items-center gap-2">
                      <ActivityIcon size={20} className="text-purple-500" />
                      Recent Transfers
                    </h3>
                    {companyDetails.recentTransfers?.length > 0 ? (
                      <div className="space-y-2">
                        {companyDetails.recentTransfers.map((transfer) => (
                          <div key={transfer.id} className="flex items-center justify-between p-2 bg-white dark:bg-dark-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-primary-800 dark:text-primary-200">{transfer.caller_name || 'Unknown'}</p>
                              <p className="text-xs text-primary-500 dark:text-primary-400">{transfer.caller_phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-primary-500 dark:text-primary-400">by {transfer.fronter?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-primary-400 dark:text-primary-500">{new Date(transfer.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-primary-500 dark:text-primary-400 italic">No transfers yet</p>
                    )}
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4 border border-cream-200/50 dark:border-dark-700/50">
                  <h3 className="font-bold text-primary-800 dark:text-primary-200 mb-3 flex items-center gap-2">
                    <SettingsIcon size={20} className="text-primary-500" />
                    Feature Configuration
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(companyDetails.company?.feature_flags || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 p-2 bg-white dark:bg-dark-900/50 rounded-lg">
                        <div className={cn(
                          'w-3 h-3 rounded-full',
                          typeof value === 'boolean' ? (value ? 'bg-green-500' : 'bg-red-500') : 'bg-blue-500'
                        )} />
                        <span className="text-xs text-primary-700 dark:text-primary-300">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          {typeof value !== 'boolean' && `: ${value}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Options */}
                <div className="bg-cream-50 dark:bg-dark-800 rounded-xl p-4 border border-cream-200/50 dark:border-dark-700/50">
                  <h3 className="font-bold text-primary-800 dark:text-primary-200 mb-3 flex items-center gap-2">
                    <DownloadIcon size={20} className="text-primary-500" />
                    Export Data (Last 30 Days)
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleExport(selectedCompany.id, 'transfers')}
                      className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <DownloadIcon size={16} />
                      Export Transfers
                    </button>
                    <button
                      onClick={() => handleExport(selectedCompany.id, 'outcomes')}
                      className="px-4 py-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <DownloadIcon size={16} />
                      Export Outcomes
                    </button>
                    <button
                      onClick={() => handleExport(selectedCompany.id, 'users')}
                      className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <DownloadIcon size={16} />
                      Export Users
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowDetailModal(false); handleEdit(selectedCompany); }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-700 hover:from-primary-600 hover:to-primary-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <EditIcon size={18} />
                    Edit Company
                  </button>
                  <button
                    onClick={() => { setShowDetailModal(false); setCompanyDetails(null); }}
                    className="px-4 py-3 bg-cream-200 dark:bg-dark-700 hover:bg-cream-300 dark:hover:bg-dark-600 text-primary-700 dark:text-primary-300 rounded-xl font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-primary-500 dark:text-primary-400">Failed to load company details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
