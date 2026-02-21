/**
 * Tasks Modals - View Modal
 * Handles task view modal operations
 */

import { Modal } from 'bootstrap';
import { taskService } from '@services/task-service.js';
import { attachmentService } from '@services/attachment-service.js';
import { checklistService } from '@services/checklist-service.js';
import { tagService } from '@services/tag-service.js';
import { initCommentThread, destroyCommentThread } from '@tasks/components/comment-thread.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { renderChecklistsSection, setupChecklistHandlers } from './tasks-checklists.js';
import { escapeHtml, capitalizeFirst, getTaskAge, formatFileSize, formatDate, formatStatus, getStatusBadgeClass } from './tasks-utils.js';
import { renderTagBadges } from '@tasks/components/tag-picker.js';

/**
 * Open view task modal
 */
export async function openViewModal(taskId, teamMembers, currentUser, openEditModal, setCurrentDeletingTaskId) {
  try {
    uiHelpers.showLoading('Loading task...');
    const [task, attachments, checklists, taskTags] = await Promise.all([
      taskService.getTask(taskId),
      attachmentService.getAttachments(taskId),
      checklistService.getTaskChecklists(taskId),
      tagService.getTaskTags(taskId),
    ]);
    uiHelpers.hideLoading();

    const modalTitle = document.getElementById('viewTaskModalTitle');
    const modalContent = document.getElementById('viewTaskModalContent');

    if (modalTitle) {
      modalTitle.textContent = task.title;
    }

    if (modalContent) {
      const projectName = task.projects?.name || 'No project';
      const dueDateDisplay = task.due_date
        ? new Date(task.due_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'No due date';

      // Get assignee name
      let assigneeName = 'Unassigned';
      if (task.assigned_to) {
        const assignee = teamMembers.find(m => m.id === task.assigned_to);
        assigneeName = assignee?.full_name || assignee?.email || 'Unknown User';
      }

      const taskAge = getTaskAge(task.created_at);
      const createdAtFull = new Date(task.created_at).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const attachmentsList =
        attachments && attachments.length > 0
          ? attachments
              .map(
                (att) => {
                  const isImage = att.mime_type?.startsWith('image/');
                  const isPDF = att.mime_type === 'application/pdf';
                  const canPreview = isImage || isPDF;

                  return `
          <li class="attachment-item-view">
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
              <button class="btn-icon-sm" onclick="window.downloadAttachment(${att.id})" title="Download">
                <span>⬇️</span>
              </button>
              ${att.uploaded_by === currentUser?.id ? `
                <button class="btn-icon-sm btn-danger-icon" onclick="window.deleteViewAttachment(${att.id}, ${taskId})" title="Delete">
                  <span>🗑️</span>
                </button>
              ` : ''}
            </div>
          </li>
        `;
                }
              )
              .join('')
          : '<li class="text-muted" style="padding: 1rem;">No attachments</li>';

      modalContent.innerHTML = `
        <ul class="nav nav-tabs mb-3" id="taskDetailTabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="details-tab" data-bs-toggle="tab" data-bs-target="#details-tab-pane" type="button" role="tab" aria-controls="details-tab-pane" aria-selected="true">
              <i class="bi bi-info-circle me-1"></i> Details
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="comments-tab" data-bs-toggle="tab" data-bs-target="#comments-tab-pane" type="button" role="tab" aria-controls="comments-tab-pane" aria-selected="false">
              <i class="bi bi-chat-dots me-1"></i> Comments
            </button>
          </li>
        </ul>

        <div class="tab-content" id="taskDetailTabContent">
          <!-- Details Tab -->
          <div class="tab-pane fade show active" id="details-tab-pane" role="tabpanel" aria-labelledby="details-tab" tabindex="0">
            <div class="view-task-content">
              <div class="view-task-section">
                <h6>Description</h6>
                <p>${task.description ? escapeHtml(task.description) : '<span class="text-muted">No description</span>'}</p>
              </div>

              <div class="view-task-section">
                <h6>Details</h6>
                <div class="view-task-details">
                  <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="badge bg-${getStatusBadgeClass(task.status)} view-task-status-badge">${formatStatus(task.status)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Priority:</span>
                    <span class="task-priority ${task.priority}">${capitalizeFirst(task.priority)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Project:</span>
                    <span>📁 ${escapeHtml(projectName)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Assigned To:</span>
                    <span>👤 ${escapeHtml(assigneeName)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Due Date:</span>
                    <span>📅 ${dueDateDisplay}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Created:</span>
                    <span title="${createdAtFull}">🕒 ${taskAge}</span>
                  </div>
                  ${taskTags && taskTags.length > 0 ? `
                    <div class="detail-item" style="display: flex; gap: 0.5rem;">
                      <span class="detail-label" style="flex-shrink: 0;">Tags:</span>
                      <div class="tag-list" style="flex: 1;">
                        ${renderTagBadges(taskTags)}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="view-task-section">
                <h6>Attachments</h6>
                <ul class="attachments-list-view">
                  ${attachmentsList}
                </ul>
              </div>

              ${renderChecklistsSection(checklists || [])}
            </div>
          </div>

          <!-- Comments Tab -->
          <div class="tab-pane fade" id="comments-tab-pane" role="tabpanel" aria-labelledby="comments-tab" tabindex="0">
            <div id="task-comments-container"></div>
          </div>
        </div>
      `;

      // Store attachments and checklists for handlers
      window._viewAttachments = attachments;
      window._viewChecklists = checklists;

      // Setup checklist event listeners
      setupChecklistHandlers(taskId);

      // Setup Comments tab initialization
      const commentsTab = document.getElementById('comments-tab');
      if (commentsTab) {
        commentsTab.addEventListener('shown.bs.tab', async () => {
          const commentsContainer = document.getElementById('task-comments-container');
          if (commentsContainer && !commentsContainer.dataset.initialized) {
            await initCommentThread(taskId, commentsContainer);
            commentsContainer.dataset.initialized = 'true';
          }
        });
      }

      // Setup Edit and Delete button handlers
      const editBtn = document.getElementById('viewTaskEditBtn');
      const deleteBtn = document.getElementById('viewTaskDeleteBtn');

      if (editBtn) {
        editBtn.onclick = () => {
          const modal = Modal.getInstance(document.getElementById('viewTaskModal'));
          modal.hide();
          setTimeout(() => openEditModal(taskId), 300);
        };
      }

      if (deleteBtn) {
        deleteBtn.onclick = () => {
          // Close view modal first
          const viewModal = Modal.getInstance(document.getElementById('viewTaskModal'));
          if (viewModal) {
            viewModal.hide();
          }
          // Small delay to ensure modal is closed
          setTimeout(() => {
            setCurrentDeletingTaskId(taskId);
            const taskName = document.getElementById('deleteTaskName');
            if (taskName) taskName.textContent = task.title;
            const deleteModal = new Modal(document.getElementById('deleteTaskModal'));
            deleteModal.show();
          }, 300);
        };
      }
    }

    const modal = new Modal(document.getElementById('viewTaskModal'));

    // Cleanup comments subscription when modal is hidden
    const modalElement = document.getElementById('viewTaskModal');
    modalElement.addEventListener('hidden.bs.modal', () => {
      const commentsContainer = document.getElementById('task-comments-container');
      if (commentsContainer) {
        destroyCommentThread(commentsContainer);
        delete commentsContainer.dataset.initialized;
      }
    }, { once: true });

    modal.show();
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error loading task:', error);
    uiHelpers.showError('Failed to load task details');
  }
}

/**
 * Open delete confirmation modal
 */
export function openDeleteModal(taskId, tasks, setCurrentDeletingTaskId) {
  const task = tasks ? tasks.find((t) => t.id === taskId) : null;

  setCurrentDeletingTaskId(taskId);

  // Close edit modal if open
  const editModal = Modal.getInstance(document.getElementById('taskModal'));
  if (editModal) {
    editModal.hide();
  }

  const taskName = document.getElementById('deleteTaskName');
  if (taskName && task) taskName.textContent = task.title;

  const modal = new Modal(document.getElementById('deleteTaskModal'));
  modal.show();
}
