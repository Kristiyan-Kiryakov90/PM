-- Migration: Enhance User Profiles and Team Members
-- Description: Add user avatars, status, and team member features
-- Date: 2026-02-10

-- Add additional fields to support user profiles
-- Note: We use auth.users metadata for most user data, but add tracking fields

-- Create user_status table for online/away/busy status
CREATE TABLE IF NOT EXISTS user_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    status_message text,
    last_seen timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_status_user_id ON user_status(user_id);
CREATE INDEX idx_user_status_status ON user_status(status);
CREATE INDEX idx_user_status_last_seen ON user_status(last_seen DESC);

-- RLS Policies
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all user statuses in their company
CREATE POLICY user_status_select_policy
    ON user_status FOR SELECT
    USING (
        is_system_admin() OR
        user_company_id() IS NULL OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = user_status.user_id
            AND (profiles.company_id = user_company_id() OR profiles.company_id IS NULL)
        )
    );

-- Policy: Users can update their own status
CREATE POLICY user_status_update_own
    ON user_status FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can insert their own status
CREATE POLICY user_status_insert_own
    ON user_status FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function: Update last_seen timestamp
CREATE OR REPLACE FUNCTION update_user_last_seen(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    INSERT INTO user_status (user_id, last_seen, status)
    VALUES (v_user_id, now(), 'online')
    ON CONFLICT (user_id)
    DO UPDATE SET
        last_seen = now(),
        status = CASE
            WHEN user_status.status = 'offline' THEN 'online'
            ELSE user_status.status
        END,
        updated_at = now();
END;
$$;

-- Function: Get company team members with details
CREATE OR REPLACE FUNCTION get_company_team_members(p_company_id bigint DEFAULT NULL)
RETURNS TABLE (
    user_id uuid,
    email text,
    full_name text,
    avatar_url text,
    role text,
    status text,
    status_message text,
    last_seen timestamptz,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id bigint;
BEGIN
    v_company_id := COALESCE(p_company_id, user_company_id());

    RETURN QUERY
    SELECT
        p.id as user_id,
        u.email,
        u.raw_user_meta_data->>'full_name' as full_name,
        u.raw_user_meta_data->>'avatar_url' as avatar_url,
        p.role,
        COALESCE(us.status, 'offline') as status,
        us.status_message,
        us.last_seen,
        p.created_at
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN user_status us ON us.user_id = p.id
    WHERE p.company_id = v_company_id
        OR (v_company_id IS NULL AND p.company_id IS NULL)
    ORDER BY p.created_at DESC;
END;
$$;

-- Trigger: Update updated_at timestamp
CREATE TRIGGER trigger_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
