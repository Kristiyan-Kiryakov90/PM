/**
 * Task Kanban Drag-and-Drop Module
 * Handles drag-and-drop interactions and column updates
 */

/**
 * Setup drag and drop for task cards
 */
export function setupDragAndDrop(changeTaskStatus, trackLocalUpdate) {
  let draggedCard = null;
  let isDragging = false;

  // Task cards - drag start
  document.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      isDragging = true;
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', card.innerHTML);

      // Store the task ID and old status
      e.dataTransfer.setData('taskId', card.dataset.taskId);
      e.dataTransfer.setData('oldStatus', card.dataset.status);
    });

    card.addEventListener('dragend', (e) => {
      card.classList.remove('dragging');
      // Remove all drag-over states
      document.querySelectorAll('.task-column-content').forEach((col) => {
        col.classList.remove('drag-over');
      });

      // Reset dragging flag after a short delay
      setTimeout(() => {
        isDragging = false;
      }, 50);
    });
  });

  // Columns - drop zones
  document.querySelectorAll('.task-column-content').forEach((column) => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const afterElement = getDragAfterElement(column, e.clientY);
      if (afterElement == null) {
        column.appendChild(draggedCard);
      } else {
        column.insertBefore(draggedCard, afterElement);
      }

      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', (e) => {
      // Only remove drag-over if leaving the column itself, not a child
      if (e.target === column) {
        column.classList.remove('drag-over');
      }
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      column.classList.remove('drag-over');

      if (!draggedCard) return;

      const taskId = draggedCard.dataset.taskId;
      const newStatus = column.closest('.task-column').dataset.status;
      const oldStatus = draggedCard.dataset.status;

      if (newStatus !== oldStatus) {
        // Optimistic update: Update UI immediately
        draggedCard.dataset.status = newStatus;

        // Update task count badges immediately
        updateColumnCounts();

        // Track this local update to prevent reload loop
        if (trackLocalUpdate) {
          trackLocalUpdate(taskId, newStatus);
        }

        // Save to backend in background (don't await)
        changeTaskStatus(taskId, newStatus).catch((error) => {
          // If update fails, revert the UI change
          console.error('Failed to update task status, reverting...', error);
          draggedCard.dataset.status = oldStatus;
          // Move card back to original column
          const originalColumn = document.querySelector(`.task-column[data-status="${oldStatus}"] .task-column-content`);
          if (originalColumn) {
            originalColumn.appendChild(draggedCard);
          }
          updateColumnCounts();
        });
      }

      draggedCard = null;
    });
  });
}

/**
 * Get the element to insert the dragged card after
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

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
 * Update task count badges on all columns
 */
function updateColumnCounts() {
  document.querySelectorAll('.task-column').forEach((column) => {
    const status = column.dataset.status;
    const taskCount = column.querySelectorAll('.task-card').length;
    const countBadge = column.querySelector('.task-column-count');
    if (countBadge) {
      countBadge.textContent = taskCount;
    }

    // Show/hide empty state
    const content = column.querySelector('.task-column-content');
    const emptyState = column.querySelector('.task-column-empty');
    if (taskCount === 0 && !emptyState) {
      content.innerHTML = '<div class="task-column-empty"><p>No tasks</p></div>';
    } else if (taskCount > 0 && emptyState) {
      emptyState.remove();
    }
  });
}
