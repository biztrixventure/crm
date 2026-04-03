import { Server } from 'socket.io';
import { getRedis, isRedisConnected } from './redis.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL === '*' ? true : (process.env.FRONTEND_URL || 'http://localhost:5173'),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Redis adapter setup deferred - works without it for single instance
  console.log('✅ Socket.io initialized (single instance mode)');

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', ({ userId, companyId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user:${userId}`);
      }
      if (companyId) {
        socket.join(`company:${companyId}`);
        console.log(`Socket ${socket.id} joined company:${companyId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket() first.');
  }
  return io;
}

// Notification helpers
export function notifyUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function notifyCompany(companyId, event, data) {
  if (!io) return;
  io.to(`company:${companyId}`).emit(event, data);
}

export function notifyTransferToCloser(closerId, transfer) {
  notifyUser(closerId, 'transfer:new', {
    message: `New transfer incoming from ${transfer.companyName}`,
    transfer,
  });
}

export function notifySaleToCompany(companyId, outcome) {
  notifyCompany(companyId, 'sale:new', {
    message: `Sale recorded by ${outcome.closerName} for your lead`,
    outcome,
  });
}

export function notifyCallbackDue(userId, callback) {
  notifyUser(userId, 'callback:due', {
    message: `Callback reminder: ${callback.customerName}`,
    callback,
  });
}

export default { initSocket, getIO };
