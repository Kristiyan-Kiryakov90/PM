/**
 * Task Kanban Board Module
 * Handles Kanban board rendering and card interactions
 */

import { getProjectStatuses } from '../services/status-service.js';
import { taskService } from "../services/task-service.js"';
import { renderTagBadges } from '../components/tag-picker.js';
import { showError } from '../utils/ui-helpers.js';
import { escapeHtml, capitalizeFirst, getTaskAge } from './tasks-utils.js';
import { teamService } from '../services/team-service.js';

// Cache team members to avoid reloading on every render
let cachedTeamMembers = [];

/**
 * Get assignee name by user ID
 */
function getAssigneeName(userId) {
  const assignee = cachedTeamMembers.find(m => m.id === userId);
  return assignee?.full_name || assignee?.email || 'Unknown';
}

/**
 * Render Kanban board
 */
export async function renderKanbanBoard(tasks, projects, currentFilters, openEditModal, openViewModal, changeTaskStatus, trackLocalUpdate = null) {
  const container = document.getElementById('tasksContainer');

  // Load team members if not cached
  if (cachedTeamMembers.length === 0) {
    try {
      cachedTeamMembers = await teamService.getTeamMembers();
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  // Load statuses for filtered project (or first project if none selected)
  const projectId = currentFilters.project_id || (projects.length > 0 ? projects[0].id : null);

  if (!projectId) {
    container.innerHTML = '<div class="empty-state"><p>No projects available. Please create a project first.</p></div>';
    return null;
  }

  let statuses;
  try {
    // Load dynamic statuses
    statuses = await getProjectStatuses(projectId);
  } catch (error) {
    console.error('Error loading statuses:', error);
    // Fallback to default statuses
    statuses = [
      { slug: 'todo', name: 'To Do', color: '#94a3b8', sort_order: 0 },
      { slug: 'in_progress', name: 'In Progress', color: '#3b82f6', sort_order: 1 },
      { slug: 'done', name: 'Done', color: '#10b981', sort_order: 2 },
    ];
  }

  // Apply search filter
  let filteredTasks = tasks;
  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filteredTasks = filteredTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
    );
  }

  // Apply priority filter
  if (currentFilters.priority) {
    filteredTasks = filteredTasks.filter(
      (task) => task.priority === currentFilters.priority
    );
  }

  // Apply assignee filter
  if (currentFilters.assigned_to) {
    filteredTasks = filteredTasks.filter(
      (task) => task.assigned_to === currentFilters.assigned_to
    );
  }

  // Apply tag filter
  if (currentFilters.tag_id) {
    const tagId = parseInt(currentFilters.tag_id, 10);
    filteredTasks = filteredTasks.filter(
      (task) => task.tags && task.tags.some((tag) => tag.id === tagId)
    );
  }

  // Render Kanban columns dynamically
  const columns = statuses.map(status => {
    const statusTasks = filteredTasks.filter((t) => t.status === status.slug);
    return renderKanbanColumn(status.slug, status.name, statusTasks, status.color, statuses);
  }).join('');

  container.innerHTML = `
    <div class="task-board">
      ${columns}
    </div>
  `;

  // Attach event listeners to task cards
  attachTaskCardListeners(openEditModal, openViewModal, changeTaskStatus);

  // Setup drag and drop
  setupDragAndDrop(changeTaskStatus, trackLocalUpdate);

  return statuses;
}

/**
 * Render a Kanban column
 */
function renderKanbanColumn(status, title, tasks, color = '#6b7280', allStatuses) {
  const isEmpty = tasks.length === 0;

  return `
    <div class="task-column" data-status="${status}">
      <div class="task-column-header" style="border-top: 3px solid ${color}">
        <h3 class="task-column-title">${title}</h3>
        <span class="task-column-count" style="background-color: ${color}20; color: ${color}">${tasks.length}</span>
      </div>
      <div class="task-column-content">
        ${
          isEmpty
            ? `<div class="task-column-empty">
                <p>No tasks</p>
              </div>`
            : tasks.map((task) => renderTaskCard(task, allStatuses)).join('')
        }
      </div>
    </div>
  `;
}

/**
 * Render a task card
 */
function renderTaskCard(task, allStatuses) {
  const projectName = task.projects?.name || 'No project';
  const priorityClass = `task-priority ${task.priority}`;
  const dueDateDisplay = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  const taskAge = getTaskAge(task.created_at);

  return `
    <div class="task-card" data-task-id="${task.id}" data-status="${task.status}" draggable="true">
      <div class="task-card-header">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <div class="task-card-actions">
          <button class="btn-icon task-edit-btn" data-task-id="${task.id}" title="Edit task">
            <span>✏️</span>
          </button>
        </div>
      </div>

      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}

      <div class="task-meta">
        <span class="${priorityClass}">${capitalizeFirst(task.priority)}</span>
        ${dueDateDisplay ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">📅 ${dueDateDisplay}</span>` : ''}
        ${taskAge ? `<span class="task-age" style="color: var(--gray-500); font-size: 0.75rem;">🕒 ${taskAge}</span>` : ''}
        ${task.assigned_to ? `<span class="task-assignee" style="color: var(--gray-600); font-size: 0.75rem;">👤 ${getAssigneeName(task.assigned_to)}</span>` : ''}
      </div>

      ${task.tags && task.tags.length > 0 ? `
        <div class="task-tags">
          ${renderTagBadges(task.tags)}
        </div>
      ` : ''}

      <div class="task-footer">
        <span class="task-project">📁 ${escapeHtml(projectName)}</span>
        <div class="task-status-actions">
          ${renderStatusButtons(task, allStatuses)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render status change buttons (dynamic based on project statuses)
 */
function renderStatusButtons(task, statuses) {
  const buttons = [];

  // Find current status in the statuses array
  const currentIndex = statuses.findIndex(s => s.slug === task.status);
  if (currentIndex === -1) return ''; // Status not found

  const currentStatus = statuses[currentIndex];
  const nextStatus = statuses[currentIndex + 1];
  const prevStatus = statuses[currentIndex - 1];

  // Back button (move to previous status)
  if (prevStatus) {
    buttons.push(
      `<button class="btn-status btn-status-back" data-task-id="${task.id}" data-new-status="${prevStatus.slug}" title="Move to ${prevStatus.name}">⬅️</button>`
    );
  }

  // Next/Forward button (move to next status)
  if (nextStatus) {
    const icon = nextStatus.is_done ? '✅' : '▶️';
    const title = nextStatus.is_done ? 'Complete' : `Move to ${nextStatus.name}`;
    buttons.push(
      `<button class="btn-status btn-status-next" data-task-id="${task.id}" data-new-status="${nextStatus.slug}" title="${title}">${icon}</button>`
    );
  } else if (currentStatus.is_done) {
    // If already at the last status (done), show reopen button to first non-done status
    const firstNonDone = statuses.find(s => !s.is_done);
    if (firstNonDone) {
      buttons.push(
        `<button class="btn-status btn-status-reopen" data-task-id="${task.id}" data-new-status="${firstNonDone.slug}" title="Reopen">🔄</button>`
      );
    }
  }

  return buttons.join('');
}

/**
 * Attach event listeners to task cards
 */
function attachTaskCardListeners(openEditModal, openViewModal, changeTaskStatus) {
  // Edit buttons
  document.querySelectorAll('.task-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      openEditModal(taskId);
    });
  });

  // Status change buttons
  document.querySelectorAll('.btn-status').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      const newStatus = btn.dataset.newStatus;
      await changeTaskStatus(taskId, newStatus);
    });
  });

  // Click on card to view details
  document.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.task-card-actions') && !e.target.closest('.btn-status')) {
        const taskId = card.dataset.taskId;
        openViewModal(taskId);
      }
    });
  });
}

/**
 * Setup drag and drop for task cards
 */
function setupDragAndDrop(changeTaskStatus, trackLocalUpdate) {
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

/**
 * Change task status
 */
export async function changeTaskStatus(taskId, newStatus, reloadTasks = null) {
  try {
    await taskService.updateTask(taskId, { status: newStatus });

    // Only reload if explicitly requested (e.g., from status buttons)
    // Drag-and-drop uses optimistic updates and doesn't need reload
    if (reloadTasks) {
      await reloadTasks();
    }
  } catch (error) {
    console.error('Error changing task status:', error);
    showError('Failed to update task status');
    throw error; // Re-throw so drag-and-drop can revert
  }
}
