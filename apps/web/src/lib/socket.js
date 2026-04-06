import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket = null;

export function initSocket() {
  if (socket?.connected) return socket;

  const isHttps = window.location.protocol === 'https:';

  // For production, use websocket only to avoid reverse proxy polling issues
  // Polling returns 400 on some reverse proxies, websocket is more reliable
  socket = io(window.location.origin, {
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 10000,
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

  // Ensure a single connect listener
  socket.off('connect');
  socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('join', {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    });
  });

  // Handle connection errors gracefully
  socket.off('connect_error');
  socket.on('connect_error', (error) => {
    console.warn('Socket.io offline (app still works):', error?.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}

export function getSocket() {
  return socket;
}
