-- Migration: Fix project activity log to include project name
-- Date: 2026-02-15
-- Description: Update project activity triggers to always include project name in details

-- Update the log_project_updated function to include project name
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

  IF OLD.start_year IS DISTINCT FROM NEW.start_year THEN
    changes := changes || jsonb_build_object('start_year', jsonb_build_object('old', OLD.start_year, 'new', NEW.start_year));
  END IF;

  IF OLD.end_year IS DISTINCT FROM NEW.end_year THEN
    changes := changes || jsonb_build_object('end_year', jsonb_build_object('old', OLD.end_year, 'new', NEW.end_year));
  END IF;

  IF changes != '{}' THEN
    -- Always include project name in details
    changes := changes || jsonb_build_object('project_name', NEW.name);

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
