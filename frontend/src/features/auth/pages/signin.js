/**
 * Sign In Page (signin.html)
 * User login with role-based redirect
 */

// Import styles
import '@styles/global/global.css';
import '@features/auth/styles/signin.css';

import { authService } from '@services/auth-service.js';
import { router } from '@utils/router.js';
import { validation } from '@utils/validation.js';

// Handle signin form submission
async function handleSigninSubmit(e) {
  e.preventDefault();

  const fieldIds = ['email', 'password'];

  // Clear previous errors
  validation.clearAllErrors(fieldIds);
  document.getElementById('signinError').classList.add('d-none');

  // Get form data
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Validate
  let hasError = false;

  if (!validation.isValidEmail(email)) {
    validation.showFieldError('email', 'Please enter a valid email address');
    hasError = true;
  }

  if (!password) {
    validation.showFieldError('password', 'Password is required');
    hasError = true;
  }

  if (hasError) return;

  // Submit
  const submitBtn = document.getElementById('signinSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing In...';

  try {
    const { session, user } = await authService.signIn(email, password);

    if (!session) {
      throw new Error('Failed to create session');
    }

    // Get user role from metadata
    const role = user.user_metadata?.role || 'user';

    // Redirect to return URL or dashboard
    const returnUrl = router.getReturnUrl();
    window.location.href = returnUrl;
  } catch (error) {
    console.error('Sign in error:', error);
    const errorDiv = document.getElementById('signinError');

    if (error.message.includes('Invalid login credentials')) {
      errorDiv.textContent = 'Invalid email or password';
    } else if (error.message.includes('Email not confirmed')) {
      errorDiv.textContent = 'Please confirm your email address before signing in';
    } else {
      errorDiv.textContent = error.message || 'Failed to sign in';
    }

    errorDiv.classList.remove('d-none');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

// Initialize page
async function init() {
  // Attach form handler
  const form = document.getElementById('signinForm');
  if (form) {
    form.addEventListener('submit', handleSigninSubmit);
  }
}

init();
