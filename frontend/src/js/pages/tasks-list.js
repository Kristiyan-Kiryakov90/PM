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
 * Render list view
 */
export async function renderListView(tasks, currentFilters) {
  const tbody = document.getElementById('listViewTableBody');
  if (!tbody) return;

  // Load team members if not cached
  if (cachedTeamMembers.length === 0) {
    try {
      cachedTeamMembers = await teamService.getTeamMembers();
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  const filteredTasks = filterTasks(tasks, currentFilters);

  if (filteredTasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No tasks found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredTasks.map(task => {
    const project = task.projects || { name: 'No Project', color: '#6c757d' };
    const assignee = task.assigned_to ? getAssigneeName(task.assigned_to) : 'Unassigned';

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
