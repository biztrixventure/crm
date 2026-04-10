import supabase from './supabase.js';

// REMOVED: Socket.io functions (socket.js no longer exists)
// - emitToUser
// - emitToCompany
// - notifyTransferCreated
// - notifySaleMade
// - notifyCallbackDue
// - notifyAdminNewEntity
// - notifyCloserManagerEvent
// - notifyOperationsManagerEvent
// - notifyComplianceManagerEvent
// - notifyComplianceAgentEvent

// ===== Persistent Notification Functions =====

/**
 * Create persistent notification in database
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

    // NOTE: Socket.io real-time delivery removed (socket.js no longer exists)
    // Notifications are persisted in database and can be fetched via API

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

// REMOVED: Enhanced Event Notification Functions (socket.io dependent)
// - notifyTransferCreatedPersistent
// - notifySaleMadePersistent
// - notifyCallbackDuePersistent

export default {
  // Persistent database functions (socket.io removed)
  createNotification,
  notifyUserPersistent,
  notifyRolePersistent,
  notifyCompanyPersistent,
};
