import { Router } from 'express';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===== Validation Schemas =====
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
  filter: z.enum(['all', 'unread', 'read']).optional().default('all'),
});

const markReadSchema = z.object({
  is_read: z.boolean().optional(),
});

// ===== Endpoints =====

// GET /notifications/count - Get unread count (MUST be BEFORE /:id routes)
router.get('/count', async (req, res) => {
  const { id: userId } = req.user;

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ unreadCount: count || 0 });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// GET /notifications - List user's notifications with pagination
router.get('/', validate(paginationSchema, 'query'), async (req, res) => {
  const { id: userId } = req.user;
  const { limit, offset, filter } = req.query;

  try {
    // Build query to get filtered notifications
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter
    if (filter === 'unread') {
      query = query.eq('is_read', false);
    } else if (filter === 'read') {
      query = query.eq('is_read', true);
    }

    const { data: notifications, error, count } = await query;

    if (error) throw error;

    // Get total unread count (not filtered)
    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (countError) throw countError;

    res.json({
      notifications,
      pagination: {
        total: count || 0,
        limit,
        offset,
        unreadCount: unreadCount || 0,
      },
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /notifications/:id/read - Mark single notification as read
router.patch('/:id/read', async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    // Verify ownership
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id, is_read')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Update notification
    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // REMOVED: emitToUser for real-time sync - socket.io no longer exists
    // emitToUser(userId, 'notification:read', {
    //   notificationId: id,
    //   timestamp: new Date().toISOString(),
    // });

    res.json({ notification: updated });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /notifications/read-all - Mark all notifications as read
router.patch('/read-all', async (req, res) => {
  const { id: userId } = req.user;

  try {
    // Update all unread notifications
    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (updateError) throw updateError;

    // REMOVED: emitToUser for real-time sync - socket.io no longer exists
    // emitToUser(userId, 'notifications:read-all', {
    //   count: updated?.length || 0,
    //   timestamp: new Date().toISOString(),
    // });

    res.json({
      message: 'All notifications marked as read',
      count: updated?.length || 0,
    });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /notifications/:id - Delete a notification
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    // Verify ownership
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete notification
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // REMOVED: emitToUser for real-time sync - socket.io no longer exists
    // emitToUser(userId, 'notification:deleted', {
    //   notificationId: id,
    //   timestamp: new Date().toISOString(),
    // });

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// DELETE /notifications - Delete all notifications (optional)
router.delete('/', async (req, res) => {
  const { id: userId } = req.user;

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'All notifications deleted' });
  } catch (err) {
    console.error('Delete all notifications error:', err);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

// POST /notifications/test - Create test notification (dev only, requires super_admin)
router.post('/test', async (req, res) => {
  const { id: userId, role } = req.user;

  // Only allow for development/testing
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoint not available in production' });
  }

  try {
    const testNotification = {
      user_id: userId,
      role,
      type: 'test:notification',
      title: 'Test Notification',
      message: 'This is a test notification from the API',
      metadata: { test: true, timestamp: new Date().toISOString() },
    };

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(testNotification)
      .select()
      .single();

    if (error) throw error;

    // REMOVED: emitToUser for real-time delivery - socket.io no longer exists
    // emitToUser(userId, 'notification:new', {
    //   id: notification.id,
    //   type: notification.type,
    //   title: notification.title,
    //   message: notification.message,
    //   is_read: notification.is_read,
    //   created_at: notification.created_at,
    //   timestamp: notification.created_at,
    //   metadata: notification.metadata,
    // });

    res.status(201).json({
      message: 'Test notification created',
      notification,
    });
  } catch (err) {
    console.error('Create test notification error:', err);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

export default router;
