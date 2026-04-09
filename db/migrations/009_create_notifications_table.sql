-- ===========================================
-- BizTrixVenture CRM - Migration #9
-- Create Notifications Table
-- ===========================================
-- Purpose: Create persistent notifications table for real-time alerts
-- Stores all notifications with 30-day retention
-- Supports role-specific and real-time notification delivery

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id        uuid REFERENCES companies(id),
  role              text NOT NULL,
  type              text NOT NULL, -- transfer:new, callback:reminder, sale:made, batch:assigned, etc.
  title             text NOT NULL,
  message           text NOT NULL,
  metadata          jsonb DEFAULT '{}', -- store arbitrary data: {transferId, closerId, batchId, etc}
  is_read           boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  expires_at        timestamptz DEFAULT (now() + '30 days'::interval),
  browser_notified  boolean DEFAULT false,
  updated_at        timestamptz DEFAULT now()
);

-- Create indexes for optimal query performance
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_expires ON notifications(expires_at);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own notifications
DROP POLICY IF EXISTS notifications_own ON notifications;
CREATE POLICY notifications_own ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_own ON notifications;
CREATE POLICY notifications_insert_own ON notifications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON notifications;
CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Cleanup Job: Mark old notifications as expired (optional, can be manual)
-- Note: pg_cron may not be available in all Supabase projects
-- Alternative: Implement cleanup API endpoint that can be called periodically
-- To enable auto-cleanup, uncomment the line below if pg_cron is available:
-- SELECT cron.schedule('cleanup-expired-notifications', '0 2 * * *', $$
--   DELETE FROM notifications WHERE expires_at < now();
-- $$);

-- For manual/scheduled cleanup, use this query:
-- DELETE FROM notifications WHERE expires_at < now();

-- Done - notifications table is ready
