/**
 * Reports Service
 * Main service for analytics, metrics, and report generation
 * Phase 3D: Reports & Analytics
 */

import {
  getTaskCompletionMetrics,
  getStatusDistribution,
  getPriorityDistribution,
  getOverdueMetrics,
  getTimeTrackingSummary,
  getTeamProductivity,
  getProjectProgress,
} from './reports-queries.js';

import {
  exportToCSV,
  getDateRangePresets,
} from './reports-export.js';

/**
 * Reports Service Object
 * Public API for all reporting functionality
 */
export const reportsService = {
  // Query methods
  getTaskCompletionMetrics,
  getStatusDistribution,
  getPriorityDistribution,
  getOverdueMetrics,
  getTimeTrackingSummary,
  getTeamProductivity,
  getProjectProgress,

  // Export utilities
  exportToCSV,
  getDateRangePresets,
};
