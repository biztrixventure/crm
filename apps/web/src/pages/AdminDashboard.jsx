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
} from 'lucide-react';
import { formatDateTime, cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';

// KPI Card component
function KPICard({ title, value, icon: Icon, trend, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
    green: 'bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400',
    blue: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          {trend && (
            <p className={cn('text-sm mt-1', trend > 0 ? 'text-green-600' : 'text-red-600')}>
              {trend > 0 ? '+' : ''}{trend}% from yesterday
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', colors[color])}>
          <Icon className="w-6 h-6" />
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
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Companies
            </h2>
            <Link
              to="/admin/companies"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Transfers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {companies.slice(0, 5).map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {company.display_name}
                      </p>
                      <p className="text-sm text-gray-500">{company.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {company.stats?.transferCount || 0}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {company.stats?.salesCount || 0}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {company.stats?.userCount || 0}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'px-2 py-1 text-xs rounded-full',
                        company.is_active
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                      )}
                    >
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
function Companies() {
  return <div className="text-gray-900 dark:text-white">Companies Management - Coming soon</div>;
}

function UsersPage() {
  return <div className="text-gray-900 dark:text-white">Users Management - Coming soon</div>;
}

function Dispositions() {
  return <div className="text-gray-900 dark:text-white">Dispositions Management - Coming soon</div>;
}

function AuditLog() {
  return <div className="text-gray-900 dark:text-white">Audit Log - Coming soon</div>;
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="companies/*" element={<Companies />} />
      <Route path="users/*" element={<UsersPage />} />
      <Route path="dispositions/*" element={<Dispositions />} />
      <Route path="audit/*" element={<AuditLog />} />
    </Routes>
  );
}
