/**
 * Tasks Feature Barrel Export
 * Public API for the tasks feature
 */

// Components
export { initGanttChart, changeViewMode, highlightCriticalPath, destroyGanttChart, getMissingDatesTasks } from './components/gantt-chart.js';
export { initTagPicker, renderTagBadges, destroyTagPicker } from './components/tag-picker.js';
export { initCommentThread, destroyCommentThread } from './components/comment-thread.js';
export { initTimeTracker } from './components/time-tracker.js';

// Note: Page scripts are not exported as they are entry points, not library code
