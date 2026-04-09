/**
 * Normalizes phone number to E.164 format (+[country code][number])
 * @param {string} phone - Phone number to normalize
 * @returns {string|null} Normalized phone or null if invalid
 */
export function normalizePhoneE164(phone) {
  if (!phone || typeof phone !== 'string') return null;

  let cleaned = phone.replace(/\D/g, '');

  // Handle different length formats
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US: 1XXXXXXXXXX -> +1XXXXXXXXXX
    return `+${cleaned}`;
  } else if (cleaned.length === 10) {
    // US without country code: XXXXXXXXXX -> +1XXXXXXXXXX
    return `+1${cleaned}`;
  } else if (cleaned.length >= 11 && cleaned.length <= 15) {
    // International: assume valid if 11-15 digits
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Simple phone number validation
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone appears valid
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Formats phone number for display (US format if applicable)
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';

  const cleaned = phone.replace(/\D/g, '');

  // US format: (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const digits = cleaned.slice(1);
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Fallback for international
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  return phone;
}

/**
 * Extract digits only from phone number
 * @param {string} phone - Phone number
 * @returns {string} Digits only
 */
export function getPhoneDigitsOnly(phone) {
  return phone ? phone.replace(/\D/g, '') : '';
}
