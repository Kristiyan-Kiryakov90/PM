/**
 * Landing Page (index.html)
 * Bootstrap modal for first sys_admin creation
 */

import { Modal } from 'bootstrap';
import supabase from '@services/supabase.js';
import { sysAdminExists, bootstrapSysAdmin } from '@services/auth-service.js';
import { redirectIfAuthenticated } from '@utils/router.js';
import {
  isValidEmail,
  isValidPassword,
  isRequired,
  showFieldError,
  clearAllErrors,
} from '@utils/validation.js';

let bootstrapModal;

// Check if should show bootstrap modal
async function checkBootstrap() {
  const adminExists = await sysAdminExists();

  if (!adminExists) {
    const modalElement = document.getElementById('bootstrapModal');
    bootstrapModal = new Modal(modalElement);
    bootstrapModal.show();
  }
}

// Handle bootstrap form submission
async function handleBootstrapSubmit(e) {
  e.preventDefault();

  const fieldIds = [
    'bootstrapCompanyName',
    'bootstrapFirstName',
    'bootstrapLastName',
    'bootstrapEmail',
    'bootstrapPassword',
    'bootstrapConfirmPassword',
  ];

  // Clear previous errors
  clearAllErrors(fieldIds);
  document.getElementById('bootstrapError').classList.add('d-none');

  // Get form data
  const companyName = document.getElementById('bootstrapCompanyName').value.trim();
  const firstName = document.getElementById('bootstrapFirstName').value.trim();
  const lastName = document.getElementById('bootstrapLastName').value.trim();
  const email = document.getElementById('bootstrapEmail').value.trim();
  const password = document.getElementById('bootstrapPassword').value;
  const confirmPassword = document.getElementById('bootstrapConfirmPassword').value;

  // Validate
  let hasError = false;

  // Company name is optional

  const firstNameValidation = isRequired(firstName, 'First name');
  if (!firstNameValidation.valid) {
    showFieldError('bootstrapFirstName', firstNameValidation.message);
    hasError = true;
  }

  const lastNameValidation = isRequired(lastName, 'Last name');
  if (!lastNameValidation.valid) {
    showFieldError('bootstrapLastName', lastNameValidation.message);
    hasError = true;
  }

  if (!isValidEmail(email)) {
    showFieldError('bootstrapEmail', 'Please enter a valid email address');
    hasError = true;
  }

  const passwordValidation = isValidPassword(password);
  if (!passwordValidation.valid) {
    showFieldError('bootstrapPassword', passwordValidation.message);
    hasError = true;
  }

  if (password !== confirmPassword) {
    showFieldError('bootstrapConfirmPassword', 'Passwords do not match');
    hasError = true;
  }

  if (hasError) return;

  // Submit
  const submitBtn = document.getElementById('bootstrapSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    await bootstrapSysAdmin({
      companyName,
      email,
      password,
      firstName,
      lastName,
    });

    // Success - redirect to admin panel
    window.location.href = '/public/admin.html';
  } catch (error) {
    console.error('Bootstrap error:', error);
    const errorDiv = document.getElementById('bootstrapError');
    errorDiv.textContent = error.message || 'Failed to create system admin';
    errorDiv.classList.remove('d-none');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create System Admin';
  }
}

// Initialize page
async function init() {
  try {
    console.log('=== INDEX PAGE INIT ===');

    // Wait for session to be restored from storage
    console.log('Waiting for auth session to be restored...');
    let currentUser = null;
    await new Promise((resolve) => {
      let isResolved = false;
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, 'User:', session?.user?.email);
        if (!isResolved && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
          currentUser = session?.user || null; // Capture user from session
          isResolved = true;
          data.subscription.unsubscribe();
          resolve();
        }
      });
      // Timeout fallback in case auth doesn't emit
      setTimeout(() => {
        if (!isResolved) {
          console.log('Auth state change timeout, resolving anyway');
          isResolved = true;
          data.subscription.unsubscribe();
          resolve();
        }
      }, 1000);
    });

    console.log('Session restored. Current user:', currentUser?.email);

    console.log('Index page: showing landing page (no auto-redirect)');
    // Check if bootstrap modal needed
    await checkBootstrap();

    // Attach form handler
    const form = document.getElementById('bootstrapForm');
    if (form) {
      form.addEventListener('submit', handleBootstrapSubmit);
      console.log('Bootstrap form handler attached');
    }
  } catch (error) {
    console.error('Init error:', error);
  }
}

// Import getUserMetadata
import { getUserMetadata } from '@utils/auth.js';

init();
