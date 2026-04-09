import { create } from 'zustand';

/**
 * Get API base URL - uses relative paths for proper proxy behavior
 * In development: /api (proxied to http://localhost:4000)
 * In production: /api (proxied by nginx to api container)
 */
const API_BASE_URL = '/api/v1';

/**
 * Get auth token from localStorage
 * @returns {string|null} JWT token or null if not available
 */
function getAuthToken() {
  try {
    // First try sessionStorage (immediate)
    let token = sessionStorage.getItem('token');
    if (token) return token;

    // Then try localStorage (persistent)
    token = localStorage.getItem('token');
    if (token) return token;

    // Check if zustand auth store has token
    const { useAuthStore } = require('../store/auth');
    const authToken = useAuthStore.getState()?.token;
    if (authToken) return authToken;

    return null;
  } catch (err) {
    console.warn('Failed to get auth token:', err);
    return null;
  }
}

/**
 * Make authenticated API request with retry logic
 */
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();

  // Return early if no token available
  if (!token) {
    throw new Error('No authentication token available');
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

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
   * Load notifications from server with error handling and auth check
   */
  loadNotifications: async (limit = 20, offset = 0, filter = 'all') => {
    set({ loading: true, error: null });
    let retries = 2;
    let lastError;

    while (retries >= 0) {
      try {
        const response = await fetchWithAuth(
          `${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}&filter=${filter}`
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized - please log in again');
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const { notifications, pagination } = await response.json();

        set({
          notifications,
          unreadCount: pagination.unreadCount || 0,
          loading: false,
        });

        return { notifications, pagination };
      } catch (err) {
        lastError = err;

        // Don't retry auth errors
        if (err.message.includes('Unauthorized') || err.message.includes('No authentication token')) {
          set({ error: err.message, loading: false });
          throw err;
        }

        console.warn(`Load notifications error (attempt ${2 - retries}/2):`, err?.message);

        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        retries--;
      }
    }

    console.error('Load notifications failed:', lastError);
    set({ error: lastError?.message || 'Failed to load notifications', loading: false });
    throw lastError;
  },

  /**
   * Get unread notification count with retry logic and auth check
   */
  loadUnreadCount: async () => {
    let retries = 2;
    let lastError;

    while (retries >= 0) {
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/count`);

        if (!response.ok) {
          if (response.status === 401) {
            console.warn('Notifications: Authentication required (401)');
            return 0; // Don't retry auth errors
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const { unreadCount } = await response.json();
        set({ unreadCount });
        return unreadCount;
      } catch (err) {
        lastError = err;

        // Don't retry auth errors
        if (err.message.includes('No authentication token')) {
          console.warn('Notifications: No token, skipping load');
          return 0;
        }

        if (err.message.includes('401')) {
          console.warn('Notifications: Auth failed, skip retries');
          return 0;
        }

        console.warn(`Load unread count error (attempt ${2 - retries}/2):`, err?.message);

        if (retries > 0) {
          // Retry after 1 second
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        retries--;
      }
    }

    console.error('Load unread count failed after retries:', lastError);
    return 0;
  },

  /**
   * Mark single notification as read with error handling
   */
  markAsRead: async (notificationId) => {
    let retries = 1;
    let lastError;

    while (retries >= 0) {
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}/read`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        // Update local state optimistically
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));

        return;
      } catch (err) {
        lastError = err;
        if (err.message.includes('Unauthorized') || err.message.includes('No authentication token')) {
          throw err;
        }

        console.warn(`Mark as read error (attempt ${1 - retries}/1):`, err?.message);

        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        retries--;
      }
    }

    console.error('Mark as read failed:', lastError);
    throw lastError;
  },

  /**
   * Mark all notifications as read
   */
  markAllRead: async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
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
      const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
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
