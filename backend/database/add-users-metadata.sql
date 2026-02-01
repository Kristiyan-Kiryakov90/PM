-- Add metadata field to users table
-- Following Best Practice 8.1: Index JSONB Columns for Efficient Querying

-- Add metadata column for user preferences and settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Best Practice 8.1: GIN index for JSONB containment queries (@>, ?, ?&, ?|)
CREATE INDEX IF NOT EXISTS users_metadata_idx ON users USING gin (metadata);

-- Best Practice: Expression indexes for frequently queried JSON keys
-- Example: if you often query by theme preference
CREATE INDEX IF NOT EXISTS users_metadata_theme_idx ON users ((metadata->>'theme'))
WHERE metadata->>'theme' IS NOT NULL;

-- Example: if you often query by notification settings
CREATE INDEX IF NOT EXISTS users_metadata_notifications_idx ON users ((metadata->>'notifications_enabled'))
WHERE metadata->>'notifications_enabled' IS NOT NULL;

COMMENT ON COLUMN users.metadata IS 'User preferences, settings, and custom fields. Use for: theme, language, notifications, UI state, avatar_url, etc.';


-- =============================================================================
-- METADATA STRUCTURE EXAMPLES
-- =============================================================================

/*
Example metadata structure:

{
  "preferences": {
    "theme": "dark",                    // "light", "dark", "auto"
    "language": "en",                   // "en", "es", "fr", etc.
    "timezone": "America/New_York",
    "date_format": "MM/DD/YYYY",
    "time_format": "12h"
  },
  "notifications": {
    "enabled": true,
    "email": true,
    "push": false,
    "task_assigned": true,
    "task_completed": true,
    "project_updates": true,
    "digest_frequency": "daily"         // "realtime", "daily", "weekly", "never"
  },
  "ui": {
    "sidebar_collapsed": false,
    "default_view": "kanban",           // "list", "kanban", "calendar"
    "tasks_per_page": 50,
    "show_completed_tasks": false
  },
  "profile": {
    "avatar_url": "https://...",
    "bio": "Product Manager at Acme Corp",
    "phone": "+1234567890",
    "department": "Engineering"
  },
  "feature_flags": {
    "beta_features": false,
    "ai_assistant": true
  },
  "custom_fields": {
    // Company-specific custom fields
    "employee_id": "EMP-12345",
    "cost_center": "CC-789"
  }
}
*/


-- =============================================================================
-- HELPER FUNCTIONS for working with user metadata
-- =============================================================================

-- Get user preference with fallback default
CREATE OR REPLACE FUNCTION public.user_preference(
    user_id uuid,
    preference_path text,
    default_value text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        metadata #>> string_to_array(preference_path, '.'),
        default_value
    )
    FROM public.users
    WHERE id = user_id;
$$;

COMMENT ON FUNCTION public.user_preference IS 'Get user preference from metadata with fallback. Example: user_preference(auth.uid(), ''preferences.theme'', ''light'')';


-- Update user preference
CREATE OR REPLACE FUNCTION public.update_user_preference(
    user_id uuid,
    preference_path text,
    preference_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.users
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        string_to_array(preference_path, '.'),
        preference_value,
        true
    ),
    updated_at = now()
    WHERE id = user_id;
END;
$$;

COMMENT ON FUNCTION public.update_user_preference IS 'Update single user preference. Example: update_user_preference(auth.uid(), ''preferences.theme'', ''"dark"'')';


-- Get all users with specific preference value (useful for feature rollouts)
CREATE OR REPLACE FUNCTION public.users_with_preference(
    preference_path text,
    preference_value text
)
RETURNS SETOF users
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT *
    FROM public.users
    WHERE metadata #>> string_to_array(preference_path, '.') = preference_value;
$$;

COMMENT ON FUNCTION public.users_with_preference IS 'Find users with specific preference value';


-- =============================================================================
-- EXAMPLE QUERIES
-- =============================================================================

/*
-- Get user theme preference
SELECT public.user_preference(auth.uid(), 'preferences.theme', 'light');

-- Update user theme
SELECT public.update_user_preference(
    auth.uid(),
    'preferences.theme',
    '"dark"'::jsonb
);

-- Update notification settings
UPDATE users
SET metadata = jsonb_set(
    metadata,
    '{notifications,email}',
    'false'::jsonb
)
WHERE id = auth.uid();

-- Query users with dark theme (uses GIN index)
SELECT id, first_name, last_name
FROM users
WHERE metadata @> '{"preferences": {"theme": "dark"}}';

-- Query users with email notifications enabled (uses expression index)
SELECT id, email
FROM users
WHERE metadata->>'notifications.email' = 'true';

-- Get all users in beta program
SELECT id, email, first_name, last_name
FROM users
WHERE metadata #>> '{feature_flags,beta_features}' = 'true';

-- Bulk update: enable feature for all admins
UPDATE users
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{feature_flags,ai_assistant}',
    'true'::jsonb
)
WHERE role IN ('admin', 'sys_admin');
*/
