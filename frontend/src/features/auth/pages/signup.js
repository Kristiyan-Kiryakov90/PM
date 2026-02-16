/**
 * Sign Up Page (signup.html)
 * User registration with optional company creation
 */

import supabase from '@services/supabase.js';
import { validation } from '@utils/validation.js';

// Handle signup form submission
async function handleSignupSubmit(e) {
  e.preventDefault();

  const fieldIds = [
    'companyName',
    'firstName',
    'lastName',
    'email',
    'password',
    'confirmPassword',
  ];

  // Clear previous errors
  validation.clearAllErrors(fieldIds);
  document.getElementById('signupError').classList.add('d-none');
  document.getElementById('signupSuccess').classList.add('d-none');

  // Get form data
  const companyName = document.getElementById('companyName').value.trim();
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validate
  let hasError = false;

  // Company name is OPTIONAL - no validation needed

  const firstNameValidation = validation.isRequired(firstName, 'First name');
  if (!firstNameValidation.valid) {
    validation.showFieldError('firstName', firstNameValidation.message);
    hasError = true;
  }

  const lastNameValidation = validation.isRequired(lastName, 'Last name');
  if (!lastNameValidation.valid) {
    validation.showFieldError('lastName', lastNameValidation.message);
    hasError = true;
  }

  if (!validation.isValidEmail(email)) {
    validation.showFieldError('email', 'Please enter a valid email address');
    hasError = true;
  }

  const passwordValidation = validation.isValidPassword(password);
  if (!passwordValidation.valid) {
    validation.showFieldError('password', passwordValidation.message);
    hasError = true;
  }

  if (password !== confirmPassword) {
    validation.showFieldError('confirmPassword', 'Passwords do not match');
    hasError = true;
  }

  if (hasError) return;

  // Submit
  const submitBtn = document.getElementById('signupSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Account...';

  try {
    // Step 1: Check company and create if needed
    const { data: companyData, error: companyError } = await supabase
      .rpc('signup_with_optional_company', {
        p_company_name: companyName || null,
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName
      });

    if (companyError) {
      throw new Error(companyError.message);
    }

    // Step 2: Sign up user with validated company data
    // Note: Metadata is used by trigger to create profile
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          company_id: companyData.company_id,
          role: companyData.role
        }
      }
    });

    if (signupError) {
      // Rollback: delete company if it was created
      if (companyData.company_id) {
        await supabase.rpc('rollback_company_creation', {
          p_company_id: companyData.company_id
        });
      }
      throw new Error(signupError.message);
    }

    // Step 3: Verify profile was created by trigger
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.warn('Profile not created by trigger, creating manually...');
      // Fallback: create profile manually
      const { error: manualProfileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          company_id: companyData.company_id,
          role: companyData.role
        });

      if (manualProfileError && !manualProfileError.message.includes('duplicate')) {
        throw new Error('Failed to create profile: ' + manualProfileError.message);
      }
    }

    // Success
    const successDiv = document.getElementById('signupSuccess');
    successDiv.textContent =
      companyData.message + '. Please check your email to confirm your account.';
    successDiv.classList.remove('d-none');

    // Clear form
    document.getElementById('signupForm').reset();

    // Redirect to sign in after 3 seconds
    setTimeout(() => {
      window.location.href = '/public/signin.html';
    }, 3000);
  } catch (error) {
    console.error('Signup error:', error);
    const errorDiv = document.getElementById('signupError');
    errorDiv.textContent = error.message || 'Failed to create account';
    errorDiv.classList.remove('d-none');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
}

// Initialize page
async function init() {
  // Attach form handler
  const form = document.getElementById('signupForm');
  if (form) {
    form.addEventListener('submit', handleSignupSubmit);
  }
}

init();
