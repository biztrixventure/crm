import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Users, TrendingUp, Phone, Plus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Sub-pages
import CloserManagerClosers from './closer-manager/Closers';
import CloserManagerPerformance from './closer-manager/Performance';
import CloserManagerTransfers from './closer-manager/Transfers';

function KPICard({ title, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-700 dark:text-primary-300',
    green: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300',
    blue: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300',
  };

  const iconColors = {
    primary: 'text-primary-600 dark:text-primary-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
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

  useEffect(() => {
    async function fetchData() {
      try {
        const [performanceRes] = await Promise.all([
          api.get('/closer-manager/performance?period=today'),
        ]);

        const closers = performanceRes.data.leaderboard || [];
        const totalSales = closers.reduce((sum, c) => sum + (c.total_sales || 0), 0);
        const totalTransfers = closers.reduce((sum, c) => sum + (c.total_transfers || 0), 0);

        setStats({
          activeCloasers: closers.length,
          totalSales,
          totalTransfers,
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
        <KPICard title="Active Closers" value={stats?.activeCloasers || 0} icon={Users} color="primary" />
        <KPICard title="Total Sales Today" value={stats?.totalSales || 0} icon={TrendingUp} color="green" />
        <KPICard title="Total Transfers Today" value={stats?.totalTransfers || 0} icon={Phone} color="blue" />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-lg border border-cream-200/50 dark:border-dark-700/50">
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-6">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/closer-manager/closers" className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:shadow-lg transition-shadow">
            <Users className="w-6 h-6 text-primary-600 dark:text-primary-400 mb-2" />
            <p className="font-medium text-primary-900 dark:text-primary-100">Manage Closers</p>
          </Link>
          <Link to="/closer-manager/performance" className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 hover:shadow-lg transition-shadow">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
            <p className="font-medium text-green-900 dark:text-green-100">View Performance</p>
          </Link>
          <Link to="/closer-manager/transfers" className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:shadow-lg transition-shadow">
            <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
            <p className="font-medium text-blue-900 dark:text-blue-100">All Transfers</p>
          </Link>
          <Link to="/closer-manager/records" className="p-4 rounded-xl bg-accent-50 dark:bg-accent-900/20 hover:shadow-lg transition-shadow">
            <Plus className="w-6 h-6 text-accent-600 dark:text-accent-400 mb-2" />
            <p className="font-medium text-accent-900 dark:text-accent-100">My Records</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CloserManagerDashboard() {
  const location = useLocation();
  const isRoot = location.pathname === '/closer-manager' || location.pathname === '/closer-manager/';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-primary-900 dark:text-primary-100">Closer Manager</h1>
        <p className="text-primary-600 dark:text-primary-400 mt-2">Manage closers, view performance, and oversee transfers</p>
      </div>

      {isRoot ? (
        <Overview />
      ) : (
        <Routes>
          <Route path="/closers" element={<CloserManagerClosers />} />
          <Route path="/performance" element={<CloserManagerPerformance />} />
          <Route path="/transfers" element={<CloserManagerTransfers />} />
        </Routes>
      )}
    </div>
  );
}
