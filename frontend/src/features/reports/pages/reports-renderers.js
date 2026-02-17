/**
 * Reports Page Renderers
 * Contains all report rendering functions
 */

/**
 * Render task completion metrics
 */
export function renderTaskCompletionMetrics(metrics) {
  const container = document.getElementById('taskCompletionContent');

  if (metrics.total === 0) {
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">📊</div><p class="report-empty-text">No tasks in this period</p></div>';
    return;
  }

  const completionRate = ((metrics.completed / metrics.total) * 100).toFixed(1);

  container.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Tasks</div>
        <div class="metric-value">${metrics.total}</div>
      </div>
      <div class="metric-card success">
        <div class="metric-label">Completed</div>
        <div class="metric-value">${metrics.completed}</div>
      </div>
      <div class="metric-card primary">
        <div class="metric-label">In Progress</div>
        <div class="metric-value">${metrics.inProgress}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Completion Rate</div>
        <div class="metric-value">${completionRate}%</div>
        <div class="progress-bar" style="margin-top: 0.5rem;">
          <div class="progress-bar-fill success" style="width: ${completionRate}%"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render status distribution
 */
export function renderStatusDistribution(distribution) {
  const container = document.getElementById('statusDistributionContent');

  if (Object.keys(distribution).length === 0) {
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">📊</div><p class="report-empty-text">No data available</p></div>';
    return;
  }

  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const statusColors = {
    'todo': '#94a3b8',
    'in_progress': '#3b82f6',
    'in_review': '#f59e0b',
    'done': '#10b981'
  };

  const statusLabels = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'in_review': 'In Review',
    'done': 'Done'
  };

  const rows = Object.entries(distribution).map(([status, count]) => {
    const percentage = ((count / total) * 100).toFixed(1);
    return `
      <tr>
        <td>${statusLabels[status] || status}</td>
        <td>${count}</td>
        <td>${percentage}%</td>
        <td>
          <div class="progress-bar" style="width: 200px;">
            <div class="progress-bar-fill" style="width: ${percentage}%; background: ${statusColors[status]}"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Count</th>
          <th>Percentage</th>
          <th>Distribution</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Render priority distribution
 */
export function renderPriorityDistribution(distribution) {
  const container = document.getElementById('priorityDistributionContent');

  if (Object.keys(distribution).length === 0) {
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">🎯</div><p class="report-empty-text">No data available</p></div>';
    return;
  }

  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const priorityColors = {
    'low': '#94a3b8',
    'medium': '#3b82f6',
    'high': '#f59e0b',
    'urgent': '#ef4444'
  };

  const rows = Object.entries(distribution).map(([priority, count]) => {
    const percentage = ((count / total) * 100).toFixed(1);
    return `
      <tr>
        <td style="text-transform: capitalize;">${priority}</td>
        <td>${count}</td>
        <td>${percentage}%</td>
        <td>
          <div class="progress-bar" style="width: 200px;">
            <div class="progress-bar-fill" style="width: ${percentage}%; background: ${priorityColors[priority]}"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Count</th>
          <th>Percentage</th>
          <th>Distribution</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Render time tracking report
 */
export function renderTimeTrackingReport(summary) {
  const container = document.getElementById('timeTrackingContent');

  if (summary.entryCount === 0) {
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">⏱️</div><p class="report-empty-text">No time entries found</p></div>';
    return;
  }

  const projectRows = summary.byProject.map(project => {
    const hours = (project.totalSeconds / 3600).toFixed(2);
    return `
      <tr>
        <td>${project.name}</td>
        <td>${hours}h</td>
        <td>${((project.totalSeconds / summary.totalSeconds) * 100).toFixed(1)}%</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 0.5rem;">
        <strong>Total Time:</strong> ${summary.totalHours} hours across ${summary.entryCount} entries
      </p>
    </div>

    ${summary.byProject.length > 0 ? `
      <table class="report-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Time Spent</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${projectRows}
        </tbody>
      </table>
    ` : '<p class="text-muted">No project breakdown available</p>'}
  `;
}

/**
 * Render team productivity
 */
export function renderTeamProductivity(productivity) {
  const container = document.getElementById('teamProductivityContent');

  if (productivity.length === 0) {
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">👥</div><p class="report-empty-text">No team data found</p></div>';
    return;
  }

  const rows = productivity.map(user => `
    <tr>
      <td>${user.userName || user.userId}</td>
      <td>${user.total}</td>
      <td>${user.completed}</td>
      <td>${user.inProgress}</td>
      <td>${user.todo}</td>
      <td>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: 100px;">
            <div class="progress-bar-fill success" style="width: ${user.completionRate}%"></div>
          </div>
          <span class="progress-label">${user.completionRate}%</span>
        </div>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Total</th>
          <th>Completed</th>
          <th>In Progress</th>
          <th>To Do</th>
          <th>Completion Rate</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Render overdue tasks report
 */
export function renderOverdueTasksReport(overdue) {
  const container = document.getElementById('overdueTasksContent');

  if (overdue.total === 0) {
    container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">✅</div><p class="report-empty-text">No overdue tasks - great job!</p></div>';
    return;
  }

  const rows = overdue.tasks.map(task => {
    const dueDate = new Date(task.due_date);
    const daysOverdue = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24));

    return `
      <tr>
        <td>${task.title}</td>
        <td style="text-transform: capitalize;">${task.priority}</td>
        <td>${dueDate.toLocaleDateString()}</td>
        <td>${daysOverdue} days</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <p style="font-size: 0.875rem; color: var(--gray-600);">
        <strong>${overdue.total}</strong> overdue tasks (${overdue.byPriority.urgent} urgent, ${overdue.byPriority.high} high priority)
      </p>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Priority</th>
          <th>Due Date</th>
          <th>Days Overdue</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
