import { useEffect, useCallback } from 'react';

/**
 * Hook to handle browser notification permissions
 * Requests permission on first login and manages permission state
 */
export function useNotificationPermissions() {
  /**
   * Request browser notification permission
   * Called on first login or when user enables in settings
   */
  const requestPermission = useCallback(async () => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    // If already granted, return true
    if (Notification.permission === 'granted') {
      return true;
    }

    // If denied, don't ask again
    if (Notification.permission === 'denied') {
      console.log('Notifications are denied by user');
      return false;
    }

    // Request permission
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      return false;
    }
  }, []);

  /**
   * Show browser notification
   * @param {object} options - Notification options
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message/body
   * @param {string} options.icon - Icon URL
   * @param {string} options.tag - Notification tag (for replacing duplicates)
   */
  const showNotification = useCallback(
    (options) => {
      // Check if notifications are permitted
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return null;
      }

      try {
        const notification = new Notification(options.title || 'BizTrixVenture', {
          body: options.message || '',
          icon: options.icon || '/logo.png',
          tag: options.tag || 'notification',
          requireInteraction: false,
          badge: '/logo.png',
        });

        // Auto-close after 5 seconds
        const timeout = setTimeout(() => {
          notification.close();
        }, 5000);

        // Clear timeout if notification is manually closed
        notification.addEventListener('close', () => {
          clearTimeout(timeout);
        });

        // Click handler - focus window
        notification.addEventListener('click', () => {
          window.focus();
          notification.close();
        });

        return notification;
      } catch (err) {
        console.error('Failed to show notification:', err);
        return null;
      }
    },
    []
  );

  /**
   * Check notification permission status
   */
  const getPermissionStatus = useCallback(() => {
    if (!('Notification' in window)) {
      return 'not_supported';
    }
    return Notification.permission;
  }, []);

  /**
   * Initialize on component mount
   * Request permission if not already done
   */
  useEffect(() => {
    // Check if user has already been asked
    const permissionAsked = localStorage.getItem('notification_permission_asked');

    if (!permissionAsked && getPermissionStatus() === 'default') {
      // Mark that we've asked
      localStorage.setItem('notification_permission_asked', 'true');

      // Request permission on next tick to avoid blocking UI
      setTimeout(() => {
        requestPermission();
      }, 500);
    }
  }, [requestPermission, getPermissionStatus]);

  return {
    requestPermission,
    showNotification,
    getPermissionStatus,
    isSupported: 'Notification' in window,
  };
}
