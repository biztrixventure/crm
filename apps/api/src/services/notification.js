import { getIO, notifyRole } from './socket.js';

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
  // Notify only admin roles
  const payload = {
    message: `New ${entityType} created: ${entity.name || entity.full_name}`,
    entityType,
    entity,
    timestamp: new Date().toISOString(),
  };

  notifyRole('super_admin', 'admin:new_entity', payload);
  notifyRole('readonly_admin', 'admin:new_entity', payload);
}

// Closer Manager events
export function notifyCloserManagerEvent({ eventType, message, userId, closerId, batchId }) {
  const payload = {
    eventType,
    message,
    closerId,
    batchId,
    timestamp: new Date().toISOString(),
  };

  // Notify all closer manager instances
  const io = getIO();
  io.to('role:closer_manager').emit('closer_manager:event', payload);

  // Also notify specific user if provided
  if (userId) {
    emitToUser(userId, 'closer_manager:event', payload);
  }
}

// Operations Manager events
export function notifyOperationsManagerEvent({ eventType, message }) {
  const payload = {
    eventType,
    message,
    timestamp: new Date().toISOString(),
  };

  const io = getIO();
  io.to('role:operations_manager').emit('operations_manager:event', payload);
}

// Compliance Manager events
export function notifyComplianceManagerEvent({ eventType, message, userId, batchId, recordId }) {
  const payload = {
    eventType,
    message,
    batchId,
    recordId,
    timestamp: new Date().toISOString(),
  };

  // Notify all compliance manager instances
  const io = getIO();
  io.to('role:compliance_manager').emit('compliance_manager:event', payload);

  // Also notify specific manager
  if (userId) {
    emitToUser(userId, 'compliance_manager:event', payload);
  }
}

// Compliance Agent events
export function notifyComplianceAgentEvent({ eventType, message, userId, batchId }) {
  const payload = {
    eventType,
    message,
    batchId,
    timestamp: new Date().toISOString(),
  };

  // Notify specific agent
  if (userId) {
    emitToUser(userId, 'compliance_agent:event', payload);
    const io = getIO();
    io.to(`compliance_agent:${userId}`).emit('compliance_agent:event', payload);
  }
}

export default {
  emitToUser,
  emitToCompany,
  notifyTransferCreated,
  notifySaleMade,
  notifyCallbackDue,
  notifyAdminNewEntity,
  notifyCloserManagerEvent,
  notifyOperationsManagerEvent,
  notifyComplianceManagerEvent,
  notifyComplianceAgentEvent,
};
