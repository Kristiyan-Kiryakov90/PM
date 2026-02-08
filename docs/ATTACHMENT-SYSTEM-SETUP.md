# Attachment System Setup Guide

## Overview

The attachment system allows users to upload files to tasks. Files are stored in Supabase Storage with metadata tracked in the `attachments` database table.

## Prerequisites

- Supabase project with Storage enabled
- Database schema with `attachments` table (from schema-optimized.sql)
- Authentication system in place

## Setup Steps

### 1. Run Storage Bucket Migration

Execute the storage bucket migration to create the bucket and policies:

```sql
-- File: backend/database/migrations/20260208_001_create_storage_bucket.sql
```

Run this in your Supabase SQL Editor or via the Supabase CLI.

### 2. Verify Bucket Creation

1. Go to Supabase Dashboard → Storage
2. Confirm the `task-attachments` bucket exists
3. Verify the bucket is set to **public** (for download links)

### 3. Verify RLS Policies

Check that the following storage policies are active:

- **Users can upload task attachments** - INSERT policy
- **Users can view task attachments** - SELECT policy
- **Users can delete task attachments** - DELETE policy
- **Users can update task attachments** - UPDATE policy

## File Structure

### Frontend Files

- `frontend/src/js/services/attachment-service.js` - Attachment CRUD operations
- `frontend/src/js/pages/tasks.js` - Updated with attachment UI handlers
- `frontend/public/tasks.html` - Updated with attachment upload UI
- `frontend/src/css/tasks.css` - Modern attachment styling

### Backend Files

- `backend/database/schema-optimized.sql` - Contains `attachments` table
- `backend/database/rls-policies.sql` - Contains RLS policies for `attachments` table
- `backend/database/migrations/20260208_001_create_storage_bucket.sql` - Storage bucket setup

## Database Schema

### Attachments Table

```sql
CREATE TABLE IF NOT EXISTS attachments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT attachments_file_name_not_empty CHECK (trim(file_name) <> ''),
    CONSTRAINT attachments_file_path_not_empty CHECK (trim(file_path) <> ''),
    CONSTRAINT attachments_file_size_positive CHECK (file_size > 0)
);
```

### Storage Path Format

```
task-attachments/{task_id}/{random_id}.{ext}
```

Example: `task-attachments/42/k3x9j2l5m8p.pdf`

## Features

### Upload

- **Max file size**: 10MB per file
- **Multiple files**: Supported
- **Location**: Edit modal only (must save task first)
- **Validation**: File size checked before upload
- **Storage**: Supabase Storage bucket `task-attachments`
- **Database**: Record created in `attachments` table

### View

- **Location**: Both edit modal and view modal
- **Display**: File name, size, upload date
- **Actions**: Download, delete (if owner or admin)

### Delete

- **Permissions**: Owner of attachment or company admin
- **Cleanup**: Removes file from storage AND database record
- **Cascade**: When task is deleted, all attachments are deleted (ON DELETE CASCADE)

### Download

- **Method**: Public URL from Supabase Storage
- **Security**: RLS policies control access at database level

## Security

### Multi-tenant Isolation

- **Database RLS**: `attachments` table has RLS policies based on `company_id`
- **Storage**: Relies on database-level checks (all authenticated users can access storage, but database layer enforces permissions)
- **Ownership**: Users can only delete their own attachments (or if admin)

### File Validation

- **Size limit**: 10MB enforced in frontend service
- **Path validation**: Database constraints prevent empty paths
- **MIME type**: Stored but not currently validated (can be added)

## Testing Checklist

- [ ] Can upload file to existing task
- [ ] File appears in Supabase Storage bucket
- [ ] Attachment record created in database with correct company_id
- [ ] Can view attachments list in edit modal
- [ ] Can view attachments list in view modal
- [ ] Can download attachment
- [ ] Can delete own attachments
- [ ] Cannot delete other users' attachments (unless admin)
- [ ] File size validation works (10MB limit)
- [ ] Multi-tenant isolation works (cannot upload to other company's tasks)
- [ ] Attachments deleted when task is deleted

## Troubleshooting

### Upload fails with "Failed to upload file"

- Check Supabase Storage bucket exists and is public
- Verify storage policies are active
- Check browser console for detailed error

### "User not authenticated" error

- Ensure user is logged in
- Check auth session is valid

### Cannot delete attachment

- Verify user is the uploader or has admin role
- Check RLS policies on `attachments` table

### File size too large

- Default limit is 10MB
- Adjust `MAX_FILE_SIZE` in `attachment-service.js` if needed
- Note: Supabase has project-level storage limits

## UI Design

The attachment system follows modern SaaS design principles:

- **Clean upload button** with file input
- **Subtle file size indicator** (max 10MB)
- **Card-based attachment list** with hover effects
- **Icon-based actions** (download, delete)
- **Responsive design** for mobile
- **Micro-interactions** on hover/click
- **Consistent spacing** and typography

## Future Enhancements

Potential improvements:

- [ ] File type restrictions (e.g., only images, PDFs)
- [ ] Drag-and-drop upload
- [ ] Image preview/thumbnails
- [ ] Progress indicator for large files
- [ ] Bulk delete
- [ ] File compression before upload
- [ ] Virus scanning
- [ ] Version history for attachments
