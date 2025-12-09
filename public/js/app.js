/**
 * Super Stream - Client-side Application JavaScript
 * Common utilities and helpers for all pages
 */

// Get CSRF token from meta tag
function getCsrfToken() {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : null;
}

// Setup CSRF token for all fetch requests
function setupCsrfToken() {
  const csrfToken = getCsrfToken();
  
  // Override fetch to automatically include CSRF token
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    // Only add CSRF token for same-origin requests
    if (!url.startsWith('http') || url.startsWith(window.location.origin)) {
      // Add CSRF token for non-GET requests
      const method = (options.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && csrfToken) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
          options.headers.set('CSRF-Token', csrfToken);
        } else {
          options.headers['CSRF-Token'] = csrfToken;
        }
      }
    }
    return originalFetch(url, options);
  };
}

// Initialize CSRF protection on page load
document.addEventListener('DOMContentLoaded', function() {
  setupCsrfToken();
  
  // Add CSRF token to all forms automatically
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      // Skip forms that already have a CSRF token
      if (!form.querySelector('input[name="_csrf"]')) {
        const method = (form.method || 'GET').toUpperCase();
        // Only add to non-GET forms
        if (method !== 'GET') {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = '_csrf';
          input.value = csrfToken;
          form.appendChild(input);
        }
      }
    });
  }
});

// Debounce function for search/filter inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Format numbers for display
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Format duration in seconds to HH:MM:SS or MM:SS
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format file size in bytes to human-readable format
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy to clipboard', 'error');
    return false;
  }
}

// Confirm action with custom message
function confirmAction(message, callback) {
  if (confirm(message)) {
    callback();
  }
}

// Handle API errors consistently
function handleApiError(error, defaultMessage = 'An error occurred') {
  console.error('API Error:', error);
  const message = error.message || error.error || defaultMessage;
  showToast(message, 'error');
}

// Make fetch request with error handling
async function fetchWithErrorHandling(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

// Initialize tooltips (Bootstrap 5)
function initializeTooltips() {
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Initialize popovers (Bootstrap 5)
function initializePopovers() {
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeTooltips();
  initializePopovers();
  
  // Add smooth scroll behavior
  document.documentElement.style.scrollBehavior = 'smooth';
  
  // Handle back button navigation
  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      hideLoading();
    }
  });
});

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debounce,
    formatNumber,
    formatDuration,
    formatFileSize,
    copyToClipboard,
    confirmAction,
    handleApiError,
    fetchWithErrorHandling,
    initializeTooltips,
    initializePopovers
  };
}
