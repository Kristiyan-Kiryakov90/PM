/**
 * Landing Page - Forms
 * Bootstrap sys_admin creation modal form
 */

import { Modal } from 'bootstrap';
import { authService } from '@services/auth-service.js';
import { validation } from '@utils/validation.js';

let bootstrapModal;

// Check if should show bootstrap modal
export async function checkBootstrap() {
  const adminExists = await authService.sysAdminExists();

  if (!adminExists) {
    const modalElement = document.getElementById('bootstrapModal');
    bootstrapModal = new Modal(modalElement);
    bootstrapModal.show();
  }
}

// Handle bootstrap form submission
export async function handleBootstrapSubmit(e) {
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
  validation.clearAllErrors(fieldIds);
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

  const firstNameValidation = validation.isRequired(firstName, 'First name');
  if (!firstNameValidation.valid) {
    validation.showFieldError('bootstrapFirstName', firstNameValidation.message);
    hasError = true;
  }

  const lastNameValidation = validation.isRequired(lastName, 'Last name');
  if (!lastNameValidation.valid) {
    validation.showFieldError('bootstrapLastName', lastNameValidation.message);
    hasError = true;
  }

  if (!validation.isValidEmail(email)) {
    validation.showFieldError('bootstrapEmail', 'Please enter a valid email address');
    hasError = true;
  }

  const passwordValidation = validation.isValidPassword(password);
  if (!passwordValidation.valid) {
    validation.showFieldError('bootstrapPassword', passwordValidation.message);
    hasError = true;
  }

  if (password !== confirmPassword) {
    validation.showFieldError('bootstrapConfirmPassword', 'Passwords do not match');
    hasError = true;
  }

  if (hasError) return;

  // Submit
  const submitBtn = document.getElementById('bootstrapSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    await authService.bootstrapSysAdmin({
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

// Setup bootstrap form event listener
export function setupBootstrapForm() {
  const form = document.getElementById('bootstrapForm');
  if (form) {
    form.addEventListener('submit', handleBootstrapSubmit);
    console.log('Bootstrap form handler attached');
  }
}
