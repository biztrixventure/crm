import supabase from './supabase.js';

export async function logAuditEvent({
  userId,
  event,
  ipAddress,
  userAgent,
  deviceInfo = null,
  metadata = null,
}) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      event,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_info: deviceInfo,
      metadata,
    });

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    // Audit log failure should not block the operation
    console.error('Audit log error:', err);
  }
}

export function parseUserAgent(userAgent) {
  if (!userAgent) return null;

  // Simple UA parsing - in production, consider using a library like ua-parser-js
  const info = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Unknown',
  };

  // Browser detection
  if (userAgent.includes('Firefox')) {
    info.browser = 'Firefox';
  } else if (userAgent.includes('Chrome')) {
    info.browser = 'Chrome';
  } else if (userAgent.includes('Safari')) {
    info.browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    info.browser = 'Edge';
  }

  // OS detection
  if (userAgent.includes('Windows')) {
    info.os = 'Windows';
  } else if (userAgent.includes('Mac')) {
    info.os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    info.os = 'Linux';
  } else if (userAgent.includes('Android')) {
    info.os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) {
    info.os = 'iOS';
  }

  // Device type
  if (userAgent.includes('Mobile')) {
    info.device = 'Mobile';
  } else if (userAgent.includes('Tablet')) {
    info.device = 'Tablet';
  } else {
    info.device = 'Desktop';
  }

  return info;
}

export default { logAuditEvent, parseUserAgent };
