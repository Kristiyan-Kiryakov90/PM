-- Migration: Create Tags System
-- Description: Add tags for flexible task categorization
-- Phase: 3B - Tags/Labels

-- =====================================================
-- TABLE: tags
-- =====================================================
CREATE TABLE IF NOT EXISTS tags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL,
  color varchar(7) NOT NULL DEFAULT '#6b7280',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_tag_name CHECK (TRIM(name) <> ''),
  CONSTRAINT valid_tag_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- =====================================================
-- TABLE: task_tags (Many-to-Many Junction)
-- =====================================================
CREATE TABLE IF NOT EXISTS task_tags (
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (task_id, tag_id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_tags_company_id ON tags(company_id);
CREATE INDEX idx_tags_name ON tags(LOWER(name));
CREATE INDEX idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX idx_task_tags_tag_id ON task_tags(tag_id);

-- Unique index for case-insensitive tag names per company
CREATE UNIQUE INDEX idx_tags_unique_name_per_company ON tags(company_id, LOWER(name));

-- =====================================================
-- RLS POLICIES: tags
-- =====================================================
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tags in their company
CREATE POLICY tags_select_company ON tags
  FOR SELECT
  USING (
    is_system_admin()
    OR (company_id IS NULL AND created_by = auth.uid())
    OR (company_id IS NOT NULL AND company_id = user_company_id())
  );

-- Policy: Users can create tags in their company
CREATE POLICY tags_insert_own ON tags
  FOR INSERT
  WITH CHECK (
    (company_id IS NULL AND created_by = auth.uid())
    OR (company_id IS NOT NULL AND company_id = user_company_id())
  );

-- Policy: Users can update tags in their company
CREATE POLICY tags_update_company ON tags
  FOR UPDATE
  USING (
    is_system_admin()
    OR (company_id IS NULL AND created_by = auth.uid())
    OR (company_id IS NOT NULL AND company_id = user_company_id())
  );

-- Policy: Users can delete tags in their company
CREATE POLICY tags_delete_company ON tags
  FOR DELETE
  USING (
    is_system_admin()
    OR (company_id IS NULL AND created_by = auth.uid())
    OR (company_id IS NOT NULL AND company_id = user_company_id())
  );

-- =====================================================
-- RLS POLICIES: task_tags
-- =====================================================
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view task-tag relationships for tasks they can access
CREATE POLICY task_tags_select ON task_tags
  FOR SELECT
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
        AND (
          (t.company_id IS NULL AND t.created_by = auth.uid())
          OR t.company_id = user_company_id()
        )
    )
  );

-- Policy: Users can add tags to tasks they can access
CREATE POLICY task_tags_insert ON task_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
        AND (
          (t.company_id IS NULL AND t.created_by = auth.uid())
          OR t.company_id = user_company_id()
        )
    )
    AND EXISTS (
      SELECT 1 FROM tags tg
      WHERE tg.id = tag_id
        AND (
          (tg.company_id IS NULL AND tg.created_by = auth.uid())
          OR tg.company_id = user_company_id()
        )
    )
  );

-- Policy: Users can remove tags from tasks they can access
CREATE POLICY task_tags_delete ON task_tags
  FOR DELETE
  USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
        AND (
          (t.company_id IS NULL AND t.created_by = auth.uid())
          OR t.company_id = user_company_id()
        )
    )
  );

-- =====================================================
-- TRIGGER: Update timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_tags_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tags_timestamp
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_timestamp();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get tags for a task
CREATE OR REPLACE FUNCTION get_task_tags(p_task_id bigint)
RETURNS TABLE (
  id bigint,
  name varchar,
  color varchar
) AS $$
  SELECT t.id, t.name, t.color
  FROM tags t
  JOIN task_tags tt ON tt.tag_id = t.id
  WHERE tt.task_id = p_task_id
  ORDER BY t.name;
$$ LANGUAGE sql STABLE;

-- Get tasks with a specific tag
CREATE OR REPLACE FUNCTION get_tasks_by_tag(p_tag_id bigint)
RETURNS TABLE (
  task_id bigint,
  title text,
  status text,
  priority text
) AS $$
  SELECT t.id, t.title, t.status, t.priority
  FROM tasks t
  JOIN task_tags tt ON tt.task_id = t.id
  WHERE tt.tag_id = p_tag_id
  ORDER BY t.created_at DESC;
$$ LANGUAGE sql STABLE;

-- Get tag usage count
CREATE OR REPLACE FUNCTION get_tag_usage_count(p_tag_id bigint)
RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM task_tags
  WHERE tag_id = p_tag_id;
$$ LANGUAGE sql STABLE;

-- Search tags by name
CREATE OR REPLACE FUNCTION search_tags(p_query text, p_company_id bigint DEFAULT NULL)
RETURNS TABLE (
  id bigint,
  name varchar,
  color varchar,
  usage_count bigint
) AS $$
  SELECT
    t.id,
    t.name,
    t.color,
    COUNT(tt.task_id) as usage_count
  FROM tags t
  LEFT JOIN task_tags tt ON tt.tag_id = t.id
  WHERE
    LOWER(t.name) LIKE LOWER('%' || p_query || '%')
    AND (p_company_id IS NULL OR t.company_id = p_company_id)
  GROUP BY t.id, t.name, t.color
  ORDER BY usage_count DESC, t.name;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE tags IS 'Tag definitions with colors for flexible task categorization';
COMMENT ON TABLE task_tags IS 'Many-to-many junction table linking tasks to tags';
COMMENT ON COLUMN tags.color IS 'Hex color code for tag badge (e.g., #3b82f6)';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON tags TO authenticated;
GRANT USAGE ON SEQUENCE tags_id_seq TO authenticated;
GRANT SELECT, INSERT, DELETE ON task_tags TO authenticated;

-- =====================================================
-- SAMPLE DATA (Optional - Common Tags)
-- =====================================================
-- Uncomment to insert common tags for testing:
-- INSERT INTO tags (company_id, name, color, created_by) VALUES
--   (NULL, 'bug', '#ef4444', auth.uid()),
--   (NULL, 'feature', '#10b981', auth.uid()),
--   (NULL, 'urgent', '#f59e0b', auth.uid()),
--   (NULL, 'documentation', '#3b82f6', auth.uid()),
--   (NULL, 'backend', '#8b5cf6', auth.uid()),
--   (NULL, 'frontend', '#ec4899', auth.uid());
