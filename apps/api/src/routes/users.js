import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../schemas/user.schema.js';
import { notifyAdminNewEntity } from '../services/notification.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /users - List users (scoped by role)
router.get('/', async (req, res) => {
  const { role, companyId } = req.user;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;

  try {
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        totp_enabled,
        created_at,
        companies!users_company_id_fkey (
          id,
          name,
          display_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Company admins can only see their own company's users
    if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    res.json({ 
      users: users || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: count > offset + limit
      }
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /users - Create user
router.post('/', validate(createUserSchema), async (req, res) => {
  const { email, password, full_name, role: newUserRole, company_id } = req.body;
  const { role: creatorRole, companyId: creatorCompanyId, id: creatorId } = req.user;

  // Authorization checks
  if (creatorRole === 'company_admin') {
    // Company admins can only create fronters for their own company
    if (newUserRole !== 'fronter') {
      return res.status(403).json({ error: 'Company admins can only create fronter accounts' });
    }
    if (company_id && company_id !== creatorCompanyId) {
      return res.status(403).json({ error: 'Cannot create users for other companies' });
    }
  } else if (creatorRole !== 'super_admin') {
    return res.status(403).json({ error: 'Not authorized to create users' });
  }

  // Validate company assignment for company-scoped roles
  const companyRoles = ['company_admin', 'fronter'];
  const biztrixRoles = ['super_admin', 'readonly_admin', 'closer'];

  if (companyRoles.includes(newUserRole) && !company_id) {
    return res.status(422).json({ error: 'Company ID is required for this role' });
  }

  if (biztrixRoles.includes(newUserRole) && company_id) {
    return res.status(422).json({ error: 'This role should not be assigned to a company' });
  }

  try {
    // Create auth user in Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw authError;
    }

    // Create user profile
    const { data: user, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role: newUserRole,
        company_id: creatorRole === 'company_admin' ? creatorCompanyId : company_id,
        created_by: creatorId,
      })
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        created_at,
        companies!users_company_id_fkey (
          id,
          name,
          display_name
        )
      `)
      .single();

    if (profileError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Notify super admins about new user
    if (creatorRole === 'super_admin') {
      notifyAdminNewEntity('user', user);
    }

    res.status(201).json({ user });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /users/me/profile - Get current user's profile (MUST be before /:id route)
router.get('/me/profile', async (req, res) => {
  const { id } = req.user;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        totp_enabled,
        created_at,
        last_login,
        companies!users_company_id_fkey (
          id,
          name,
          display_name,
          logo_url
        )
      `)
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user stats - use limit approach instead of count
    const stats = {};
    
    if (user.role === 'fronter') {
      const { data: transfers, error: transferError } = await supabase
        .from('transfers')
        .select('id')
        .eq('fronter_id', id)
        .limit(1)
        .offset(0);
      
      // Use a single count query
      const { count: transferCount } = await supabase
        .from('transfers')
        .select('id', { count: 'exact', head: true })
        .eq('fronter_id', id);
      stats.totalTransfers = transferCount || 0;
    } else if (user.role === 'closer') {
      // Single query to get outcome count
      const { count: outcomeCount } = await supabase
        .from('outcomes')
        .select('id', { count: 'exact', head: true })
        .eq('closer_id', id);
      
      // Single query for sales (outcomes with revenue)
      const { count: saleCount } = await supabase
        .from('outcomes')
        .select('id', { count: 'exact', head: true })
        .eq('closer_id', id)
        .not('revenue', 'is', null);
      
      stats.totalOutcomes = outcomeCount || 0;
      stats.totalSales = saleCount || 0;
    }

    res.json({ user, stats });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /users/me/profile - Update current user's profile (MUST be before /:id route)
router.patch('/me/profile', async (req, res) => {
  const { id } = req.user;
  const { full_name } = req.body;

  // Users can only update their own name (not email, role, etc.)
  if (!full_name || full_name.trim().length < 2) {
    return res.status(422).json({ error: 'Full name must be at least 2 characters' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ full_name: full_name.trim() })
      .eq('id', id)
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        totp_enabled,
        created_at,
        companies!users_company_id_fkey (
          id,
          name,
          display_name
        )
      `)
      .single();

    if (error) throw error;

    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /users/closers/list - List active closers (for transfer form dropdown)
router.get('/closers/list', async (req, res) => {
  try {
    const { data: closers, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'closer')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    res.json({ closers });
  } catch (err) {
    console.error('Get closers error:', err);
    res.status(500).json({ error: 'Failed to fetch closers' });
  }
});

// GET /users/:id - Get single user
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { role, companyId } = req.user;

  try {
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        totp_enabled,
        created_at,
        companies!users_company_id_fkey (
          id,
          name,
          display_name,
          feature_flags
        )
      `)
      .eq('id', id);

    // Company admins can only view their own company's users
    if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /users/:id - Update user
router.patch('/:id', validate(updateUserSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { role: updaterRole, companyId: updaterCompanyId, id: updaterId } = req.user;

  // Prevent self-role change
  if (id === updaterId && updates.role) {
    return res.status(403).json({ error: 'Cannot change your own role' });
  }

  try {
    // Check if user exists and get current data
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Company admins can only update their own company's fronters
    if (updaterRole === 'company_admin') {
      if (existingUser.company_id !== updaterCompanyId) {
        return res.status(403).json({ error: 'Cannot update users from other companies' });
      }
      if (existingUser.role !== 'fronter') {
        return res.status(403).json({ error: 'Company admins can only update fronter accounts' });
      }
      // Remove fields company admin shouldn't change
      delete updates.role;
      delete updates.company_id;
    } else if (updaterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to update users' });
    }

    // Update email in Supabase Auth if changed
    if (updates.email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email: updates.email,
      });
      if (authError) throw authError;
    }

    const { data: user, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        totp_enabled,
        created_at,
        companies!users_company_id_fkey (
          id,
          name,
          display_name
        )
      `)
      .single();

    if (updateError) throw updateError;

    res.json({ user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /users/closers - List active closers (for transfer form dropdown)
router.get('/closers/list', async (req, res) => {
  try {
    const { data: closers, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'closer')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    res.json({ closers });
  } catch (err) {
    console.error('Get closers error:', err);
    res.status(500).json({ error: 'Failed to fetch closers' });
  }
});

// GET /users/:id/profile - View another user's profile (admin/company admin only)
router.get('/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { role, companyId, id: currentUserId } = req.user;

  // Users can view their own profile
  if (id === currentUserId) {
    // Redirect to /me/profile logic
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          company_id,
          is_active,
          totp_enabled,
          created_at,
          last_login,
          companies!users_company_id_fkey (
            id,
            name,
            display_name
          )
        `)
        .eq('id', id)
        .single();

      if (error || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ user, canEdit: true });
    } catch (err) {
      console.error('Get profile error:', err);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  // Only super_admin, readonly_admin, and company_admin can view other profiles
  if (!['super_admin', 'readonly_admin', 'company_admin'].includes(role)) {
    return res.status(403).json({ error: 'Not authorized to view this profile' });
  }

  try {
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        totp_enabled,
        created_at,
        last_login,
        companies!users_company_id_fkey (
          id,
          name,
          display_name
        )
      `)
      .eq('id', id);

    // Company admins can only view their company's users
    if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found or not accessible' });
    }

    // Get user stats
    const stats = {};
    
    if (user.role === 'fronter') {
      const { count: transferCount } = await supabase
        .from('transfers')
        .select('id', { count: 'exact', head: true })
        .eq('fronter_id', id);
      stats.totalTransfers = transferCount || 0;
    } else if (user.role === 'closer') {
      const [{ count: outcomeCount }, { count: saleCount }] = await Promise.all([
        supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('closer_id', id),
        supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('closer_id', id).not('revenue', 'is', null),
      ]);
      stats.totalOutcomes = outcomeCount || 0;
      stats.totalSales = saleCount || 0;
    }

    // Determine if current user can edit this profile
    const canEdit = role === 'super_admin' || 
      (role === 'company_admin' && user.company_id === companyId && user.role === 'fronter');

    res.json({ user, stats, canEdit });
  } catch (err) {
    console.error('Get user profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
