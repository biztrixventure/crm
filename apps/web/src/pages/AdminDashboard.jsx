import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  UsersIcon,
  TrendingUpIcon,
} from 'lucide-animated';
import { Building2, DollarSign, Plus, Star, Phone, Loader2, ShieldCheck, Activity, Save } from 'lucide-react';
import { formatDateTime, cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { Companies, Users } from './admin';
import PlanManager from '../components/PlanManager';
import ClientManager from '../components/ClientManager';
import SearchFieldConfig from '../components/SearchFieldConfig';

// KPI Card component
function KPICard({ title, value, icon: Icon, trend, color = 'primary' }) {
  const colors = {
    primary: 'bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300',
    green: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300',
    yellow: 'bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 text-yellow-700 dark:text-yellow-300',
    blue: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300',
  };

  const iconColors = {
    primary: 'text-primary-600 dark:text-primary-400',
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400', 
    blue: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-lg shadow-primary-200/50 dark:shadow-dark-900/50 border border-cream-200/50 dark:border-dark-700/50 backdrop-blur-sm transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600/70 dark:text-primary-400/70">{title}</p>
          <p className="text-3xl font-bold text-primary-800 dark:text-primary-200 mt-1">
            {value}
          </p>
          {trend && (
            <p className={cn('text-sm mt-2 flex items-center gap-1', trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              <TrendingUpIcon size={16} />
              {trend > 0 ? '+' : ''}{trend}% from yesterday
            </p>
          )}
        </div>
        <div className={cn('p-4 rounded-2xl shadow-lg', colors[color])}>
          <Icon className={iconColors[color]} />
        </div>
      </div>
    </div>
  );
}

// Dashboard Overview
function Overview() {
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [companiesRes] = await Promise.all([
          api.get('/companies'),
        ]);
        setCompanies(companiesRes.data.companies || []);
        
        // Calculate totals
        let totalTransfers = 0;
        let totalSales = 0;
        let totalUsers = 0;
        
        companiesRes.data.companies?.forEach(c => {
          totalTransfers += c.stats?.transferCount || 0;
          totalSales += c.stats?.salesCount || 0;
          totalUsers += c.stats?.userCount || 0;
        });

        setStats({
          totalTransfers,
          totalSales,
          activeCompanies: companiesRes.data.companies?.filter(c => c.is_active).length || 0,
          totalUsers,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-cream-200 dark:bg-dark-700 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent flex items-center gap-2">
            <Star className="w-8 h-8 text-accent-500 dark:text-accent-400" />
            Admin Dashboard
          </h1>
          <p className="text-primary-600/70 dark:text-primary-400/70 mt-1">System overview and management</p>
        </div>
        <div className="bg-gradient-to-r from-primary-400 to-accent-400 dark:from-primary-600 dark:to-accent-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg">
          Super Administrator
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Transfers"
          value={stats?.totalTransfers || 0}
          icon={(props) => <Phone {...props} className="w-7 h-7" />}
          color="primary"
        />
        <KPICard
          title="Total Sales"
          value={stats?.totalSales || 0}
          icon={(props) => <DollarSign {...props} className="w-7 h-7" />}
          color="green"
        />
        <KPICard
          title="Active Companies"
          value={stats?.activeCompanies || 0}
          icon={(props) => <Building2 {...props} className="w-7 h-7" />}
          color="blue"
        />
        <KPICard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={(props) => <UsersIcon {...props} size={28} />}
          color="yellow"
        />
      </div>

      {/* Companies Table */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-primary-200/20 dark:shadow-dark-900/20 border border-cream-200/50 dark:border-dark-700/50 transition-colors">
        <div className="p-6 border-b border-cream-200/50 dark:border-dark-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-500 dark:from-primary-600 dark:to-primary-700 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-primary-800 dark:text-primary-200">
                Companies Overview
              </h2>
            </div>
            <Link
              to="/admin/companies"
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-500 text-white rounded-xl text-sm font-medium hover:from-primary-600 hover:to-primary-500 dark:hover:from-primary-700 dark:hover:to-primary-600 transition-all flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              View all
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-cream-100 to-cream-200 dark:from-dark-800 dark:to-dark-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                  Transfers
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                  Sales
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-dark-700">
              {companies.slice(0, 5).map((company) => (
                <tr key={company.id} className="hover:bg-cream-50/50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-primary-800 dark:text-primary-200">
                        {company.display_name}
                      </p>
                      <p className="text-sm text-primary-500 dark:text-primary-400">{company.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                      {company.stats?.transferCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                      {company.stats?.salesCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                      {company.stats?.userCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 w-fit',
                        company.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full', company.is_active ? 'bg-green-500' : 'bg-red-500')} />
                      {company.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Placeholder components for other routes
function CompaniesRoute() {
  return <Companies />;
}

function UsersPage() {
  return <Users />;
}

function Dispositions() {
  const [dispositions, setDispositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: '', is_default: false });

  async function fetchDispositions() {
    try {
      setLoading(true);
      const res = await api.get('/dispositions', { timeout: 10000 });
      setDispositions(res.data.dispositions || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load dispositions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDispositions();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/dispositions', form, { timeout: 10000 });
      toast.success('Disposition created');
      setForm({ label: '', is_default: false });
      await fetchDispositions();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create disposition');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      await api.patch(`/dispositions/${item.id}`, { is_active: false }, { timeout: 10000 });
      toast.success('Disposition deactivated');
      await fetchDispositions();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to deactivate disposition');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Dispositions Management</h1>

      <div className="bg-white dark:bg-dark-900 rounded-2xl p-5 border border-cream-200 dark:border-dark-800 shadow-lg">
        <h2 className="font-semibold text-primary-800 dark:text-primary-200 mb-3">Create Disposition</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            value={form.label}
            onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
            placeholder="Disposition label"
            className="md:col-span-2 px-3 py-2.5 rounded-xl border border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          />
          <label className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm((s) => ({ ...s, is_default: e.target.checked }))}
            />
            Default
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-cream-200 dark:border-dark-800 shadow-lg overflow-hidden">
        <div className="p-4 border-b border-cream-200 dark:border-dark-800">
          <h3 className="font-semibold text-primary-800 dark:text-primary-200">Active Dispositions</h3>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-primary-500 dark:text-primary-400">Loading...</div>
        ) : dispositions.length === 0 ? (
          <div className="p-4 text-sm text-primary-500 dark:text-primary-400">No dispositions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cream-100 dark:bg-dark-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Default</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-dark-800">
                {dispositions.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-sm text-primary-800 dark:text-primary-100">{d.label}</td>
                    <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{d.is_default ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">
                      <button
                        disabled={d.is_default}
                        onClick={() => toggleActive(d)}
                        className="px-3 py-1.5 rounded-lg border border-cream-300 dark:border-dark-700 text-xs text-primary-700 dark:text-primary-300 disabled:opacity-40"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });
  const [filters, setFilters] = useState({ event: '', from: '', to: '' });

  async function fetchAudit(page = 1) {
    try {
      setLoading(true);
      const [eventsRes, statsRes, logsRes] = await Promise.all([
        api.get('/audit/events', { timeout: 10000 }),
        api.get('/audit/stats', { params: { from: filters.from || undefined, to: filters.to || undefined }, timeout: 10000 }),
        api.get('/audit', {
          params: {
            page,
            limit: 20,
            event: filters.event || undefined,
            from: filters.from || undefined,
            to: filters.to || undefined,
          },
          timeout: 12000,
        }),
      ]);

      setEvents(eventsRes.data.events || []);
      setStats(statsRes.data.stats || null);
      setLogs(logsRes.data.logs || []);
      setPagination(logsRes.data.pagination || { page: 1, hasMore: false });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAudit(1);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Audit Log</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Window Logins" value={stats?.windowLogins || 0} icon={ShieldCheck} />
        <MetricCard title="Failed Logins" value={stats?.windowFailedLogins || 0} icon={Activity} />
        <MetricCard title="2FA Setups" value={stats?.windowTwoFaSetups || 0} icon={ShieldCheck} />
      </div>

      <p className="text-xs text-primary-500 dark:text-primary-400">
        Default window is last 30 days unless you set custom dates.
      </p>

      <div className="bg-white dark:bg-dark-900 rounded-2xl p-4 border border-cream-200 dark:border-dark-800 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={filters.event}
            onChange={(e) => setFilters((s) => ({ ...s, event: e.target.value }))}
            className="px-3 py-2.5 rounded-xl border border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))}
            className="px-3 py-2.5 rounded-xl border border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          />
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))}
            className="px-3 py-2.5 rounded-xl border border-cream-300 dark:border-dark-700 bg-cream-50/50 dark:bg-dark-800/50 text-primary-800 dark:text-primary-100"
          />
          <button
            onClick={() => fetchAudit(1)}
            className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-cream-200 dark:border-dark-800 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-primary-500 dark:text-primary-400">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-sm text-primary-500 dark:text-primary-400">No audit events found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-100 dark:bg-dark-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">Event</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 dark:divide-dark-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm text-primary-800 dark:text-primary-100">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{log.user?.full_name || 'System'}</td>
                      <td className="px-4 py-3 text-sm text-primary-700 dark:text-primary-300">{log.event}</td>
                      <td className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-cream-200 dark:border-dark-800 flex items-center justify-between">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchAudit(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-cream-300 dark:border-dark-700 text-sm text-primary-700 dark:text-primary-300 disabled:opacity-50"
              >
                Previous
              </button>
              <p className="text-sm text-primary-600 dark:text-primary-400">
                Page {pagination.page}
              </p>
              <button
                disabled={!pagination.hasMore}
                onClick={() => fetchAudit(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-cream-300 dark:border-dark-700 text-sm text-primary-700 dark:text-primary-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-4 border border-cream-200 dark:border-dark-800 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-primary-500 dark:text-primary-400">{title}</p>
          <p className="text-2xl font-bold text-primary-800 dark:text-primary-200 mt-1">{value}</p>
        </div>
        <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="companies/*" element={<CompaniesRoute />} />
      <Route path="users/*" element={<UsersPage />} />
      <Route path="dispositions/*" element={<Dispositions />} />
      <Route path="plans/*" element={<PlanManager />} />
      <Route path="clients/*" element={<ClientManager />} />
      <Route path="search-config/*" element={<SearchFieldConfig />} />
      <Route path="audit/*" element={<AuditLog />} />
    </Routes>
  );
}
