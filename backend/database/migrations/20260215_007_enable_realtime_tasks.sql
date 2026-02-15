-- Enable Realtime for tasks table
-- This allows real-time subscriptions to work properly

-- Set replica identity to FULL to include all columns in realtime updates
ALTER TABLE tasks REPLICA IDENTITY FULL;

-- Add tasks table to the realtime publication
-- This enables Supabase Realtime to broadcast changes
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Also enable realtime for related tables that might need it
ALTER TABLE projects REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

ALTER TABLE comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

ALTER TABLE attachments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE attachments;

-- Note: This migration enables realtime subscriptions for:
-- - tasks: Auto-sync task changes across users
-- - projects: Auto-sync project changes
-- - comments: Live comment updates
-- - notifications: Instant notification delivery
-- - attachments: Live attachment updates
