import { bootstrapApp } from './js/app/shell.js';

function isDevMode() {
  try {
    if (window.__PLAYER0_DEV_MODE === true) return true;

    const params = new URLSearchParams(window.location.search);
    const devParam = params.get('dev');
    if (devParam === '' || devParam === '1' || devParam === 'true') return true;

    const ls = localStorage.getItem('player0.devMode');
    if (ls === '1' || ls === 'true') return true;

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
  } catch {
    // ignore
  }

  return false;
}

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Dev mode: avoid service worker caching surprises.
    if (isDevMode()) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        console.log('Dev mode: service worker unregistered');
      } catch (error) {
        console.warn('Dev mode: failed to unregister service worker:', error);
      }
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered:', registration.scope);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('Service Worker update found');
        
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New version available! Refresh to update.');
            
            // Optionally show update notification
            if (window.showUpdateNotification) {
              window.showUpdateNotification();
            }
          }
        });
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

bootstrapApp();

