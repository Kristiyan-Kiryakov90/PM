-- Migration: Drop invites system
-- Date: 2026-02-07
-- Description: Remove invite-based registration system
-- Reason: Admins will create/manage users directly via admin panel

-- Drop functions related to invites
DROP FUNCTION IF EXISTS public.validate_invite_token(uuid);
DROP FUNCTION IF EXISTS public.mark_invite_used(uuid);
DROP FUNCTION IF EXISTS public.expire_old_invites();

-- Drop invites table
DROP TABLE IF EXISTS public.invites CASCADE;

COMMENT ON DATABASE current_database() IS 'User management via admin panel only. No invite system.';
