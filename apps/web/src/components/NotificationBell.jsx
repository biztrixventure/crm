import { useEffect, useState } from 'react';
import { BellIcon } from 'lucide-animated';
import { useNotificationStore } from '../store/notifications';
import NotificationsPanel from './NotificationsPanel';
import { cn } from '../lib/utils';

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    loadUnreadCount,
    setNotificationsOpen,
  } = useNotificationStore();

  const [panelOpen, setPanelOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load unread count on mount (only if we have a token)
  useEffect(() => {
    // Check if we have a valid token in localStorage before loading
    const hasToken = () => {
      try {
        // Try different possible zustand persist keys
        let token = localStorage.getItem('token');
        if (token) return true;

        const authStore = localStorage.getItem('auth-store');
        if (authStore) {
          const parsed = JSON.parse(authStore);
          token = parsed?.state?.token || parsed?.token;
          if (token) return true;
        }

        const useAuthStore = localStorage.getItem('useAuthStore');
        if (useAuthStore) {
          const parsed = JSON.parse(useAuthStore);
          token = parsed?.state?.token || parsed?.token;
          if (token) return true;
        }

        return false;
      } catch {
        return false;
      }
    };

    // Only load if we have a token
    if (hasToken()) {
      loadUnreadCount().catch((err) => {
        console.warn('Failed to load unread count:', err?.message);
      });

      // Refresh unread count every 30 seconds
      const interval = setInterval(() => {
        loadUnreadCount().catch((err) => {
          console.warn('Failed to refresh unread count:', err?.message);
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [loadUnreadCount]);

  // Load recent notifications when dropdown opens
  useEffect(() => {
    if (showDropdown && notifications.length === 0) {
      // Only try to load if we likely have a token
      loadNotifications(5, 0, 'all').catch((err) => {
        console.warn('Failed to load notifications:', err?.message);
        // Silently fail - user may not be authenticated yet
      });
    }
  }, [showDropdown, loadNotifications, notifications.length]);

  const recentNotifications = notifications.slice(0, 5);

  const handleViewAll = () => {
    setShowDropdown(false);
    setPanelOpen(true);
  };

  return (
    <>
      {/* Bell Button */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-all duration-200"
          aria-label="Notifications"
        >
          <BellIcon size={20} className="transition-transform duration-200 hover:scale-110" />

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full text-xs font-bold text-white animate-pulse flex items-center justify-center shadow-lg">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-200 dark:border-dark-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {unreadCount} unread
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-200 dark:divide-dark-700">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentNotifications.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="text-2xl mb-2">📭</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                </div>
              ) : (
                recentNotifications.map((notification) => {
                  const typeConfig = getNotificationTypeConfig(notification.type);
                  const createdTime = new Date(notification.created_at);
                  const timeAgo = formatTimeAgo(createdTime);

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors',
                        notification.is_read
                          ? 'bg-gray-50 dark:bg-dark-900'
                          : 'bg-blue-50/50 dark:bg-blue-900/20'
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 text-lg">{typeConfig.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {timeAgo}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-dark-700">
                <button
                  onClick={handleViewAll}
                  className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Panel Modal */}
      {panelOpen && <NotificationsPanel onClose={() => setPanelOpen(false)} />}
    </>
  );
}

// Helper: Get notification type configuration
function getNotificationTypeConfig(type) {
  const configs = {
    'transfer:new': { icon: '🎁', color: 'blue' },
    'transfer:assigned': { icon: '📦', color: 'blue' },
    'callback:reminder': { icon: '⏰', color: 'orange' },
    'callback:due': { icon: '⏰', color: 'orange' },
    'sale:made': { icon: '✅', color: 'green' },
    'batch:assigned': { icon: '📋', color: 'purple' },
    'batch:completed': { icon: '✓', color: 'purple' },
    'record:flagged': { icon: '🚩', color: 'red' },
    'team:event': { icon: '👥', color: 'indigo' },
    'operations:alert': { icon: '🔔', color: 'yellow' },
  };

  return configs[type] || { icon: '🔔', color: 'gray' };
}

// Helper: Format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
