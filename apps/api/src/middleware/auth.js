import jwt from 'jsonwebtoken';
import supabase from '../services/supabase.js';

// Get JWT_SECRET at function call time, not module load time
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify JWT
    const decoded = jwt.verify(token, getJwtSecret());
    
    // Check if it's a TOTP intermediate token
    if (decoded.step === 'totp') {
      return res.status(401).json({ 
        error: 'TOTP verification required',
        totp_required: true,
      });
    }

    // Fetch full user data
    const { data: user, error } = await supabase
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
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      companyId: user.company_id,
      company: user.companies,
      featureFlags: user.companies?.feature_flags || {},
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Generate tokens
export function generateToken(userId, expiresIn = '8h') {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn });
}

export function generateTotpIntermediateToken(userId) {
  return jwt.sign({ userId, step: 'totp' }, getJwtSecret(), { expiresIn: '5m' });
}

export default { authenticate, generateToken, generateTotpIntermediateToken };
