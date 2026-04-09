/**
 * Notification sound configuration
 * Maps notification types to audio file paths
 */

export const NOTIFICATION_SOUNDS = {
  transfer: 'transfer.mp3',      // Positive/happy tone for new transfer
  callback: 'callback.mp3',      // Reminder/bell tone for callback
  sale: 'sale.mp3',              // Celebratory tone for sale
  batch: 'batch.mp3',            // Neutral notification tone for batch
  alert: 'alert.mp3',            // Urgent tone for alerts
};

/**
 * Map notification type to sound category
 */
export const NOTIFICATION_TYPE_TO_SOUND = {
  'transfer:new': 'transfer',
  'transfer:assigned': 'transfer',
  'transfer:reassigned': 'transfer',
  'callback:reminder': 'callback',
  'callback:due': 'callback',
  'callback:created': 'callback',
  'sale:made': 'sale',
  'outcome:created': 'sale',
  'batch:assigned': 'batch',
  'batch:completed': 'batch',
  'batch:reminder': 'batch',
  'record:flagged': 'alert',
  'team:event': 'callback',
  'operations:alert': 'alert',
  'test:notification': 'callback',
};

/**
 * Get sound file path for notification type
 */
export function getSoundPath(notificationType) {
  const soundType = NOTIFICATION_TYPE_TO_SOUND[notificationType] || 'callback';
  const fileName = NOTIFICATION_SOUNDS[soundType];
  return `/sounds/${fileName}`;
}

/**
 * Get sound type from notification type
 */
export function getSoundType(notificationType) {
  return NOTIFICATION_TYPE_TO_SOUND[notificationType] || 'callback';
}
