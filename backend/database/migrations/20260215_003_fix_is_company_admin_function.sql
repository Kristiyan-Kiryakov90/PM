-- Migration: Fix is_company_admin function to handle sys_admin role
-- Date: 2026-02-15
-- Description: Function was returning NULL instead of boolean, causing RLS policy failures

-- Fix is_company_admin to include sys_admin and return boolean instead of NULL
CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'sys_admin')
     FROM public.profiles
     WHERE id = auth.uid()),
    false
  );
$$;
