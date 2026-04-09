import { useState } from 'react';
import { XIcon, CheckIcon } from 'lucide-react';
import { useNotificationStore } from '../store/notifications';
import { cn } from '../lib/utils';

// Map notification types to icons and colors
const NOTIFICATION_TYPE_CONFIG = {
  'transfer:new': { icon: '🎁', color: 'bg-blue-500', label: 'Transfer' },
  'transfer:assigned': { icon: '📦', color: 'bg-blue-500', label: 'Transfer' },
  'transfer:reassigned': { icon: '📦', color: 'bg-blue-500', label: 'Transfer' },
  'callback:reminder': { icon: '⏰', color: 'bg-orange-500', label: 'Callback' },
  'callback:due': { icon: '⏰', color: 'bg-orange-500', label: 'Callback' },
  'callback:created': { icon: '⏳', color: 'bg-orange-500', label: 'Callback' },
  'sale:made': { icon: '✅', color: 'bg-green-500', label: 'Sale' },
  'outcome:created': { icon: '📝', color: 'bg-green-500', label: 'Outcome' },
  'batch:assigned': { icon: '📋', color: 'bg-purple-500', label: 'Batch' },
  'batch:completed': { icon: '✓', color: 'bg-purple-500', label: 'Batch' },
  'batch:reminder': { icon: '⚠️', color: 'bg-purple-500', label: 'Batch' },
  'record:flagged': { icon: '🚩', color: 'bg-red-500', label: 'Flag' },
  'team:event': { icon: '👥', color: 'bg-indigo-500', label: 'Team' },
  'operations:alert': { icon: '🔔', color: 'bg-yellow-500', label: 'Alert' },
  'test:notification': { icon: '🧪', color: 'bg-gray-500', label: 'Test' },
};

export default function NotificationItem({ notification, onDelete }) {
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const [deleting, setDeleting] = useState(false);

  const typeConfig = NOTIFICATION_TYPE_CONFIG[notification.type] || {
    icon: '🔔',
    color: 'bg-gray-500',
    label: 'Notification',
  };

  const createdTime = new Date(notification.created_at);
  const now = new Date();
  const diffMs = now - createdTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo = 'just now';
  if (diffMins > 0 && diffMins < 60) timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  else if (diffHours > 0 && diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  else if (diffDays > 0 && diffDays < 7) timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  else timeAgo = createdTime.toLocaleDateString();

  const handleMarkAsRead = async () => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(notification.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        'p-3 border-l-4 flex gap-3 items-start justify-between hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors',
        notification.is_read
          ? 'border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900'
          : 'border-blue-500 bg-white dark:bg-dark-800'
      )}
    >
      {/* Icon and content */}
      <div className="flex gap-3 items-start flex-1 min-w-0">
        {/* Icon */}
        <div
          className={cn(
            'text-xl flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white',
            typeConfig.color
          )}
        >
          {typeConfig.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with type badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {notification.title}
            </span>
            {!notification.is_read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 flex-shrink-0">
              {typeConfig.label}
            </span>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {notification.message}
          </p>

          {/* Time */}
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {timeAgo}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        {/* Mark as read button */}
        {!notification.is_read && (
          <button
            onClick={handleMarkAsRead}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Mark as read"
          >
            <CheckIcon size={16} />
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors disabled:opacity-50"
          title="Delete"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
}
