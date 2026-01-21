// ============================================
// API Configuration - Change URL here only
// ============================================
// Default: same-origin backend (works in local dev, Codespaces, and production)
// Optional override: set `window.__PLAYER0_API_URL = 'https://example.com/api'` before this module loads.
const API_URL = window.__PLAYER0_API_URL || `${window.location.origin}/api`;

// Export API_URL for use in other modules
export { API_URL };

// ============================================
// Cache Configuration
// ============================================
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week
const cache = new Map();

// Dev mode disables caching entirely.
// Enable via any of:
// - `window.__PLAYER0_DEV_MODE = true` (set before this module loads)
// - URL query `?dev=1` (or `?dev=true`)
// - localStorage key `player0.devMode` set to `"1"` or `"true"`
// - hostname `localhost` / `127.0.0.1`
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

function getCacheKey(endpoint) {
  return endpoint;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

function clearCache() {
  cache.clear();
}

async function fetchWithCache(url, options = {}) {
  const cacheKey = getCacheKey(url);

    // Dev mode: bypass in-memory cache and tell fetch to avoid HTTP cache.
    if (isDevMode()) {
        const headers = new Headers(options.headers || {});
        headers.set('Cache-Control', 'no-cache');

        const response = await fetch(url, {
            ...options,
            headers,
            cache: 'no-store'
        });
        
        // Handle auth redirects (GitHub Codespaces)
        if (response.redirected || response.type === 'opaqueredirect') {
          console.warn('API request was redirected (auth required?)');
          throw new Error('Authentication required');
        }
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    }
  
  // Check cache for GET requests only
  if (!options.method || options.method === 'GET') {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  const response = await fetch(url, options);
  
  // Handle auth redirects (GitHub Codespaces)
  if (response.redirected || response.type === 'opaqueredirect') {
    console.warn('API request was redirected (auth required?)');
    throw new Error('Authentication required');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  
  // Cache successful GET responses
  if (!options.method || options.method === 'GET') {
    setCache(cacheKey, data);
  }
  
  return data;
}

// ============================================
// Search APIs
// ============================================

/**
 * Get search suggestions/autocomplete
 * @param {string} query - Partial search query (min 2 chars)
 * @param {number} limit - Max suggestions per category
 * @returns {Object} { artists, albums, songs, genres }
 */
async function getSearchSuggestions(query, limit = 5) {
    if (!query || query.length < 2) {
        return { artists: [], albums: [], songs: [], genres: [] };
    }
    
    const response = await fetch(`${API_URL}/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'Error getting suggestions');
    }
    
    return data;
}

async function simpleSearch(input) {
    const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(input)}`);
    const data = await response.json();

    if(!response.ok) {
        throw new Error(data.message || 'Error performing search');
    }

    return data;
}

async function advancedSearch({ title, artist, album, genre, year, minDuration, maxDuration } = {}) {
    const queryParams = new URLSearchParams();

    if (title) queryParams.append('title', title);
    if (artist) queryParams.append('artist', artist);
    if (album) queryParams.append('album', album);
    if (genre) queryParams.append('genre', genre);
    if (year) queryParams.append('year', year);
    if (minDuration) queryParams.append('minDuration', minDuration);
    if (maxDuration) queryParams.append('maxDuration', maxDuration);

    const response = await fetch(`${API_URL}/search?${queryParams}`);
    const data = await response.json();

    if(!response.ok) {
        throw new Error(data.message || 'Error performing advanced search');
    }

    return data;
}

// ============================================
// Songs APIs
// ============================================

async function fetchAllSongs() {
    return await fetchWithCache(`${API_URL}/songs`);
}

function songCoverUrl(songId) {
    return `${API_URL}/cover/${songId}`;
}

function songStreamUrl(songId) {
    return `${API_URL}/stream/${songId}`;
}

async function recordPlay(songId) {
    const response = await fetch(`${API_URL}/play/${songId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationPlayed: 0 })
    });
    
    if(!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error recording play');
    }
    
    return response.json();
}

// ============================================
// Albums APIs
// ============================================

async function listAlbums() {
    return await fetchWithCache(`${API_URL}/albums`);
}

async function getAlbumDetail(artist, album) {
    return await fetchWithCache(`${API_URL}/albums/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`);
}

function albumCoverUrl(songId) {
    return `${API_URL}/cover/${songId}`;
}

// ============================================
// Artists APIs
// ============================================

async function listArtists() {
    return await fetchWithCache(`${API_URL}/artists`);
}

// ============================================
// Playlists APIs
// ============================================

async function listPlaylists() {
    const data = await fetchWithCache(`${API_URL}/playlists`);
    return data;
}

async function getPlaylist(id) {
    const data = await fetchWithCache(`${API_URL}/playlists/${id}`);
    return data;
}

async function createPlaylist(name, description = '', songIds = []) {
    const response = await fetch(`${API_URL}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, songIds })
    });
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create playlist');
    }
    
    // Clear cache
    cache.delete(getCacheKey(`${API_URL}/playlists`));
    
    return await response.json();
}

async function updatePlaylist(id, updates) {
    const response = await fetch(`${API_URL}/playlists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update playlist');
    }
    
    // Clear cache
    cache.delete(getCacheKey(`${API_URL}/playlists/${id}`));
    cache.delete(getCacheKey(`${API_URL}/playlists`));
    
    return await response.json();
}

async function deletePlaylist(id) {
    const response = await fetch(`${API_URL}/playlists/${id}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete playlist');
    }
    
    // Clear cache
    cache.delete(getCacheKey(`${API_URL}/playlists/${id}`));
    cache.delete(getCacheKey(`${API_URL}/playlists`));
    
    return await response.json();
}

async function addSongToPlaylist(playlistId, songId) {
    const playlist = await getPlaylist(playlistId);
    const songIds = playlist.songIds || [];
    
    if (songIds.includes(songId)) {
        return playlist; // Already in playlist
    }
    
    return await updatePlaylist(playlistId, { songIds: [...songIds, songId] });
}

async function removeSongFromPlaylist(playlistId, songId) {
    const playlist = await getPlaylist(playlistId);
    const songIds = (playlist.songIds || []).filter(id => id !== songId);
    return await updatePlaylist(playlistId, { songIds });
}

// ============================================
// Statistics APIs
// ============================================

async function getStats() {
    // Stats change frequently (plays, recently played, listening time). Avoid long-lived caching.
    const response = await fetch(`${API_URL}/stats`, { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'API request failed');
    }

    return data;
}

// ============================================
// Library Management APIs
// ============================================

async function scanLibrary() {
    const response = await fetch(`${API_URL}/scan`, { method: 'POST' });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || data.message || 'Error scanning library');
    }

    // Scanning changes library data: clear cache.
    clearCache();
    return data;
}

// ============================================
// Lyrics API
// ============================================

async function getLyrics(songId, { force = false } = {}) {
    if (!songId) throw new Error('songId is required');

    const url = new URL(`${API_URL}/lyrics/${encodeURIComponent(songId)}`);
    if (force) url.searchParams.set('force', '1');

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || data.message || 'Error getting lyrics');
    }

    return data;
}

// ============================================
// Song Metadata (Tagging) APIs
// ============================================

async function updateSong(id, updates) {
    const response = await fetch(`${API_URL}/songs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates || {})
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update song');
    }

    // Clear cache for list + item.
    cache.delete(getCacheKey(`${API_URL}/songs`));
    cache.delete(getCacheKey(`${API_URL}/songs/${id}`));

    return data;
}

// ============================================
// Stats Import
// ============================================

async function importStatsCsv(csvText) {
    const response = await fetch(`${API_URL}/stats/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: String(csvText || '') })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to import stats');
    }

    // Invalidate cached views.
    cache.delete(getCacheKey(`${API_URL}/songs`));
    cache.delete(getCacheKey(`${API_URL}/stats`));
    return data;
}

// ============================================
// Admin / Config
// ============================================

async function getServerConfig() {
    const response = await fetch(`${API_URL}/config`, {
        method: 'GET',
        headers: {}
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to load server config');
    }
    return data;
}

async function updateServerConfig(configUpdate) {
    const response = await fetch(`${API_URL}/config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(configUpdate || {})
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update server config');
    }
    return data;
}

// ============================================
// Exports
// ============================================

export { 
    getSearchSuggestions,
    simpleSearch, 
    advancedSearch, 
    fetchAllSongs, 
    songCoverUrl,
    songStreamUrl,
    recordPlay,
    updateSong,
    importStatsCsv,
    getServerConfig,
    updateServerConfig,
    listAlbums,
    getAlbumDetail,
    albumCoverUrl,
    listArtists,
    listPlaylists,
    getPlaylist,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getStats,
    scanLibrary,
    getLyrics,
    clearCache
};