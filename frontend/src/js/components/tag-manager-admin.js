/**
 * Tag Manager - Admin Only
 * Create, edit, and delete tags (admin interface)
 * Phase 3B: Tags/Labels (Approach 2)
 */

import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getTagUsage,
  TAG_COLORS,
} from '../services/tag-service.js';
import { showError, showSuccess } from '../utils/ui-helpers.js';

/**
 * Render tag manager in a container
 * @param {HTMLElement} container - Container element
 */
export async function renderTagManager(container) {
  if (!container) return;

  let tags = [];
  let editingTagId = null;
  let listenersAttached = false;

  async function render() {
    tags = await getTags();

    // Load usage counts
    const tagsWithUsage = await Promise.all(
      tags.map(async (tag) => {
        const usage = await getTagUsage(tag.id);
        return { ...tag, usageCount: usage.usageCount };
      })
    );

    container.innerHTML = `
      <div class="tag-manager-admin">
        <div class="tag-manager-header mb-4">
          <button class="btn btn-primary" id="createTagBtn">
            ➕ Create Tag
          </button>
        </div>

        ${tags.length === 0 ? `
          <div class="tag-manager-empty">
            <div class="tag-manager-empty-icon">🏷️</div>
            <p class="tag-manager-empty-text">No tags yet. Create your first tag!</p>
          </div>
        ` : `
          <div class="tag-manager-list">
            ${tagsWithUsage.map(tag => `
              <div class="tag-manager-item" data-tag-id="${tag.id}">
                <div class="tag-manager-color-preview" style="background-color: ${tag.color};" title="Click to change color"></div>
                <div class="tag-manager-info">
                  <div class="tag-manager-name">${escapeHtml(tag.name)}</div>
                  <div class="tag-manager-usage">${tag.usageCount} ${tag.usageCount === 1 ? 'task' : 'tasks'}</div>
                </div>
                <div class="tag-manager-actions">
                  <button class="tag-manager-action-btn edit" data-tag-id="${tag.id}" title="Edit">
                    ✏️
                  </button>
                  <button class="tag-manager-action-btn delete" data-tag-id="${tag.id}" title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}

        <!-- Create/Edit Form Modal -->
        <div id="tagFormModal" style="display: none;">
          <!-- Will be shown as modal -->
        </div>
      </div>
    `;

    // Only attach event listeners once
    if (!listenersAttached) {
      setupEventListeners();
      listenersAttached = true;
    }
  }

  function setupEventListeners() {
    // Use event delegation for create button
    container.addEventListener('click', async (e) => {
      // Create tag button
      const createBtn = e.target.closest('#createTagBtn');
      if (createBtn) {
        e.preventDefault();
        console.log('Create tag button clicked');
        showTagForm();
        return;
      }

      // Edit buttons
      const editBtn = e.target.closest('.edit');
      if (editBtn) {
        e.preventDefault();
        const tagId = parseInt(editBtn.dataset.tagId, 10);
        showTagForm(tagId);
        return;
      }

      // Delete buttons
      const deleteBtn = e.target.closest('.delete');
      if (deleteBtn) {
        e.preventDefault();
        const tagId = parseInt(deleteBtn.dataset.tagId, 10);
        await handleDeleteTag(tagId);
        return;
      }

      // Color preview click
      const colorPreview = e.target.closest('.tag-manager-color-preview');
      if (colorPreview) {
        e.preventDefault();
        const tagId = parseInt(colorPreview.closest('.tag-manager-item').dataset.tagId, 10);
        showColorPicker(tagId);
        return;
      }
    });
  }

  function showTagForm(tagId = null) {
    const tag = tagId ? tags.find(t => t.id === tagId) : null;
    editingTagId = tagId;

    // Remove any existing modals first
    const existingOverlay = document.getElementById('tagFormOverlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const formHtml = `
      <div class="modal-overlay" id="tagFormOverlay">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5>${tag ? 'Edit Tag' : 'Create Tag'}</h5>
              <button class="btn-close" id="closeTagForm">×</button>
            </div>
            <div class="modal-body">
              <div class="tag-form">
                <div class="tag-form-group">
                  <label class="tag-form-label">Tag Name *</label>
                  <input
                    type="text"
                    class="tag-form-input"
                    id="tagNameInput"
                    value="${tag ? escapeHtml(tag.name) : ''}"
                    placeholder="e.g., bug, feature, urgent"
                    maxlength="50"
                    required
                  />
                </div>

                <div class="tag-form-group">
                  <label class="tag-form-label">Color</label>
                  <div class="tag-form-color-grid">
                    ${TAG_COLORS.map(color => `
                      <div
                        class="tag-form-color-option ${tag?.color === color.value ? 'selected' : ''}"
                        style="background-color: ${color.value};"
                        data-color="${color.value}"
                        title="${color.name}"
                      ></div>
                    `).join('')}
                  </div>
                </div>

                <div class="tag-form-preview">
                  <label class="tag-form-preview-label">Preview</label>
                  <span class="tag-badge" id="tagPreview" style="background-color: ${tag?.color || TAG_COLORS[11].value}; color: white;">
                    ${tag ? escapeHtml(tag.name) : 'Tag Name'}
                  </span>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="cancelTagForm">Cancel</button>
              <button class="btn btn-primary" id="saveTagBtn">${tag ? 'Update' : 'Create'} Tag</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert form into page
    document.body.insertAdjacentHTML('beforeend', formHtml);

    setupFormListeners(tag);
  }

  function setupFormListeners(existingTag) {
    const overlay = document.getElementById('tagFormOverlay');
    const nameInput = document.getElementById('tagNameInput');
    const preview = document.getElementById('tagPreview');
    const saveBtn = document.getElementById('saveTagBtn');
    const cancelBtn = document.getElementById('cancelTagForm');
    const closeBtn = document.getElementById('closeTagForm');

    let selectedColor = existingTag?.color || TAG_COLORS[11].value;

    // Name input updates preview
    nameInput?.addEventListener('input', (e) => {
      if (preview) {
        preview.textContent = e.target.value || 'Tag Name';
      }
    });

    // Color selection
    overlay?.addEventListener('click', (e) => {
      const colorOption = e.target.closest('.tag-form-color-option');
      if (colorOption) {
        // Remove previous selection
        overlay.querySelectorAll('.tag-form-color-option').forEach(el => {
          el.classList.remove('selected');
        });
        // Add new selection
        colorOption.classList.add('selected');
        selectedColor = colorOption.dataset.color;

        // Update preview
        if (preview) {
          preview.style.backgroundColor = selectedColor;
        }
      }
    });

    // Save button
    saveBtn?.addEventListener('click', async () => {
      const name = nameInput?.value.trim();
      if (!name) {
        showError('Tag name is required');
        return;
      }

      try {
        if (editingTagId) {
          await updateTag(editingTagId, { name, color: selectedColor });
          showSuccess('Tag updated');
        } else {
          await createTag({ name, color: selectedColor });
          showSuccess('Tag created');
        }
        overlay?.remove();
        await render();
      } catch (error) {
        console.error('Error saving tag:', error);
        showError(error.message || 'Failed to save tag');
      }
    });

    // Cancel/Close buttons
    [cancelBtn, closeBtn].forEach(btn => {
      btn?.addEventListener('click', () => {
        overlay?.remove();
      });
    });

    // Click outside to close
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Focus name input
    nameInput?.focus();
  }

  function showColorPicker(tagId) {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    showTagForm(tagId);
  }

  async function handleDeleteTag(tagId) {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    const usage = await getTagUsage(tagId);

    if (usage.usageCount > 0) {
      if (!confirm(`Delete tag "${tag.name}"? It's used on ${usage.usageCount} ${usage.usageCount === 1 ? 'task' : 'tasks'} and will be removed from all of them.`)) {
        return;
      }
    } else {
      if (!confirm(`Delete tag "${tag.name}"?`)) {
        return;
      }
    }

    try {
      await deleteTag(tagId);
      showSuccess('Tag deleted');
      await render();
    } catch (error) {
      console.error('Error deleting tag:', error);
      showError('Failed to delete tag');
    }
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

  // Initial render
  await render();

  return {
    render,
  };
}
