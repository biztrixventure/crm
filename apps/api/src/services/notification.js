import { getIO } from './socket.js';

export function emitToUser(userId, event, data) {
  const io = getIO();
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToCompany(companyId, event, data) {
  const io = getIO();
  io.to(`company:${companyId}`).emit(event, data);
}

// Transfer submitted - notify the selected closer
export function notifyTransferCreated(closerId, transfer, companyName) {
  emitToUser(closerId, 'transfer:new', {
    message: `New transfer incoming from ${companyName}`,
    transfer,
    timestamp: new Date().toISOString(),
  });
}

// Sale made - notify company admin
export function notifySaleMade(companyId, outcome, closerName) {
  emitToCompany(companyId, 'sale:made', {
    message: `Sale recorded by ${closerName} for your lead`,
    outcome,
    timestamp: new Date().toISOString(),
  });
}

// Callback due - notify the user who created it
export function notifyCallbackDue(userId, callback) {
  emitToUser(userId, 'callback:due', {
    message: `Callback reminder: ${callback.customer_name}`,
    callback,
    timestamp: new Date().toISOString(),
  });
}

// New company/user created - notify super admin
export function notifyAdminNewEntity(entityType, entity) {
  const io = getIO();
  // Broadcast to all connected super admins
  io.emit('admin:new_entity', {
    message: `New ${entityType} created: ${entity.name || entity.full_name}`,
    entityType,
    entity,
    timestamp: new Date().toISOString(),
  });
}

export default {
  emitToUser,
  emitToCompany,
  notifyTransferCreated,
  notifySaleMade,
  notifyCallbackDue,
  notifyAdminNewEntity,
};
