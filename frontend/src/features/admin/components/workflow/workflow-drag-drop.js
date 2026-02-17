/**
 * Workflow - Drag and Drop Logic
 * Handles draggable status reordering and persistence
 */

import { statusService } from '@services/status-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';

let draggedItem = null;

/**
 * Setup drag and drop for status items
 * @param {Function} onReorder - Callback after successful reorder
 */
export function setupDragAndDrop(statuses, currentProjectId, onReorder) {
  const items = document.querySelectorAll('.status-item');

  items.forEach((item) => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', (e) => handleDragOver(e, draggedItem));
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', (e) => handleDragEnd(e, statuses, currentProjectId, onReorder));
  });
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
  draggedItem = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
  this.classList.add('dragging');
}

/**
 * Handle drag over
 */
function handleDragOver(e, draggedElement) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';

  const container = document.getElementById('statusList');
  const afterElement = getDragAfterElement(container, e.clientY);

  if (afterElement == null) {
    container.appendChild(draggedElement);
  } else {
    container.insertBefore(draggedElement, afterElement);
  }

  return false;
}

/**
 * Handle drop
 */
function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  return false;
}

/**
 * Handle drag end
 */
function handleDragEnd(e, statuses, currentProjectId, onReorder) {
  this.classList.remove('dragging');

  // Save new order
  const items = document.querySelectorAll('.status-item');
  const newOrder = Array.from(items).map((item, index) => ({
    id: parseInt(item.dataset.statusId, 10),
    sort_order: index,
  }));

  saveStatusOrder(newOrder, statuses, currentProjectId, onReorder);
}

/**
 * Get drag after element
 */
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
 * Save status order to database
 */
async function saveStatusOrder(newOrder, statuses, currentProjectId, onReorder) {
  try {
    await statusService.reorderStatuses(currentProjectId, newOrder);

    // Update local state
    const updatedStatuses = statuses.map((status) => {
      const newPos = newOrder.find((o) => o.id === status.id);
      return newPos ? { ...status, sort_order: newPos.sort_order } : status;
    });
    updatedStatuses.sort((a, b) => a.sort_order - b.sort_order);

    if (onReorder) {
      onReorder(updatedStatuses);
    }
  } catch (error) {
    console.error('Error saving status order:', error);
    uiHelpers.showError('Failed to reorder statuses');

    // Trigger reload to reset order
    if (onReorder) {
      onReorder(null); // Signal error, parent should reload
    }
  }
}
