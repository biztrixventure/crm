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
  const filterRole = req.query.role; // Optional query param to filter by role

  try {
    // Only super_admin, readonly_admin, closer_manager, operations_manager, compliance_manager, and company_admin can view users
    if (!['super_admin', 'readonly_admin', 'closer_manager', 'operations_manager', 'compliance_manager', 'company_admin'].includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

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
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    // Filter by role if specified
    if (filterRole) {
      query = query.eq('role', filterRole);
    }

    // Company admins can only see their own company's users
    if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    // Check if there are more results (limit + 1 to detect hasMore)
    const hasMore = users && users.length > limit;
    const visibleUsers = users ? users.slice(0, limit) : [];

    res.json({ 
      users: visibleUsers || [],
      pagination: {
        limit,
        offset,
        hasMore,
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
  } else if (creatorRole === 'compliance_manager') {
    // Compliance managers can only create compliance agents
    if (newUserRole !== 'compliance_agent') {
      return res.status(403).json({ error: 'Compliance managers can only create compliance agent accounts' });
    }
    // Compliance agents should not be assigned to a company (BizTrix internal only)
    if (company_id) {
      return res.status(422).json({ error: 'Compliance agents are BizTrix-internal and cannot be assigned to companies' });
    }
  } else if (creatorRole !== 'super_admin') {
    return res.status(403).json({ error: 'Not authorized to create users' });
  }

  // Validate company assignment for company-scoped roles
  const companyRoles = ['company_admin', 'fronter'];
  const biztrixRoles = ['super_admin', 'readonly_admin', 'closer', 'closer_manager', 'operations_manager', 'compliance_manager', 'compliance_agent'];

  if (companyRoles.includes(newUserRole) && !company_id) {
    return res.status(422).json({ error: 'Company ID is required for this role' });
  }

  if (biztrixRoles.includes(newUserRole) && company_id) {
    return res.status(422).json({ error: 'This role should not be assigned to a company' });
  }

  // If creating a closer, extract and validate managed_by (for super admin to assign manager)
  let managedBy = null;
  if (newUserRole === 'closer' && creatorRole === 'super_admin') {
    managedBy = req.body.managed_by || null; // Optional manager assignment
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
        managed_by: managedBy, // Set manager if assigning a closer to a manager
        created_by: creatorId,
      })
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        managed_by,
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
        managed_by,
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

// DELETE /users/:id - Delete a user with role-based authorization
router.delete('/:id', async (req, res) => {
  const { id: userIdToDelete } = req.params;
  const { role: deleterRole, companyId: deleterCompanyId, id: deleterId } = req.user;

  // Prevent self-deletion
  if (userIdToDelete === deleterId) {
    return res.status(403).json({ error: 'Cannot delete your own account' });
  }

  // Operations managers cannot delete anyone (read-only)
  if (deleterRole === 'operations_manager') {
    return res.status(403).json({ error: 'Operations managers cannot delete users (read-only access)' });
  }

  // Only these roles can delete users
  if (!['super_admin', 'company_admin', 'closer_manager'].includes(deleterRole)) {
    return res.status(403).json({ error: 'Not authorized to delete users' });
  }

  try {
    // Fetch the user to be deleted
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role, company_id, managed_by')
      .eq('id', userIdToDelete)
      .single();

    if (fetchError || !userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Authorization logic based on deleter role
    if (deleterRole === 'super_admin') {
      // Super admins can delete anyone except other super_admins or readonly_admins
      if (['super_admin', 'readonly_admin'].includes(userToDelete.role)) {
        return res.status(403).json({ error: 'Cannot delete super admins or readonly admins' });
      }
    } else if (deleterRole === 'company_admin') {
      // Company admins can only delete users from their own company
      // And cannot delete super_admin, readonly_admin, or other company_admins
      if (!userToDelete.company_id || userToDelete.company_id !== deleterCompanyId) {
        return res.status(403).json({ error: 'Cannot delete users from other companies' });
      }
      if (['super_admin', 'readonly_admin', 'company_admin'].includes(userToDelete.role)) {
        return res.status(403).json({ error: 'Cannot delete super admins, readonly admins, or other company admins' });
      }
    } else if (deleterRole === 'closer_manager') {
      // Closer managers can only delete closers they manage
      if (userToDelete.role !== 'closer') {
        return res.status(403).json({ error: 'Closer managers can only delete closers they manage' });
      }
      if (userToDelete.managed_by !== deleterId) {
        return res.status(403).json({ error: 'Cannot delete closers not managed by you' });
      }
    }

    // Delete from Supabase Auth first
    try {
      await supabase.auth.admin.deleteUser(userIdToDelete);
    } catch (authError) {
      console.error('Auth deletion error:', authError);
      // Continue anyway - try to delete from database
    }

    // Delete from users table
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('id', userIdToDelete);

    if (dbError) {
      // Handle foreign key constraint violation
      if (dbError.code === '23503') {
        // User has related records (outcomes, transfers, etc.)
        return res.status(409).json({
          error: 'Cannot delete user with existing records',
          message: 'This user has associated outcomes or records that must be deleted first, or use deactivation instead.',
          suggestion: 'Consider deactivating the user instead: PATCH /users/:id with { "is_active": false }',
          details: dbError.message,
        });
      }
      throw dbError;
    }

    res.json({
      message: 'User deleted successfully',
      user: {
        id: userToDelete.id,
        email: userToDelete.email,
        role: userToDelete.role,
      }
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      error: 'Failed to delete user',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

export default router;
