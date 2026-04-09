import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const useNotificationStore = create((set, get) => ({
  // Persistent notifications from server
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  // UI state
  notificationsOpen: false,
  currentPage: 0,

  // ===== Legacy Toast Notifications (auto-dismiss) =====

  addNotification: (notification) => {
    const id = Date.now();
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id, ...notification, createdAt: new Date() },
      ],
      unreadCount: state.unreadCount + 1,
    }));

    // Auto-remove after 10 seconds
    setTimeout(() => {
      get().removeNotification(id);
    }, 10000);

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  // ===== Persistent Notifications API Methods =====

  /**
   * Load notifications from server
   */
  loadNotifications: async (limit = 20, offset = 0, filter = 'all') => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}&filter=${filter}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load notifications: ${response.status}`);
      }

      const { notifications, pagination } = await response.json();

      set({
        notifications,
        unreadCount: pagination.unreadCount || 0,
        loading: false,
      });

      return { notifications, pagination };
    } catch (err) {
      console.error('Load notifications error:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  /**
   * Get unread notification count
   */
  loadUnreadCount: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/count`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load unread count');

      const { unreadCount } = await response.json();
      set({ unreadCount });
      return unreadCount;
    } catch (err) {
      console.error('Load unread count error:', err);
      return 0;
    }
  },

  /**
   * Mark single notification as read
   */
  markAsRead: async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      console.error('Mark as read error:', err);
      throw err;
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllRead: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to mark all as read');

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('Mark all read error:', err);
      throw err;
    }
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete notification');

      // Update local state
      set((state) => {
        const deleted = state.notifications.find((n) => n.id === notificationId);
        return {
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadCount: deleted && !deleted.is_read
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch (err) {
      console.error('Delete notification error:', err);
      throw err;
    }
  },

  /**
   * Clear all notifications
   */
  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  // ===== Real-time Updates (from Socket.io) =====

  /**
   * Add notification in real-time from socket event
   */
  addNotificationRealtime: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  /**
   * Update notification in real-time
   */
  updateNotificationRealtime: (notification) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notification.id ? notification : n
      ),
    }));
  },

  /**
   * Remove notification in real-time
   */
  removeNotificationRealtime: (notificationId) => {
    set((state) => {
      const deleted = state.notifications.find((n) => n.id === notificationId);
      return {
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: deleted && !deleted.is_read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    });
  },

  // ===== UI State =====

  setNotificationsOpen: (open) => set({ notificationsOpen: open }),
  setCurrentPage: (page) => set({ currentPage: page }),
}));
