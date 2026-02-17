/**
 * Admin Feature Barrel Export
 * Public API for the admin feature
 */

// Components
export { renderSystemAdminManager } from './components/sysadmin/system-admin-manager.js';
export { renderTagManager } from './components/tag-manager-admin.js';
export { renderTeamMemberManager } from './components/team/team-manager-admin.js';
export { renderWorkflowManager } from './components/workflow-manager-admin.js';
export { openKanbanSettings } from './components/workflow/kanban-settings.js';

// Note: Page scripts are not exported as they are entry points, not library code
