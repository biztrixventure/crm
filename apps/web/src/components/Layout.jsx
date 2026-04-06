import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import { useNotificationStore } from '../store/notifications';
import {
  HomeIcon,
  UsersIcon,
  SettingsIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  ChevronDownIcon,
  SparklesIcon,
  UserIcon,
} from 'lucide-animated';
import { Building2, Phone, FileText, TrendingUp, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { cn, roleLabels, getInitials } from '../lib/utils';

const navigation = {
  super_admin: [
    { name: 'Dashboard', href: '/admin', icon: HomeIcon },
    { name: 'Companies', href: '/admin/companies', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: UsersIcon },
    { name: 'Dispositions', href: '/admin/dispositions', icon: SettingsIcon },
    { name: 'Plans', href: '/admin/plans', icon: FileText },
    { name: 'Clients', href: '/admin/clients', icon: FileText },
    { name: 'Audit Log', href: '/admin/audit', icon: FileText },
  ],
  readonly_admin: [
    { name: 'Dashboard', href: '/admin', icon: HomeIcon },
    { name: 'Companies', href: '/admin/companies', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: UsersIcon },
    { name: 'Audit Log', href: '/admin/audit', icon: FileText },
  ],
  company_admin: [
    { name: 'Dashboard', href: '/company', icon: HomeIcon },
    { name: 'Transfers', href: '/company/transfers', icon: Phone },
    { name: 'Outcomes', href: '/company/outcomes', icon: FileText },
    { name: 'Callbacks', href: '/company/callbacks', icon: Phone },
    { name: 'Fronters', href: '/company/fronters', icon: UsersIcon },
    { name: 'Number Lists', href: '/company/numbers', icon: FileText },
  ],
  closer: [
    { name: 'Dashboard', href: '/closer', icon: HomeIcon },
    { name: 'My Outcomes', href: '/closer/outcomes', icon: FileText },
    { name: 'Callbacks', href: '/closer/callbacks', icon: Phone },
  ],
  closer_manager: [
    { name: 'Dashboard', href: '/closer-manager', icon: HomeIcon },
    { name: 'My Records', href: '/closer-manager/records', icon: FileText },
    { name: 'Callbacks', href: '/closer-manager/callbacks', icon: Phone },
    { name: 'Number Search', href: '/closer-manager/search', icon: SearchIcon },
    { name: 'Closers', href: '/closer-manager/closers', icon: UsersIcon },
    { name: 'Performance', href: '/closer-manager/performance', icon: TrendingUp },
    { name: 'Transfers', href: '/closer-manager/transfers', icon: Phone },
  ],
  operations_manager: [
    { name: 'Dashboard', href: '/operations', icon: HomeIcon },
    { name: 'Companies', href: '/operations/companies', icon: Building2 },
    { name: 'Transfers', href: '/operations/transfers', icon: Phone },
    { name: 'Records', href: '/operations/records', icon: FileText },
    { name: 'Users', href: '/operations/users', icon: UsersIcon },
  ],
  compliance_manager: [
    { name: 'Dashboard', href: '/compliance', icon: HomeIcon },
    { name: 'Records', href: '/compliance/records', icon: FileText },
    { name: 'Batches', href: '/compliance/batches', icon: FileText },
    { name: 'DNC List', href: '/compliance/dnc', icon: SettingsIcon },
  ],
  compliance_agent: [
    { name: 'My Batches', href: '/compliance/batches', icon: FileText },
  ],
  fronter: [
    { name: 'Dashboard', href: '/fronter', icon: HomeIcon },
    { name: 'My Transfers', href: '/fronter/transfers', icon: Phone },
    { name: 'My Numbers', href: '/fronter/numbers', icon: FileText },
    { name: 'Callbacks', href: '/fronter/callbacks', icon: Phone },
  ],
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore();
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navItems = navigation[user?.role] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-cream-50 to-white dark:from-dark-950 dark:via-dark-900 dark:to-dark-800 transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-primary-900/30 dark:bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary-500 to-primary-400 dark:from-dark-900 dark:to-dark-950 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-xl border-r border-transparent dark:border-dark-800',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-primary-400/30 dark:border-dark-700/50">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">
                BizTrix
              </span>
              <p className="text-xs text-white/70 dark:text-white/60 -mt-1">CRM</p>
            </div>
          </Link>
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 text-white transition-colors"
          >
            <XIcon size={20} />
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
                    ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-300 shadow-lg shadow-primary-600/20 dark:shadow-primary-400/10'
                    : 'text-white/90 dark:text-white/80 hover:bg-white/15 dark:hover:bg-white/10 hover:text-white'
                )}
              >
                <item.icon 
                  size={20}
                  className={cn('w-5 h-5', isActive && 'text-primary-500 dark:text-primary-400')} 
                />
                <span className="font-medium">{item.name}</span>
                {isActive && <SparklesIcon size={16} className="ml-auto text-accent-400 dark:text-accent-300" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur rounded-xl p-3 text-center border border-white/10">
            <p className="text-xs text-white/70">BizTrixVenture v1.0</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('lg:pl-64 min-h-screen flex flex-col')}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl border-b border-cream-200/50 dark:border-dark-800/50 shadow-sm transition-colors">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-xl hover:bg-cream-100 dark:hover:bg-dark-800 text-primary-600 dark:text-primary-300 transition-colors"
            >
              <MenuIcon size={20} />
            </button>

            <div className="flex items-center space-x-3 ml-auto">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl hover:bg-cream-100 dark:hover:bg-dark-800 text-primary-500 dark:text-primary-300 transition-all hover:scale-105"
              >
                {theme === 'dark' ? (
                  <SunIcon size={20} />
                ) : (
                  <MoonIcon size={20} />
                )}
              </button>

              {/* Notifications */}
              <button
                onClick={() => {
                  setNotificationsOpen((v) => !v);
                  markAllRead();
                }}
                className="relative p-2.5 rounded-xl hover:bg-cream-100 dark:hover:bg-dark-800 text-primary-500 dark:text-primary-300 transition-all hover:scale-105"
              >
                <BellIcon size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full text-xs text-white flex items-center justify-center font-bold shadow-lg animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-20 top-14 w-80 max-h-96 overflow-auto bg-white dark:bg-dark-900 rounded-xl shadow-xl border border-cream-200 dark:border-dark-800 z-50">
                  <div className="p-3 border-b border-cream-200 dark:border-dark-800">
                    <h3 className="font-semibold text-primary-800 dark:text-primary-200">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-primary-500 dark:text-primary-400">No notifications yet.</p>
                  ) : (
                    notifications.slice().reverse().map((n) => (
                      <div key={n.id} className="p-3 border-b border-cream-100 dark:border-dark-800/70">
                        <p className="text-sm font-semibold text-primary-800 dark:text-primary-200">{n.title}</p>
                        <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center space-x-3 p-2 rounded-xl hover:bg-cream-100 dark:hover:bg-dark-800 transition-all hover:scale-105"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-500 dark:from-primary-600 dark:to-primary-700 flex items-center justify-center shadow-md">
                    <span className="text-sm font-bold text-white">
                      {getInitials(user?.fullName || 'U')}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-primary-800 dark:text-primary-100">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-primary-500 dark:text-primary-400">
                      {roleLabels[user?.role]}
                    </p>
                  </div>
                  <ChevronDownIcon size={16} className={cn("text-primary-400 dark:text-primary-300 transition-transform", profileOpen && "rotate-180")} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-900 rounded-xl shadow-xl border border-cream-200 dark:border-dark-800 py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-primary-700 dark:text-primary-200 hover:bg-cream-50 dark:hover:bg-dark-800 transition-colors"
                    >
                      <UserIcon size={16} />
                      <span>My Profile</span>
                    </button>
                    <hr className="border-cream-200 dark:border-dark-700" />
                    <button
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogoutIcon size={16} />
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
