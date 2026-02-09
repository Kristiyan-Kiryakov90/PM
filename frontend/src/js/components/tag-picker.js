/**
 * Tag Picker Component
 * Select and manage tags for a task (selection only - admins create tags via admin interface)
 * Phase 3B: Tags/Labels
 */

import {
  getTags,
  getTaskTags,
  addTagToTask,
  removeTagFromTask,
  getContrastColor,
} from '../services/tag-service.js';
import { showError } from '../utils/ui-helpers.js';

/**
 * Initialize tag picker for a task
 * @param {HTMLElement} container - Container element
 * @param {number} taskId - Task ID
 * @returns {Promise<Object>} API for controlling the tag picker
 */
export async function initTagPicker(container, taskId) {
  if (!container || !taskId) {
    console.error('Tag picker requires container and task ID');
    return;
  }

  let allTags = [];
  let selectedTags = [];

  /**
   * Render the tag picker UI
   */
  async function render() {
    try {
      // Load all available tags and current task tags
      [allTags, selectedTags] = await Promise.all([
        getTags(),
        getTaskTags(taskId),
      ]);

      container.innerHTML = `
        <div class="tag-picker">
          <label class="tag-picker-label">Tags</label>

          <!-- Selected Tags -->
          <div class="tag-list tag-picker-selected" id="selectedTagsList">
            ${renderSelectedTags()}
          </div>

          <!-- Available Tags -->
          ${renderAvailableTags()}
        </div>
      `;

      setupEventListeners();
    } catch (error) {
      console.error('Error rendering tag picker:', error);
      container.innerHTML = `
        <div class="tag-picker-error">
          <p class="text-danger">Failed to load tags</p>
        </div>
      `;
    }
  }

  /**
   * Render selected tags
   */
  function renderSelectedTags() {
    if (selectedTags.length === 0) {
      return '<span class="text-muted" style="font-size: 0.875rem;">No tags selected</span>';
    }

    return selectedTags
      .map(
        (tag) => `
      <span class="tag-badge tag-badge-removable" style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)};" data-tag-id="${tag.id}">
        ${escapeHtml(tag.name)}
        <span class="tag-badge-remove" data-tag-id="${tag.id}" title="Remove tag">×</span>
      </span>
    `
      )
      .join('');
  }

  /**
   * Render available tags (not yet selected)
   */
  function renderAvailableTags() {
    // Filter out already selected tags
    const availableTags = allTags.filter(
      (tag) => !selectedTags.some((st) => st.id === tag.id)
    );

    if (allTags.length === 0) {
      return `
        <div class="tag-picker-available mt-3">
          <small class="text-muted d-block mb-2">Available tags:</small>
          <div class="tag-picker-empty">
            No tags available. Contact admin to create tags.
          </div>
        </div>
      `;
    }

    if (availableTags.length === 0) {
      return `
        <div class="tag-picker-available mt-3">
          <small class="text-muted d-block mb-2">Available tags:</small>
          <div class="text-muted" style="font-size: 0.875rem;">
            All tags have been added
          </div>
        </div>
      `;
    }

    return `
      <div class="tag-picker-available mt-3">
        <small class="text-muted d-block mb-2">Available tags:</small>
        <div class="tag-list">
          ${availableTags.map(tag => `
            <button
              class="tag-badge tag-badge-clickable"
              style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)}; border: none; cursor: pointer;"
              data-tag-id="${tag.id}"
              title="Click to add ${escapeHtml(tag.name)}"
            >
              ${escapeHtml(tag.name)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }


  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Remove tag clicks (from selected tags)
    container.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.tag-badge-remove');
      if (removeBtn) {
        const tagId = parseInt(removeBtn.dataset.tagId, 10);
        await handleRemoveTag(tagId);
      }
    });

    // Add tag clicks (from available tags)
    container.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('.tag-badge-clickable');
      if (addBtn) {
        const tagId = parseInt(addBtn.dataset.tagId, 10);
        await handleAddTag(tagId);
      }
    });
  }

  /**
   * Handle adding a tag to the task
   */
  async function handleAddTag(tagId) {
    try {
      await addTagToTask(taskId, tagId);
      await render(); // Refresh
    } catch (error) {
      console.error('Error adding tag:', error);
      showError('Failed to add tag');
    }
  }

  /**
   * Handle removing a tag from the task
   */
  async function handleRemoveTag(tagId) {
    try {
      await removeTagFromTask(taskId, tagId);
      await render(); // Refresh
    } catch (error) {
      console.error('Error removing tag:', error);
      showError('Failed to remove tag');
    }
  }

  /**
   * Get currently selected tag IDs
   */
  function getSelectedTagIds() {
    return selectedTags.map((t) => t.id);
  }

  // Initialize
  await render();

  // Return API
  return {
    render,
    getSelectedTagIds,
  };
}

/**
 * Utility function to escape HTML
 */
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

/**
 * Render tag badges (for display only, no interaction)
 * @param {Array} tags - Array of tag objects
 * @returns {string} HTML string
 */
export function renderTagBadges(tags) {
  if (!tags || tags.length === 0) {
    return '';
  }

  return tags
    .map(
      (tag) => `
    <span class="tag-badge" style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)};">
      ${escapeHtml(tag.name)}
    </span>
  `
    )
    .join('');
}
