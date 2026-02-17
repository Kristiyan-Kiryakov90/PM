/**
 * Tasks Page - Initialization Module
 * Handles data loading and dropdown population
 */

import { projectService } from '@services/project-service.js';
import { tagService } from '@services/tag-service.js';
import { teamService } from '@services/team-service.js';
import { statusService } from '@services/status-service.js';

/**
 * Load projects from the API (only active projects)
 */
export async function loadProjects() {
  try {
    // Only load active projects for task assignment
    const projects = await projectService.getProjects({ status: 'active' });
    return projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

/**
 * Load tags from the API
 */
export async function loadTags() {
  try {
    const tags = await tagService.getTags();
    return tags;
  } catch (error) {
    console.error('Error loading tags:', error);
    return [];
  }
}

/**
 * Load team members from the API
 */
export async function loadTeamMembers() {
  try {
    const teamMembers = await teamService.getTeamMembers();
    return teamMembers;
  } catch (error) {
    console.error('Error loading team members:', error);
    return [];
  }
}

/**
 * Populate project dropdowns
 */
export function populateProjectDropdowns(projects) {
  const filterProjectSelect = document.getElementById('filterProject');
  const taskProjectSelect = document.getElementById('taskProject');

  // Filter dropdown
  if (filterProjectSelect) {
    const currentValue = filterProjectSelect.value;
    filterProjectSelect.innerHTML = '<option value="">All Projects</option>';
    projects.forEach((project) => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      filterProjectSelect.appendChild(option);
    });
    filterProjectSelect.value = currentValue;
  }

  // Task form dropdown
  if (taskProjectSelect) {
    const currentValue = taskProjectSelect.value;
    taskProjectSelect.innerHTML = '<option value="">Select project...</option>';
    projects.forEach((project) => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      taskProjectSelect.appendChild(option);
    });
    if (currentValue) {
      taskProjectSelect.value = currentValue;
    }
  }
}

/**
 * Populate tag filter dropdown
 */
export function populateTagFilter(tags) {
  const filterTagSelect = document.getElementById('filterTag');

  if (filterTagSelect) {
    const currentValue = filterTagSelect.value;
    filterTagSelect.innerHTML = '<option value="">All Tags</option>';
    tags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag.id;
      option.textContent = tag.name;
      filterTagSelect.appendChild(option);
    });
    filterTagSelect.value = currentValue;
  }
}

/**
 * Populate assignee filter dropdown
 */
export function populateAssigneeFilter(teamMembers) {
  const filterAssigneeSelect = document.getElementById('filterAssignee');

  if (filterAssigneeSelect) {
    const currentValue = filterAssigneeSelect.value;
    filterAssigneeSelect.innerHTML = '<option value="">All Members</option>';
    teamMembers.forEach((member) => {
      const option = document.createElement('option');
      option.value = member.id;
      option.textContent = member.full_name || member.email || 'Unknown User';
      filterAssigneeSelect.appendChild(option);
    });
    filterAssigneeSelect.value = currentValue;
  }
}

/**
 * Populate status filter dropdown based on selected project
 */
export async function populateStatusFilter(projectId) {
  const filterStatusSelect = document.getElementById('filterStatus');

  if (!filterStatusSelect) return;

  const currentValue = filterStatusSelect.value;
  filterStatusSelect.innerHTML = '<option value="">All Status</option>';

  if (!projectId) {
    // No project selected, show default statuses
    const defaultStatuses = [
      { slug: 'todo', name: 'To Do' },
      { slug: 'in_progress', name: 'In Progress' },
      { slug: 'review', name: 'Review' },
      { slug: 'done', name: 'Done' },
    ];
    defaultStatuses.forEach((status) => {
      const option = document.createElement('option');
      option.value = status.slug;
      option.textContent = status.name;
      filterStatusSelect.appendChild(option);
    });
  } else {
    // Load dynamic statuses for selected project
    try {
      const projectStatuses = await statusService.getProjectStatuses(projectId);
      projectStatuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status.slug;
        option.textContent = status.name;
        filterStatusSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading statuses:', error);
      // Fallback to default statuses
      const defaultStatuses = [
        { slug: 'todo', name: 'To Do' },
        { slug: 'in_progress', name: 'In Progress' },
        { slug: 'review', name: 'Review' },
        { slug: 'done', name: 'Done' },
      ];
      defaultStatuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status.slug;
        option.textContent = status.name;
        filterStatusSelect.appendChild(option);
      });
    }
  }

  filterStatusSelect.value = currentValue;
}
