import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket = null;

export function initSocket() {
  if (socket?.connected) return socket;

  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
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
