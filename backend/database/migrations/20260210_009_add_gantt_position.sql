-- Add gantt_position field to tasks for vertical ordering in Gantt view
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS gantt_position INTEGER DEFAULT 0;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_tasks_gantt_position ON tasks(project_id, gantt_position) WHERE gantt_position IS NOT NULL;

-- Function to auto-assign gantt_position to existing tasks
DO $$
DECLARE
  proj_id BIGINT;
  task_rec RECORD;
  pos INTEGER;
BEGIN
  -- For each project, assign sequential positions based on created_at
  FOR proj_id IN SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL LOOP
    pos := 1;
    FOR task_rec IN
      SELECT id FROM tasks
      WHERE project_id = proj_id AND gantt_position = 0
      ORDER BY created_at ASC
    LOOP
      UPDATE tasks SET gantt_position = pos WHERE id = task_rec.id;
      pos := pos + 1;
    END LOOP;
  END LOOP;

  -- Handle tasks without project (personal tasks)
  pos := 1;
  FOR task_rec IN
    SELECT id FROM tasks
    WHERE project_id IS NULL AND gantt_position = 0
    ORDER BY created_at ASC
  LOOP
    UPDATE tasks SET gantt_position = pos WHERE id = task_rec.id;
    pos := pos + 1;
  END LOOP;
END $$;

COMMENT ON COLUMN tasks.gantt_position IS 'Position for vertical ordering in Gantt view (lower number = higher position)';
