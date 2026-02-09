/**
 * Admin Page (admin.html)
 * Company admin functions: manage users, view company settings
 */

import { Modal } from 'bootstrap';
import supabase from '@services/supabase.js';
import { requireAdmin, getUserMetadata } from '@utils/auth.js';

// State
let currentCompanyId = null;
let currentUserRole = null;

/**
 * Initialize admin page
 */
async function init() {
  // Ensure user is admin
  await requireAdmin();

  // Get user metadata
  const metadata = await getUserMetadata();
  currentCompanyId = metadata.company_id;
  currentUserRole = metadata.role;

  // Check if user has a company
  if (!currentCompanyId) {
    showError('You must create a company before accessing admin features.');
    window.location.href = '/public/dashboard.html';
    return;
  }

  // Load company users
  await loadCompanyUsers();

  // Attach event listeners
  attachEventListeners();
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) {
    createUserForm.addEventListener('submit', handleCreateUser);
  }

  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', showCreateUserModal);
  }
}

/**
 * Load company users from profiles table
 */
async function loadCompanyUsers() {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        id,
        role,
        created_at
      `)
      .eq('company_id', currentCompanyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get auth.users data for email and name
    const userIds = profiles.map(p => p.id);
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Failed to fetch user details:', usersError);
    }

    // Merge profiles with auth.users data
    const usersWithDetails = profiles.map(profile => {
      const authUser = users?.find(u => u.id === profile.id);
      return {
        id: profile.id,
        email: authUser?.email || 'Unknown',
        first_name: authUser?.user_metadata?.first_name || '',
        last_name: authUser?.user_metadata?.last_name || '',
        role: profile.role,
        created_at: profile.created_at,
      };
    });

    renderUserTable(usersWithDetails);

  } catch (error) {
    console.error('Failed to load users:', error);
    showError('Failed to load company users: ' + error.message);
  }
}

/**
 * Render user table
 */
function renderUserTable(users) {
  const tbody = document.querySelector('#usersTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">
          No users yet. Create your first team member.
        </td>
      </tr>
    `;
    return;
  }

  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</td>
      <td>
        <span class="badge ${user.role === 'admin' ? 'bg-primary' : 'bg-secondary'}">
          ${escapeHtml(user.role)}
        </span>
      </td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
    `;
    tbody.appendChild(row);
  });
}

/**
 * Show create user modal
 */
function showCreateUserModal() {
  const modal = document.getElementById('createUserModal');
  if (modal) {
    // Use Bootstrap modal or custom modal logic
    const bsModal = new Modal(modal);
    bsModal.show();
  }
}

/**
 * Handle create user form submission
 * Calls Edge Function with service role
 */
async function handleCreateUser(e) {
  e.preventDefault();

  const email = document.getElementById('newUserEmail').value.trim();
  const firstName = document.getElementById('newUserFirstName').value.trim();
  const lastName = document.getElementById('newUserLastName').value.trim();
  const role = document.getElementById('newUserRole').value;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    // Call Edge Function (uses service role internally)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role
      }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Failed to create user');
    }

    // Success!
    showSuccess(
      `User created successfully!\n\n` +
      `Email: ${data.user.email}\n` +
      `Temporary Password: ${data.user.temp_password}\n\n` +
      `⚠️ Share this password securely with the user.`
    );

    // Reload user list
    await loadCompanyUsers();

    // Reset form
    document.getElementById('createUserForm').reset();

    // Close modal
    const modal = Modal.getInstance(document.getElementById('createUserModal'));
    if (modal) modal.hide();

  } catch (error) {
    console.error('Failed to create user:', error);
    showError('Failed to create user: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create User';
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('adminError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
    setTimeout(() => errorDiv.classList.add('d-none'), 5000);
  } else {
    alert('Error: ' + message);
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successDiv = document.getElementById('adminSuccess');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.classList.remove('d-none');
    setTimeout(() => successDiv.classList.add('d-none'), 10000);
  } else {
    alert(message);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on page load
init();
