-- Migration: Create Time Tracking System
-- Description: Add time_entries table for tracking time spent on tasks
-- Phase: 3A - Time Tracking

-- =====================================================
-- TABLE: time_entries
-- =====================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id bigint REFERENCES companies(id) ON DELETE CASCADE,

  -- Time tracking fields
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz, -- NULL means timer is still running
  duration_seconds integer, -- Auto-calculated when end_time is set
  description text, -- Optional notes about what was done
  is_manual boolean NOT NULL DEFAULT false, -- Manual entry vs timer

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time IS NULL OR end_time >= start_time),
  CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT no_negative_duration CHECK (
    end_time IS NULL OR
    EXTRACT(EPOCH FROM (end_time - start_time)) >= 0
  )
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_active ON time_entries(user_id, end_time) WHERE end_time IS NULL;

-- Composite index for common queries
CREATE INDEX idx_time_entries_task_user ON time_entries(task_id, user_id);

-- =====================================================
-- FUNCTION: Auto-calculate duration
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- When end_time is set, calculate duration in seconds
  IF NEW.end_time IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::integer;
  ELSE
    NEW.duration_seconds := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_duration
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_duration();

-- =====================================================
-- FUNCTION: Prevent overlapping active timers
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_overlapping_timers()
RETURNS TRIGGER AS $$
DECLARE
  active_timer_count integer;
BEGIN
  -- Only check if creating/updating an active timer (end_time IS NULL)
  IF NEW.end_time IS NULL THEN
    -- Count active timers for this user (excluding current entry if updating)
    SELECT COUNT(*) INTO active_timer_count
    FROM time_entries
    WHERE user_id = NEW.user_id
      AND end_time IS NULL
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF active_timer_count > 0 THEN
      RAISE EXCEPTION 'User already has an active timer running. Stop it before starting a new one.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_overlapping_timers
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_overlapping_timers();

-- =====================================================
-- FUNCTION: Log time tracking activity
-- =====================================================
CREATE OR REPLACE FUNCTION log_time_entry_activity()
RETURNS TRIGGER AS $$
DECLARE
  task_title text;
  action_text text;
  time_duration text;
BEGIN
  -- Get task title
  SELECT title INTO task_title FROM tasks WHERE id = COALESCE(NEW.task_id, OLD.task_id);

  -- Determine action text
  IF TG_OP = 'INSERT' THEN
    IF NEW.end_time IS NULL THEN
      action_text := 'started_timer';
    ELSE
      action_text := 'logged_time';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.end_time IS NULL AND NEW.end_time IS NOT NULL THEN
      action_text := 'stopped_timer';
    ELSE
      action_text := 'updated_time_entry';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_text := 'deleted_time_entry';
  END IF;

  -- Format duration if available
  IF NEW.duration_seconds IS NOT NULL THEN
    time_duration := to_char(INTERVAL '1 second' * NEW.duration_seconds, 'HH24:MI:SS');
  ELSIF OLD.duration_seconds IS NOT NULL THEN
    time_duration := to_char(INTERVAL '1 second' * OLD.duration_seconds, 'HH24:MI:SS');
  END IF;

  -- Insert activity log (matching actual table structure)
  INSERT INTO activity_log (
    entity_type,
    entity_id,
    action,
    actor_id,
    company_id,
    details
  ) VALUES (
    'task',
    COALESCE(NEW.task_id, OLD.task_id),
    action_text,
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.company_id, OLD.company_id),
    jsonb_build_object(
      'time_entry_id', COALESCE(NEW.id, OLD.id),
      'task_title', task_title,
      'duration', time_duration,
      'duration_seconds', COALESCE(NEW.duration_seconds, OLD.duration_seconds),
      'is_manual', COALESCE(NEW.is_manual, OLD.is_manual),
      'start_time', COALESCE(NEW.start_time, OLD.start_time)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_time_entry_activity
  AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_time_entry_activity();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own time entries
CREATE POLICY time_entries_select_own ON time_entries
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_system_admin()
    OR (company_id IS NOT NULL AND company_id = user_company_id())
  );

-- Policy: Users can insert their own time entries for tasks they can access
CREATE POLICY time_entries_insert_own ON time_entries
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Can access task in their company
      EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = task_id
          AND (
            (t.company_id IS NULL AND t.created_by = auth.uid())
            OR t.company_id = user_company_id()
          )
      )
    )
  );

-- Policy: Users can update their own time entries
CREATE POLICY time_entries_update_own ON time_entries
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own time entries
CREATE POLICY time_entries_delete_own ON time_entries
  FOR DELETE
  USING (user_id = auth.uid() OR is_system_admin());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get total time for a task (in seconds)
CREATE OR REPLACE FUNCTION get_task_total_time(p_task_id bigint)
RETURNS integer AS $$
  SELECT COALESCE(SUM(duration_seconds), 0)::integer
  FROM time_entries
  WHERE task_id = p_task_id
    AND end_time IS NOT NULL; -- Only count completed entries
$$ LANGUAGE sql STABLE;

-- Get total time for a user (in seconds) within date range
CREATE OR REPLACE FUNCTION get_user_total_time(
  p_user_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS integer AS $$
  SELECT COALESCE(SUM(duration_seconds), 0)::integer
  FROM time_entries
  WHERE user_id = p_user_id
    AND end_time IS NOT NULL
    AND (p_start_date IS NULL OR start_time >= p_start_date)
    AND (p_end_date IS NULL OR end_time <= p_end_date);
$$ LANGUAGE sql STABLE;

-- Get active timer for a user
CREATE OR REPLACE FUNCTION get_active_timer(p_user_id uuid)
RETURNS TABLE (
  id bigint,
  task_id bigint,
  task_title text,
  start_time timestamptz,
  elapsed_seconds integer,
  description text
) AS $$
  SELECT
    te.id,
    te.task_id,
    t.title as task_title,
    te.start_time,
    EXTRACT(EPOCH FROM (now() - te.start_time))::integer as elapsed_seconds,
    te.description
  FROM time_entries te
  JOIN tasks t ON t.id = te.task_id
  WHERE te.user_id = p_user_id
    AND te.end_time IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Format duration as HH:MM:SS
CREATE OR REPLACE FUNCTION format_duration(seconds integer)
RETURNS text AS $$
  SELECT to_char(INTERVAL '1 second' * seconds, 'HH24:MI:SS');
$$ LANGUAGE sql IMMUTABLE;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE time_entries IS 'Tracks time spent on tasks with start/stop timers and manual entries';
COMMENT ON COLUMN time_entries.end_time IS 'NULL means timer is currently running';
COMMENT ON COLUMN time_entries.duration_seconds IS 'Auto-calculated from start_time and end_time';
COMMENT ON COLUMN time_entries.is_manual IS 'true for manual entries, false for timer-based entries';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON time_entries TO authenticated;
GRANT USAGE ON SEQUENCE time_entries_id_seq TO authenticated;
