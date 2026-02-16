/**
 * Task Attachments Module
 * Handles attachment upload, download, view, and delete operations
 */

import { Modal } from 'bootstrap';
import supabase from '@services/supabase.js';
import { attachmentService } from '@services/attachment-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { escapeHtml, formatFileSize, formatDate } from './tasks-utils.js';

// Module state
let currentTaskAttachments = [];
let currentEditingTaskId = null;
let currentUser = null;

/**
 * Initialize attachment module
 */
export function initAttachmentModule(user) {
  currentUser = user;
}

/**
 * Set current editing task ID
 */
export function setEditingTaskId(taskId) {
  currentEditingTaskId = taskId;
}

/**
 * Load attachments for a task (edit modal)
 */
export async function loadTaskAttachments(taskId) {
  try {
    currentTaskAttachments = await attachmentService.getAttachments(taskId);
    renderTaskAttachments();
  } catch (error) {
    console.error('Error loading attachments:', error);
    uiHelpers.showError('Failed to load attachments');
  }
}

/**
 * Render attachments in edit modal
 */
export function renderTaskAttachments() {
  const attachmentsList = document.getElementById('taskAttachmentsList');
  if (!attachmentsList) return;

  if (currentTaskAttachments.length === 0) {
    attachmentsList.innerHTML = '<p class="text-muted" style="font-size: 0.875rem; margin: 0;">No attachments yet</p>';
    return;
  }

  attachmentsList.innerHTML = currentTaskAttachments
    .map(
      (att) => {
        const isImage = att.mime_type?.startsWith('image/');
        const isPDF = att.mime_type === 'application/pdf';
        const canPreview = isImage || isPDF;

        return `
    <div class="attachment-item-edit" data-attachment-id="${att.id}">
      <div class="attachment-info">
        <span class="attachment-icon">${isImage ? '🖼️' : isPDF ? '📄' : '📎'}</span>
        <div class="attachment-details">
          <span class="attachment-name">${escapeHtml(att.file_name)}</span>
          <span class="attachment-meta">${formatFileSize(att.file_size)} · ${formatDate(att.created_at)}</span>
        </div>
      </div>
      <div class="attachment-actions">
        ${canPreview ? `
          <button class="btn-icon-sm" onclick="window.viewAttachment(${att.id}, '${att.mime_type}')" title="View">
            <span>👁️</span>
          </button>
        ` : ''}
        <button class="btn-icon-sm" onclick="window.attachmentService.downloadAttachment(${att.id})" title="Download">
          <span>⬇️</span>
        </button>
        <button class="btn-icon-sm btn-danger-icon" onclick="window.deleteEditAttachment(${att.id})" title="Delete">
          <span>🗑️</span>
        </button>
      </div>
    </div>
  `;
      }
    )
    .join('');
}

/**
 * Handle attachment file upload
 */
export async function handleAttachmentUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  if (!currentEditingTaskId) {
    uiHelpers.showError('Please save the task before uploading attachments');
    event.target.value = '';
    return;
  }

  // Validate file sizes (1MB limit per file)
  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
  const oversizedFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);

  if (oversizedFiles.length > 0) {
    const fileNames = oversizedFiles.map(f =>
      `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`
    ).join(', ');
    uiHelpers.showError(`File(s) exceed 1MB limit: ${fileNames}`);
    event.target.value = '';
    return;
  }

  try {
    uiHelpers.showLoading('Uploading attachments...');

    for (const file of files) {
      const attachment = await attachmentService.uploadAttachment(currentEditingTaskId, file);
      currentTaskAttachments.push(attachment);
    }

    uiHelpers.hideLoading();
    uiHelpers.showSuccess(`${files.length} file(s) uploaded successfully`);
    renderTaskAttachments();

    // Clear input
    event.target.value = '';
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error uploading attachment:', error);
    uiHelpers.showError(error.message || 'Failed to upload attachment');
    event.target.value = '';
  }
}

/**
 * Delete attachment from edit modal
 */
export async function deleteEditAttachment(attachmentId) {
  if (!confirm('Are you sure you want to delete this attachment?')) {
    return;
  }

  try {
    uiHelpers.showLoading('Deleting attachment...');
    await attachmentService.deleteAttachment(attachmentId);
    uiHelpers.hideLoading();

    // Remove from current list
    currentTaskAttachments = currentTaskAttachments.filter((att) => att.id !== attachmentId);
    renderTaskAttachments();

    uiHelpers.showSuccess('Attachment deleted successfully');
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error deleting attachment:', error);
    uiHelpers.showError(error.message || 'Failed to delete attachment');
  }
}

/**
 * Delete attachment from view modal
 */
export async function deleteViewAttachment(attachmentId, taskId, reopenViewModal) {
  if (!confirm('Are you sure you want to delete this attachment?')) {
    return;
  }

  try {
    uiHelpers.showLoading('Deleting attachment...');
    await attachmentService.deleteAttachment(attachmentId);
    uiHelpers.hideLoading();
    uiHelpers.showSuccess('Attachment deleted successfully');

    // Close and reopen modal to refresh
    const modal = Modal.getInstance(document.getElementById('viewTaskModal'));
    if (modal) {
      modal.hide();
    }
    setTimeout(() => reopenViewModal(taskId), 300);
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error deleting attachment:', error);
    uiHelpers.showError(error.message || 'Failed to delete attachment');
  }
}

/**
 * Download attachment
 */
export function downloadAttachmentHandler(attachmentId, viewAttachments) {
  const attachment = viewAttachments?.find((att) => att.id === attachmentId);
  if (!attachment) {
    uiHelpers.showError('Attachment not found');
    return;
  }

  try {
    attachmentService.downloadAttachment(attachment);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    uiHelpers.showError('Failed to download attachment');
  }
}

/**
 * View attachment (preview images/PDFs)
 */
export async function viewAttachment(attachmentId, mimeType, viewAttachments) {
  try {
    uiHelpers.showLoading('Loading preview...');

    // Find attachment in current list
    let attachment = currentTaskAttachments?.find(a => a.id === attachmentId);
    if (!attachment && viewAttachments) {
      attachment = viewAttachments.find(a => a.id === attachmentId);
    }

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Get public URL from Supabase Storage
    const { data } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(attachment.file_path, 3600); // 1 hour expiry

    uiHelpers.hideLoading();

    if (!data?.signedUrl) {
      throw new Error('Failed to get file URL');
    }

    const isImage = mimeType?.startsWith('image/');
    const isPDF = mimeType === 'application/pdf';

    if (isImage) {
      // Show image in modal
      showImagePreview(data.signedUrl, attachment.file_name);
    } else if (isPDF) {
      // Open PDF in new tab
      window.open(data.signedUrl, '_blank');
    }
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error viewing attachment:', error);
    uiHelpers.showError(error.message || 'Failed to view attachment');
  }
}

/**
 * Show image preview in modal
 */
function showImagePreview(imageUrl, fileName) {
  // Create modal dynamically
  const existingModal = document.getElementById('imagePreviewModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div class="modal fade" id="imagePreviewModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(fileName)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center" style="max-height: 80vh; overflow: auto;">
            <img src="${imageUrl}" alt="${escapeHtml(fileName)}" style="max-width: 100%; height: auto;">
          </div>
          <div class="modal-footer">
            <a href="${imageUrl}" download="${escapeHtml(fileName)}" class="btn btn-primary">Download</a>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = new Modal(document.getElementById('imagePreviewModal'));
  modal.show();

  // Clean up when closed
  document.getElementById('imagePreviewModal').addEventListener('hidden.bs.modal', function () {
    this.remove();
  });
}

/**
 * Reset attachments state
 */
export function resetAttachments() {
  currentTaskAttachments = [];
  currentEditingTaskId = null;
}

/**
 * Get current attachments
 */
export function getCurrentAttachments() {
  return currentTaskAttachments;
}

// Expose functions to window for onclick handlers
window.deleteEditAttachment = deleteEditAttachment;
window.viewAttachment = (...args) => viewAttachment(...args, window._viewAttachments);
window.downloadAttachment = (id) => downloadAttachmentHandler(id, window._viewAttachments);
window.deleteViewAttachment = deleteViewAttachment;
