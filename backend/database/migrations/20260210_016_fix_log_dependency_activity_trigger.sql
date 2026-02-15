-- Fix the log_dependency_activity trigger function
-- activity_log uses: actor_id (not user_id), details (not description/metadata)
CREATE OR REPLACE FUNCTION public.log_dependency_activity()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
DECLARE
  v_task_title TEXT;
  v_depends_on_title TEXT;
BEGIN
  -- Get task titles
  SELECT title INTO v_task_title FROM tasks WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  SELECT title INTO v_depends_on_title FROM tasks WHERE id = COALESCE(NEW.depends_on_task_id, OLD.depends_on_task_id);

  -- Insert into activity log using correct column names
  INSERT INTO activity_log (
    company_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    details
  ) VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    'task',
    COALESCE(NEW.task_id, OLD.task_id),
    CASE WHEN TG_OP = 'INSERT' THEN 'dependency_added' ELSE 'dependency_removed' END,
    COALESCE(NEW.created_by, OLD.created_by),
    jsonb_build_object(
      'description', CASE
        WHEN TG_OP = 'INSERT' THEN format('Added dependency: "%s" depends on "%s"', v_task_title, v_depends_on_title)
        ELSE format('Removed dependency: "%s" no longer depends on "%s"', v_task_title, v_depends_on_title)
      END,
      'dependency_id', COALESCE(NEW.id, OLD.id),
      'depends_on_task_id', COALESCE(NEW.depends_on_task_id, OLD.depends_on_task_id)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;
