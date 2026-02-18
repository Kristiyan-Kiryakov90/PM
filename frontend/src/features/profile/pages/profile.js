/**
 * Profile Page (profile.html)
 * User profile management: update info, change password, delete account
 */

// Import styles
import '@styles/global/global.css';
import '@styles/shared/navbar.css';
import '@styles/shared/notifications.css';
import '@styles/shared/profile.css';

import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { profileService } from '@services/profile-service.js';
import supabase from '@services/supabase.js';

let currentUserEmail = '';

async function init() {
  try {
    // Ensure user is authenticated
    await router.requireAuth();

    // Render navbar
    await renderNavbar();

    // Load user profile data
    await loadProfileData();

    // Setup tab switching
    setupTabs();

    // Setup form submissions
    setupForms();

    // Setup delete account button
    setupDeleteAccount();
  } catch (error) {
    console.error('Profile page initialization error:', error);
    uiHelpers.showError('Failed to load profile. Please refresh the page.');
  }
}

async function loadProfileData() {
  try {
    const metadata = await authUtils.getUserMetadata();
    const fullName = await authUtils.getUserFullName();

    // Store email for delete confirmation
    currentUserEmail = metadata.email || '';

    // Populate form fields
    document.getElementById('firstName').value = metadata.first_name || '';
    document.getElementById('lastName').value = metadata.last_name || '';
    document.getElementById('email').value = currentUserEmail;
    document.getElementById('roleText').textContent = metadata.role || 'user';

    // Update avatar
    const initials = fullName
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
    document.getElementById('profileAvatarBig').textContent = initials;
  } catch (error) {
    console.error('Error loading profile data:', error);
    uiHelpers.showError('Failed to load profile information.');
  }
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.profile-tab-btn');
  const tabContents = document.querySelectorAll('.profile-tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');

      // Remove active from all buttons and contents
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      // Add active to clicked button and corresponding content
      btn.classList.add('active');
      document.getElementById(tabName + '-tab').classList.add('active');
    });
  });
}

function setupForms() {
  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('passwordForm');

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleProfileUpdate();
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handlePasswordChange();
    });
  }
}

async function handleProfileUpdate() {
  const submitBtn = document.querySelector('#profileForm button[type="submit"]');

  try {
    uiHelpers.disableButton(submitBtn, 'Saving...');

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();

    await profileService.updateProfile({
      first_name: firstName,
      last_name: lastName,
    });

    uiHelpers.showSuccess('Profile updated successfully');

    // Reload profile data to refresh UI
    await loadProfileData();
  } catch (error) {
    console.error('Error updating profile:', error);
    uiHelpers.showError(error.message || 'Failed to update profile');
  } finally {
    uiHelpers.enableButton(submitBtn);
  }
}

async function handlePasswordChange() {
  const submitBtn = document.querySelector('#passwordForm button[type="submit"]');

  try {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      uiHelpers.showError('New password and confirmation do not match');
      return;
    }

    uiHelpers.disableButton(submitBtn, 'Updating...');

    await profileService.changePassword(newPassword);

    uiHelpers.showSuccess('Password changed successfully');

    // Clear form
    document.getElementById('passwordForm').reset();
  } catch (error) {
    console.error('Error changing password:', error);
    uiHelpers.showError(error.message || 'Failed to change password');
  } finally {
    uiHelpers.enableButton(submitBtn);
  }
}

function setupDeleteAccount() {
  const deleteBtn = document.getElementById('deleteAccountBtn');

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      await handleDeleteAccount();
    });
  }
}

async function handleDeleteAccount() {
  // First confirmation
  const confirmed = confirm(
    '⚠️ WARNING: This action cannot be undone!\n\n' +
    'Are you absolutely sure you want to permanently delete your account?\n\n' +
    'All your projects, tasks, comments, and data will be lost forever.\n\n' +
    'Click OK to proceed with account deletion.'
  );

  if (!confirmed) {
    return;
  }

  // Second confirmation with email verification
  const emailConfirmation = prompt(
    `To confirm deletion, please type your email address:\n${currentUserEmail}`
  );

  if (!emailConfirmation) {
    uiHelpers.showInfo('Account deletion cancelled');
    return;
  }

  if (emailConfirmation.trim() !== currentUserEmail) {
    uiHelpers.showError('Email confirmation does not match. Account deletion cancelled.');
    return;
  }

  const deleteBtn = document.getElementById('deleteAccountBtn');
  uiHelpers.disableButton(deleteBtn, 'Deleting Account...');

  try {
    // Call edge function to delete account
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const response = await fetch(
      `${supabase.supabaseUrl}/functions/v1/delete-own-account`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabase.supabaseKey,
        },
        body: JSON.stringify({
          confirmEmail: currentUserEmail,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to delete account');
    }

    // Account deleted successfully - sign out and redirect
    uiHelpers.showSuccess('Your account has been permanently deleted. Goodbye!');

    // Wait a moment for user to see the message
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Sign out
    await supabase.auth.signOut();

    // Redirect to landing page
    window.location.href = '/index.html';
  } catch (error) {
    console.error('Error deleting account:', error);
    uiHelpers.showError(error.message || 'Failed to delete account');
    uiHelpers.enableButton(deleteBtn);
  }
}

init();
