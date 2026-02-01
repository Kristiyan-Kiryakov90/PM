# 09 - File Storage & Attachments

> **Status**: 🟡 Pending
> **Phase**: Phase 4 - File Storage & Admin
> **Dependencies**: [07-task-management.md](./07-task-management.md)

---

## 1. Overview

### Feature Description
Implement file upload, storage, and download functionality using Supabase Storage. Users can attach files to tasks, view attachments, and download them.

### Goals
- Configure Supabase Storage bucket
- Create storage service module
- Add file upload to tasks
- Display attachments on tasks
- Enable file download
- Handle file deletion
- Enforce file size and type restrictions

### User Value Proposition
Allows users to attach relevant documents, images, and files to tasks for better context and collaboration.

### Prerequisites
- [x] [07-task-management.md](./07-task-management.md) - Attachments belong to tasks

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** user
**I want to** upload files to tasks
**So that** I can share documents and resources with my team

**As a** user
**I want to** view all attachments on a task
**So that** I can access relevant files

**As a** user
**I want to** download attached files
**So that** I can use them locally

**As a** user
**I want to** delete attachments I uploaded
**So that** I can remove outdated files

### Acceptance Criteria

- [ ] Users can upload files to tasks (max 10MB)
- [ ] Supported file types: images, PDFs, docs, spreadsheets
- [ ] Attachments display with filename, size, upload date
- [ ] Users can download attachments
- [ ] Users can delete their own attachments
- [ ] Project owners can delete any attachment in their projects
- [ ] File uploads show progress indicator
- [ ] Storage quota respected (Supabase free tier: 1GB)

### Definition of Done

- [ ] Supabase Storage bucket configured
- [ ] Storage service module created
- [ ] File upload UI implemented
- [ ] Attachments display on tasks
- [ ] Download and delete work
- [ ] File size/type validation works
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Upload success rate | > 95% |
| Upload time (5MB file) | < 10 seconds |
| Download success rate | > 98% |

---

## 3. Database Requirements

**attachments table** - Already created in [03-database-schema.md](./03-database-schema.md)

### Supabase Storage Configuration

**Bucket Setup:**
- Bucket name: `task-attachments`
- Access: Private (authenticated users only)
- File size limit: 10MB per file
- Allowed MIME types: Configure in bucket settings

---

## 4. Backend/Service Layer

### Service Module

**File**: `frontend/src/js/services/storage.js`

### Function Signatures

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Tasks | `frontend/public/tasks.html` | Add attachments section |

### UI Layout Description (Add to Task Details)

#### Attachments Section on Task Modal/Page

**Layout Structure:**

### Bootstrap Components Used

| Component | Usage | Classes |
|-----------|-------|---------|
| Card | Attachments container | `card`, `card-body` |
| List Group | Attachments list | `list-group`, `list-group-item` |
| Progress Bar | Upload progress | `progress`, `progress-bar` |
| Button | Upload/Download/Delete | `btn`, `btn-primary`, `btn-sm` |
| Badge | File size | `badge`, `bg-secondary` |
| Alert | Upload errors | `alert`, `alert-danger` |

### JavaScript Interactions

#### File Upload Handler

---

## 6. Security Considerations

### File Upload Security

- [ ] Validate file size (max 10MB)
- [ ] Validate file type (whitelist approach)
- [ ] Sanitize file names
- [ ] Use unique file paths to prevent overwrites
- [ ] Check user authentication before upload

### Storage Access Control

- [ ] Bucket is private (not public)
- [ ] RLS policies on attachments table
- [ ] Only authenticated users can access
- [ ] Users can only delete their own attachments (or project owner)

---

## 7. Implementation Steps

- [ ] Outline database changes (tables, indexes, RLS)
- [ ] Define service layer functions and error handling
- [ ] Describe UI updates and required pages/components
- [ ] List integration touchpoints and config updates
- [ ] Note validation and edge cases to handle

---

## 9. Related Specs

### Dependencies (Must Complete First)

- [x] [07-task-management.md](./07-task-management.md) - Attachments belong to tasks

### Depends On This (Blocked Until Complete)

- None (optional feature)

---

## Appendix

### Supabase Storage Limits (Free Tier)

- Storage: 1GB total
- File uploads: 50MB per file (we limit to 10MB for better UX)
- Bandwidth: 2GB/month

### Supported File Types

- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX, XLS, XLSX, TXT

### Future Enhancements

- [ ] Add drag-and-drop file upload
- [ ] Add image preview/thumbnails
- [ ] Add bulk file download (zip)
- [ ] Add file versioning
- [ ] Add Google Drive/Dropbox integration
