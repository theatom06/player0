// ============================================
// API Configuration - Change URL here only
// ============================================
const API_URL = 'https://ominous-space-guide-g95r5vgg75rcwx64-3000.app.github.dev/api';

// Export API_URL for use in other modules
export { API_URL };

// ============================================
// Cache Configuration
// ============================================
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

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
  
  // Check cache for GET requests only
  if (!options.method || options.method === 'GET') {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  const response = await fetch(url, options);
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
}function albumCoverUrl(songId) {
    return `${API_URL}/cover/${songId}`;
}

// ============================================
// Artists APIs
// ============================================

async function listArtists() {
    return await fetchWithCache(`${API_URL}/artists`);
}// ============================================
// Playlists APIs
// ============================================

async function listPlaylists() {
    return await fetchWithCache(`${API_URL}/playlists`);
}async function createPlaylist(name, description, songs = []) {
    const response = await fetch(`${API_URL}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, songs })
    });
    
    if(!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error creating playlist');
    }
    
    return response.json();
}

// ============================================
// Statistics APIs
// ============================================

async function getStats() {
    return await fetchWithCache(`${API_URL}/stats`);
}// ============================================
// Library Management APIs
// ============================================

async function scanLibrary() {
    const response = await fetch(`${API_URL}/scan`, { method: 'POST' });
    const data = await response.json();
    
    if(!response.ok) {
        throw new Error(data.message || 'Error scanning library');
    }
    
    return data;
}

// ============================================
// Exports
// ============================================

export { 
    simpleSearch, 
    advancedSearch, 
    fetchAllSongs, 
    songCoverUrl,
    songStreamUrl,
    recordPlay,
    listAlbums,
    getAlbumDetail,
    albumCoverUrl,
    listArtists,
    listPlaylists,
    createPlaylist,
    getStats,
    scanLibrary,
    clearCache
};