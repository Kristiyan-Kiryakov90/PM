/**
 * Kanban Board Settings Component
 * Allows users to create, edit, delete, and reorder status columns
 */

import { Modal } from 'bootstrap';
import { statusService } from '@services/status-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';

let settingsModal = null;
let currentProjectId = null;
let statuses = [];
let draggedItem = null;

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
  setupDragAndDrop();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add status button
  const addBtn = document.getElementById('addStatusBtn');
  if (addBtn) {
    addBtn.onclick = () => openEditStatusModal();
  }

  // Edit status buttons
  document.querySelectorAll('.edit-status-btn').forEach((btn) => {
    btn.onclick = () => {
      const statusId = parseInt(btn.dataset.statusId, 10);
      const status = statuses.find((s) => s.id === statusId);
      if (status) {
        openEditStatusModal(status);
      }
    };
  });

  // Delete status buttons
  document.querySelectorAll('.delete-status-btn').forEach((btn) => {
    btn.onclick = () => {
      const statusId = parseInt(btn.dataset.statusId, 10);
      const status = statuses.find((s) => s.id === statusId);
      if (status) {
        openDeleteStatusModal(status);
      }
    };
  });

  // Save status button
  const saveBtn = document.getElementById('saveStatusBtn');
  if (saveBtn) {
    saveBtn.onclick = handleSaveStatus;
  }

  // Confirm delete button
  const confirmDeleteBtn = document.getElementById('confirmDeleteStatusBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = handleDeleteStatus;
  }

  // Color picker sync
  const colorPicker = document.getElementById('editStatusColor');
  const colorHex = document.getElementById('editStatusColorHex');

  if (colorPicker && colorHex) {
    colorPicker.oninput = () => {
      colorHex.value = colorPicker.value;
    };
    colorHex.oninput = () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(colorHex.value)) {
        colorPicker.value = colorHex.value;
      }
    };
  }

  // Auto-generate slug from name
  const nameInput = document.getElementById('editStatusName');
  const slugInput = document.getElementById('editStatusSlug');

  if (nameInput && slugInput) {
    nameInput.oninput = () => {
      // Only auto-generate if creating new status (no id)
      const statusId = document.getElementById('editStatusId').value;
      if (!statusId) {
        const slug = nameInput.value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        slugInput.value = slug;
      }
    };
  }
}

/**
 * Setup drag and drop for reordering
 */
function setupDragAndDrop() {
  const items = document.querySelectorAll('.status-item');

  items.forEach((item) => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  draggedItem = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
  this.classList.add('dragging');
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';

  const container = document.getElementById('statusList');
  const afterElement = getDragAfterElement(container, e.clientY);

  if (afterElement == null) {
    container.appendChild(draggedItem);
  } else {
    container.insertBefore(draggedItem, afterElement);
  }

  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');

  // Save new order
  const items = document.querySelectorAll('.status-item');
  const newOrder = Array.from(items).map((item, index) => ({
    id: parseInt(item.dataset.statusId, 10),
    sort_order: index,
  }));

  saveStatusOrder(newOrder);
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.status-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Save status order
 */
async function saveStatusOrder(newOrder) {
  try {
    await statusService.reorderStatuses(currentProjectId, newOrder);
    statuses = statuses.map((status) => {
      const newPos = newOrder.find((o) => o.id === status.id);
      return newPos ? { ...status, sort_order: newPos.sort_order } : status;
    });
    statuses.sort((a, b) => a.sort_order - b.sort_order);
  } catch (error) {
    console.error('Error saving status order:', error);
    uiHelpers.showError('Failed to reorder statuses');
    // Reload to reset order
    await loadStatuses();
    renderStatuses();
  }
}

/**
 * Open edit status modal
 */
function openEditStatusModal(status = null) {
  const modal = new Modal(document.getElementById('editStatusModal'));
  const form = document.getElementById('editStatusForm');

  // Reset form
  form.reset();

  if (status) {
    // Edit existing status
    document.getElementById('editStatusTitle').textContent = 'Edit Status';
    document.getElementById('editStatusId').value = status.id;
    document.getElementById('editStatusName').value = status.name;
    document.getElementById('editStatusSlug').value = status.slug;
    document.getElementById('editStatusColor').value = status.color;
    document.getElementById('editStatusColorHex').value = status.color;
    document.getElementById('editStatusIsDone').checked = status.is_done;
    document.getElementById('editStatusIsDefault').checked = status.is_default;
  } else {
    // Create new status
    document.getElementById('editStatusTitle').textContent = 'Add Status';
    document.getElementById('editStatusId').value = '';
    document.getElementById('editStatusColor').value = '#6b7280';
    document.getElementById('editStatusColorHex').value = '#6b7280';
  }

  modal.show();
}

/**
 * Handle save status
 */
async function handleSaveStatus() {
  const form = document.getElementById('editStatusForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const statusId = document.getElementById('editStatusId').value;
  const statusData = {
    name: document.getElementById('editStatusName').value.trim(),
    slug: document.getElementById('editStatusSlug').value.trim().toLowerCase(),
    color: document.getElementById('editStatusColorHex').value,
    is_done: document.getElementById('editStatusIsDone').checked,
    is_default: document.getElementById('editStatusIsDefault').checked,
  };

  try {
    if (statusId) {
      // Update existing status
      await statusService.updateStatus(parseInt(statusId, 10), statusData);
      uiHelpers.showSuccess('Status updated successfully');
    } else {
      // Create new status
      const maxSortOrder = statuses.length > 0 ? Math.max(...statuses.map((s) => s.sort_order)) : -1;
      await statusService.createStatus({
        project_id: currentProjectId,
        ...statusData,
        sort_order: maxSortOrder + 1,
      });
      uiHelpers.showSuccess('Status created successfully');
    }

    // Close modal
    const modal = Modal.getInstance(document.getElementById('editStatusModal'));
    modal.hide();

    // Reload and re-render
    await loadStatuses();
    renderStatuses();
    setupEventListeners();

    // Notify parent to reload
    window.dispatchEvent(new CustomEvent('kanbanSettingsChanged'));
  } catch (error) {
    console.error('Error saving status:', error);
    uiHelpers.showError(error.message || 'Failed to save status');
  }
}

/**
 * Open delete status modal
 */
function openDeleteStatusModal(status) {
  const modal = new Modal(document.getElementById('deleteStatusModal'));

  document.getElementById('deleteStatusName').textContent = status.name;
  const warning = document.getElementById('deleteStatusWarning');

  if (status.task_count > 0) {
    warning.textContent = `Cannot delete: ${status.task_count} task(s) are using this status. Please reassign tasks first.`;
    document.getElementById('confirmDeleteStatusBtn').disabled = true;
  } else {
    warning.textContent = 'This action cannot be undone.';
    document.getElementById('confirmDeleteStatusBtn').disabled = false;
    document.getElementById('confirmDeleteStatusBtn').dataset.statusId = status.id;
  }

  modal.show();
}

/**
 * Handle delete status
 */
async function handleDeleteStatus() {
  const btn = document.getElementById('confirmDeleteStatusBtn');
  const statusId = parseInt(btn.dataset.statusId, 10);

  try {
    await statusService.deleteStatus(statusId);
    uiHelpers.showSuccess('Status deleted successfully');

    // Close modal
    const modal = Modal.getInstance(document.getElementById('deleteStatusModal'));
    modal.hide();

    // Reload and re-render
    await loadStatuses();
    renderStatuses();
    setupEventListeners();

    // Notify parent to reload
    window.dispatchEvent(new CustomEvent('kanbanSettingsChanged'));
  } catch (error) {
    console.error('Error deleting status:', error);
    uiHelpers.showError(error.message || 'Failed to delete status');
  }
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
