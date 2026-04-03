import jwt from 'jsonwebtoken';
import supabase from '../services/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET;

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
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
        totp_enabled,
        is_active,
        companies (
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
      totpEnabled: user.totp_enabled,
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
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

export function generateTotpIntermediateToken(userId) {
  return jwt.sign({ userId, step: 'totp' }, JWT_SECRET, { expiresIn: '5m' });
}

export default { authenticate, generateToken, generateTotpIntermediateToken };
