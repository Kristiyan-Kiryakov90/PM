-- Migration: Create notifications system
-- Description: Notifications for mentions, assignments, comments, and other user actions
-- Date: 2026-02-10

-- Create helper function for updating updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,

    -- Notification metadata
    type text NOT NULL CHECK (type IN (
        'mention',
        'assignment',
        'comment',
        'reply',
        'status_change',
        'due_date',
        'task_completed',
        'project_update'
    )),
    title text NOT NULL,
    message text NOT NULL,

    -- Related entities (nullable - not all notifications relate to all entities)
    task_id bigint REFERENCES tasks(id) ON DELETE CASCADE,
    project_id bigint REFERENCES projects(id) ON DELETE CASCADE,
    comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,

    -- Actor who triggered the notification
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Notification state
    is_read boolean DEFAULT false,
    read_at timestamptz,

    -- Standard timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_company_id ON notifications(company_id);
CREATE INDEX idx_notifications_task_id ON notifications(task_id);
CREATE INDEX idx_notifications_project_id ON notifications(project_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY notifications_select_own
    ON notifications FOR SELECT
    USING (
        auth.uid() = user_id
    );

-- Policy: System can insert notifications (handled by triggers/functions)
CREATE POLICY notifications_insert_system
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY notifications_delete_own
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Function: Create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id uuid,
    p_company_id bigint,
    p_type text,
    p_title text,
    p_message text,
    p_task_id bigint DEFAULT NULL,
    p_project_id bigint DEFAULT NULL,
    p_comment_id bigint DEFAULT NULL,
    p_actor_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notification_id bigint;
BEGIN
    -- Don't notify users about their own actions
    IF p_user_id = p_actor_id THEN
        RETURN NULL;
    END IF;

    INSERT INTO notifications (
        user_id,
        company_id,
        type,
        title,
        message,
        task_id,
        project_id,
        comment_id,
        actor_id
    )
    VALUES (
        p_user_id,
        p_company_id,
        p_type,
        p_title,
        p_message,
        p_task_id,
        p_project_id,
        p_comment_id,
        p_actor_id
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

-- Trigger: Notify on task assignment
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_task_title text;
    v_company_id bigint;
BEGIN
    -- Only notify on assignment changes (not on task creation)
    IF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
        SELECT title, company_id INTO v_task_title, v_company_id
        FROM tasks
        WHERE id = NEW.id;

        PERFORM create_notification(
            p_user_id := NEW.assigned_to,
            p_company_id := v_company_id,
            p_type := 'assignment',
            p_title := 'New task assigned',
            p_message := 'You were assigned to: ' || v_task_title,
            p_task_id := NEW.id,
            p_project_id := NEW.project_id,
            p_actor_id := auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_task_assignment
    AFTER INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assignment();

-- Trigger: Notify on mentions (when mentions are created)
CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comment record;
    v_task_title text;
BEGIN
    -- Get comment details
    SELECT c.*, t.title as task_title, t.company_id
    INTO v_comment
    FROM comments c
    LEFT JOIN tasks t ON c.task_id = t.id
    WHERE c.id = NEW.comment_id;

    -- Create notification for mentioned user
    PERFORM create_notification(
        p_user_id := NEW.user_id,
        p_company_id := v_comment.company_id,
        p_type := 'mention',
        p_title := 'You were mentioned',
        p_message := 'You were mentioned in a comment' ||
            CASE WHEN v_comment.task_title IS NOT NULL
                THEN ' on: ' || v_comment.task_title
                ELSE ''
            END,
        p_task_id := v_comment.task_id,
        p_comment_id := NEW.comment_id,
        p_actor_id := v_comment.user_id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_mention
    AFTER INSERT ON mentions
    FOR EACH ROW
    EXECUTE FUNCTION notify_mention();

-- Trigger: Notify on comment replies
CREATE OR REPLACE FUNCTION notify_comment_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parent_comment record;
    v_task_title text;
BEGIN
    -- Only notify on replies (parent_comment_id is set)
    IF NEW.parent_comment_id IS NOT NULL THEN
        -- Get parent comment details
        SELECT c.*, t.title as task_title, t.company_id
        INTO v_parent_comment
        FROM comments c
        LEFT JOIN tasks t ON c.task_id = t.id
        WHERE c.id = NEW.parent_comment_id;

        -- Notify the parent comment author
        PERFORM create_notification(
            p_user_id := v_parent_comment.author_id,
            p_company_id := v_parent_comment.company_id,
            p_type := 'reply',
            p_title := 'New reply to your comment',
            p_message := 'Someone replied to your comment' ||
                CASE WHEN v_parent_comment.task_title IS NOT NULL
                    THEN ' on: ' || v_parent_comment.task_title
                    ELSE ''
                END,
            p_task_id := NEW.task_id,
            p_comment_id := NEW.id,
            p_actor_id := NEW.author_id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_comment_reply
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_comment_reply();

-- Trigger: Update updated_at timestamp
CREATE TRIGGER trigger_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
