-- Migration: Activity Log System
-- Date: 2026-02-10
-- Purpose: Track all changes to tasks, projects, and comments with automatic triggers

BEGIN;

-- =============================================================================
-- STEP 1: Create Activity Log Table
-- =============================================================================

CREATE TABLE activity_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL,
    entity_type text NOT NULL,  -- 'task', 'project', 'comment', 'attachment'
    entity_id bigint NOT NULL,
    action text NOT NULL,        -- 'created', 'updated', 'deleted', 'status_changed', 'assigned', 'commented'
    details jsonb DEFAULT '{}',  -- { field: 'status', old: 'todo', new: 'done' }
    created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- STEP 2: Create Indexes
-- =============================================================================

CREATE INDEX activity_log_company_id_idx ON activity_log(company_id);
CREATE INDEX activity_log_actor_id_idx ON activity_log(actor_id);
CREATE INDEX activity_log_entity_type_idx ON activity_log(entity_type);
CREATE INDEX activity_log_entity_id_idx ON activity_log(entity_id);
CREATE INDEX activity_log_created_at_idx ON activity_log(created_at DESC);
CREATE INDEX activity_log_company_created_idx ON activity_log(company_id, created_at DESC);

-- =============================================================================
-- STEP 3: Row Level Security Policies
-- =============================================================================

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log FORCE ROW LEVEL SECURITY;

-- SELECT: Users can see activity in their company or their personal activities
CREATE POLICY activity_log_select_policy ON activity_log
  FOR SELECT
  USING (
    -- System admin sees all
    is_system_admin()
    OR
    -- Company users see their company's activity
    (company_id IS NOT NULL AND company_id = user_company_id())
    OR
    -- Personal users see their own activity
    (company_id IS NULL AND actor_id = auth.uid())
  );

-- INSERT: System can insert activity logs (triggers will use SECURITY DEFINER functions)
CREATE POLICY activity_log_insert_policy ON activity_log
  FOR INSERT
  WITH CHECK (true);  -- Triggers handle insertion with SECURITY DEFINER

-- No UPDATE or DELETE policies - activity logs are immutable

-- =============================================================================
-- STEP 4: Helper Function to Log Activity
-- =============================================================================

CREATE OR REPLACE FUNCTION log_activity(
  p_company_id bigint,
  p_actor_id uuid,
  p_entity_type text,
  p_entity_id bigint,
  p_action text,
  p_details jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO activity_log (company_id, actor_id, entity_type, entity_id, action, details)
  VALUES (p_company_id, p_actor_id, p_entity_type, p_entity_id, p_action, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_activity IS
'Helper function to log activity with SECURITY DEFINER privileges';

-- =============================================================================
-- STEP 5: Task Activity Triggers
-- =============================================================================

-- Task created
CREATE OR REPLACE FUNCTION log_task_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    NEW.company_id,
    NEW.created_by,
    'task',
    NEW.id,
    'created',
    jsonb_build_object(
      'title', NEW.title,
      'status', NEW.status,
      'priority', NEW.priority,
      'project_id', NEW.project_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_created_trigger
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_created();

-- Task updated
CREATE OR REPLACE FUNCTION log_task_updated()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}';
BEGIN
  -- Track specific field changes
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    changes := changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
  END IF;

  IF OLD.description IS DISTINCT FROM NEW.description THEN
    changes := changes || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changes := changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    -- Log special status_changed action
    PERFORM log_activity(
      NEW.company_id,
      COALESCE(auth.uid(), NEW.created_by),
      'task',
      NEW.id,
      'status_changed',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    changes := changes || jsonb_build_object('priority', jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    changes := changes || jsonb_build_object('assigned_to', jsonb_build_object('old', OLD.assigned_to, 'new', NEW.assigned_to));
    -- Log special assigned action
    PERFORM log_activity(
      NEW.company_id,
      COALESCE(auth.uid(), NEW.created_by),
      'task',
      NEW.id,
      'assigned',
      jsonb_build_object('old_assignee', OLD.assigned_to, 'new_assignee', NEW.assigned_to)
    );
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    changes := changes || jsonb_build_object('due_date', jsonb_build_object('old', OLD.due_date, 'new', NEW.due_date));
  END IF;

  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    changes := changes || jsonb_build_object('project_id', jsonb_build_object('old', OLD.project_id, 'new', NEW.project_id));
  END IF;

  -- Log general update if there were changes
  IF changes != '{}' THEN
    PERFORM log_activity(
      NEW.company_id,
      COALESCE(auth.uid(), NEW.created_by),
      'task',
      NEW.id,
      'updated',
      changes
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_updated_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION log_task_updated();

-- Task deleted
CREATE OR REPLACE FUNCTION log_task_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    OLD.company_id,
    COALESCE(auth.uid(), OLD.created_by),
    'task',
    OLD.id,
    'deleted',
    jsonb_build_object(
      'title', OLD.title,
      'status', OLD.status
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_deleted_trigger
  BEFORE DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_deleted();

-- =============================================================================
-- STEP 6: Project Activity Triggers
-- =============================================================================

-- Project created
CREATE OR REPLACE FUNCTION log_project_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    NEW.company_id,
    NEW.created_by,
    'project',
    NEW.id,
    'created',
    jsonb_build_object('name', NEW.name, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER project_created_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_created();

-- Project updated
CREATE OR REPLACE FUNCTION log_project_updated()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}';
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    changes := changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
  END IF;

  IF OLD.description IS DISTINCT FROM NEW.description THEN
    changes := changes || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changes := changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
  END IF;

  IF changes != '{}' THEN
    PERFORM log_activity(
      NEW.company_id,
      COALESCE(auth.uid(), NEW.created_by),
      'project',
      NEW.id,
      'updated',
      changes
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER project_updated_trigger
  AFTER UPDATE ON projects
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION log_project_updated();

-- Project deleted
CREATE OR REPLACE FUNCTION log_project_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    OLD.company_id,
    COALESCE(auth.uid(), OLD.created_by),
    'project',
    OLD.id,
    'deleted',
    jsonb_build_object('name', OLD.name)
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER project_deleted_trigger
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_deleted();

-- =============================================================================
-- STEP 7: Comment Activity Triggers
-- =============================================================================

-- Comment created
CREATE OR REPLACE FUNCTION log_comment_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    NEW.company_id,
    NEW.author_id,
    'comment',
    NEW.id,
    'commented',
    jsonb_build_object(
      'task_id', NEW.task_id,
      'is_action_item', NEW.is_action_item,
      'content_preview', LEFT(NEW.content, 100)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comment_created_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION log_comment_created();

-- Comment deleted
CREATE OR REPLACE FUNCTION log_comment_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    OLD.company_id,
    COALESCE(auth.uid(), OLD.author_id),
    'comment',
    OLD.id,
    'deleted',
    jsonb_build_object('task_id', OLD.task_id)
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comment_deleted_trigger
  BEFORE DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION log_comment_deleted();

-- =============================================================================
-- STEP 8: Attachment Activity Triggers
-- =============================================================================

-- Attachment created
CREATE OR REPLACE FUNCTION log_attachment_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    NEW.company_id,
    NEW.uploaded_by,
    'attachment',
    NEW.id,
    'created',
    jsonb_build_object(
      'task_id', NEW.task_id,
      'file_name', NEW.file_name,
      'file_size', NEW.file_size
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER attachment_created_trigger
  AFTER INSERT ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_attachment_created();

-- Attachment deleted
CREATE OR REPLACE FUNCTION log_attachment_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
    OLD.company_id,
    COALESCE(auth.uid(), OLD.uploaded_by),
    'attachment',
    OLD.id,
    'deleted',
    jsonb_build_object(
      'task_id', OLD.task_id,
      'file_name', OLD.file_name
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER attachment_deleted_trigger
  BEFORE DELETE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_attachment_deleted();

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260210_002_create_activity_log completed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Created activity_log table with indexes and RLS';
  RAISE NOTICE '  - Created log_activity() helper function';
  RAISE NOTICE '  - Added triggers for tasks (create, update, delete, status change, assignment)';
  RAISE NOTICE '  - Added triggers for projects (create, update, delete)';
  RAISE NOTICE '  - Added triggers for comments (create, delete)';
  RAISE NOTICE '  - Added triggers for attachments (create, delete)';
  RAISE NOTICE '  - All changes are now automatically tracked!';
  RAISE NOTICE '';
END $$;
