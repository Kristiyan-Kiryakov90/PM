/**
 * Task Checklists Module
 * Handles checklist operations for tasks
 */

import { checklistService } from '@services/checklist-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { escapeHtml } from './tasks-utils.js';

/**
 * Render checklists section
 */
export function renderChecklistsSection(checklists) {
  const checklistsContent = checklists.length > 0
    ? checklists.map(checklist => renderChecklist(checklist)).join('')
    : '<p class="text-muted" style="padding: 1rem; text-align: center;">No checklists yet. Click "Add Checklist" to create one.</p>';

  return `
    <div class="view-task-section">
      <div class="section-header-with-action">
        <h6>Checklists</h6>
        <button class="btn-sm btn-outline-primary checklist-add-btn">
          <span>➕</span>
          <span>Add Checklist</span>
        </button>
      </div>
      <div class="checklists-container">
        ${checklistsContent}
      </div>
    </div>
  `;
}

/**
 * Render a single checklist with items
 */
function renderChecklist(checklist) {
  const items = checklist.checklist_items || [];
  const totalItems = items.length;
  const completedItems = items.filter(item => item.is_completed).length;
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return `
    <div class="checklist-block" data-checklist-id="${checklist.id}">
      <div class="checklist-header">
        <div class="checklist-title-row">
          <h6 class="checklist-title">${escapeHtml(checklist.title)}</h6>
          <div class="checklist-header-actions">
            <span class="checklist-progress-text">${completedItems}/${totalItems}</span>
            <button
              class="btn-icon-xs checklist-delete-checklist-btn"
              title="Delete checklist"
            >
              🗑️
            </button>
          </div>
        </div>
        <div class="checklist-progress-bar">
          <div class="checklist-progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
      <ul class="checklist-items-list">
        ${items.map(item => renderChecklistItem(item)).join('')}
        <li class="checklist-add-item">
          <button class="btn-link-sm checklist-add-item-btn" data-checklist-id="${checklist.id}">
            + Add item
          </button>
        </li>
      </ul>
    </div>
  `;
}

/**
 * Render a single checklist item
 */
function renderChecklistItem(item) {
  return `
    <li class="checklist-item ${item.is_completed ? 'completed' : ''}" data-item-id="${item.id}">
      <input
        type="checkbox"
        class="checklist-checkbox"
        ${item.is_completed ? 'checked' : ''}
      />
      <span class="checklist-item-content">${escapeHtml(item.content)}</span>
      <button
        class="btn-icon-xs checklist-delete-btn"
        title="Delete item"
      >
        ✕
      </button>
    </li>
  `;
}

/**
 * Calculate and update task status based on checklist completion
 */
async function updateTaskStatusFromChecklists(taskId) {
  try {
    console.log('🔄 Calculating status for task:', taskId);
    const checklists = await checklistService.getTaskChecklists(taskId);
    console.log('📋 Loaded checklists:', checklists.length);

    let totalItems = 0;
    let completedItems = 0;

    checklists.forEach((checklist, index) => {
      const items = checklist.checklist_items || [];
      const completed = items.filter(item => item.is_completed).length;
      console.log(`📝 Checklist ${index + 1} "${checklist.title}": ${completed}/${items.length} items complete`);
      totalItems += items.length;
      completedItems += completed;
    });

    console.log(`📊 Total across all checklists: ${completedItems}/${totalItems} items complete`);

    let newStatus = null;
    if (totalItems > 0) {
      if (completedItems === 0) {
        newStatus = 'todo';
      } else if (completedItems === totalItems) {
        newStatus = 'done';
      } else {
        newStatus = 'in_progress';
      }

      console.log(`🎯 Calculated status: ${newStatus}`);

      if (newStatus) {
        const { taskService } = await import('@services/task-service.js');
        await taskService.updateTask(taskId, { status: newStatus });
        console.log(`✅ Task status updated to: ${newStatus}`);
        updateStatusBadgeInModal(newStatus);
        window.dispatchEvent(new CustomEvent('taskStatusChanged', { detail: { taskId, status: newStatus } }));
      }
    }
  } catch (error) {
    console.error('Error updating task status from checklists:', error);
  }
}

/**
 * Update status badge in the view modal
 */
function updateStatusBadgeInModal(newStatus) {
  const statusBadge = document.querySelector('.view-task-status-badge');
  if (statusBadge) {
    const statusText = {
      'todo': 'To Do',
      'in_progress': 'In Progress',
      'in_review': 'In Review',
      'done': 'Done'
    }[newStatus] || newStatus;

    const statusClass = {
      'todo': 'secondary',
      'in_progress': 'primary',
      'in_review': 'warning',
      'done': 'success'
    }[newStatus] || 'secondary';

    statusBadge.className = `badge bg-${statusClass} view-task-status-badge`;
    statusBadge.textContent = statusText;
    console.log('📍 Updated status badge in modal');
  }
}

/**
 * Refresh only the checklists section without reopening modal
 */
async function refreshChecklistsSection(taskId) {
  try {
    const checklists = await checklistService.getTaskChecklists(taskId);
    const container = document.querySelector('.checklists-container');
    if (container) {
      const checklistsContent = checklists.length > 0
        ? checklists.map(checklist => renderChecklist(checklist)).join('')
        : '<p class="text-muted" style="padding: 1rem; text-align: center;">No checklists yet. Click "Add Checklist" to create one.</p>';
      container.innerHTML = checklistsContent;
    }
  } catch (error) {
    console.error('Error refreshing checklists:', error);
  }
}

/**
 * Setup checklist event handlers using event delegation on the modal element.
 * Replaces previous listener on each call to avoid stale taskId closures.
 */
export function setupChecklistHandlers(taskId) {
  const modal = document.getElementById('viewTaskModal');
  if (!modal) return;

  // Remove previous listeners to avoid duplicates / stale taskId
  if (modal._checklistClickHandler) {
    modal.removeEventListener('click', modal._checklistClickHandler);
  }
  if (modal._checklistChangeHandler) {
    modal.removeEventListener('change', modal._checklistChangeHandler);
  }

  // --- Click delegation ---
  modal._checklistClickHandler = async (e) => {
    // Add Checklist
    if (e.target.closest('.checklist-add-btn')) {
      const title = prompt('Enter checklist name:');
      if (!title || !title.trim()) return;
      try {
        await checklistService.createChecklist({ task_id: taskId, title: title.trim() });
        uiHelpers.showSuccess('Checklist created');
        await refreshChecklistsSection(taskId);
      } catch (error) {
        console.error('Error creating checklist:', error);
        uiHelpers.showError('Failed to create checklist');
      }
      return;
    }

    // Delete Checklist
    const deleteChecklistBtn = e.target.closest('.checklist-delete-checklist-btn');
    if (deleteChecklistBtn) {
      const block = deleteChecklistBtn.closest('[data-checklist-id]');
      if (!block) return;
      const checklistId = parseInt(block.dataset.checklistId, 10);
      if (!confirm('Delete this entire checklist? All items will be removed.')) return;
      try {
        await checklistService.deleteChecklist(checklistId);
        uiHelpers.showSuccess('Checklist deleted');
        await refreshChecklistsSection(taskId);
      } catch (error) {
        console.error('Error deleting checklist:', error);
        uiHelpers.showError('Failed to delete checklist');
      }
      return;
    }

    // Add Item
    const addItemBtn = e.target.closest('.checklist-add-item-btn');
    if (addItemBtn) {
      const checklistId = parseInt(addItemBtn.dataset.checklistId, 10);
      const content = prompt('Enter checklist item:');
      if (!content || !content.trim()) return;
      try {
        await checklistService.createChecklistItem({ checklist_id: checklistId, content: content.trim() });
        uiHelpers.showSuccess('Item added');
        await updateTaskStatusFromChecklists(taskId);
        await refreshChecklistsSection(taskId);
      } catch (error) {
        console.error('Error adding checklist item:', error);
        uiHelpers.showError('Failed to add item');
      }
      return;
    }

    // Delete Item
    const deleteItemBtn = e.target.closest('.checklist-delete-btn');
    if (deleteItemBtn) {
      const li = deleteItemBtn.closest('[data-item-id]');
      if (!li) return;
      const itemId = parseInt(li.dataset.itemId, 10);
      if (!confirm('Delete this checklist item?')) return;
      try {
        await checklistService.deleteChecklistItem(itemId);
        uiHelpers.showSuccess('Checklist item deleted');
        await updateTaskStatusFromChecklists(taskId);
        await refreshChecklistsSection(taskId);
      } catch (error) {
        console.error('Error deleting checklist item:', error);
        uiHelpers.showError('Failed to delete checklist item');
      }
    }
  };

  // --- Change delegation (checkboxes) ---
  modal._checklistChangeHandler = async (e) => {
    if (!e.target.matches('.checklist-checkbox')) return;
    const li = e.target.closest('[data-item-id]');
    if (!li) return;
    const itemId = parseInt(li.dataset.itemId, 10);
    try {
      await checklistService.toggleChecklistItem(itemId);
      await updateTaskStatusFromChecklists(taskId);
      await refreshChecklistsSection(taskId);
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      uiHelpers.showError('Failed to update checklist item');
    }
  };

  modal.addEventListener('click', modal._checklistClickHandler);
  modal.addEventListener('change', modal._checklistChangeHandler);
}
