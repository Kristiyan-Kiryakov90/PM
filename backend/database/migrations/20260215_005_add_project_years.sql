-- Migration: Add start_year and end_year to projects
-- Date: 2026-02-15
-- Description: Add year tracking for projects

-- Add year columns
ALTER TABLE projects
ADD COLUMN start_year INTEGER,
ADD COLUMN end_year INTEGER;

-- Add check constraint to ensure years are valid
ALTER TABLE projects
ADD CONSTRAINT projects_years_check
CHECK (
  (start_year IS NULL OR (start_year >= 2000 AND start_year <= 2100))
  AND
  (end_year IS NULL OR (end_year >= 2000 AND end_year <= 2100))
  AND
  (start_year IS NULL OR end_year IS NULL OR end_year >= start_year)
);

-- Add index for year filtering
CREATE INDEX idx_projects_start_year ON projects(start_year);
CREATE INDEX idx_projects_end_year ON projects(end_year);
