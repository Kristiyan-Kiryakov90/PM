/**
 * UI Helper Functions
 * Utilities for showing loading states, errors, and success messages
 */

/**
 * Show loading overlay with spinner
 * @param {string} message - Loading message (optional)
 * @returns {function} Function to hide loading
 */
export function showLoading(message = 'Loading...') {
  // Remove existing overlay if any
  hideLoading();

  const overlay = document.createElement('div');
  overlay.className = 'spinner-overlay';
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div style="text-align: center;">
      <div class="spinner-border"></div>
      <p class="loading-text">${escapeHtml(message)}</p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Return function to hide loading
  return hideLoading;
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Show error alert message
 * @param {string} message - Error message
 * @param {string} containerId - Container to insert alert (default: body)
 * @param {number} timeout - Auto-dismiss timeout in ms (0 = no auto-dismiss)
 */
export function showError(message, containerId = null, timeout = 5000) {
  const alertId = 'alert-' + Date.now();
  const alertHTML = `
    <div class="alert alert-danger alert-dismissible fade show" role="alert" id="${alertId}">
      <div class="alert-content">
        <strong>Error:</strong> ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  const container = containerId ? document.getElementById(containerId) : document.body;
  if (container) {
    container.insertAdjacentHTML('afterbegin', alertHTML);

    if (timeout > 0) {
      setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
          alert.remove();
        }
      }, timeout);
    }
  }
}

/**
 * Show success alert message
 * @param {string} message - Success message
 * @param {string} containerId - Container to insert alert (default: body)
 * @param {number} timeout - Auto-dismiss timeout in ms (0 = no auto-dismiss)
 */
export function showSuccess(message, containerId = null, timeout = 3000) {
  const alertId = 'alert-' + Date.now();
  const alertHTML = `
    <div class="alert alert-success alert-dismissible fade show" role="alert" id="${alertId}">
      <div class="alert-content">
        <strong>Success!</strong> ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  const container = containerId ? document.getElementById(containerId) : document.body;
  if (container) {
    container.insertAdjacentHTML('afterbegin', alertHTML);

    if (timeout > 0) {
      setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
          alert.remove();
        }
      }, timeout);
    }
  }
}

/**
 * Show info alert message
 * @param {string} message - Info message
 * @param {string} containerId - Container to insert alert (default: body)
 * @param {number} timeout - Auto-dismiss timeout in ms (0 = no auto-dismiss)
 */
export function showInfo(message, containerId = null, timeout = 4000) {
  const alertId = 'alert-' + Date.now();
  const alertHTML = `
    <div class="alert alert-info alert-dismissible fade show" role="alert" id="${alertId}">
      <div class="alert-content">
        ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  const container = containerId ? document.getElementById(containerId) : document.body;
  if (container) {
    container.insertAdjacentHTML('afterbegin', alertHTML);

    if (timeout > 0) {
      setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
          alert.remove();
        }
      }, timeout);
    }
  }
}

/**
 * Show warning alert message
 * @param {string} message - Warning message
 * @param {string} containerId - Container to insert alert (default: body)
 * @param {number} timeout - Auto-dismiss timeout in ms (0 = no auto-dismiss)
 */
export function showWarning(message, containerId = null, timeout = 4000) {
  const alertId = 'alert-' + Date.now();
  const alertHTML = `
    <div class="alert alert-warning alert-dismissible fade show" role="alert" id="${alertId}">
      <div class="alert-content">
        <strong>Warning:</strong> ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  const container = containerId ? document.getElementById(containerId) : document.body;
  if (container) {
    container.insertAdjacentHTML('afterbegin', alertHTML);

    if (timeout > 0) {
      setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
          alert.remove();
        }
      }, timeout);
    }
  }
}

/**
 * Clear all alerts
 * @param {string} containerId - Container to clear alerts from (default: whole page)
 */
export function clearAlerts(containerId = null) {
  const container = containerId ? document.getElementById(containerId) : document;
  const alerts = container.querySelectorAll('.alert');
  alerts.forEach((alert) => {
    alert.remove();
  });
}

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @param {function} onConfirm - Callback if user confirms
 * @param {function} onCancel - Callback if user cancels
 */
export function showConfirm(message, onConfirm, onCancel = null) {
  const confirmed = confirm(escapeHtml(message));
  if (confirmed) {
    onConfirm();
  } else if (onCancel) {
    onCancel();
  }
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
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

/**
 * Format form errors for display
 * @param {Object} errors - Object with field names as keys and error messages as values
 * @param {string} containerId - Container to insert errors
 */
export function showFormErrors(errors, containerId = null) {
  if (!errors || Object.keys(errors).length === 0) return;

  const errorMessages = Object.values(errors)
    .flat()
    .map((msg) => `<li>${escapeHtml(msg)}</li>`)
    .join('');

  const alertId = 'alert-' + Date.now();
  const alertHTML = `
    <div class="alert alert-danger alert-dismissible fade show" role="alert" id="${alertId}">
      <strong>Please fix the following errors:</strong>
      <ul class="mb-0 mt-2">
        ${errorMessages}
      </ul>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  const container = containerId ? document.getElementById(containerId) : document.body;
  if (container) {
    container.insertAdjacentHTML('afterbegin', alertHTML);
  }
}

/**
 * Disable button and show loading state
 * @param {HTMLElement|string} button - Button element or selector
 * @param {string} loadingText - Text to show while loading
 */
export function disableButton(button, loadingText = 'Loading...') {
  const btn = typeof button === 'string' ? document.querySelector(button) : button;
  if (!btn) return;

  btn.disabled = true;
  btn.dataset.originalText = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${escapeHtml(loadingText)}`;
}

/**
 * Enable button and restore original state
 * @param {HTMLElement|string} button - Button element or selector
 */
export function enableButton(button) {
  const btn = typeof button === 'string' ? document.querySelector(button) : button;
  if (!btn) return;

  btn.disabled = false;
  if (btn.dataset.originalText) {
    btn.innerHTML = btn.dataset.originalText;
  }
}

/**
 * Add loading skeleton to a container
 * @param {string} containerId - Container element ID
 * @param {number} count - Number of skeleton items to create
 */
export function showSkeleton(containerId, count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let skeletonHTML = '';
  for (let i = 0; i < count; i++) {
    skeletonHTML += `
      <div class="skeleton-item" style="margin-bottom: 1rem;">
        <div class="skeleton-line" style="width: 100%; height: 1rem; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; margin-bottom: 0.5rem; border-radius: 4px;"></div>
        <div class="skeleton-line" style="width: 80%; height: 0.75rem; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; border-radius: 4px;"></div>
      </div>
    `;
  }

  container.innerHTML = skeletonHTML;

  // Add animation style if not exists
  if (!document.querySelector('style[data-skeleton]')) {
    const style = document.createElement('style');
    style.setAttribute('data-skeleton', 'true');
    style.textContent = `
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Remove skeleton loading state
 * @param {string} containerId - Container element ID
 */
export function hideSkeleton(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}
