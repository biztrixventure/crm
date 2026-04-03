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
    
    socket.on('connect', () => {
      console.log('Socket connected');
      // Join user room
      socket.emit('join', {
        userId: user.id,
        companyId: user.companyId,
      });
    });
  }

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
