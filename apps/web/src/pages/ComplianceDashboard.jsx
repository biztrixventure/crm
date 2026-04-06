import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { FileText, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';

// Sub-pages
import ComplianceBatches from './compliance/Batches';
import ComplianceRecords from './compliance/Records';
import ComplianceBatchDetail from './compliance/BatchDetail';
import ComplianceDNC from './compliance/DNC';

function StatCard({ title, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300',
    yellow: 'bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 text-yellow-700 dark:text-yellow-300',
    red: 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 text-red-700 dark:text-red-300',
  };

  const iconColors = {
    primary: 'text-primary-600 dark:text-primary-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-red-600 dark:text-red-400',
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
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isManager = user?.role === 'compliance_manager';

  useEffect(() => {
    async function fetchData() {
      try {
        const batchesRes = await api.get('/compliance/batches?limit=100');
        const batches = batchesRes.data.batches || [];

        const pendingBatches = batches.filter(b => b.status === 'pending').length;
        const completedBatches = batches.filter(b => b.status === 'completed').length;
        const flaggedRecords = batches.reduce((sum, b) => sum + (b.flagged_records || 0), 0);

        setStats({
          pendingBatches,
          completedBatches,
          flaggedRecords,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Pending Batches" value={stats?.pendingBatches || 0} icon={FileText} color="primary" />
        <StatCard title="Completed Batches" value={stats?.completedBatches || 0} icon={Shield} color="primary" />
        <StatCard title="Flagged Records" value={stats?.flaggedRecords || 0} icon={AlertCircle} color="red" />
      </div>

      {isManager && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-lg border border-cream-200/50 dark:border-dark-700/50">
          <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-6">Manager Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/compliance/batches" className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow">
              <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
              <p className="font-medium text-primary-900 dark:text-primary-100">Manage Batches</p>
            </Link>
            <Link to="/compliance/records" className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow">
              <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
              <p className="font-medium text-primary-900 dark:text-primary-100">View Records</p>
            </Link>
            <Link to="/compliance/dnc" className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow">
              <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
              <p className="font-medium text-primary-900 dark:text-primary-100">DNC List</p>
            </Link>
          </div>
        </div>
      )}

      {!isManager && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50 rounded-2xl p-6">
          <p className="text-primary-900 dark:text-primary-100 font-medium">My Assigned Batches</p>
          <p className="text-primary-700 dark:text-primary-400 text-sm mt-1">You can only view and review batches assigned to you.</p>
          <Link to="/compliance/batches" className="text-primary-600 dark:text-primary-400 hover:underline text-sm mt-3 inline-block font-medium">
            View My Batches →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ComplianceDashboard() {
  const location = useLocation();
  const isRoot = location.pathname === '/compliance' || location.pathname === '/compliance/';
  const { user } = useAuthStore();
  const isManager = user?.role === 'compliance_manager';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-primary-900 dark:text-primary-100">
          {isManager ? 'Compliance Manager' : 'Compliance Agent'}
        </h1>
        <p className="text-primary-600 dark:text-primary-400 mt-2">
          {isManager ? 'Manage compliance batches and DNC list' : 'Review assigned compliance batches'}
        </p>
      </div>

      {isRoot ? (
        <Overview />
      ) : (
        <Routes>
          <Route path="/batches/*" element={<ComplianceBatches />} />
          <Route path="/batches/:batchId" element={<ComplianceBatchDetail />} />
          <Route path="/records" element={<ComplianceRecords />} />
          <Route path="/dnc" element={<ComplianceDNC />} />
        </Routes>
      )}
    </div>
  );
}
