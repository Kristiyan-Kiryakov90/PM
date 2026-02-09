/**
 * Task Checklists Module
 * Handles checklist operations for tasks
 */

import {
  getTaskChecklists,
  createChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from '../services/checklist-service.js';
import { showError, showSuccess } from '../utils/ui-helpers.js';
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
        <button class="btn-sm btn-outline-primary" onclick="window.addNewChecklist()">
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
              onclick="window.deleteChecklistHandler(${checklist.id})"
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
          <button class="btn-link-sm" onclick="window.addChecklistItem(${checklist.id})">
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
        onchange="window.toggleChecklistItemHandler(${item.id})"
      />
      <span class="checklist-item-content">${escapeHtml(item.content)}</span>
      <button
        class="btn-icon-xs checklist-delete-btn"
        onclick="window.deleteChecklistItemHandler(${item.id})"
        title="Delete item"
      >
        ✕
      </button>
    </li>
  `;
}

/**
 * Setup checklist event handlers
 */
export function setupChecklistHandlers(taskId, reopenViewModal) {
  // Global handlers for checklist operations
  window.toggleChecklistItemHandler = async (itemId) => {
    try {
      await toggleChecklistItem(itemId);
      // Refresh modal
      setTimeout(() => reopenViewModal(taskId), 100);
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      showError('Failed to update checklist item');
    }
  };

  window.deleteChecklistItemHandler = async (itemId) => {
    if (!confirm('Delete this checklist item?')) return;
    try {
      await deleteChecklistItem(itemId);
      showSuccess('Checklist item deleted');
      // Refresh modal
      setTimeout(() => reopenViewModal(taskId), 100);
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      showError('Failed to delete checklist item');
    }
  };

  window.addChecklistItem = async (checklistId) => {
    const content = prompt('Enter checklist item:');
    if (!content || !content.trim()) return;
    try {
      await createChecklistItem({ checklist_id: checklistId, content: content.trim() });
      showSuccess('Item added');
      // Refresh modal
      setTimeout(() => reopenViewModal(taskId), 100);
    } catch (error) {
      console.error('Error adding checklist item:', error);
      showError('Failed to add item');
    }
  };

  window.addNewChecklist = async () => {
    const title = prompt('Enter checklist name:');
    if (!title || !title.trim()) return;
    try {
      await createChecklist({ task_id: taskId, title: title.trim() });
      showSuccess('Checklist created');
      // Refresh modal
      setTimeout(() => reopenViewModal(taskId), 100);
    } catch (error) {
      console.error('Error creating checklist:', error);
      showError('Failed to create checklist');
    }
  };

  window.deleteChecklistHandler = async (checklistId) => {
    if (!confirm('Delete this entire checklist? All items will be removed.')) return;
    try {
      await deleteChecklist(checklistId);
      showSuccess('Checklist deleted');
      // Refresh modal
      setTimeout(() => reopenViewModal(taskId), 100);
    } catch (error) {
      console.error('Error deleting checklist:', error);
      showError('Failed to delete checklist');
    }
  };
}
