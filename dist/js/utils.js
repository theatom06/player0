/**
 * ============================================
 * Utility Functions Module
 * ============================================
 * 
 * Common helper functions used throughout the application:
 * - Time formatting
 * - HTML escaping for XSS prevention
 * - Debounce for search optimization
 * - Lazy loading for images
 * 
 * @module utils
 */

/**
 * Format seconds into MM:SS display format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "3:45")
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS attacks
 * Converts special characters to HTML entities
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function to limit execution rate
 * Useful for search input to avoid excessive API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
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

/**
 * Lazy loading observer for images
 * Uses IntersectionObserver for efficient viewport-based loading
 */
let lazyLoadObserver = null;

/**
 * Initialize lazy loading for images
 * Call once on app startup
 */
function initLazyLoading() {
  if (lazyLoadObserver) return;
  
  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without IntersectionObserver
    console.log('IntersectionObserver not supported, loading all images immediately');
    return;
  }
  
  lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          img.classList.remove('lazy');
          img.classList.add('loaded');
        }
        
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '100px 0px', // Start loading 100px before entering viewport
    threshold: 0.01
  });
}

/**
 * Observe an image element for lazy loading
 * @param {HTMLImageElement} img - Image element to observe
 */
function observeLazyImage(img) {
  if (!lazyLoadObserver) {
    // If observer not available, load immediately
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
    return;
  }
  
  lazyLoadObserver.observe(img);
}

/**
 * Setup lazy loading for all images with data-src attribute in a container
 * @param {HTMLElement} container - Container element to search for lazy images
 */
function setupLazyImages(container = document) {
  const lazyImages = container.querySelectorAll('img[data-src]');
  lazyImages.forEach(img => observeLazyImage(img));
}

/**
 * Create a lazy-loadable image element
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text
 * @param {string} className - CSS class name
 * @returns {string} HTML string for lazy image
 */
function lazyImageHtml(src, alt, className = '') {
  const escapedSrc = escapeHtml(src);
  const escapedAlt = escapeHtml(alt);
  const classAttr = className ? `class="${escapeHtml(className)} lazy"` : 'class="lazy"';
  
  // Use a tiny transparent placeholder
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
  
  return `<img ${classAttr} src="${placeholder}" data-src="${escapedSrc}" alt="${escapedAlt}" loading="lazy" />`;
}

export { 
  formatDuration, 
  escapeHtml, 
  debounce, 
  initLazyLoading, 
  observeLazyImage, 
  setupLazyImages,
  lazyImageHtml 
};