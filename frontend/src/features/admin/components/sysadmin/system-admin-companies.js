/**
 * System Admin - Company Management
 * UI, forms, and CRUD operations for company management
 */

import { Modal } from 'bootstrap';
import supabase from '@services/supabase.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { escapeHtml } from './system-admin-shared.js';

/**
 * Render companies tab content
 */
export function renderCompaniesTab(allCompanies) {
  return `
    <div class="system-admin-header mb-4">
      <button class="btn btn-primary" id="createCompanyBtn">
        ➕ Create Company
      </button>
    </div>

    ${allCompanies.length === 0 ? `
      <div class="text-center text-muted py-4">
        <p>No companies yet.</p>
      </div>
    ` : `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Users</th>
              <th>Projects</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allCompanies.map(company => renderCompanyRow(company)).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/**
 * Render single company row
 */
function renderCompanyRow(company) {
  return `
    <tr data-company-id="${company.id}">
      <td>${escapeHtml(company.name)}</td>
      <td>${company.user_count || 0}</td>
      <td>${company.project_count || 0}</td>
      <td>${new Date(company.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-company" data-company-id="${company.id}" title="Edit">
          ✏️
        </button>
        <button class="btn btn-sm btn-outline-danger delete-company" data-company-id="${company.id}" title="Delete">
          🗑️
        </button>
      </td>
    </tr>
  `;
}

/**
 * Show company form modal (create/edit)
 */
export function showCompanyForm(companyId, allCompanies, onSave) {
  const company = companyId ? allCompanies.find(c => c.id === parseInt(companyId)) : null;
  const isEditing = !!company;

  const modalHtml = `
    <div class="modal fade" id="companyFormModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEditing ? 'Edit Company' : 'Create Company'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Company Name *</label>
              <input type="text" class="form-control" id="companyNameInput" value="${escapeHtml(company?.name || '')}" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveCompanyBtn">${isEditing ? 'Update' : 'Create'} Company</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  setupCompanyFormListeners(company, companyId, onSave);
}

/**
 * Setup company form event listeners
 */
function setupCompanyFormListeners(existingCompany, companyId, onSave) {
  const modalElement = document.getElementById('companyFormModal');
  const nameInput = document.getElementById('companyNameInput');
  const saveBtn = document.getElementById('saveCompanyBtn');

  const modal = new Modal(modalElement);
  modal.show();

  modalElement.addEventListener('hidden.bs.modal', () => {
    modalElement.remove();
  });

  saveBtn?.addEventListener('click', async () => {
    const name = nameInput?.value.trim();

    if (!name) {
      uiHelpers.showError('Company name is required');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = existingCompany ? 'Updating...' : 'Creating...';

    try {
      if (!existingCompany) {
        await createCompany({ name });
        uiHelpers.showSuccess('Company created successfully');
      } else {
        await updateCompany(companyId, { name });
        uiHelpers.showSuccess('Company updated successfully');
      }

      modal.hide();
      if (onSave) await onSave();
    } catch (error) {
      console.error('Error saving company:', error);
      uiHelpers.showError(error.message || 'Failed to save company');
      saveBtn.disabled = false;
      saveBtn.textContent = existingCompany ? 'Update Company' : 'Create Company';
    }
  });
}

/**
 * Handle delete company
 */
export async function handleDeleteCompany(companyId, allCompanies, onDelete) {
  const company = allCompanies.find(c => c.id === parseInt(companyId));
  if (!company) return;

  if (!confirm(`Delete company "${company.name}"?\n\nWarning: This will affect ${company.user_count || 0} users and ${company.project_count || 0} projects.\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await deleteCompany(companyId);
    uiHelpers.showSuccess('Company deleted successfully');
    if (onDelete) await onDelete();
  } catch (error) {
    console.error('Error deleting company:', error);
    uiHelpers.showError(error.message || 'Failed to delete company');
  }
}

/**
 * API: Create company
 */
async function createCompany({ name }) {
  const { error } = await supabase
    .from('companies')
    .insert({ name });

  if (error) throw error;
}

/**
 * API: Update company
 */
async function updateCompany(companyId, { name }) {
  const { error } = await supabase
    .from('companies')
    .update({ name })
    .eq('id', companyId);

  if (error) throw error;
}

/**
 * API: Delete company
 */
async function deleteCompany(companyId) {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId);

  if (error) throw error;
}
