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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold">B</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              BizTrix
            </span>
          </Link>
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className={cn('lg:pl-64 min-h-screen flex flex-col')}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex items-center space-x-4 ml-auto">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-gray-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Bell className="w-5 h-5 text-gray-500" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {getInitials(user?.fullName || 'U')}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {roleLabels[user?.role]}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                    <button
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
