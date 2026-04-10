import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function initSocket() {
  if (socket?.connected) return socket;

  const isHttps = window.location.protocol === 'https:';

  // Initialize socket with production-ready configuration
  // WebSocket primary transport, polling fallback for nginx proxy compatibility
  socket = io(window.location.origin, {
    // Transport configuration
    transports: ['websocket', 'polling'],
    autoConnect: false,
    withCredentials: true,

    // Reconnection strategy
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    // Path and namespace (critical for nginx proxy)
    path: '/socket.io/',
    namespace: '/',

    // Timeouts - increased for production networks
    timeout: 20000,
    connect_timeout: 20000,
    ackTimeout: 10000,
    upgradeTimeout: 10000,

    // Connection settings
    secure: isHttps,

    // Auth token
    auth: () => ({
      token: useAuthStore.getState().token || localStorage.getItem('auth-store-token')
    })
  });

  return socket;
}

export function connectSocket() {
  if (!socket) {
    socket = initSocket();
  }

  const { user, token } = useAuthStore.getState();

  // Only connect if authenticated
  if (!socket.connected && user && token) {
    socket.connect();
  } else if (!user) {
    console.log('Socket not connecting - user not authenticated');
    return socket;
  }

  // Connection event - emit join with user details
  socket.off('connect');
  socket.on('connect', () => {
    console.log('✓ Socket connected', { socketId: socket.id });
    reconnectAttempts = 0;

    socket.emit('join', {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    });
  });

  // Connection error handling with detailed logging
  socket.off('connect_error');
  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    const errorInfo = {
      message: error?.message || String(error),
      code: error?.code,
      type: error?.type,
      attempt: reconnectAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS
    };

    console.warn(`Socket connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, errorInfo);

    // Show critical error after max retries
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        '❌ Socket.io failed to connect after multiple attempts. ' +
        'API server may be unavailable. App will continue with polling fallback.'
      );
    }
  });

  // Disconnection handling
  socket.off('disconnect');
  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);

    // Auto-reconnect on server disconnect
    if (reason === 'io server disconnect') {
      setTimeout(() => {
        if (user && token) {
          socket.connect();
        }
      }, 2000);
    }
  });

  // Error event
  socket.off('error');
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
  }
}

export function getSocket() {
  return socket;
}

export function isSocketConnected() {
  return socket?.connected ?? false;
}
