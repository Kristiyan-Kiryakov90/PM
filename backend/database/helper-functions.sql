-- TaskFlow Helper Functions
-- Functions for role checking and company isolation

-- Function to get the current user's company_id from auth.users metadata
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT (raw_user_meta_data->>'company_id')::UUID
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a system admin
CREATE OR REPLACE FUNCTION auth.is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT raw_user_meta_data->>'role' = 'sys_admin'
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a company admin
CREATE OR REPLACE FUNCTION auth.is_company_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT raw_user_meta_data->>'role' IN ('admin', 'sys_admin')
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT raw_user_meta_data->>'role'
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user belongs to a specific company
CREATE OR REPLACE FUNCTION auth.user_belongs_to_company(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- System admins can access all companies
    IF auth.is_system_admin() THEN
        RETURN TRUE;
    END IF;

    -- Check if user's company_id matches
    RETURN (
        SELECT (raw_user_meta_data->>'company_id')::UUID = check_company_id
        FROM auth.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate invite token and get company_id
CREATE OR REPLACE FUNCTION public.validate_invite_token(invite_token UUID)
RETURNS TABLE (
    company_id UUID,
    role TEXT,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.company_id,
        i.role,
        (i.status = 'pending' AND i.expires_at > NOW()) AS is_valid
    FROM invites i
    WHERE i.token = invite_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark invite as used
CREATE OR REPLACE FUNCTION public.mark_invite_used(invite_token UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE invites
    SET
        status = 'accepted',
        used_at = NOW()
    WHERE token = invite_token
        AND status = 'pending'
        AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire old invites (can be called by a cron job)
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE invites
    SET status = 'expired'
    WHERE status = 'pending'
        AND expires_at <= NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
