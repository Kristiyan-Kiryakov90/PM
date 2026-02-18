-- Migration: Create user_status table and fix get_company_team_members function
-- Description: Applies missing user_status table and updated team members RPC
-- Date: 2026-02-18

-- Create user_status table (safe to re-run)
CREATE TABLE IF NOT EXISTS user_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    status_message text,
    last_seen timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_status ON user_status(status);
CREATE INDEX IF NOT EXISTS idx_user_status_last_seen ON user_status(last_seen DESC);

-- RLS Policies
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_status' AND policyname = 'user_status_select_policy'
  ) THEN
    CREATE POLICY user_status_select_policy ON user_status FOR SELECT
    USING (
        is_system_admin() OR
        user_company_id() IS NULL OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = user_status.user_id
            AND (profiles.company_id = user_company_id() OR profiles.company_id IS NULL)
        )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_status' AND policyname = 'user_status_update_own'
  ) THEN
    CREATE POLICY user_status_update_own ON user_status FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_status' AND policyname = 'user_status_insert_own'
  ) THEN
    CREATE POLICY user_status_insert_own ON user_status FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger for updated_at (drop and recreate safely)
DROP TRIGGER IF EXISTS trigger_user_status_updated_at ON user_status;
CREATE TRIGGER trigger_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

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

-- Drop and recreate get_company_team_members with correct types
DROP FUNCTION IF EXISTS get_company_team_members(bigint);

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
    created_at timestamptz,
    id uuid
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
        u.email::text,
        (COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(u.raw_user_meta_data->>'last_name', ''))::text as full_name,
        (u.raw_user_meta_data->>'avatar_url')::text as avatar_url,
        p.role::text,
        COALESCE(us.status, 'offline')::text as status,
        us.status_message::text,
        us.last_seen,
        p.created_at,
        p.id
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN user_status us ON us.user_id = p.id
    WHERE p.company_id = v_company_id
        OR (v_company_id IS NULL AND p.company_id IS NULL)
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_team_members TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_last_seen TO authenticated;
