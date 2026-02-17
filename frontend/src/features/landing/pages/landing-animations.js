/**
 * Landing Page - Interactive Animations & Effects
 * Demo carousel and interactive board animations
 */

// Board state
let boardTasks = [];
let boardTaskCounter = 0;
let boardFilter = 'all';
let boardView = 'kanban';
let demoCurrentSlide = 'dashboard';
let demoAutoplayTimer = null;

const BOARD_STATUSES = ['todo', 'in_progress', 'done'];
const FILTER_CYCLE = ['all', 'high', 'medium', 'done'];
const DEMO_SLIDES = ['dashboard', 'projects', 'tasks', 'reports', 'admin'];
const FILTER_LABELS = {
  all: 'All',
  high: 'High',
  medium: 'Medium',
  done: 'Done',
};

function normalizeBoardView(view) {
  if (view === 'timeline') return 'gantt';
  return view;
}

function formatDueDate(dateString) {
  if (!dateString) return 'No due date';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No due date';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return 'Today';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
}

function getVisibleTasks() {
  if (boardFilter === 'all') return boardTasks;
  if (boardFilter === 'done') return boardTasks.filter((task) => task.status === 'done');
  return boardTasks.filter((task) => task.priority === boardFilter);
}

function getTaskActions(task) {
  if (task.status === 'todo') {
    return [
      { action: 'next', label: 'Move right' },
      { action: 'done', label: 'Done' },
    ];
  }
  if (task.status === 'in_progress') {
    return [
      { action: 'prev', label: 'Move left' },
      { action: 'next', label: 'Move right' },
      { action: 'done', label: 'Done' },
    ];
  }
  return [
    { action: 'prev', label: 'Move left' },
    { action: 'reopen', label: 'Reopen' },
  ];
}

function getTaskCardClass(task) {
  if (task.status === 'done') return 'task-card priority-done';
  if (task.priority === 'high') return 'task-card priority-high';
  if (task.priority === 'medium') return 'task-card priority-medium';
  return 'task-card';
}

function renderKanbanBoard() {
  const visibleTasks = getVisibleTasks();
  const boardColumns = document.getElementById('boardColumns');
  if (!boardColumns) return;

  BOARD_STATUSES.forEach((status) => {
    const column = boardColumns.querySelector(`.board-column[data-status="${status}"]`);
    if (!column) return;

    const cards = visibleTasks.filter((task) => task.status === status);
    column.querySelectorAll('.task-card').forEach((card) => card.remove());

    cards.forEach((task) => {
      const card = document.createElement('article');
      card.className = getTaskCardClass(task);
      card.dataset.taskId = String(task.id);
      card.dataset.status = task.status;
      card.dataset.priority = task.priority;

      const meta = task.status === 'done'
        ? `Completed ${task.completed || 'Recently'} - ${task.assignee}`
        : `Due: ${formatDueDate(task.due)} - Assignee: ${task.assignee}`;

      card.innerHTML = `
        <p class="task-title">${task.title}</p>
        <p class="task-meta">${meta}</p>
        <div class="task-tags">${task.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
        <div class="task-card-actions">
          ${getTaskActions(task).map((item) => `<button type="button" class="task-action" data-action="${item.action}">${item.label}</button>`).join('')}
        </div>
      `;

      column.appendChild(card);
    });
  });

  const todoCount = visibleTasks.filter((task) => task.status === 'todo').length;
  const progressCount = visibleTasks.filter((task) => task.status === 'in_progress').length;
  const doneCount = visibleTasks.filter((task) => task.status === 'done').length;

  const todoEl = document.getElementById('countTodo');
  const progressEl = document.getElementById('countProgress');
  const doneEl = document.getElementById('countDone');
  if (todoEl) todoEl.textContent = String(todoCount);
  if (progressEl) progressEl.textContent = String(progressCount);
  if (doneEl) doneEl.textContent = String(doneCount);
}

function renderListView() {
  const listEl = document.getElementById('boardList');
  if (!listEl) return;

  const visibleTasks = getVisibleTasks();
  const rows = visibleTasks.map((task) => {
    const dueOrDone = task.status === 'done' ? `Completed ${task.completed || 'Recently'}` : formatDueDate(task.due);
    return `
      <div class="board-list-row">
        <span class="board-list-task">${task.title}</span>
        <span class="board-list-status ${task.status}">${task.status.replace('_', ' ')}</span>
        <span>${task.assignee}</span>
        <span>${dueOrDone}</span>
      </div>
    `;
  }).join('');

  listEl.innerHTML = `
    <div class="board-list-row board-list-head">
      <span>Task</span>
      <span>Status</span>
      <span>Assignee</span>
      <span>Due/Completed</span>
    </div>
    ${rows}
  `;
}

function renderGanttView() {
  const ganttEl = document.getElementById('boardGantt') || document.getElementById('boardTimeline');
  if (!ganttEl) return;

  const visibleTasks = getVisibleTasks();
  const bars = visibleTasks.map((task) => {
    const progress = task.status === 'done' ? 100 : task.status === 'in_progress' ? 62 : 26;
    return `
      <div class="board-gantt-item">
        <p>${task.assignee}</p>
        <div class="board-gantt-bar"><span style="width: ${progress}%"><em>${task.title}</em></span></div>
      </div>
    `;
  }).join('');

  ganttEl.innerHTML = bars || '<p class="m-0 text-muted">No tasks for this filter.</p>';
}

function setBoardView(view) {
  boardView = normalizeBoardView(view);
  document.querySelectorAll('.board-view').forEach((btn) => {
    btn.classList.toggle('active', normalizeBoardView(btn.dataset.view) === boardView);
  });

  const kanban = document.getElementById('boardKanbanPanel');
  const list = document.getElementById('boardListPanel');
  const gantt = document.getElementById('boardGanttPanel') || document.getElementById('boardTimelinePanel');
  if (!kanban || !list || !gantt) return;

  kanban.classList.toggle('is-active', boardView === 'kanban');
  list.classList.toggle('is-active', boardView === 'list');
  gantt.classList.toggle('is-active', boardView === 'gantt');
}

function shiftTaskStatus(task, direction) {
  const currentIndex = BOARD_STATUSES.indexOf(task.status);
  if (currentIndex === -1) return;
  const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  if (nextIndex < 0 || nextIndex >= BOARD_STATUSES.length) return;
  task.status = BOARD_STATUSES[nextIndex];

  if (task.status === 'done') {
    task.priority = 'done';
    task.completed = 'Just now';
  }
}

function renderBoard() {
  renderKanbanBoard();
  renderListView();
  renderGanttView();
}

function clearDemoAutoplay() {
  if (demoAutoplayTimer) {
    clearInterval(demoAutoplayTimer);
    demoAutoplayTimer = null;
  }
}

function startDemoAutoplay() {
  clearDemoAutoplay();

  const slides = document.querySelectorAll('.app-slide[data-demo-slide]');
  if (slides.length <= 1) return;

  demoAutoplayTimer = setInterval(() => {
    shiftDemoSlide(1, false);
  }, 7000);
}

function setDemoSlide(slideKey, shouldRestartAutoplay = true) {
  if (!DEMO_SLIDES.includes(slideKey)) return;
  demoCurrentSlide = slideKey;

  document.querySelectorAll('.app-slide[data-demo-slide]').forEach((slide) => {
    slide.classList.toggle('is-active', slide.dataset.demoSlide === slideKey);
  });

  document.querySelectorAll('[data-demo-target]').forEach((control) => {
    const isActive = control.dataset.demoTarget === slideKey;
    if (control.classList.contains('demo-dot')) {
      control.classList.toggle('is-active', isActive);
    } else {
      control.classList.toggle('active', isActive);
    }
  });

  if (shouldRestartAutoplay) {
    startDemoAutoplay();
  }
}

function shiftDemoSlide(direction, shouldRestartAutoplay = true) {
  const currentIndex = DEMO_SLIDES.indexOf(demoCurrentSlide);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeIndex + direction + DEMO_SLIDES.length) % DEMO_SLIDES.length;
  setDemoSlide(DEMO_SLIDES[nextIndex], shouldRestartAutoplay);
}

export function initAppDemoCarousel() {
  const carouselTrack = document.getElementById('demoCarouselTrack');
  if (!carouselTrack) return;

  document.querySelectorAll('[data-demo-target]').forEach((control) => {
    control.addEventListener('click', () => {
      const target = control.dataset.demoTarget;
      if (!target) return;
      setDemoSlide(target);
    });
  });

  const prevBtn = document.getElementById('demoPrevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      shiftDemoSlide(-1);
    });
  }

  const nextBtn = document.getElementById('demoNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      shiftDemoSlide(1);
    });
  }

  carouselTrack.addEventListener('mouseenter', clearDemoAutoplay);
  carouselTrack.addEventListener('mouseleave', startDemoAutoplay);
  carouselTrack.addEventListener('focusin', clearDemoAutoplay);
  carouselTrack.addEventListener('focusout', startDemoAutoplay);

  setDemoSlide(demoCurrentSlide);
}

export function initLandingBoard() {
  const boardRoot = document.querySelector('.task-board');
  if (!boardRoot) return;

  const seedCards = boardRoot.querySelectorAll('.task-card[data-task-id]');
  boardTasks = Array.from(seedCards).map((card) => ({
    id: Number(card.dataset.taskId),
    status: card.dataset.status,
    priority: card.dataset.priority || 'medium',
    title: card.dataset.title || card.querySelector('.task-title')?.textContent?.trim() || 'Untitled task',
    assignee: card.dataset.assignee || 'Unassigned',
    due: card.dataset.due || '',
    completed: card.dataset.completed || '',
    tags: Array.from(card.querySelectorAll('.task-tags span')).map((tag) => tag.textContent.trim()),
  }));

  boardTaskCounter = boardTasks.length + 1;

  const addTaskBtn = document.getElementById('boardAddTaskBtn');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      boardTasks.unshift({
        id: boardTaskCounter++,
        status: 'todo',
        priority: 'medium',
        title: `New task ${boardTaskCounter - 1}`,
        assignee: 'Unassigned',
        due: due.toISOString(),
        completed: '',
        tags: ['Backlog'],
      });
      renderBoard();
    });
  }

  const filterBtn = document.getElementById('boardFilterBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      const currentIndex = FILTER_CYCLE.indexOf(boardFilter);
      const nextIndex = (currentIndex + 1) % FILTER_CYCLE.length;
      boardFilter = FILTER_CYCLE[nextIndex];
      filterBtn.dataset.filter = boardFilter;
      filterBtn.textContent = `Filter: ${FILTER_LABELS[boardFilter]}`;
      renderBoard();
    });
  }

  document.querySelectorAll('.board-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextView = normalizeBoardView(btn.dataset.view || 'kanban');
      setBoardView(nextView);
      renderBoard();
    });
  });

  const kanbanPanel = document.getElementById('boardKanbanPanel');
  if (kanbanPanel) {
    kanbanPanel.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('.task-action');
      if (!actionBtn) return;

      const card = actionBtn.closest('.task-card');
      if (!card) return;

      const taskId = Number(card.dataset.taskId);
      const action = actionBtn.dataset.action;
      const task = boardTasks.find((item) => item.id === taskId);
      if (!task) return;

      if (action === 'next' || action === 'prev') {
        shiftTaskStatus(task, action);
      } else if (action === 'done') {
        task.status = 'done';
        task.priority = 'done';
        task.completed = 'Just now';
      } else if (action === 'reopen') {
        task.status = 'todo';
        task.priority = 'medium';
        task.completed = '';
      }

      renderBoard();
    });
  }

  setBoardView(boardView);
  renderBoard();
}
