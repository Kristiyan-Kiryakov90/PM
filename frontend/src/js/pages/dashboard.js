/**
 * Dashboard Page Logic
 * Displays overview stats, my tasks, upcoming deadlines, and project progress
 */

import { renderNavbar } from '../components/navbar.js';
import { requireAuth } from '../utils/router.js';
import { getCurrentUser } from '../utils/auth.js';
import { showError, showLoading, hideLoading } from '../utils/ui-helpers.js';
import {
  getDashboardStats,
  getMyTasks,
  getUpcomingDeadlines,
  getProjectProgress,
  getRecentActivity,
} from '../services/dashboard-service.js';

// State
let currentUser = null;

/**
 * Initialize the dashboard page
 */
async function init() {
  try {
    // Require authentication
    await requireAuth();

    // Render navbar
    await renderNavbar();

    // Load current user
    currentUser = await getCurrentUser();

    // Load all dashboard data
    await loadDashboard();
  } catch (error) {
    console.error('Dashboard page initialization error:', error);
    showError('Failed to load dashboard. Please refresh.');
  }
}

/**
 * Load all dashboard data
 */
async function loadDashboard() {
  try {
    showLoading('Loading dashboard...');

    // Load data in parallel
    const [stats, myTasks, upcomingDeadlines, projectProgress, recentActivity] = await Promise.all([
      getDashboardStats(),
      getMyTasks(),
      getUpcomingDeadlines(),
      getProjectProgress(),
      getRecentActivity(),
    ]);

    hideLoading();

    // Render each section
    renderStats(stats);
    renderMyTasks(myTasks);
    renderUpcomingDeadlines(upcomingDeadlines);
    renderProjectProgress(projectProgress);
    renderRecentActivity(recentActivity);
  } catch (error) {
    hideLoading();
    console.error('Error loading dashboard:', error);
    showError('Failed to load dashboard data. Please try again.');
  }
}

/**
 * Render stat cards
 */
function renderStats(stats) {
  // Total Projects
  const totalProjectsEl = document.getElementById('statTotalProjects');
  if (totalProjectsEl) {
    totalProjectsEl.textContent = stats.totalProjects;
  }

  // Active Tasks
  const activeTasksEl = document.getElementById('statActiveTasks');
  if (activeTasksEl) {
    activeTasksEl.textContent = stats.activeTasks;
  }

  // Completed This Week
  const completedWeekEl = document.getElementById('statCompletedWeek');
  if (completedWeekEl) {
    completedWeekEl.textContent = stats.completedThisWeek;
  }

  // Overdue Tasks
  const overdueEl = document.getElementById('statOverdue');
  if (overdueEl) {
    overdueEl.textContent = stats.overdueTasks;
  }
}

/**
 * Render my tasks
 */
function renderMyTasks(tasks) {
  const container = document.getElementById('myTasksContainer');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No tasks assigned to you</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-item">
      <div class="task-item-header">
        <span class="task-item-priority priority-${task.priority || 'medium'}">${getPriorityIcon(task.priority)}</span>
        <a href="/public/tasks.html?task=${task.id}" class="task-item-title">${escapeHtml(task.title)}</a>
      </div>
      <div class="task-item-meta">
        <span class="task-item-project">${escapeHtml(task.projects?.name || 'No Project')}</span>
        ${task.due_date ? `<span class="task-item-due ${isOverdue(task.due_date) ? 'overdue' : ''}">${formatDate(task.due_date)}</span>` : ''}
      </div>
    </div>
  `
    )
    .join('');
}

/**
 * Render upcoming deadlines
 */
function renderUpcomingDeadlines(tasks) {
  const container = document.getElementById('upcomingDeadlinesContainer');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No upcoming deadlines</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="deadline-item">
      <a href="/public/tasks.html?task=${task.id}" class="deadline-title">${escapeHtml(task.title)}</a>
      <div class="deadline-meta">
        <span class="deadline-project">${escapeHtml(task.projects?.name || 'No Project')}</span>
        <span class="deadline-date">${formatDate(task.due_date)}</span>
      </div>
    </div>
  `
    )
    .join('');
}

/**
 * Render project progress bars
 */
function renderProjectProgress(projects) {
  const container = document.getElementById('projectProgressContainer');
  if (!container) return;

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No projects yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = projects
    .map(
      (project) => `
    <div class="progress-item">
      <div class="progress-header">
        <span class="progress-icon" style="color: ${project.color || '#3b82f6'}">${project.icon || '📁'}</span>
        <span class="progress-name">${escapeHtml(project.name)}</span>
        <span class="progress-percentage">${project.percentage}%</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${project.percentage}%; background-color: ${project.color || '#3b82f6'}"></div>
      </div>
      <div class="progress-meta">${project.completed_tasks} of ${project.total_tasks} tasks completed</div>
    </div>
  `
    )
    .join('');
}

/**
 * Render recent activity
 */
function renderRecentActivity(activities) {
  const container = document.getElementById('recentActivityContainer');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No recent activity</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activities
    .map(
      (activity) => `
    <div class="activity-item">
      <div class="activity-icon">${getActivityIcon(activity.type)}</div>
      <div class="activity-content">
        <div class="activity-description">${escapeHtml(activity.description)}</div>
        <div class="activity-meta">
          <span class="activity-project">${escapeHtml(activity.project_name)}</span>
          <span class="activity-time">${formatRelativeTime(activity.created_at)}</span>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

/**
 * Utility functions
 */
function getPriorityIcon(priority) {
  const icons = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    urgent: '🚨',
  };
  return icons[priority] || icons.medium;
}

function getActivityIcon(type) {
  const icons = {
    task_created: '➕',
    task_updated: '📝',
    task_completed: '✅',
    task_deleted: '🗑️',
  };
  return icons[type] || '📌';
}

function isOverdue(dueDate) {
  return new Date(dueDate) < new Date();
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if today
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  // Check if tomorrow
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  // Format as "Mon, Jan 15"
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

// Initialize on page load
init();
