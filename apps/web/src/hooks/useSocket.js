import { useEffect, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';
import toast from 'react-hot-toast';

export function useSocket() {
  const { user, token } = useAuthStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (!user || !token) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    // Event handlers (ensure no duplicate listeners on re-renders)
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
    });

    socket.on('sale:made', (data) => {
      toast.success(data.message, { duration: 5000 });
      addNotification({
        type: 'sale',
        title: 'Sale Made!',
        message: data.message,
        data: data.outcome,
      });
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
      
      // Request browser notification permission and show
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Callback Reminder', {
          body: data.message,
          icon: '/favicon.svg',
        });
      }
    });

    socket.on('admin:new_entity', (data) => {
      toast.success(data.message);
      addNotification({
        type: 'admin',
        title: `New ${data.entityType}`,
        message: data.message,
        data: data.entity,
      });
    });

    return () => {
      socket.off('transfer:new');
      socket.off('sale:made');
      socket.off('callback:due');
      socket.off('admin:new_entity');
    };
  }, [user, token, addNotification]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return getSocket();
}
