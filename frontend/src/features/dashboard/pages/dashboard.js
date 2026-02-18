/**
 * Dashboard Page Logic
 * Displays overview stats, my tasks, upcoming deadlines, and project progress
 */

// Import styles
import '@styles/global/global.css';
import '@styles/shared/navbar.css';
import '@styles/shared/notifications.css';
import '@dashboard/styles/dashboard.css';
import '@dashboard/styles/activity.css';

import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { dashboardService } from '@services/dashboard-service.js';
import { initActivityFeed } from '@dashboard/components/activity-feed.js';

// State
let currentUser = null;

/**
 * Initialize the dashboard page
 */
async function init() {
  console.time('⏱️ Dashboard Page Load');
  try {
    // Require authentication
    await router.requireAuth();

    // Run navbar, user fetch, and data load in parallel
    const [, loadedUser] = await Promise.all([
      renderNavbar(),
      authUtils.getCurrentUser(),
      loadDashboard(),
    ]);

    currentUser = loadedUser;

    console.timeEnd('⏱️ Dashboard Page Load');
  } catch (error) {
    console.error('Dashboard page initialization error:', error);
    uiHelpers.showError('Failed to load dashboard. Please refresh.');
    console.timeEnd('⏱️ Dashboard Page Load');
  }
}

/**
 * Load all dashboard data
 */
async function loadDashboard() {
  try {
    // Load data in parallel
    const [stats, myTasks, upcomingDeadlines, projectProgress] = await Promise.all([
      dashboardService.getDashboardStats(),
      dashboardService.getMyTasks(),
      dashboardService.getUpcomingDeadlines(),
      dashboardService.getProjectProgress(),
    ]);

    // Render each section
    renderStats(stats);
    renderMyTasks(myTasks);
    renderUpcomingDeadlines(upcomingDeadlines);
    renderProjectProgress(projectProgress);

    // Initialize activity feed independently — don't block other renders
    const activityContainer = document.getElementById('recentActivityContainer');
    if (activityContainer) {
      initActivityFeed(activityContainer, {
        limit: 10,
        realtime: true,
      }).catch(console.error);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    uiHelpers.showError('Failed to load dashboard data. Please try again.');
  }
}

/**
 * Render stat cards - smooth transition from skeleton
 */
function renderStats(stats) {
  // Helper to smoothly replace skeleton with actual number
  const updateStat = (elementId, value) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Remove skeleton (if present)
    const skeleton = el.querySelector('.skeleton');
    if (skeleton) {
      skeleton.style.opacity = '0';
      setTimeout(() => skeleton.remove(), 80);
    }

    // Set number with fade-in
    el.style.opacity = '0';
    el.textContent = value;
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transition = 'opacity 0.1s';
    }, 80);
  };

  // Update all stats smoothly
  updateStat('statTotalProjects', stats.totalProjects);
  updateStat('statActiveTasks', stats.activeTasks);
  updateStat('statCompletedWeek', stats.completedThisWeek);
  updateStat('statOverdue', stats.overdueTasks);
}

/**
 * Render my tasks - smooth transition from skeleton
 */
async function renderMyTasks(tasks) {
  const container = document.getElementById('myTasksContainer');
  if (!container) return;

  // Fade out skeleton first
  const skeletonList = container.querySelector('.skeleton-list');
  if (skeletonList) {
    skeletonList.style.opacity = '0';
    skeletonList.style.transition = 'opacity 0.1s';
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small content-loaded">
        <p>No tasks assigned to you</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="content-loaded">${tasks
    .map(
      (task) => `
    <div class="task-item">
      <div class="task-item-header">
        <span class="task-item-priority priority-${task.priority || 'medium'}">${getPriorityIcon(task.priority)}</span>
        <a href="/tasks.html?task=${task.id}" class="task-item-title">${escapeHtml(task.title)}</a>
      </div>
      <div class="task-item-meta">
        <span class="task-item-project">${escapeHtml(task.projects?.name || 'No Project')}</span>
        ${task.due_date ? `<span class="task-item-due ${isOverdue(task.due_date) ? 'overdue' : ''}">${formatDate(task.due_date)}</span>` : ''}
      </div>
    </div>
  `
    )
    .join('')}</div>`;
}

/**
 * Render upcoming deadlines - smooth transition from skeleton
 */
async function renderUpcomingDeadlines(tasks) {
  const container = document.getElementById('upcomingDeadlinesContainer');
  if (!container) return;

  // Fade out skeleton first
  const skeletonList = container.querySelector('.skeleton-list');
  if (skeletonList) {
    skeletonList.style.opacity = '0';
    skeletonList.style.transition = 'opacity 0.1s';
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small content-loaded">
        <p>No upcoming deadlines</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="deadline-item">
      <a href="/tasks.html?task=${task.id}" class="deadline-title">${escapeHtml(task.title)}</a>
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
 * Render recent activity - now handled by activity-feed.js component
 * Kept for reference but not used
 */
// function renderRecentActivity(activities) { ... }

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
