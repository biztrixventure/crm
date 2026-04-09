import { useEffect, useState } from 'react';
import { XIcon, Loader2Icon, CheckCheck, Trash } from 'lucide-react';
import { useNotificationStore } from '../store/notifications';
import NotificationItem from './NotificationItem';
import { cn } from '../lib/utils';

export default function NotificationsPanel({ onClose }) {
  const {
    notifications,
    totalCount,
    unreadCount,
    loading,
    currentPage,
    setCurrentPage,
    loadNotifications,
    markAllRead,
    deleteNotification,
  } = useNotificationStore();

  const [filter, setFilter] = useState('all');
  const [pageSize] = useState(10);

  // Load notifications on mount and when filter changes
  useEffect(() => {
    loadNotifications(pageSize, 0, filter);
    setCurrentPage(0);
  }, [filter, pageSize, loadNotifications, setCurrentPage]);

  // Load new page data when currentPage changes
  useEffect(() => {
    const offset = currentPage * pageSize;
    loadNotifications(pageSize, offset, filter).catch(err => {
      console.error('Failed to load page:', err);
    });
  }, [currentPage, filter, pageSize, loadNotifications]);

  const startIndex = currentPage * pageSize;
  const displayedNotifications = notifications.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleDeleteNotification = async (id) => {
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-sm text-blue-100 mt-0.5">
                {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <XIcon size={24} className="text-white" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-gray-50 dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 px-6 py-3 flex items-center justify-between">
          {/* Filter tabs */}
          <div className="flex gap-2">
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon size={24} className="text-blue-500 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-dark-700">
              {displayedNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onDelete={handleDeleteNotification}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination and footer */}
        {notifications.length > 0 && (
          <div className="bg-gray-50 dark:bg-dark-900 border-t border-gray-200 dark:border-dark-700 px-6 py-3 flex items-center justify-between">
            {/* Page info */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {totalCount > 0 ? (
                <>
                  Showing {startIndex + 1}–
                  {Math.min(startIndex + pageSize, totalCount)} of{' '}
                  {totalCount}
                </>
              ) : (
                'No notifications'
              )}
            </div>

            {/* Pagination buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    className={cn(
                      'w-8 h-8 text-sm font-medium rounded transition-colors',
                      currentPage === idx
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'
                    )}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
