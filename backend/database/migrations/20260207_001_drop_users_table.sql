-- Migration: Drop public.users table
-- Date: 2026-02-07
-- Description: Remove public.users table and use auth.users only
-- Reason: Simplify architecture, use Supabase auth.users out of the box

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop functions related to users table
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_login();
DROP FUNCTION IF EXISTS public.user_full_name(uuid);
DROP FUNCTION IF EXISTS public.user_preference(uuid, text, text);
DROP FUNCTION IF EXISTS public.update_user_preference(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.users_with_preference(text, text);
DROP FUNCTION IF EXISTS public.current_user_info();

-- Drop users table (CASCADE will drop foreign keys from other tables)
-- Note: We need to remove FK constraints first from other tables
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;

-- Now drop the users table
DROP TABLE IF EXISTS public.users CASCADE;

-- Update comments on remaining tables
COMMENT ON TABLE companies IS 'Multi-tenant containers. User data stored in auth.users metadata.';
COMMENT ON TABLE projects IS 'Projects within companies. created_by references auth.users.id';
COMMENT ON TABLE tasks IS 'Tasks within projects. assigned_to and created_by reference auth.users.id';
COMMENT ON TABLE attachments IS 'File attachments. uploaded_by references auth.users.id';
