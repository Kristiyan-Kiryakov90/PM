-- Migration: Comments and Mentions System
-- Date: 2026-02-10
-- Purpose: Add comments with @mentions, threaded replies, and action items

BEGIN;

-- =============================================================================
-- STEP 1: Create Tables
-- =============================================================================

-- Comments table for task discussions
CREATE TABLE comments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    parent_comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    content text NOT NULL CHECK (trim(content) <> ''),
    is_action_item boolean DEFAULT false,
    action_assignee uuid,
    action_resolved boolean DEFAULT false,
    action_resolved_at timestamptz,
    edited_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Mentions table to track @mentions in comments
CREATE TABLE mentions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comment_id bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (comment_id, mentioned_user_id)
);

-- =============================================================================
-- STEP 2: Create Indexes
-- =============================================================================

CREATE INDEX comments_task_id_idx ON comments(task_id);
CREATE INDEX comments_company_id_idx ON comments(company_id);
CREATE INDEX comments_author_id_idx ON comments(author_id);
CREATE INDEX comments_parent_comment_id_idx ON comments(parent_comment_id);
CREATE INDEX comments_created_at_idx ON comments(created_at DESC);
CREATE INDEX mentions_comment_id_idx ON mentions(comment_id);
CREATE INDEX mentions_mentioned_user_id_idx ON mentions(mentioned_user_id);

-- =============================================================================
-- STEP 3: Row Level Security Policies
-- =============================================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments FORCE ROW LEVEL SECURITY;

-- SELECT: Users can see comments on tasks they have access to
CREATE POLICY comments_select_policy ON comments
  FOR SELECT
  USING (
    -- System admin sees all
    is_system_admin()
    OR
    -- Company users see their company's comments
    (company_id IS NOT NULL AND company_id = user_company_id())
    OR
    -- Personal users see comments on their tasks
    (company_id IS NULL AND task_id IN (
      SELECT id FROM tasks
      WHERE company_id IS NULL
      AND created_by = auth.uid()
    ))
  );

-- INSERT: Authenticated users can add comments to tasks they can access
CREATE POLICY comments_insert_policy ON comments
  FOR INSERT
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- Author must be current user
    author_id = auth.uid()
    AND
    (
      -- System admin can comment anywhere
      is_system_admin()
      OR
      -- Company users can comment on their company's tasks
      (company_id IS NOT NULL AND company_id = user_company_id() AND task_id IN (
        SELECT id FROM tasks WHERE company_id = user_company_id()
      ))
      OR
      -- Personal users can comment on their own tasks
      (company_id IS NULL AND task_id IN (
        SELECT id FROM tasks
        WHERE company_id IS NULL
        AND created_by = auth.uid()
      ))
    )
  );

-- UPDATE: Users can edit their own comments
CREATE POLICY comments_update_policy ON comments
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR
    is_system_admin()
  )
  WITH CHECK (
    author_id = auth.uid()
    OR
    is_system_admin()
  );

-- DELETE: Users can delete their own comments, or admins can delete company comments
CREATE POLICY comments_delete_policy ON comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR
    is_system_admin()
    OR
    (company_id IS NOT NULL AND is_company_admin())
  );

-- =============================================================================
-- Mentions RLS Policies
-- =============================================================================

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions FORCE ROW LEVEL SECURITY;

-- SELECT: Users can see mentions in comments they can access
CREATE POLICY mentions_select_policy ON mentions
  FOR SELECT
  USING (
    comment_id IN (
      SELECT id FROM comments
    )
  );

-- INSERT: Anyone who can create a comment can create mentions
CREATE POLICY mentions_insert_policy ON mentions
  FOR INSERT
  WITH CHECK (
    comment_id IN (
      SELECT id FROM comments WHERE author_id = auth.uid()
    )
    OR
    is_system_admin()
  );

-- DELETE: Can only delete mentions from your own comments
CREATE POLICY mentions_delete_policy ON mentions
  FOR DELETE
  USING (
    comment_id IN (
      SELECT id FROM comments WHERE author_id = auth.uid()
    )
    OR
    is_system_admin()
  );

-- =============================================================================
-- STEP 4: Updated_at Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_updated_at_trigger
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();

-- =============================================================================
-- STEP 5: Helper Function to Get Comment Thread
-- =============================================================================

CREATE OR REPLACE FUNCTION get_comment_thread(root_comment_id bigint)
RETURNS TABLE (
  id bigint,
  task_id bigint,
  parent_comment_id bigint,
  author_id uuid,
  content text,
  is_action_item boolean,
  action_assignee uuid,
  action_resolved boolean,
  created_at timestamptz,
  depth integer
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    -- Base case: root comment
    SELECT
      c.id,
      c.task_id,
      c.parent_comment_id,
      c.author_id,
      c.content,
      c.is_action_item,
      c.action_assignee,
      c.action_resolved,
      c.created_at,
      0 as depth
    FROM comments c
    WHERE c.id = root_comment_id

    UNION ALL

    -- Recursive case: child comments
    SELECT
      c.id,
      c.task_id,
      c.parent_comment_id,
      c.author_id,
      c.content,
      c.is_action_item,
      c.action_assignee,
      c.action_resolved,
      c.created_at,
      ct.depth + 1
    FROM comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
  )
  SELECT * FROM comment_tree ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_comment_thread IS
'Recursively fetches a comment and all its nested replies';

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260210_001_create_comments_mentions completed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Created comments table with action items support';
  RAISE NOTICE '  - Created mentions table for @mentions tracking';
  RAISE NOTICE '  - Added RLS policies for multi-tenant isolation';
  RAISE NOTICE '  - Created indexes for performance';
  RAISE NOTICE '  - Added get_comment_thread() helper function';
  RAISE NOTICE '';
END $$;
