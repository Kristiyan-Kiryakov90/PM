/**
 * Task List View Module
 * Handles list/table view rendering
 */

import { renderTagBadges } from '../components/tag-picker.js';
import {
  escapeHtml,
  formatStatus,
  formatPriority,
  getStatusBadgeClass,
  getPriorityBadgeClass,
  formatDueDate,
  filterTasks,
  getContrastingTextColor,
} from './tasks-utils.js';

/**
 * Render list view
 */
export function renderListView(tasks, currentFilters) {
  const tbody = document.getElementById('listViewTableBody');
  if (!tbody) return;

  const filteredTasks = filterTasks(tasks, currentFilters);

  if (filteredTasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No tasks found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredTasks.map(task => {
    const project = task.projects || { name: 'No Project', color: '#6c757d' };
    const assignee = task.assigned_to_user
      ? (task.assigned_to_user.user_metadata?.full_name || task.assigned_to_user.email)
      : 'Unassigned';

    // Get contrasting text color for project badge
    const projectTextColor = getContrastingTextColor(project.color);

    return `
      <tr style="cursor: pointer;" onclick="window.openViewModal(${task.id})">
        <td>
          <div class="fw-semibold">${escapeHtml(task.title)}</div>
          ${task.tags && task.tags.length > 0 ? renderTagBadges(task.tags) : ''}
        </td>
        <td>
          <span style="color: #1f2937; font-weight: 500;">
            ${escapeHtml(project.name)}
          </span>
        </td>
        <td><span class="badge bg-${getStatusBadgeClass(task.status)}">${formatStatus(task.status)}</span></td>
        <td><span class="badge bg-${getPriorityBadgeClass(task.priority)}">${formatPriority(task.priority)}</span></td>
        <td>${task.due_date ? formatDueDate(task.due_date) : '-'}</td>
        <td>${escapeHtml(assignee)}</td>
      </tr>
    `;
  }).join('');
}
