import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../lib/axios';
import { useAuthStore } from '../store/auth';
import {
  Phone,
  DollarSign,
  Users,
  Clock,
  Plus,
  Download,
} from 'lucide-react';
import { formatDateTime, cn } from '../lib/utils';

// KPI Card component
function KPICard({ title, value, icon: Icon, color = 'primary' }) {
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
        </div>
        <div className={cn('p-3 rounded-xl', colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function Overview() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, transfersRes] = await Promise.all([
          api.get(`/companies/${user.companyId}/stats`),
          api.get('/transfers', { params: { limit: 5 } }),
        ]);
        setStats(statsRes.data.stats);
        setTransfers(transfersRes.data.transfers || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user.companyId]);

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Company Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user.company?.display_name}
          </p>
        </div>
        {user.featureFlags?.allow_export && (
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Transfers Today"
          value={stats?.transfersToday || 0}
          icon={Phone}
          color="primary"
        />
        <KPICard
          title="Sales Today"
          value={stats?.salesToday || 0}
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Pending Callbacks"
          value={stats?.pendingCallbacks || 0}
          icon={Clock}
          color="yellow"
        />
        <KPICard
          title="Active Fronters"
          value={stats?.activeUsers || 0}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Recent Transfers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Transfers
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Fronter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Closer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDateTime(transfer.created_at)}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {transfer.customer_name}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {transfer.customer_phone}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {transfer.fronter?.full_name}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {transfer.closer?.full_name}
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No transfers yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Transfers() {
  return <div className="text-gray-900 dark:text-white">Transfers - Coming soon</div>;
}

function Outcomes() {
  return <div className="text-gray-900 dark:text-white">Outcomes - Coming soon</div>;
}

function Fronters() {
  return <div className="text-gray-900 dark:text-white">Fronters - Coming soon</div>;
}

function Numbers() {
  return <div className="text-gray-900 dark:text-white">Number Lists - Coming soon</div>;
}

export default function CompanyDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="transfers/*" element={<Transfers />} />
      <Route path="outcomes/*" element={<Outcomes />} />
      <Route path="fronters/*" element={<Fronters />} />
      <Route path="numbers/*" element={<Numbers />} />
    </Routes>
  );
}
