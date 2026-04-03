import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Derive key from JWT_SECRET
function deriveKey(secret, salt) {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
}

// Encrypt TOTP secret for storage
export function encryptSecret(plaintext) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(jwtSecret, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

// Decrypt TOTP secret from storage
export function decryptSecret(encryptedData) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');

  const [saltB64, ivB64, tagB64, encryptedB64] = encryptedData.split(':');
  
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  
  const key = deriveKey(jwtSecret, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(encrypted) + decipher.final('utf8');
}

// Generate new TOTP secret
export function generateTotpSecret(email) {
  const secret = speakeasy.generateSecret({
    name: `${process.env.TOTP_ISSUER || 'BizTrixVenture'}:${email}`,
    issuer: process.env.TOTP_ISSUER || 'BizTrixVenture',
    length: 32,
  });

  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

// Generate QR code as data URL
export async function generateQRCode(otpauthUrl) {
  return await QRCode.toDataURL(otpauthUrl);
}

// Verify TOTP token
export function verifyTotp(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before/after for clock skew
  });
}

export default {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  generateQRCode,
  verifyTotp,
};
