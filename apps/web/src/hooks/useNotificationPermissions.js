import { useEffect, useCallback } from 'react';

/**
 * Hook to handle browser notification permissions
 * Requests permission on first login and manages permission state
 * Gracefully handles browsers that don't support notifications
 */
export function useNotificationPermissions() {
  /**
   * Request browser notification permission
   * Called on first login or when user enables in settings
   */
  const requestPermission = useCallback(async () => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('ℹ This browser does not support notifications');
      return false;
    }

    // If already granted, return true
    if (Notification.permission === 'granted') {
      console.log('✓ Notifications already granted');
      return true;
    }

    // If previously denied, don't spam with prompts
    if (Notification.permission === 'denied') {
      console.log('ℹ Notifications previously denied by user');
      return false;
    }

    // Request permission
    try {
      console.log('🔔 Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log(`Notification permission: ${permission}`);
      return permission === 'granted';
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      return false;
    }
  }, []);

  /**
   * Show browser notification with error handling
   * @param {object} options - Notification options
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message/body
   * @param {string} options.icon - Icon URL
   * @param {string} options.tag - Notification tag (for grouping duplicates)
   */
  const showNotification = useCallback(
    (options) => {
      // Check if notifications are available and permitted
      if (!('Notification' in window)) {
        return null;
      }

      if (Notification.permission !== 'granted') {
        // Silently skip if not granted (user denied or didn't respond)
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

        // Auto-close after 5 seconds if user doesn't interact
        const timeout = setTimeout(() => {
          try {
            notification.close();
          } catch (e) {
            // Notification already closed, ignore
          }
        }, 5000);

        // Clear timeout if notification is manually closed
        notification.addEventListener('close', () => {
          clearTimeout(timeout);
        });

        // Click handler - focus window
        notification.addEventListener('click', () => {
          window.focus();
          try {
            notification.close();
          } catch (e) {
            // Already closed, ignore
          }
        });

        return notification;
      } catch (err) {
        console.warn('Failed to show notification:', err);
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
   * Initialize permission request on component mount
   * Only asks once per user, respects browser decisions
   */
  useEffect(() => {
    // Only request if we haven't asked yet and browser supports notifications
    if (!('Notification' in window)) {
      return;
    }

    const permissionAsked = localStorage.getItem('notification_permission_asked');
    const status = getPermissionStatus();

    if (!permissionAsked && status === 'default') {
      // Mark that we've asked (even if user doesn't respond immediately)
      localStorage.setItem('notification_permission_asked', 'true');

      // Delay request to avoid blocking UI
      const timer = setTimeout(() => {
        requestPermission().catch((err) => {
          console.error('Permission request error:', err);
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [requestPermission, getPermissionStatus]);

  return {
    requestPermission,
    showNotification,
    getPermissionStatus,
    isSupported: 'Notification' in window,
  };
}
