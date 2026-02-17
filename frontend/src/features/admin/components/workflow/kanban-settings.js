/**
 * Kanban Board Settings - Main Component
 * Entry point for workflow settings modal
 */

import { Modal } from 'bootstrap';
import { statusService } from '@services/status-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { setupDragAndDrop } from './workflow-drag-drop.js';
import {
  openEditStatusModal,
  openDeleteStatusModal,
  setupColorPickerSync,
  setupSlugAutoGenerate
} from './workflow-status-editor.js';

let settingsModal = null;
let currentProjectId = null;
let statuses = [];

/**
 * Open Kanban board settings modal
 */
export async function openKanbanSettings(projectId) {
  if (!projectId) {
    uiHelpers.showError('Please select a project first');
    return;
  }

  currentProjectId = projectId;

  // Load statuses with task counts
  await loadStatuses();

  // Get or create modal
  const modalEl = document.getElementById('kanbanSettingsModal');
  if (!modalEl) {
    createSettingsModal();
  }

  // Render statuses
  renderStatuses();

  // Show modal
  settingsModal = new Modal(document.getElementById('kanbanSettingsModal'));
  settingsModal.show();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Create settings modal HTML
 */
function createSettingsModal() {
  const modalHTML = `
    <div class="modal fade" id="kanbanSettingsModal" tabindex="-1" aria-labelledby="kanbanSettingsTitle" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="kanbanSettingsTitle">
              <span>⚙️</span> Workflow Settings
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted mb-3">Customize your workflow status columns. Drag to reorder.</p>

            <!-- Status list -->
            <div id="statusList" class="status-list mb-3">
              <!-- Statuses will be rendered here -->
            </div>

            <!-- Add new status button -->
            <button type="button" class="btn btn-outline-primary btn-sm" id="addStatusBtn">
              <span>➕</span> Add Status Column
            </button>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Status Modal -->
    <div class="modal fade" id="editStatusModal" tabindex="-1" aria-labelledby="editStatusTitle" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="editStatusTitle">Edit Status</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="editStatusForm">
              <input type="hidden" id="editStatusId">

              <div class="mb-3">
                <label for="editStatusName" class="form-label">Status Name *</label>
                <input type="text" class="form-control" id="editStatusName" required maxlength="50">
              </div>

              <div class="mb-3">
                <label for="editStatusSlug" class="form-label">Slug (URL-friendly) *</label>
                <input type="text" class="form-control" id="editStatusSlug" required maxlength="50" pattern="[a-z0-9_-]+">
                <small class="form-text text-muted">Lowercase letters, numbers, hyphens, and underscores only</small>
              </div>

              <div class="mb-3">
                <label for="editStatusColor" class="form-label">Color</label>
                <div class="input-group">
                  <input type="color" class="form-control form-control-color" id="editStatusColor" value="#6b7280">
                  <input type="text" class="form-control" id="editStatusColorHex" value="#6b7280" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7">
                </div>
              </div>

              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="editStatusIsDone">
                <label class="form-check-label" for="editStatusIsDone">
                  Mark as "Done" status (tasks in this column are completed)
                </label>
              </div>

              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="editStatusIsDefault">
                <label class="form-check-label" for="editStatusIsDefault">
                  Set as default status for new tasks
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveStatusBtn">Save Changes</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteStatusModal" tabindex="-1" aria-labelledby="deleteStatusTitle" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="deleteStatusTitle">Delete Status</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete the status "<strong id="deleteStatusName"></strong>"?</p>
            <p class="text-danger mb-0" id="deleteStatusWarning"></p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteStatusBtn">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Load statuses with task counts
 */
async function loadStatuses() {
  try {
    statuses = await statusService.getStatusesWithTaskCounts(currentProjectId);
  } catch (error) {
    console.error('Error loading statuses:', error);
    uiHelpers.showError('Failed to load statuses');
  }
}

/**
 * Render statuses list
 */
function renderStatuses() {
  const container = document.getElementById('statusList');
  if (!container) return;

  if (statuses.length === 0) {
    container.innerHTML = '<p class="text-muted">No statuses defined yet.</p>';
    return;
  }

  container.innerHTML = statuses.map((status) => {
    const taskCountText = status.task_count === 1 ? '1 task' : `${status.task_count} tasks`;
    const defaultBadge = status.is_default ? '<span class="badge bg-primary ms-2">Default</span>' : '';
    const doneBadge = status.is_done ? '<span class="badge bg-success ms-2">Done</span>' : '';

    return `
      <div class="status-item" data-status-id="${status.id}" draggable="true">
        <div class="status-item-handle">
          <span class="drag-handle">⋮⋮</span>
        </div>
        <div class="status-item-color" style="background-color: ${status.color}"></div>
        <div class="status-item-content">
          <div class="status-item-name">
            ${escapeHtml(status.name)}
            ${defaultBadge}
            ${doneBadge}
          </div>
          <div class="status-item-meta">
            <span class="text-muted">${escapeHtml(status.slug)}</span>
            <span class="text-muted">•</span>
            <span class="text-muted">${taskCountText}</span>
          </div>
        </div>
        <div class="status-item-actions">
          <button class="btn btn-sm btn-outline-secondary edit-status-btn" data-status-id="${status.id}">
            <span>✏️</span>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-status-btn" data-status-id="${status.id}" ${status.task_count > 0 ? 'disabled' : ''}>
            <span>🗑️</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Setup drag and drop
  setupDragAndDrop(statuses, currentProjectId, handleReorderComplete);
}

/**
 * Handle reorder complete callback
 */
function handleReorderComplete(updatedStatuses) {
  if (updatedStatuses) {
    statuses = updatedStatuses;
  } else {
    // Error occurred, reload
    loadStatuses().then(() => {
      renderStatuses();
      setupEventListeners();
    });
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add status button
  const addBtn = document.getElementById('addStatusBtn');
  if (addBtn) {
    addBtn.onclick = () => openEditStatusModal(null, handleSaveComplete);
  }

  // Edit status buttons
  document.querySelectorAll('.edit-status-btn').forEach((btn) => {
    btn.onclick = () => {
      const statusId = parseInt(btn.dataset.statusId, 10);
      const status = statuses.find((s) => s.id === statusId);
      if (status) {
        openEditStatusModal(status, handleSaveComplete);
      }
    };
  });

  // Delete status buttons
  document.querySelectorAll('.delete-status-btn').forEach((btn) => {
    btn.onclick = () => {
      const statusId = parseInt(btn.dataset.statusId, 10);
      const status = statuses.find((s) => s.id === statusId);
      if (status) {
        openDeleteStatusModal(status, handleDeleteComplete);
      }
    };
  });

  // Setup form helpers
  setupColorPickerSync();
  setupSlugAutoGenerate();
}

/**
 * Handle save complete callback
 */
async function handleSaveComplete(statusId, statusData) {
  if (!statusId) {
    // Create new status
    const maxSortOrder = statuses.length > 0 ? Math.max(...statuses.map((s) => s.sort_order)) : -1;
    await statusService.createStatus({
      project_id: currentProjectId,
      ...statusData,
      sort_order: maxSortOrder + 1,
    });
  }

  // Reload and re-render
  await loadStatuses();
  renderStatuses();
  setupEventListeners();
}

/**
 * Handle delete complete callback
 */
async function handleDeleteComplete(statusId) {
  // Reload and re-render
  await loadStatuses();
  renderStatuses();
  setupEventListeners();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
