-- Migration: Fix project status constraint to include 'paused'
-- Date: 2026-02-15
-- Description: Frontend uses 'paused' status but DB constraint only allowed 'completed'

-- Drop the old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add new constraint with correct status values
ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'paused', 'archived'));
