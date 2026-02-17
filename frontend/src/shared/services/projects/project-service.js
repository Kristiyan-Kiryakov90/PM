/**
 * Project Service
 * Main service for project management
 */

import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from './project-crud.js';

import {
  getProjectStats,
  canModifyProject,
} from './project-queries.js';

/**
 * Project Service Object
 * Public API for all project operations
 */
export const projectService = {
  // CRUD operations
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,

  // Query/aggregation methods
  getProjectStats,
  canModifyProject,
};
