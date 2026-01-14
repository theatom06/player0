/**
 * ============================================
 * Player 0 - Service Worker
 * ============================================
 * 
 * Provides offline support and caching for:
 * - Static assets (HTML, CSS, JS)
 * - API responses (songs list, playlists)
 * - Album artwork (cover images)
 * 
 * Cache Strategies:
 * - Static assets: Cache-first (fast loads)
 * - API data: Network-first with cache fallback
 * - Cover art: Cache-first with long expiry
 * - Audio streams: Network-only (too large to cache)
 * 
 * Dev Mode:
 * - Disabled on localhost/dev environments
 * - Only caches in production
 */

// Check if running in development mode
function isDevMode() {
  const hostname = self.location.hostname;
  return hostname === 'localhost' ||
         hostname.includes('.github.dev') ||
         hostname.includes('.codespaces') ||
         hostname.includes('gitpod.io') ||
         hostname.endsWith('.local');
}

const DEV_MODE = isDevMode();

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `player0-static-${CACHE_VERSION}`;
const API_CACHE = `player0-api-${CACHE_VERSION}`;
const COVER_CACHE = `player0-covers-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/main.css',
  '/app.js',
  '/css/base.css',
  '/css/components.css',
  '/css/header.css',
  '/css/library.css',
  '/css/mobile.css',
  '/css/player.css',
  '/css/sidebar.css',
  '/css/views.css',
  '/js/API.js',
  '/js/player.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/utils.js',
  '/js/app/albums.js',
  '/js/app/artists.js',
  '/js/app/dropdowns.js',
  '/js/app/library.js',
  '/js/app/navigation.js',
  '/js/app/playerSetup.js',
  '/js/app/playlistImportExport.js',
  '/js/app/playlists.js',
  '/js/app/scan.js',
  '/js/app/search.js',
  '/js/app/settings.js',
  '/js/app/shell.js',
  '/js/app/sidebar.js',
  '/js/app/stats.js',
  '/js/app/uiModals.js',
  '/js/app/views.js',
  '/js/app/viewSwitcher.js',
  '/views/album-detail.html',
  '/views/albums.html',
  '/views/artists.html',
  '/views/library.html',
  '/views/playlist-detail.html',
  '/views/playlists.html',
  '/views/settings.html',
  '/views/stats.html'
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/songs$/,
  /\/api\/albums$/,
  /\/api\/artists$/,
  /\/api\/playlists$/,
  /\/api\/stats$/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // In dev mode, skip caching and activate immediately
  if (DEV_MODE) {
    console.log('[SW] Dev mode - skipping cache, activating immediately');
    event.waitUntil(self.skipWaiting());
    return;
  }
  
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('player0-') && 
                     name !== STATIC_CACHE && 
                     name !== API_CACHE && 
                     name !== COVER_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with appropriate strategies
self.addEventListener('fetch', (event) => {
  // In dev mode, let all requests pass through to network
  if (DEV_MODE) {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (GitHub Codespaces auth, external resources)
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Skip auth-related paths
  if (url.pathname.includes('/auth/') || url.pathname.includes('signin')) {
    return;
  }
  
  // Skip streaming endpoints (too large to cache)
  if (url.pathname.startsWith('/api/stream/')) {
    return;
  }
  
  // Handle cover art - Cache-first strategy
  if (url.pathname.startsWith('/api/cover/')) {
    event.respondWith(cacheFirstWithExpiry(event.request, COVER_CACHE, 7 * 24 * 60 * 60 * 1000));
    return;
  }
  
  // Handle cacheable API endpoints - Network-first with cache fallback
  if (isCacheableApi(url.pathname)) {
    event.respondWith(networkFirstWithCache(event.request, API_CACHE));
    return;
  }
  
  // Handle static assets - Cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }
});

/**
 * Check if URL matches cacheable API patterns
 */
function isCacheableApi(pathname) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  return pathname === '/' ||
         pathname.endsWith('.html') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.ico');
}

/**
 * Cache-first strategy
 * Returns cached response if available, otherwise fetches from network
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Cache-first with expiry
 * Returns cached response if available and not expired
 */
async function cacheFirstWithExpiry(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    const dateHeader = cached.headers.get('sw-cached-at');
    if (dateHeader) {
      const cachedAt = parseInt(dateHeader, 10);
      if (Date.now() - cachedAt < maxAge) {
        return cached;
      }
    } else {
      // No timestamp, return cached anyway
      return cached;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone and add timestamp header
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', Date.now().toString());
      
      const timestampedResponse = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
      cache.put(request, timestampedResponse);
    }
    return response;
  } catch (error) {
    // Return stale cache if network fails
    if (cached) {
      return cached;
    }
    console.error('[SW] Fetch failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first with cache fallback
 * Tries network first, falls back to cache if offline
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    
    // Don't cache redirects or non-OK responses
    if (response.ok && !response.redirected && response.type !== 'opaqueredirect') {
      cache.put(request, response.clone());
    }
    
    // If we got a redirect (auth), don't use cached version, let browser handle it
    if (response.redirected || response.type === 'opaqueredirect') {
      return response;
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('player0-'))
            .map((name) => caches.delete(name))
        );
      })
    );
  }
});
