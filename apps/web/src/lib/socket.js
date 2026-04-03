import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket = null;

export function initSocket() {
  if (socket?.connected) return socket;

  const isHttps = window.location.protocol === 'https:';
  const isProdHost = !['localhost', '127.0.0.1'].includes(window.location.hostname);

  socket = io(window.location.origin, {
    // Behind reverse proxies, polling-first is more reliable than websocket-first.
    transports: isProdHost ? ['polling'] : ['websocket', 'polling'],
    upgrade: !isProdHost,
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
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
