import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function initSocket() {
  if (socket?.connected) return socket;

  const isHttps = window.location.protocol === 'https:';

  // WebSocket only for production reliability (avoids reverse proxy polling issues)
  // Include polling as fallback for network transitions
  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000, // Increased timeout for slow networks
    secure: isHttps,
  });

  return socket;
}

export function connectSocket() {
  if (!socket) {
    socket = initSocket();
  }

  const { user } = useAuthStore.getState();

  if (!socket.connected && user) {
    socket.connect();
  }

  // Single connect listener
  socket.off('connect');
  socket.on('connect', () => {
    console.log('✓ Socket connected');
    reconnectAttempts = 0;
    socket.emit('join', {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    });
  });

  // Better error and reconnection handling
  socket.off('connect_error');
  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    console.warn(
      `Socket connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`,
      error?.message || error
    );

    // If max retries exceeded, show more detailed warning
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        '❌ Socket.io disconnect - check API server status. App will function with polling.'
      );
    }
  });

  // Disconnection handler
  socket.off('disconnect');
  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server disconnected, attempt reconnect
      socket.connect();
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
