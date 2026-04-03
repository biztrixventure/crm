import { Router } from 'express';
import jwt from 'jsonwebtoken';
import supabase, { supabaseAuth } from '../services/supabase.js';
import { authenticate, generateToken, generateTotpIntermediateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { loginSchema, totpVerifySchema, totpConfirmSchema } from '../schemas/auth.schema.js';
import { logAuditEvent, parseUserAgent } from '../services/audit.js';
import { 
  generateTotpSecret, 
  generateQRCode, 
  verifyTotp, 
  encryptSecret, 
  decryptSecret 
} from '../services/totp.js';
import { deleteSession, setSession } from '../services/redis.js';

const router = Router();

// POST /auth/login - Email + password login
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    // Authenticate with Supabase using anon client
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Log failed attempt
      await logAuditEvent({
        userId: null,
        event: 'login_failed',
        ipAddress: ip,
        userAgent,
        deviceInfo: parseUserAgent(userAgent),
        metadata: { email, reason: authError.message },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const authUserId = authData.user.id;

    // Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        totp_enabled,
        totp_secret,
        is_active,
        companies!users_company_id_fkey (
          id,
          name,
          display_name,
          feature_flags,
          is_active
        )
      `)
      .eq('id', authUserId)
      .single();

    if (userError) {
      console.error('Database error fetching user profile:', userError);
      // Check if it's a "not found" error vs other database errors
      if (userError.code === 'PGRST116') {
        return res.status(401).json({ error: 'User profile not found. Please contact admin.' });
      }
      return res.status(500).json({ error: 'Database error while fetching user profile' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check if 2FA is required
    if (user.totp_enabled) {
      // Return intermediate token for TOTP verification
      const intermediateToken = generateTotpIntermediateToken(user.id);
      
      await logAuditEvent({
        userId: user.id,
        event: 'login_success',
        ipAddress: ip,
        userAgent,
        deviceInfo: parseUserAgent(userAgent),
        metadata: { step: 'password_verified', totp_required: true },
      });

      return res.json({
        totp_required: true,
        intermediate_token: intermediateToken,
        message: 'Please enter your 2FA code',
      });
    }

    // No 2FA - issue full token
    const token = generateToken(user.id);
    await setSession(user.id, token);

    await logAuditEvent({
      userId: user.id,
      event: 'login_success',
      ipAddress: ip,
      userAgent,
      deviceInfo: parseUserAgent(userAgent),
      metadata: { totp_required: false },
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        companyId: user.company_id,
        company: user.companies,
        featureFlags: user.companies?.feature_flags || {},
      },
    });
  } catch (err) {
    console.error('Login error:', err.message || err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Login failed', details: process.env.NODE_ENV !== 'production' ? err.message : undefined });
  }
});

// POST /auth/totp/verify - Verify TOTP code
router.post('/totp/verify', authLimiter, validate(totpVerifySchema), async (req, res) => {
  const { token: totpCode } = req.body;
  const authHeader = req.headers.authorization;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No intermediate token provided' });
  }

  const intermediateToken = authHeader.split(' ')[1];

  try {
    // Verify intermediate token
    const decoded = jwt.verify(intermediateToken, process.env.JWT_SECRET);
    
    if (decoded.step !== 'totp') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const userId = decoded.userId;

    // Get user's TOTP secret
    const { data: user, error } = await supabase
      .from('users')
      .select('id, totp_secret, totp_enabled, full_name, email, role, company_id')
      .eq('id', userId)
      .single();

    if (error || !user || !user.totp_secret) {
      return res.status(401).json({ error: 'User not found or 2FA not setup' });
    }

    // Decrypt and verify TOTP
    const decryptedSecret = decryptSecret(user.totp_secret);
    const isValid = verifyTotp(decryptedSecret, totpCode);

    if (!isValid) {
      await logAuditEvent({
        userId,
        event: 'totp_verify_failed',
        ipAddress: ip,
        userAgent,
        deviceInfo: parseUserAgent(userAgent),
      });
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // Issue full token
    const fullToken = generateToken(userId);
    await setSession(userId, fullToken);

    await logAuditEvent({
      userId,
      event: 'login_success',
      ipAddress: ip,
      userAgent,
      deviceInfo: parseUserAgent(userAgent),
      metadata: { step: 'totp_verified' },
    });

    // Fetch full user data for response
    const { data: fullUser } = await supabase
      .from('users')
      .select(`
        id, email, full_name, role, company_id,
        companies (id, name, display_name, feature_flags, is_active)
      `)
      .eq('id', userId)
      .single();

    res.json({
      token: fullToken,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        fullName: fullUser.full_name,
        role: fullUser.role,
        companyId: fullUser.company_id,
        company: fullUser.companies,
        featureFlags: fullUser.companies?.feature_flags || {},
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    console.error('TOTP verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /auth/totp/setup - Generate TOTP secret and QR code (Admin only)
router.post('/totp/setup', authenticate, async (req, res) => {
  const { id, email, role } = req.user;

  // Only admins need 2FA
  if (!['super_admin', 'readonly_admin', 'company_admin'].includes(role)) {
    return res.status(403).json({ error: '2FA is only available for admin accounts' });
  }

  try {
    // Check if already setup
    const { data: user } = await supabase
      .from('users')
      .select('totp_enabled')
      .eq('id', id)
      .single();

    if (user?.totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Generate secret
    const { base32, otpauthUrl } = generateTotpSecret(email);
    const qrCode = await generateQRCode(otpauthUrl);

    // Store encrypted secret (not enabled yet)
    const encryptedSecret = encryptSecret(base32);
    
    await supabase
      .from('users')
      .update({ totp_secret: encryptedSecret })
      .eq('id', id);

    res.json({
      secret: base32, // User can manually enter this if QR fails
      qrCode,
      message: 'Scan the QR code with your authenticator app, then confirm with a code',
    });
  } catch (err) {
    console.error('TOTP setup error:', err);
    res.status(500).json({ error: '2FA setup failed' });
  }
});

// POST /auth/totp/confirm - Confirm TOTP setup with first code
router.post('/totp/confirm', authenticate, validate(totpConfirmSchema), async (req, res) => {
  const { code } = req.body;
  const { id } = req.user;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  try {
    // Get current secret
    const { data: user, error } = await supabase
      .from('users')
      .select('totp_secret, totp_enabled')
      .eq('id', id)
      .single();

    if (error || !user?.totp_secret) {
      return res.status(400).json({ error: 'Please run 2FA setup first' });
    }

    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Verify code
    const decryptedSecret = decryptSecret(user.totp_secret);
    const isValid = verifyTotp(decryptedSecret, code);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    }

    // Enable 2FA
    await supabase
      .from('users')
      .update({ totp_enabled: true })
      .eq('id', id);

    await logAuditEvent({
      userId: id,
      event: '2fa_setup',
      ipAddress: ip,
      userAgent,
      deviceInfo: parseUserAgent(userAgent),
    });

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    console.error('TOTP confirm error:', err);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// POST /auth/logout - Invalidate session
router.post('/logout', authenticate, async (req, res) => {
  const { id } = req.user;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  try {
    await deleteSession(id);
    
    await logAuditEvent({
      userId: id,
      event: 'logout',
      ipAddress: ip,
      userAgent,
      deviceInfo: parseUserAgent(userAgent),
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /auth/me - Get current user profile
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      companyId: req.user.companyId,
      company: req.user.company,
      featureFlags: req.user.featureFlags,
      totpEnabled: req.user.totpEnabled,
    },
  });
});

export default router;
