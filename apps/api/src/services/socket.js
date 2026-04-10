import { Server } from 'socket.io';
import { getRedis, isRedisConnected } from './redis.js';
import { notifyCallbackDuePersistent } from './notification.js';

let io = null;

export function initSocket(httpServer) {
  // Determine CORS origin for Socket.io
  // In production, should match FRONTEND_URL environment variable
  let corsOrigin = process.env.FRONTEND_URL;

  // Fallback logic
  if (!corsOrigin) {
    if (process.env.NODE_ENV === 'production') {
      // Production: default to localhost, but better to have FRONTEND_URL set
      corsOrigin = true; // Allow all origins (relies on withCredentials=true)
    } else {
      corsOrigin = 'http://localhost:5173';
    }
  } else if (corsOrigin === '*') {
    corsOrigin = true; // Socket.io expects true instead of '*'
  }

  // Initialize Socket.io with production settings
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    // Transport configuration
    transports: ['websocket', 'polling'],
    allowEIO3: true,

    // Connection settings
    pingInterval: 30000,
    pingTimeout: 60000,
    upgradeTimeout: 10000,

    // Buffering
    maxHttpBufferSize: 1e6, // 1MB
    perMessageDeflate: false, // Disable for better proxy compatibility

    // Parser
    parser: require('socket.io-parser')
  });

  console.log('✅ Socket.io initialized', {
    mode: 'production',
    transports: ['websocket', 'polling'],
    corsOrigin,
    maxHttpBufferSize: '1MB'
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✓ Socket connected: ${socket.id}`);

    // Join room event
    socket.on('join', ({ userId, companyId, role }) => {
      try {
        if (userId) {
          socket.join(`user:${userId}`);
          console.log(`  └─ joined: user:${userId}`);
        }
        if (companyId) {
          socket.join(`company:${companyId}`);
          console.log(`  └─ joined: company:${companyId}`);
        }
        if (role) {
          socket.join(`role:${role}`);
          console.log(`  └─ joined: role:${role}`);
        }
      } catch (err) {
        console.error('Error joining rooms:', err);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`✗ Socket disconnected: ${socket.id}`);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`Socket error (${socket.id}):`, error);
    });

    // Worker callback notification
    socket.on('callback:fire', async ({ userId, callback }) => {
      if (!userId || !callback) return;
      try {
        await notifyCallbackDuePersistent(userId, callback);
      } catch (err) {
        console.error('Error handling callback:fire event:', err);
      }
    });
  });

  // Global error handler
  io.on('error', (error) => {
    console.error('Socket.io error:', error);
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket() first.');
  }
  return io;
}

// ===== Notification Helpers =====

export function notifyUser(userId, event, data) {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit(event, data);
  } catch (err) {
    console.error(`Error notifying user ${userId}:`, err);
  }
}

export function notifyCompany(companyId, event, data) {
  if (!io) return;
  try {
    io.to(`company:${companyId}`).emit(event, data);
  } catch (err) {
    console.error(`Error notifying company ${companyId}:`, err);
  }
}

export function notifyRole(role, event, data) {
  if (!io) return;
  try {
    io.to(`role:${role}`).emit(event, data);
  } catch (err) {
    console.error(`Error notifying role ${role}:`, err);
  }
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
