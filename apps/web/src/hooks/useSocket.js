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
    if (!socket) {
      console.error('Failed to initialize socket connection');
      return;
    }

    // ===== Legacy Event Handlers (backward compatibility) =====

    socket.off('transfer:new');
    socket.on('transfer:new', (data) => {
      try {
        toast.success(data.message || 'New transfer incoming', { duration: 5000 });
        addNotification({
          type: 'transfer',
          title: 'New Transfer',
          message: data.message || 'New transfer incoming',
          data: data.transfer,
        });
        playSound('transfer');
      } catch (err) {
        console.error('Error handling transfer:new event:', err);
      }
    });

    socket.off('sale:made');
    socket.on('sale:made', (data) => {
      try {
        toast.success(data.message || 'Sale made', { duration: 5000 });
        addNotification({
          type: 'sale',
          title: 'Sale Made!',
          message: data.message || 'Sale made',
          data: data.outcome,
        });
        playSound('sale');
      } catch (err) {
        console.error('Error handling sale:made event:', err);
      }
    });

    socket.off('callback:due');
    socket.on('callback:due', (data) => {
      try {
        toast(data.message || 'Callback reminder', {
          icon: '📞',
          duration: 10000,
        });
        addNotification({
          type: 'callback',
          title: 'Callback Reminder',
          message: data.message || 'Callback reminder',
          data: data.callback,
        });
        playSound('callback');

        // Show browser notification
        showNotification({
          title: 'Callback Reminder',
          message: data.message || 'Callback reminder',
        });
      } catch (err) {
        console.error('Error handling callback:due event:', err);
      }
    });

    socket.off('admin:new_entity');
    socket.on('admin:new_entity', (data) => {
      try {
        toast.success(data.message || 'New entity created', {
          duration: 5000,
        });
        addNotification({
          type: 'admin',
          title: `New ${data.entityType || 'Entity'}`,
          message: data.message || 'New entity created',
          data: data.entity,
        });
        playSound('alert');
      } catch (err) {
        console.error('Error handling admin:new_entity event:', err);
      }
    });

    // ===== New Persistent Notification Events =====

    socket.off('notification:new');
    socket.on('notification:new', (notification) => {
      try {
        // Add to store for real-time sync across tabs
        addNotificationRealtime(notification);

        // Show toast for immediate visibility
        toast.success(notification.message || 'New notification', { duration: 5000 });

        // Play sound based on notification type
        try {
          if (notification.type.includes('transfer')) playSound('transfer');
          else if (notification.type.includes('callback')) playSound('callback');
          else if (notification.type.includes('sale')) playSound('sale');
          else if (notification.type.includes('batch')) playSound('batch');
          else if (notification.type.includes('alert') || notification.type.includes('flagged'))
            playSound('alert');
          else playSound('callback'); // default
        } catch (soundErr) {
          console.warn('Failed to play sound:', soundErr?.message);
        }

        // Show browser notification
        try {
          showNotification({
            title: notification.title || 'Notification',
            message: notification.message || '',
            tag: notification.id,
          });
        } catch (notifErr) {
          console.warn('Failed to show browser notification:', notifErr?.message);
        }
      } catch (err) {
        console.error('Error handling notification:new event:', err);
      }
    });

    socket.off('notification:read');
    socket.on('notification:read', (data) => {
      try {
        // Notification marked as read on another tab/client
        // Store will handle UI update if needed
      } catch (err) {
        console.error('Error handling notification:read event:', err);
      }
    });

    socket.off('notification:deleted');
    socket.on('notification:deleted', (data) => {
      try {
        // Remove from store for real-time sync
        removeNotificationRealtime(data.notificationId);
      } catch (err) {
        console.error('Error handling notification:deleted event:', err);
      }
    });

    socket.off('notifications:read-all');
    socket.on('notifications:read-all', (data) => {
      try {
        // All notifications marked as read on another tab/client
        // Store will handle UI update if needed
      } catch (err) {
        console.error('Error handling notifications:read-all event:', err);
      }
    });

    return () => {
      // Cleanup event listeners
      socket.off('transfer:new');
      socket.off('sale:made');
      socket.off('callback:due');
      socket.off('admin:new_entity');
      socket.off('notification:new');
      socket.off('notification:read');
      socket.off('notification:deleted');
      socket.off('notifications:read-all');
    };
  }, [user, token, addNotification, addNotificationRealtime, removeNotificationRealtime, playSound, showNotification]);

  return getSocket();
}
