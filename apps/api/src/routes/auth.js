import { Router } from 'express';
import supabase, { supabaseAuth } from '../services/supabase.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { loginSchema } from '../schemas/auth.schema.js';
import { logAuditEvent, parseUserAgent } from '../services/audit.js';
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

    // Issue JWT token
    const token = generateToken(user.id);
    await setSession(user.id, token);

    await logAuditEvent({
      userId: user.id,
      event: 'login_success',
      ipAddress: ip,
      userAgent,
      deviceInfo: parseUserAgent(userAgent),
      metadata: { authenticated: true },
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
    },
  });
});

export default router;
