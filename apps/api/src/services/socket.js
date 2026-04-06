import { Server } from 'socket.io';
import { getRedis, isRedisConnected } from './redis.js';

let io = null;

export function initSocket(httpServer) {
  // Determine CORS origin - support multiple formats
  let corsOrigin = 'http://localhost:5173';

  if (process.env.FRONTEND_URL) {
    corsOrigin = process.env.FRONTEND_URL === '*' ? true : process.env.FRONTEND_URL;
  } else if (process.env.NODE_ENV === 'production') {
    // In production without explicit FRONTEND_URL, allow all origins
    // (relies on socket.io connection with proper credentials)
    corsOrigin = true;
  }

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    pingInterval: 30000,
    pingTimeout: 60000,
  });

  // Redis adapter setup deferred - works without it for single instance
  console.log('✅ Socket.io initialized (single instance mode)');

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', ({ userId, companyId, role }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user:${userId}`);
      }
      if (companyId) {
        socket.join(`company:${companyId}`);
        console.log(`Socket ${socket.id} joined company:${companyId}`);
      }
      if (role) {
        socket.join(`role:${role}`);
        console.log(`Socket ${socket.id} joined role:${role}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });

    // Worker emits this event when callback time is due
    socket.on('callback:fire', ({ userId, callback }) => {
      if (!userId || !callback) return;
      notifyCallbackDue(userId, callback);
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

export function notifyRole(role, event, data) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, data);
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
