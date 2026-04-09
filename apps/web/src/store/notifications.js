import { create } from 'zustand';
import { useAuthStore } from './auth';

/**
 * Get API base URL - uses relative paths for proper proxy behavior
 * In development: /api (proxied to http://localhost:4000)
 * In production: /api (proxied by nginx to api container)
 */
const API_BASE_URL = '/api/v1';

/**
 * Get auth token from auth store
 * @returns {string|null} JWT token or null if not available
 */
function getAuthToken() {
  try {
    // Get token directly from auth store (most reliable)
    const { token } = useAuthStore.getState();
    
    if (token) {
      return token;
    }

    // Fallback to localStorage for persistence edge cases
    const possibleKeys = ['auth-store', 'useAuthStore', 'token'];

    for (const key of possibleKeys) {
      const stored = localStorage.getItem(key);
      if (!stored) continue;

      // If it's the token key directly, just return it
      if (key === 'token') {
        return stored;
      }

      // Otherwise it's JSON from zustand persist
      try {
        const parsed = JSON.parse(stored);
        // Zustand v4+ uses { state: {...} } structure
        const token = parsed?.state?.token || parsed?.token;
        if (token) {
          console.debug(`Found token in localStorage key: ${key}`);
          return token;
        }
      } catch (e) {
        // Continue to next key
      }
    }

    console.debug('No valid token found in auth store or localStorage');
    return null;
  } catch (err) {
    console.warn('Failed to get auth token:', err.message);
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();

  // If no token, return a rejected response to match fetch() behavior
  if (!token) {
    console.warn('fetchWithAuth: No token available');
    // Return a fake 401 response that matches fetch() API
    return new Response(JSON.stringify({ error: 'Unauthorized - no token' }), {
      status: 401,
      statusText: 'Unauthorized',
    });
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

export const useNotificationStore = create((set, get) => ({
  // Persistent notifications from server
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  totalCount: 0, // Track total notification count for pagination

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
    // Check if token is available before attempting
    const token = getAuthToken();
    if (!token) {
      console.debug('Notifications: No token available, skipping load');
      return { notifications: [], pagination: { total: 0, limit, offset, unreadCount: 0 } };
    }

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
          totalCount: pagination.total || 0,
          unreadCount: pagination.unreadCount || 0,
          loading: false,
        });

        return { notifications, pagination };
      } catch (err) {
        lastError = err;

        // Don't retry auth errors
        if (err.message.includes('Unauthorized') || err.message.includes('No authentication token')) {
          set({ error: err.message, loading: false });
          console.warn('Load notifications: Auth error, skipping retries');
          return { notifications: [], pagination: { total: 0, limit, offset, unreadCount: 0 } };
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
    return { notifications: [], pagination: { total: 0, limit, offset, unreadCount: 0 } };
  },

  /**
   * Get unread notification count with retry logic and auth check
   */
  loadUnreadCount: async () => {
    // Check if token is available before attempting
    const token = getAuthToken();
    if (!token) {
      console.debug('Notifications: No token available, returning 0');
      return 0;
    }

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
  clearAll: async () => {
    const token = getAuthToken();
    if (!token) {
      set({ notifications: [], unreadCount: 0 });
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/notifications`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.warn('Failed to clear notifications on server');
      }

      set({ notifications: [], unreadCount: 0, totalCount: 0 });
    } catch (err) {
      console.error('Clear all error:', err);
      // Still clear locally even if server fails
      set({ notifications: [], unreadCount: 0, totalCount: 0 });
    }
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
    set((state) => {
      const oldNotification = state.notifications.find((n) => n.id === notification.id);
      let unreadDelta = 0;

      // If read status changed, adjust unread count
      if (oldNotification && oldNotification.is_read !== notification.is_read) {
        unreadDelta = notification.is_read ? -1 : 1;
      }

      return {
        notifications: state.notifications.map((n) =>
          n.id === notification.id ? notification : n
        ),
        unreadCount: Math.max(0, state.unreadCount + unreadDelta),
      };
    });
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
