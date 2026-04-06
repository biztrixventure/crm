import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Building2, Phone, FileText, Users, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Sub-pages
import OperationsCompanies from './operations/Companies';
import OperationsTransfers from './operations/Transfers';
import OperationsRecords from './operations/Records';
import OperationsUsers from './operations/Users';
import OperationsCallbacks from './operations/Callbacks';

function KPICard({ title, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300',
    green: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300',
    blue: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300',
    yellow: 'bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 text-yellow-700 dark:text-yellow-300',
  };

  const iconColors = {
    primary: 'text-primary-600 dark:text-primary-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-700/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600/70 dark:text-primary-400/70">{title}</p>
          <p className="text-3xl font-bold text-primary-800 dark:text-primary-200 mt-1">{value}</p>
        </div>
        <div className={cn('p-4 rounded-2xl shadow-lg', colors[color])}>
          <Icon className={iconColors[color]} />
        </div>
      </div>
    </div>
  );
}

function Overview() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/operations/dashboard');
        setKpis(res.data.kpis);
      } catch (error) {
        console.error('Failed to fetch KPIs:', error);
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl p-6 mb-8">
        <p className="text-yellow-800 dark:text-yellow-300 font-medium">Operations View — Read Only</p>
        <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">You have view-only access to all company data. No modifications are allowed.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <KPICard title="Total Transfers" value={kpis?.total_transfers || 0} icon={Phone} color="primary" />
        <KPICard title="Total Sales" value={kpis?.total_sales || 0} icon={FileText} color="green" />
        <KPICard title="Pending Callbacks" value={kpis?.callbacks_pending || 0} icon={Phone} color="blue" />
        <KPICard title="Active Companies" value={kpis?.active_companies || 0} icon={Building2} color="yellow" />
        <KPICard title="Active Closers" value={kpis?.active_closers || 0} icon={Users} color="primary" />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-lg border border-cream-200/50 dark:border-dark-700/50">
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-6">View Options</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link
            to="/operations/companies"
            className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow"
          >
            <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
            <p className="font-medium text-primary-900 dark:text-primary-100 text-sm">Companies</p>
          </Link>
          <Link
            to="/operations/transfers"
            className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow"
          >
            <Phone className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
            <p className="font-medium text-primary-900 dark:text-primary-100 text-sm">Transfers</p>
          </Link>
          <Link
            to="/operations/records"
            className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow"
          >
            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
            <p className="font-medium text-primary-900 dark:text-primary-100 text-sm">Records</p>
          </Link>
          <Link
            to="/operations/users"
            className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow"
          >
            <Users className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
            <p className="font-medium text-primary-900 dark:text-primary-100 text-sm">Users</p>
          </Link>
          <Link
            to="/operations/callbacks"
            className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow"
          >
            <Phone className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
            <p className="font-medium text-primary-900 dark:text-primary-100 text-sm">Callbacks</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OperationsDashboard() {
  const location = useLocation();
  const isRoot = location.pathname === '/operations' || location.pathname === '/operations/';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-primary-900 dark:text-primary-100">Operations Manager</h1>
        <p className="text-primary-600 dark:text-primary-400 mt-2">Read-only oversight of all operations</p>
      </div>

      {isRoot ? <Overview /> : (
        <Routes>
          <Route path="/companies" element={<OperationsCompanies />} />
          <Route path="/transfers" element={<OperationsTransfers />} />
          <Route path="/records" element={<OperationsRecords />} />
          <Route path="/users" element={<OperationsUsers />} />
          <Route path="/callbacks" element={<OperationsCallbacks />} />
        </Routes>
      )}
    </div>
  );
}
