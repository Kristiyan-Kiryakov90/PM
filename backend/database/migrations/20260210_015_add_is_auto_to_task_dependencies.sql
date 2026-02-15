-- Add is_auto column to task_dependencies
-- Distinguishes auto-generated dependencies (from Gantt reorder) from manual ones
ALTER TABLE task_dependencies
  ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;

-- Index for fast cleanup of auto dependencies
CREATE INDEX IF NOT EXISTS idx_task_deps_is_auto
  ON task_dependencies (is_auto) WHERE is_auto = true;

COMMENT ON COLUMN task_dependencies.is_auto IS 'True if dependency was auto-generated from Gantt chart ordering';
