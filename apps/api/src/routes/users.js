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
        companies (
          id,
          name,
          display_name
        )
      `)
      .order('created_at', { ascending: false });

    // Company admins can only see their own company's users
    if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    res.json({ users });
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
        companies (
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
        companies (
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
        companies (
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

export default router;
