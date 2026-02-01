# Plan 07: Attachment System

## Objective
Implement file upload, storage, download, and deletion for task attachments.

## What's Needed

**Files:**
- `frontend/src/js/services/attachment-service.js` - Attachment operations
- Update `frontend/src/js/pages/tasks.js` - Add attachment UI to task modal

**Functionality:**

**Attachment Service:**
- uploadAttachment - Upload file to Supabase Storage, create record
- getAttachments - List attachments for a task
- deleteAttachment - Delete file from storage and record

**File Upload:**
- File size validation (max 10MB)
- File type validation (optional)
- Upload to Supabase Storage "attachments" bucket
- Store metadata in attachments table (file_name, file_size, mime_type, file_url)

**Task Modal Updates:**
- Show attachments list in task detail modal
- Upload button/drag-drop zone
- Display file name, size, upload date
- Download link for each attachment
- Delete button (own uploads only)

**Storage Structure:**
- Path: `task-attachments/{task_id}/{random_id}.{ext}`
- Public access for downloads

## Testing
- Can upload file to task
- File appears in Supabase Storage bucket
- Attachment record created in database
- Can view attachments list
- Can download attachment
- Can delete own attachments
- File size validation works (10MB limit)
- Multi-tenant isolation (can't upload to other company's tasks)

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
- Plan 03 (Authentication System)
- Plan 06 (Task Management)
