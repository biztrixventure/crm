import { useEffect, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';
import { useNotificationSounds } from './useNotificationSounds';
import { useNotificationPermissions } from './useNotificationPermissions';
import toast from 'react-hot-toast';

export function useSocket() {
  const { user, token } = useAuthStore();
  const {
    addNotification,
    addNotificationRealtime,
    removeNotificationRealtime,
  } = useNotificationStore((state) => ({
    addNotification: state.addNotification,
    addNotificationRealtime: state.addNotificationRealtime,
    removeNotificationRealtime: state.removeNotificationRealtime,
  }));

  const { playSound } = useNotificationSounds();
  const { showNotification } = useNotificationPermissions();

  useEffect(() => {
    if (!user || !token) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    // ===== Legacy Event Handlers (backward compatibility) =====
    // (kept for compatibility with existing notifications)

    socket.off('transfer:new');
    socket.off('sale:made');
    socket.off('callback:due');
    socket.off('admin:new_entity');

    socket.on('transfer:new', (data) => {
      toast.success(data.message, { duration: 5000 });
      addNotification({
        type: 'transfer',
        title: 'New Transfer',
        message: data.message,
        data: data.transfer,
      });
      playSound('transfer');
    });

    socket.on('sale:made', (data) => {
      toast.success(data.message, { duration: 5000 });
      addNotification({
        type: 'sale',
        title: 'Sale Made!',
        message: data.message,
        data: data.outcome,
      });
      playSound('sale');
    });

    socket.on('callback:due', (data) => {
      toast(data.message, {
        icon: '📞',
        duration: 10000,
      });
      addNotification({
        type: 'callback',
        title: 'Callback Reminder',
        message: data.message,
        data: data.callback,
      });
      playSound('callback');

      // Show browser notification
      showNotification({
        title: 'Callback Reminder',
        message: data.message,
      });
    });

    socket.on('admin:new_entity', (data) => {
      toast.success(data.message);
      addNotification({
        type: 'admin',
        title: `New ${data.entityType}`,
        message: data.message,
        data: data.entity,
      });
      playSound('alert');
    });

    // ===== New Persistent Notification Events =====

    socket.off('notification:new');
    socket.on('notification:new', (notification) => {
      // Add to store for real-time sync across tabs
      addNotificationRealtime(notification);

      // Show toast for immediate visibility
      toast.success(notification.message, { duration: 5000 });

      // Play sound based on notification type
      if (notification.type.includes('transfer')) playSound('transfer');
      else if (notification.type.includes('callback')) playSound('callback');
      else if (notification.type.includes('sale')) playSound('sale');
      else if (notification.type.includes('batch')) playSound('batch');
      else if (notification.type.includes('alert') || notification.type.includes('flagged'))
        playSound('alert');
      else playSound('callback'); // default

      // Show browser notification
      showNotification({
        title: notification.title,
        message: notification.message,
        tag: notification.id,
      });
    });

    socket.off('notification:read');
    socket.on('notification:read', (data) => {
      // Notification marked as read on another tab/client
      // Store will handle UI update
    });

    socket.off('notification:deleted');
    socket.on('notification:deleted', (data) => {
      // Remove from store for real-time sync
      removeNotificationRealtime(data.notificationId);
    });

    socket.off('notifications:read-all');
    socket.on('notifications:read-all', (data) => {
      // All notifications marked as read on another tab/client
      // Store will handle UI update
    });

    socket.off('connect_error');
    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err?.message || 'connection failed');
    });

    return () => {
      socket.off('transfer:new');
      socket.off('sale:made');
      socket.off('callback:due');
      socket.off('admin:new_entity');
      socket.off('notification:new');
      socket.off('notification:read');
      socket.off('notification:deleted');
      socket.off('notifications:read-all');
      socket.off('connect_error');
    };
  }, [user, token, addNotification, addNotificationRealtime, removeNotificationRealtime, playSound, showNotification]);

  return getSocket();
}
