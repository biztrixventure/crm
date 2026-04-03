import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import { useNotificationStore } from '../store/notifications';
import {
  Home,
  Users,
  Building2,
  Phone,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { cn, roleLabels, getInitials } from '../lib/utils';

const navigation = {
  super_admin: [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Companies', href: '/admin/companies', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Dispositions', href: '/admin/dispositions', icon: Settings },
    { name: 'Audit Log', href: '/admin/audit', icon: FileText },
  ],
  readonly_admin: [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Companies', href: '/admin/companies', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Audit Log', href: '/admin/audit', icon: FileText },
  ],
  company_admin: [
    { name: 'Dashboard', href: '/company', icon: Home },
    { name: 'Transfers', href: '/company/transfers', icon: Phone },
    { name: 'Outcomes', href: '/company/outcomes', icon: FileText },
    { name: 'Fronters', href: '/company/fronters', icon: Users },
    { name: 'Number Lists', href: '/company/numbers', icon: FileText },
  ],
  closer: [
    { name: 'Dashboard', href: '/closer', icon: Home },
    { name: 'My Outcomes', href: '/closer/outcomes', icon: FileText },
    { name: 'Callbacks', href: '/closer/callbacks', icon: Phone },
  ],
  fronter: [
    { name: 'Dashboard', href: '/fronter', icon: Home },
    { name: 'My Transfers', href: '/fronter/transfers', icon: Phone },
    { name: 'My Numbers', href: '/fronter/numbers', icon: FileText },
    { name: 'Callbacks', href: '/fronter/callbacks', icon: Phone },
  ],
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore();
  const notifications = useNotificationStore((state) => state.notifications);
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = navigation[user?.role] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-cream-50 to-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-primary-900/30 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary-500 to-primary-400 transform transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-primary-400/30">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">
                BizTrix
              </span>
              <p className="text-xs text-white/70 -mt-1">CRM</p>
            </div>
          </Link>
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-white text-primary-600 shadow-lg shadow-primary-600/20'
                    : 'text-white/90 hover:bg-white/15 hover:text-white'
                )}
              >
                <item.icon className={cn('w-5 h-5', isActive && 'text-primary-500')} />
                <span className="font-medium">{item.name}</span>
                {isActive && <Sparkles className="w-4 h-4 ml-auto text-accent-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
            <p className="text-xs text-white/70">BizTrixVenture v1.0</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('lg:pl-64 min-h-screen flex flex-col')}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-cream-200/50 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-xl hover:bg-cream-100 text-primary-600"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 ml-auto">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl hover:bg-cream-100 text-primary-500 transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {/* Notifications */}
              <button className="relative p-2.5 rounded-xl hover:bg-cream-100 text-primary-500 transition-colors">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full text-xs text-white flex items-center justify-center font-bold shadow-lg">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center space-x-3 p-2 rounded-xl hover:bg-cream-100 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-500 flex items-center justify-center shadow-md">
                    <span className="text-sm font-bold text-white">
                      {getInitials(user?.fullName || 'U')}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-primary-800">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-primary-500">
                      {roleLabels[user?.role]}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-primary-400" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-cream-200 py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-primary-700 hover:bg-cream-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
