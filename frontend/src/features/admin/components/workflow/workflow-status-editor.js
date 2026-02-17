/**
 * Workflow - Status Editor
 * Create, edit, and delete status operations
 */

import { Modal } from 'bootstrap';
import { statusService } from '@services/status-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';

/**
 * Open edit status modal
 * @param {Object|null} status - Status to edit, or null for new
 * @param {Function} onSave - Callback after successful save
 */
export function openEditStatusModal(status, onSave) {
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

  // Setup save handler
  setupSaveHandler(onSave);

  modal.show();
}

/**
 * Setup save button handler
 */
function setupSaveHandler(onSave) {
  const saveBtn = document.getElementById('saveStatusBtn');
  if (!saveBtn) return;

  // Remove old listeners by cloning
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.onclick = () => handleSaveStatus(onSave);
}

/**
 * Handle save status
 */
async function handleSaveStatus(onSave) {
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
      // Create new status - will be handled by onSave callback
      uiHelpers.showSuccess('Status created successfully');
    }

    // Close modal
    const modal = Modal.getInstance(document.getElementById('editStatusModal'));
    modal.hide();

    // Trigger callback
    if (onSave) {
      await onSave(statusId, statusData);
    }

    // Notify parent to reload
    window.dispatchEvent(new CustomEvent('kanbanSettingsChanged'));
  } catch (error) {
    console.error('Error saving status:', error);
    uiHelpers.showError(error.message || 'Failed to save status');
  }
}

/**
 * Open delete status modal
 * @param {Object} status - Status to delete
 * @param {Function} onDelete - Callback after successful delete
 */
export function openDeleteStatusModal(status, onDelete) {
  const modal = new Modal(document.getElementById('deleteStatusModal'));

  document.getElementById('deleteStatusName').textContent = status.name;
  const warning = document.getElementById('deleteStatusWarning');
  const confirmBtn = document.getElementById('confirmDeleteStatusBtn');

  if (status.task_count > 0) {
    warning.textContent = `Cannot delete: ${status.task_count} task(s) are using this status. Please reassign tasks first.`;
    confirmBtn.disabled = true;
  } else {
    warning.textContent = 'This action cannot be undone.';
    confirmBtn.disabled = false;
    confirmBtn.dataset.statusId = status.id;

    // Setup delete handler
    setupDeleteHandler(onDelete);
  }

  modal.show();
}

/**
 * Setup delete button handler
 */
function setupDeleteHandler(onDelete) {
  const confirmBtn = document.getElementById('confirmDeleteStatusBtn');
  if (!confirmBtn) return;

  // Remove old listeners by cloning
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.onclick = () => handleDeleteStatus(onDelete);
}

/**
 * Handle delete status
 */
async function handleDeleteStatus(onDelete) {
  const btn = document.getElementById('confirmDeleteStatusBtn');
  const statusId = parseInt(btn.dataset.statusId, 10);

  try {
    await statusService.deleteStatus(statusId);
    uiHelpers.showSuccess('Status deleted successfully');

    // Close modal
    const modal = Modal.getInstance(document.getElementById('deleteStatusModal'));
    modal.hide();

    // Trigger callback
    if (onDelete) {
      await onDelete(statusId);
    }

    // Notify parent to reload
    window.dispatchEvent(new CustomEvent('kanbanSettingsChanged'));
  } catch (error) {
    console.error('Error deleting status:', error);
    uiHelpers.showError(error.message || 'Failed to delete status');
  }
}

/**
 * Setup color picker sync
 */
export function setupColorPickerSync() {
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
}

/**
 * Setup auto-generate slug from name
 */
export function setupSlugAutoGenerate() {
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
