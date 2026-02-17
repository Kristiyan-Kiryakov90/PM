/**
 * Checklist Service
 * Main service for checklist and checklist item management
 */

import {
  getTaskChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  getChecklistProgress,
  getTaskChecklistsProgress,
} from './checklist-crud.js';

import {
  createChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
} from './checklist-items.js';

/**
 * Checklist Service Object
 * Public API for all checklist operations
 */
export const checklistService = {
  // Checklist CRUD
  getTaskChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  getChecklistProgress,
  getTaskChecklistsProgress,

  // Checklist item operations
  createChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
};
