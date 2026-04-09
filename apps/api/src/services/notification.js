import { getIO, notifyRole } from './socket.js';
import supabase from './supabase.js';

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

// ===== Persistent Notification Functions =====

/**
 * Create persistent notification in database and emit socket event
 * @param {string} userId - User to notify
 * @param {string} type - Notification type (transfer:new, callback:due, etc)
 * @param {string} title - Display title
 * @param {string} message - Display message
 * @param {object} metadata - Additional data (transferId, callbackId, etc)
 * @param {string} companyId - Optional company ID
 * @param {string} role - User's role
 */
export async function createNotification(userId, type, title, message, metadata = {}, companyId = null, role = null) {
  try {
    // Create notification in database
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: role || 'user',
        type,
        title,
        message,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // Emit socket event for real-time delivery
    emitToUser(userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: notification.is_read,
      created_at: notification.created_at,
      timestamp: notification.created_at,
      metadata: notification.metadata,
    });

    return notification;
  } catch (err) {
    console.error('Create notification error:', err);
    throw err;
  }
}

/**
 * Create notification for a single user with persistence
 */
export async function notifyUserPersistent(userId, type, title, message, metadata = {}, companyId = null, role = null) {
  return createNotification(userId, type, title, message, metadata, companyId, role);
}

/**
 * Create notification for all users with a specific role
 */
export async function notifyRolePersistent(roleName, type, title, message, metadata = {}, userIds = []) {
  try {
    // If specific userIds provided, notify only those
    if (userIds.length > 0) {
      for (const userId of userIds) {
        await createNotification(userId, type, title, message, metadata, null, roleName);
      }
      return;
    }

    // Otherwise, query all users with that role
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .eq('role', roleName);

    if (error) throw error;

    // Create notifications for each user
    for (const user of users || []) {
      await createNotification(user.id, type, title, message, metadata, null, roleName);
    }
  } catch (err) {
    console.error('Notify role persistent error:', err);
    throw err;
  }
}

/**
 * Create notification for all users in a company
 */
export async function notifyCompanyPersistent(companyId, type, title, message, metadata = {}) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('company_id', companyId);

    if (error) throw error;

    // Create notifications for each user
    for (const user of users || []) {
      await createNotification(user.id, type, title, message, metadata, companyId, user.role);
    }
  } catch (err) {
    console.error('Notify company persistent error:', err);
    throw err;
  }
}

// ===== Enhanced Event Notification Functions =====

// Transfer submitted - notify the selected closer (PERSISTENT)
export async function notifyTransferCreatedPersistent(closerId, transfer, companyName, companyId, closer_role = 'closer') {
  const title = 'New Transfer';
  const message = `New transfer incoming from ${companyName}`;

  await createNotification(
    closerId,
    'transfer:new',
    title,
    message,
    { transferId: transfer.id, customerId: transfer.customer_name, companyName },
    companyId,
    closer_role
  );

  // Still emit for legacy socket listeners
  emitToUser(closerId, 'transfer:new', {
    message,
    transfer,
    timestamp: new Date().toISOString(),
  });
}

// Sale made - notify company admin (PERSISTENT)
export async function notifySaleMadePersistent(companyId, outcome, closerName, dispositions) {
  const title = 'Sale Recorded';
  const message = `Sale recorded by ${closerName} for your lead`;

  // Notify company admins
  await notifyCompanyPersistent(
    companyId,
    'sale:made',
    title,
    message,
    { outcomeId: outcome.id, closerId: outcome.closer_id, disposition: dispositions ? dispositions.label : 'Sale Made' }
  );

  // Still emit for legacy socket listeners
  emitToCompany(companyId, 'sale:made', {
    message,
    outcome,
    timestamp: new Date().toISOString(),
  });
}

// Callback due - notify the user who created it (PERSISTENT)
export async function notifyCallbackDuePersistent(userId, callback, userRole = 'closer') {
  const title = 'Callback Reminder';
  const message = `Callback reminder: ${callback.customer_name}`;

  await createNotification(
    userId,
    'callback:due',
    title,
    message,
    { callbackId: callback.id, customerName: callback.customer_name, customerPhone: callback.customer_phone },
    callback.company_id,
    userRole
  );

  // Still emit for legacy socket listeners
  emitToUser(userId, 'callback:due', {
    message,
    callback,
    timestamp: new Date().toISOString(),
  });
}

export default {
  emitToUser,
  emitToCompany,
  notifyTransferCreated: notifyTransferCreatedPersistent,
  notifySaleMade: notifySaleMadePersistent,
  notifyCallbackDue: notifyCallbackDuePersistent,
  notifyAdminNewEntity,
  notifyCloserManagerEvent,
  notifyOperationsManagerEvent,
  notifyComplianceManagerEvent,
  notifyComplianceAgentEvent,
  // New persistent functions
  createNotification,
  notifyUserPersistent,
  notifyRolePersistent,
  notifyCompanyPersistent,
  notifyTransferCreatedPersistent,
  notifySaleMadePersistent,
  notifyCallbackDuePersistent,
};
