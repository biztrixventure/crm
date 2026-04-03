import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import api from '../lib/axios';
import {
  Building2,
  Users,
  Phone,
  TrendingUp,
  DollarSign,
  Clock,
  Plus,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { formatDateTime, cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { Companies } from './admin';

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
              <TrendingUp className="w-4 h-4" />
              {trend > 0 ? '+' : ''}{trend}% from yesterday
            </p>
          )}
        </div>
        <div className={cn('p-4 rounded-2xl shadow-lg', colors[color])}>
          <Icon className={cn('w-7 h-7', iconColors[color])} />
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
          icon={Phone}
          color="primary"
        />
        <KPICard
          title="Total Sales"
          value={stats?.totalSales || 0}
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Active Companies"
          value={stats?.activeCompanies || 0}
          icon={Building2}
          color="blue"
        />
        <KPICard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
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
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-bold text-primary-800 mb-2">Users Management</h3>
      <p className="text-primary-600">Coming soon - Manage all system users</p>
    </div>
  );
}

function Dispositions() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-bold text-primary-800 mb-2">Dispositions Management</h3>
      <p className="text-primary-600">Coming soon - Configure call dispositions</p>
    </div>
  );
}

function AuditLog() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-bold text-primary-800 mb-2">Audit Log</h3>
      <p className="text-primary-600">Coming soon - View system activity logs</p>
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
      <Route path="audit/*" element={<AuditLog />} />
    </Routes>
  );
}
