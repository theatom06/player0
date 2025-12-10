// ============================================
// API Configuration - Change URL here only
// ============================================
const API_URL = 'https://ominous-space-guide-g95r5vgg75rcwx64-3000.app.github.dev/api';

// Export API_URL for use in other modules
export { API_URL };

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
    const response = await fetch(`${API_URL}/songs`);
    const data = await response.json();

    if(!response.ok) {
        throw new Error(data.message || 'Error fetching songs');
    }

    return data;
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
    const response = await fetch(`${API_URL}/albums`);
    const data = await response.json();

    if(!response.ok) {
        throw new Error(data.message || 'Error fetching albums');
    }

    return data;
}

async function getAlbumDetail(artist, album) {
    const response = await fetch(`${API_URL}/albums/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`);
    const data = await response.json();
    
    if(!response.ok) {
        throw new Error(data.message || 'Error fetching album detail');
    }
    
    return data;
}

function albumCoverUrl(songId) {
    return `${API_URL}/cover/${songId}`;
}

// ============================================
// Artists APIs
// ============================================

async function listArtists() {
    const response = await fetch(`${API_URL}/artists`);
    const data = await response.json();
    
    if(!response.ok) {
        throw new Error(data.message || 'Error fetching artists');
    }
    
    return data;
}

// ============================================
// Playlists APIs
// ============================================

async function listPlaylists() {
    const response = await fetch(`${API_URL}/playlists`);
    const data = await response.json();
    
    if(!response.ok) {
        throw new Error(data.message || 'Error fetching playlists');
    }
    
    return data;
}

async function createPlaylist(name, description, songs = []) {
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
    const response = await fetch(`${API_URL}/stats`);
    const data = await response.json();
    
    if(!response.ok) {
        throw new Error(data.message || 'Error fetching stats');
    }
    
    return data;
}

// ============================================
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
    scanLibrary
};