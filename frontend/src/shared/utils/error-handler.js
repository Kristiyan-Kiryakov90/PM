/**
 * Centralized Error Handler
 * Maps errors to user-friendly messages
 */

import { uiHelpers } from './ui-helpers.js';

export const errorHandler = {
  /**
   * Handle errors from Supabase and other sources
   * @param {Error|Object} error - Error object
   * @param {Object} context - Additional context about where error occurred
   * @returns {Object} User-friendly error message and details
   */
  handleError(error, context = {}) {
    const { containerId = null, showAlert = true, logError = true } = context;

    // Log error for debugging
    if (logError) {
      console.error('Error:', error, 'Context:', context);
    }

    // Map error to user-friendly message
    const errorMessage = this.mapErrorToMessage(error);

    // Show alert if requested
    if (showAlert && errorMessage.userMessage) {
      uiHelpers.showError(errorMessage.userMessage, containerId);
    }

    return errorMessage;
  },

  /**
   * Map error to user-friendly message
   * @param {Error|Object} error - Error object from various sources
   * @returns {Object} { userMessage, technicalMessage, code }
   */
  mapErrorToMessage(error) {
    if (!error) {
      return {
        userMessage: 'An unknown error occurred. Please try again.',
        technicalMessage: 'Unknown error',
        code: 'UNKNOWN_ERROR',
      };
    }

    const errorStr = String(error);
    const errorCode = error?.code;
    const status = error?.status;

    // Supabase Auth Errors
    if (errorCode === 'INVALID_CREDENTIALS') {
      return {
        userMessage: 'Invalid email or password. Please try again.',
        technicalMessage: errorStr,
        code: 'AUTH_INVALID_CREDENTIALS',
      };
    }

    if (errorCode === 'USER_NOT_FOUND') {
      return {
        userMessage: 'No account found with this email address.',
        technicalMessage: errorStr,
        code: 'AUTH_USER_NOT_FOUND',
      };
    }

    if (errorCode === 'EMAIL_CONFLICT') {
      return {
        userMessage: 'This email address is already registered.',
        technicalMessage: errorStr,
        code: 'AUTH_EMAIL_CONFLICT',
      };
    }

    if (errorCode === 'WEAK_PASSWORD') {
      return {
        userMessage: 'Password must be at least 8 characters with uppercase, lowercase, and number.',
        technicalMessage: errorStr,
        code: 'AUTH_WEAK_PASSWORD',
      };
    }

    if (errorCode === 'INVALID_PHONE') {
      return {
        userMessage: 'Please enter a valid phone number.',
        technicalMessage: errorStr,
        code: 'AUTH_INVALID_PHONE',
      };
    }

    if (errorCode === 'RATE_LIMIT_EXCEEDED') {
      return {
        userMessage: 'Too many attempts. Please try again later.',
        technicalMessage: errorStr,
        code: 'AUTH_RATE_LIMIT',
      };
    }

    if (
      errorStr.includes('failed to fetch') ||
      errorStr.includes('network error') ||
      errorStr.includes('fetch failed')
    ) {
      return {
        userMessage: 'Network error. Please check your connection and try again.',
        technicalMessage: errorStr,
        code: 'NETWORK_ERROR',
      };
    }

    // PostgreSQL / Database Errors
    if (errorCode === '23505') {
      return {
        userMessage: 'This record already exists. Please use a different value.',
        technicalMessage: 'Unique constraint violation: ' + errorStr,
        code: 'DB_UNIQUE_VIOLATION',
      };
    }

    if (errorCode === '23502') {
      return {
        userMessage: 'Missing required information. Please fill in all fields.',
        technicalMessage: 'Not null constraint violation: ' + errorStr,
        code: 'DB_NOT_NULL_VIOLATION',
      };
    }

    if (errorCode === '23503') {
      return {
        userMessage: 'This record cannot be deleted because it is referenced by other records.',
        technicalMessage: 'Foreign key violation: ' + errorStr,
        code: 'DB_FOREIGN_KEY_VIOLATION',
      };
    }

    if (errorCode === '42P01') {
      return {
        userMessage: 'A database error occurred. Please contact support.',
        technicalMessage: 'Undefined table: ' + errorStr,
        code: 'DB_TABLE_NOT_FOUND',
      };
    }

    // HTTP Status Errors
    if (status === 401) {
      return {
        userMessage: 'Your session has expired. Please sign in again.',
        technicalMessage: 'Unauthorized: ' + errorStr,
        code: 'HTTP_401_UNAUTHORIZED',
      };
    }

    if (status === 403) {
      return {
        userMessage: 'You do not have permission to perform this action.',
        technicalMessage: 'Forbidden: ' + errorStr,
        code: 'HTTP_403_FORBIDDEN',
      };
    }

    if (status === 404) {
      return {
        userMessage: 'The requested item was not found.',
        technicalMessage: 'Not found: ' + errorStr,
        code: 'HTTP_404_NOT_FOUND',
      };
    }

    if (status === 409) {
      return {
        userMessage: 'This action conflicts with existing data. Please refresh and try again.',
        technicalMessage: 'Conflict: ' + errorStr,
        code: 'HTTP_409_CONFLICT',
      };
    }

    if (status === 422) {
      return {
        userMessage: 'The submitted data is invalid. Please check your inputs.',
        technicalMessage: 'Unprocessable entity: ' + errorStr,
        code: 'HTTP_422_UNPROCESSABLE',
      };
    }

    if (status === 429) {
      return {
        userMessage: 'Too many requests. Please wait a moment and try again.',
        technicalMessage: 'Rate limited: ' + errorStr,
        code: 'HTTP_429_RATE_LIMIT',
      };
    }

    if (status >= 500) {
      return {
        userMessage:
          'A server error occurred. Our team has been notified. Please try again in a moment.',
        technicalMessage: `Server error ${status}: ${errorStr}`,
        code: 'HTTP_500_SERVER_ERROR',
      };
    }

    // Custom application errors
    if (error.message) {
      // Check for common application error patterns
      if (error.message.includes('Company') || error.message.includes('company')) {
        return {
          userMessage: 'There was an issue with the company data. Please contact support.',
          technicalMessage: error.message,
          code: 'APP_COMPANY_ERROR',
        };
      }

      if (error.message.includes('Permission') || error.message.includes('permission')) {
        return {
          userMessage: 'You do not have permission to perform this action.',
          technicalMessage: error.message,
          code: 'APP_PERMISSION_ERROR',
        };
      }

      if (error.message.includes('Validation') || error.message.includes('validation')) {
        return {
          userMessage: 'Please check your input and try again.',
          technicalMessage: error.message,
          code: 'APP_VALIDATION_ERROR',
        };
      }

      // Return the actual error message as fallback
      return {
        userMessage: error.message,
        technicalMessage: error.message,
        code: 'APP_CUSTOM_ERROR',
      };
    }

    // Final fallback
    return {
      userMessage: 'Something went wrong. Please try again.',
      technicalMessage: errorStr,
      code: 'GENERIC_ERROR',
    };
  },

  /**
   * Create an error object with user-friendly message
   * @param {string} message - User-friendly message
   * @param {string} code - Error code
   * @param {Object} details - Additional details
   * @returns {Error} Error object with message property
   */
  createError(message, code = 'CUSTOM_ERROR', details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
  },

  /**
   * Validate required fields
   * @param {Object} data - Object to validate
   * @param {string[]} requiredFields - Array of field names
   * @returns {Object} Validation errors or empty object
   */
  validateRequired(data, requiredFields) {
    const errors = {};

    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        const fieldLabel = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        errors[field] = `${fieldLabel} is required`;
      }
    }

    return errors;
  },

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} { isValid, errors }
   */
  validatePassword(password) {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain an uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain a lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain a number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Log error to console in development
   * @param {string} context - Context message
   * @param {Error} error - Error object
   */
  logError(context, error) {
    if (process.env.NODE_ENV === 'development') {
      console.group(`❌ ${context}`);
      console.error('Error:', error);
      console.trace();
      console.groupEnd();
    }
  },
};

