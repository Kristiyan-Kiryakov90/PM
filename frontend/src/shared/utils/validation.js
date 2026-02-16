/**
 * Input Validation Utilities
 * Helper functions for form validation
 */

export const validation = {
  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   * @param {string} password
   * @returns {Object} { valid: boolean, message: string }
   */
  isValidPassword(password) {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }

    return { valid: true, message: '' };
  },

  /**
   * Validate required field
   * @param {string} value
   * @param {string} fieldName
   * @returns {Object} { valid: boolean, message: string }
   */
  isRequired(value, fieldName = 'This field') {
    if (!value || value.trim() === '') {
      return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true, message: '' };
  },

  /**
   * Validate form data
   * @param {Object} formData - Form field values
   * @param {Object} rules - Validation rules
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validateForm(formData, rules) {
    const errors = {};
    let valid = true;

    for (const field in rules) {
      const value = formData[field];
      const fieldRules = rules[field];

      for (const rule of fieldRules) {
        const result = rule(value);
        if (!result.valid) {
          errors[field] = result.message;
          valid = false;
          break;
        }
      }
    }

    return { valid, errors };
  },

  /**
   * Show validation error in UI
   * @param {string} fieldId - Input field ID
   * @param {string} message - Error message
   */
  showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.add('is-invalid');

    let feedback = field.nextElementSibling;
    if (!feedback || !feedback.classList.contains('invalid-feedback')) {
      feedback = document.createElement('div');
      feedback.classList.add('invalid-feedback');
      field.parentNode.appendChild(feedback);
    }

    feedback.textContent = message;
  },

  /**
   * Clear field validation error
   * @param {string} fieldId - Input field ID
   */
  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove('is-invalid');

    const feedback = field.nextElementSibling;
    if (feedback && feedback.classList.contains('invalid-feedback')) {
      feedback.remove();
    }
  },

  /**
   * Clear all validation errors
   * @param {string[]} fieldIds - Array of field IDs
   */
  clearAllErrors(fieldIds) {
    fieldIds.forEach((id) => this.clearFieldError(id));
  },

  /**
   * Show multiple field errors
   * @param {Object} errors - Object with field IDs as keys and error messages as values
   */
  showErrors(errors) {
    for (const fieldId in errors) {
      this.showFieldError(fieldId, errors[fieldId]);
    }
  },
};

