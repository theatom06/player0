/**
 * ============================================
 * Player 0 - Backend Server
 * ============================================
 * 
 * Main Express server providing REST API for:
 * - Music library management and scanning
 * - Audio streaming with range request support
 * - Playlist CRUD operations
 * - Play history tracking and statistics
 * - Album and artist browsing
 * - Advanced search functionality
 * 
 * Security Features:
 * - Input validation on all endpoints
 * - Path traversal protection
 * - Request size limits
 * - Security headers (HSTS, XSS, etc.)
 * 
 * @module server
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Storage from './storage.js';
import MusicScanner from './scanner.js';
import logger, { httpLogger } from './logger.js';
import configData from './config.json' with { type: 'json' };
import { resolveLyricsForSong } from './lyrics/lyricsService.js';
import { registerConfigRoutes } from './routes/configRoutes.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE_PATH = path.join(__dirname, 'config.json');
// Mutable runtime config so some settings (like rate limiting) can apply immediately.
const runtimeConfig = JSON.parse(JSON.stringify(configData));

// Initialize Express app and Storage
const app = express();
const storage = new Storage(runtimeConfig.dataDirectory);

/**
 * Security Headers Middleware
 * Adds security-related HTTP headers to all responses
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Enables XSS filter
 * - HSTS: Forces HTTPS connections
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

/**
 * CORS Configuration
 * Allows cross-origin requests from configured origins
 * Set ALLOWED_ORIGINS env variable for production security
 */
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

/**
 * Body Parser Middleware
 * Parses JSON and URL-encoded request bodies
 * 10MB limit prevents memory exhaustion attacks
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * HTTP Request Logging
 * Logs all incoming requests with timing information
 */
app.use(httpLogger);

// Config routes (device-hosted: editable from Settings)
// Register these before rate limiting so you can always recover from bad limiter settings.
registerConfigRoutes(app, { runtimeConfig, configFilePath: CONFIG_FILE_PATH });

/**
 * MIME Type Middleware
 * Ensures correct Content-Type headers for static assets
 * Critical for proper CSS/JS loading in browsers
 */
app.use((req, res, next) => {
  if (req.url.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  } else if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.url.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize storage system
await storage.init();

// ============================================
// API Routes - Songs
// ============================================

/**
 * GET /api/songs
 * Retrieve all songs in the library
 * @returns {Array<Object>} List of all songs with metadata
 */
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await storage.getSongs();
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/songs/:id
 * Get a specific song by its ID
 * @param {string} id - Alphanumeric song ID
 * @returns {Object} Song metadata
 */
app.get('/api/songs/:id', async (req, res) => {
  try {
    // Validate ID format (alphanumeric and hyphens only)
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid song ID format' });
    }
    
    const song = await storage.getSongById(req.params.id);
    if (song) {
      res.json(song);
    } else {
      res.status(404).json({ error: 'Song not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API Routes - Lyrics
// ============================================

/**
 * GET /api/lyrics/:id
 * Resolve synced lyrics (LRC) for a song.
 * Flow: local .lrc -> embedded tags. (No network fetch.)
 * Query params:
 * - force=1 : re-check local file and tags
 */
app.get('/api/lyrics/:id', async (req, res) => {
  try {
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid song ID format' });
    }

    const song = await storage.getSongById(req.params.id);
    if (!song || !song.filePath) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // "force" is accepted for backwards-compat but lyrics are local/tags only.
    const result = await resolveLyricsForSong({ storage, song });

    if (!result.ok) {
      return res.status(result.status || 404).json({ error: result.error || 'Lyrics not found' });
    }

    return res.json({
      songId: song.id,
      source: result.source,
      synced: Boolean(result.synced),
      lrcPath: result.lrcPath || null,
      lrc: result.lrc || ''
    });
  } catch (error) {
    console.error('Error resolving lyrics:', error);
    return res.status(500).json({ error: 'Error resolving lyrics' });
  }
});

/**
 * PATCH /api/songs/:id
 * Update editable song metadata (currently: bpm, key)
 * @body {number|null} bpm - Beats per minute (30-300) or null to clear
 * @body {string|null} key - Musical key (short string) or null to clear
 */
app.patch('/api/songs/:id', async (req, res) => {
  try {
    // Validate ID format (alphanumeric and hyphens only)
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid song ID format' });
    }

    const song = await storage.getSongById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'bpm')) {
      const bpmRaw = req.body.bpm;
      if (bpmRaw === null || bpmRaw === '') {
        updates.bpm = null;
      } else {
        const bpm = Number(bpmRaw);
        if (!Number.isFinite(bpm) || bpm < 30 || bpm > 300) {
          return res.status(400).json({ error: 'Invalid bpm (expected number 30-300, or null)' });
        }
        updates.bpm = Math.round(bpm);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'key')) {
      const keyRaw = req.body.key;
      if (keyRaw === null || keyRaw === '') {
        updates.key = null;
      } else if (typeof keyRaw !== 'string') {
        return res.status(400).json({ error: 'Invalid key (expected string or null)' });
      } else {
        const k = String(keyRaw).trim();
        updates.key = k ? k.slice(0, 32) : null;
      }
    }

    const ok = await storage.updateSong(req.params.id, updates);
    if (!ok) {
      return res.status(500).json({ error: 'Failed to update song' });
    }

    const updated = await storage.getSongById(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search
 * Search songs with multiple filters
 * @query {string} q - General search query (title, artist, album)
 * @query {string} artist - Filter by artist name
 * @query {string} album - Filter by album name
 * @query {string} genre - Filter by genre
 * @query {number} year - Filter by release year
 * @returns {Array<Object>} Filtered list of songs
 */
app.get('/api/search', async (req, res) => {
  try {
    const { q, artist, album, genre, year } = req.query;
    
    // Validate and sanitize inputs
    if (q && (typeof q !== 'string' || q.length > 100)) {
      return res.status(400).json({ error: 'Invalid search query' });
    }
    if (artist && (typeof artist !== 'string' || artist.length > 100)) {
      return res.status(400).json({ error: 'Invalid artist query' });
    }
    if (album && (typeof album !== 'string' || album.length > 100)) {
      return res.status(400).json({ error: 'Invalid album query' });
    }
    if (genre && (typeof genre !== 'string' || genre.length > 100)) {
      return res.status(400).json({ error: 'Invalid genre query' });
    }
    if (year && (isNaN(year) || parseInt(year) < 1900 || parseInt(year) > 2100)) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    
    let songs = await storage.getSongs();
    
    if (q) {
      const query = q.toLowerCase();
      songs = songs.filter(song =>
        song.title?.toLowerCase().includes(query) ||
        song.artist?.toLowerCase().includes(query) ||
        song.album?.toLowerCase().includes(query)
      );
    }
    
    if (artist) {
      songs = songs.filter(song => 
        song.artist?.toLowerCase().includes(artist.toLowerCase())
      );
    }
    
    if (album) {
      songs = songs.filter(song => 
        song.album?.toLowerCase().includes(album.toLowerCase())
      );
    }
    
    if (genre) {
      songs = songs.filter(song => 
        song.genre?.toLowerCase().includes(genre.toLowerCase())
      );
    }
    
    if (year) {
      songs = songs.filter(song => song.year === parseInt(year));
    }
    
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/suggestions
 * Get search suggestions/autocomplete based on partial query
 * Returns unique artists, albums, and song titles matching the query
 * @query {string} q - Partial search query (min 2 chars)
 * @query {number} limit - Max suggestions per category (default: 5)
 * @returns {Object} Categorized suggestions { artists, albums, songs, genres }
 */
app.get('/api/suggestions', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    // Validate query
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ artists: [], albums: [], songs: [], genres: [] });
    }
    
    if (q.length > 100) {
      return res.status(400).json({ error: 'Query too long' });
    }
    
    const maxLimit = Math.min(parseInt(limit) || 5, 20);
    const query = q.toLowerCase().trim();
    const songs = await storage.getSongs();
    
    // Collect unique matches with relevance scoring
    const artistSet = new Map();
    const albumSet = new Map();
    const songSet = new Map();
    const genreSet = new Map();
    
    for (const song of songs) {
      // Score artists
      if (song.artist) {
        const artist = song.artist;
        const artistLower = artist.toLowerCase();
        if (artistLower.includes(query)) {
          const score = artistLower.startsWith(query) ? 100 : artistLower.indexOf(query) === 0 ? 90 : 50;
          if (!artistSet.has(artist) || artistSet.get(artist).score < score) {
            artistSet.set(artist, { value: artist, score, type: 'artist' });
          }
        }
      }
      
      // Score albums
      if (song.album) {
        const album = song.album;
        const albumLower = album.toLowerCase();
        if (albumLower.includes(query)) {
          const score = albumLower.startsWith(query) ? 100 : 50;
          const key = `${album}|${song.artist || ''}`;
          if (!albumSet.has(key) || albumSet.get(key).score < score) {
            albumSet.set(key, { 
              value: album, 
              artist: song.albumArtist || song.artist,
              score, 
              type: 'album' 
            });
          }
        }
      }
      
      // Score song titles
      if (song.title) {
        const title = song.title;
        const titleLower = title.toLowerCase();
        if (titleLower.includes(query)) {
          const score = titleLower.startsWith(query) ? 100 : 50;
          if (!songSet.has(song.id) || songSet.get(song.id).score < score) {
            songSet.set(song.id, { 
              id: song.id,
              value: title, 
              artist: song.artist,
              album: song.album,
              score, 
              type: 'song' 
            });
          }
        }
      }
      
      // Score genres
      if (song.genre) {
        const genre = song.genre;
        const genreLower = genre.toLowerCase();
        if (genreLower.includes(query)) {
          const score = genreLower.startsWith(query) ? 100 : 50;
          if (!genreSet.has(genre) || genreSet.get(genre).score < score) {
            genreSet.set(genre, { value: genre, score, type: 'genre' });
          }
        }
      }
    }
    
    // Sort by score and limit results
    const sortByScore = (a, b) => b.score - a.score;
    
    res.json({
      artists: Array.from(artistSet.values()).sort(sortByScore).slice(0, maxLimit),
      albums: Array.from(albumSet.values()).sort(sortByScore).slice(0, maxLimit),
      songs: Array.from(songSet.values()).sort(sortByScore).slice(0, maxLimit),
      genres: Array.from(genreSet.values()).sort(sortByScore).slice(0, maxLimit)
    });
  } catch (error) {
    logger.error('Error getting suggestions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API Routes - Albums
// ============================================

/**
 * GET /api/albums
 * Get all albums with aggregated metadata
 * Groups songs by album and artist, includes song count and duration
 * @returns {Array<Object>} List of albums with metadata
 */
app.get('/api/albums', async (req, res) => {
  try {
    const songs = await storage.getSongs();
    const albumMap = new Map();
    
    songs.forEach(song => {
      const albumKey = `${song.album}|${song.albumArtist || song.artist}`;
      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, {
          album: song.album,
          artist: song.albumArtist || song.artist,
          year: song.year,
          songs: []
        });
      }
      albumMap.get(albumKey).songs.push(song);
    });
    
    const albums = Array.from(albumMap.values()).map(album => ({
      ...album,
      songCount: album.songs.length,
      duration: album.songs.reduce((sum, s) => sum + (s.duration || 0), 0)
    }));
    
    res.json(albums);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/albums/:artist/:album
 * Get detailed information about a specific album
 * Returns all songs in the album, sorted by disc and track number
 * @param {string} artist - Album artist name (URL encoded)
 * @param {string} album - Album name (URL encoded)
 * @returns {Object} Album details with sorted track list
 */
app.get('/api/albums/:artist/:album', async (req, res) => {
  try {
    const { artist, album } = req.params;
    
    // Validate parameters length
    if (artist.length > 200 || album.length > 200) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const songs = await storage.getSongs();
    
    const albumSongs = songs.filter(song =>
      song.album === decodeURIComponent(album) &&
      (song.albumArtist || song.artist) === decodeURIComponent(artist)
    ).sort((a, b) => {
      if (a.discNumber !== b.discNumber) {
        return (a.discNumber || 0) - (b.discNumber || 0);
      }
      return (a.trackNumber || 0) - (b.trackNumber || 0);
    });
    
    if (albumSongs.length > 0) {
      res.json({
        album: decodeURIComponent(album),
        artist: decodeURIComponent(artist),
        year: albumSongs[0].year,
        songs: albumSongs,
        duration: albumSongs.reduce((sum, s) => sum + (s.duration || 0), 0)
      });
    } else {
      res.status(404).json({ error: 'Album not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API Routes - Artists
// ============================================

/**
 * GET /api/artists
 * Get all artists with song and album counts
 * @returns {Array<Object>} List of artists with statistics
 */
app.get('/api/artists', async (req, res) => {
  try {
    const songs = await storage.getSongs();
    const artistMap = new Map();
    
    songs.forEach(song => {
      const artist = song.artist || 'Unknown Artist';
      if (!artistMap.has(artist)) {
        artistMap.set(artist, {
          name: artist,
          songCount: 0,
          albums: new Set()
        });
      }
      const artistData = artistMap.get(artist);
      artistData.songCount++;
      if (song.album) {
        artistData.albums.add(song.album);
      }
    });
    
    const artists = Array.from(artistMap.values()).map(artist => ({
      name: artist.name,
      songCount: artist.songCount,
      albumCount: artist.albums.size
    }));
    
    res.json(artists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API Routes - Streaming
// ============================================

/**
 * GET /api/stream/:id
 * Stream audio file with HTTP range request support
 * Enables seeking in audio player and bandwidth optimization
 * @param {string} id - Song ID
 * @returns {Stream} Audio file stream with appropriate headers
 */
app.get('/api/stream/:id', async (req, res) => {
  try {
    // Validate ID format
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid song ID format' });
    }
    
    const song = await storage.getSongById(req.params.id);
    
    if (!song || !song.filePath) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const filePath = song.filePath;
    
    // Ensure file path is absolute and exists
    if (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cover/:id
 * Extract and serve album artwork from audio file metadata
 * Returns embedded cover art or 404 if not available
 * @param {string} id - Song ID
 * @returns {Image} Album artwork (JPEG/PNG)
 */
app.get('/api/cover/:id', async (req, res) => {
  try {
    // Validate ID format
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid song ID format' });
    }
    
    const song = await storage.getSongById(req.params.id);
    
    if (!song || !song.filePath) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const filePath = song.filePath;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Import parseFile from music-metadata
    const { parseFile } = await import('music-metadata');
    const metadata = await parseFile(filePath);
    
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];
      res.set('Content-Type', picture.format || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(picture.data));
    } else {
      return res.status(404).json({ error: 'No cover art found' });
    }
  } catch (error) {
    console.error('Error extracting cover art:', error);
    return res.status(500).json({ error: 'Error extracting cover art' });
  }
});

// ============================================
// API Routes - Playlists
// ============================================

/**
 * GET /api/playlists
 * Retrieve all playlists
 * @returns {Array<Object>} List of playlists with metadata
 */
app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await storage.getPlaylists();
    res.json(playlists);
  } catch (error) {
    console.error('Error getting playlists:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/playlists/:id
 * Get a specific playlist by ID
 * @param {string} id - Playlist ID
 * @returns {Object} Playlist details
 */
app.get('/api/playlists/:id', async (req, res) => {
  try {
    const playlist = await storage.getPlaylistById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    console.error('Error getting playlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/playlists
 * Create a new playlist
 * @body {string} name - Playlist name (required, max 200 chars)
 * @body {string} description - Playlist description (optional, max 1000 chars)
 * @body {Array<string>} songIds - Initial song IDs (optional)
 * @returns {Object} Created playlist
 */
app.post('/api/playlists', async (req, res) => {
  try {
    const { name, description, songIds } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }
    
    if (name.length > 200) {
      return res.status(400).json({ error: 'Playlist name too long (max 200 chars)' });
    }
    
    if (description && description.length > 1000) {
      return res.status(400).json({ error: 'Description too long (max 1000 chars)' });
    }
    
    const playlist = await storage.createPlaylist({
      name: name.trim(),
      description: description ? description.trim() : '',
      songIds: Array.isArray(songIds) ? songIds : []
    });
    
    res.status(201).json(playlist);
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/playlists/:id
 * Update an existing playlist
 * @param {string} id - Playlist ID
 * @body {string} name - New playlist name (optional)
 * @body {string} description - New description (optional)
 * @body {Array<string>} songIds - Updated song list (optional)
 * @returns {Object} Updated playlist
 */
app.put('/api/playlists/:id', async (req, res) => {
  try {
    const { name, description, songIds, pinned } = req.body;
    const updates = {};
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid playlist name' });
      }
      updates.name = name.trim();
    }
    
    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() : '';
    }
    
    if (songIds !== undefined) {
      if (!Array.isArray(songIds)) {
        return res.status(400).json({ error: 'songIds must be an array' });
      }
      updates.songIds = songIds;
    }

    if (pinned !== undefined) {
      if (typeof pinned !== 'boolean') {
        return res.status(400).json({ error: 'pinned must be a boolean' });
      }
      updates.pinned = pinned;
    }
    
    const updated = await storage.updatePlaylist(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/playlists/:id
 * Delete a playlist permanently
 * @param {string} id - Playlist ID
 * @returns {Object} Success message
 */
app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const success = await storage.deletePlaylist(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API Routes - Play History & Statistics
// ============================================

/**
 * POST /api/play/:id
 * Record a song play for statistics tracking
 * Increments play count and updates last played timestamp
 * @param {string} id - Song ID
 * @body {number} durationPlayed - Seconds played (optional)
 * @returns {Object} Success message
 */
app.post('/api/play/:id', async (req, res) => {
  try {
    // Validate ID format
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid song ID format' });
    }
    
    const { durationPlayed } = req.body;
    
    // Validate duration
    if (durationPlayed !== undefined && (typeof durationPlayed !== 'number' || durationPlayed < 0)) {
      return res.status(400).json({ error: 'Invalid duration' });
    }
    
    await storage.addPlayHistory(req.params.id, durationPlayed);
    res.json({ message: 'Play recorded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history
 * Get recent play history
 * @query {number} limit - Max number of entries (default: 100, max: 1000)
 * @returns {Array<Object>} Recent plays with timestamps
 */
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    // Validate limit
    if (limit < 1 || limit > 1000) {
      return res.status(400).json({ error: 'Invalid limit (1-1000)' });
    }
    
    const history = await storage.getPlayHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats
 * Get comprehensive library statistics
 * Includes total counts, most played, recently played, etc.
 * @returns {Object} Statistics object with various metrics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/stats/import
 * Import song-level play stats from a CSV previously exported by the UI.
 * Body: { csv: string }
 * Updates: playCount, lastPlayed
 */
app.post('/api/stats/import', async (req, res) => {
  try {
    const csvText = String(req.body?.csv || '');
    if (!csvText.trim()) {
      return res.status(400).json({ error: 'Missing csv' });
    }

    function parseCsvLine(line) {
      const fields = [];
      let field = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (inQuotes) {
          if (ch === '"') {
            if (line[i + 1] === '"') {
              field += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            field += ch;
          }
          continue;
        }

        if (ch === '"') {
          inQuotes = true;
          continue;
        }
        if (ch === ',') {
          fields.push(field);
          field = '';
          continue;
        }
        field += ch;
      }

      fields.push(field);
      return fields;
    }

    const lines = csvText
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV has no data rows' });
    }

    const header = parseCsvLine(lines[0]).map((h) => String(h || '').trim());
    const idxId = header.indexOf('id');
    const idxPlayCount = header.indexOf('playCount');
    const idxLastPlayed = header.indexOf('lastPlayed');
    if (idxId < 0 || idxPlayCount < 0) {
      return res.status(400).json({ error: 'CSV header must include id and playCount' });
    }

    const songs = await storage.getSongs();
    const byId = new Map(songs.map((s) => [String(s.id), s]));

    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      const id = String(row[idxId] || '').trim();
      if (!id) {
        skippedCount++;
        continue;
      }

      const song = byId.get(id);
      if (!song) {
        skippedCount++;
        continue;
      }

      const playCountRaw = row[idxPlayCount];
      const playCount = Number.parseInt(String(playCountRaw ?? '').trim(), 10);
      if (!Number.isFinite(playCount) || playCount < 0) {
        skippedCount++;
        continue;
      }

      let lastPlayed = null;
      if (idxLastPlayed >= 0) {
        const lp = String(row[idxLastPlayed] ?? '').trim();
        lastPlayed = lp || null;
      }

      song.playCount = playCount;
      if (idxLastPlayed >= 0) {
        song.lastPlayed = lastPlayed;
      }

      updatedCount++;
    }

    await storage.saveSongs(songs);
    res.json({ updatedCount, skippedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// API Routes - Library Management
// ============================================

/**
 * POST /api/scan
 * Trigger a full library scan
 * Scans configured music directories and updates database
 * @returns {Object} Scan results (added, updated, total)
 */
app.post('/api/scan', async (req, res) => {
  try {
    const scanner = new MusicScanner();
    const result = await scanner.scan();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Frontend Route
// ============================================

/**
 * GET /
 * Serve the main application HTML
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// Server Startup
// ============================================

const PORT = Number(process.env.PORT) || runtimeConfig.port || 3000;
const HOST = runtimeConfig.host || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🎵 Player 0 Server running on http://${HOST}:${PORT}`);
  console.log(`📁 Data directory: ${runtimeConfig.dataDirectory}`);
  console.log(`🎶 Music directories: ${(runtimeConfig.musicDirectories || []).join(', ')}`);
  console.log(`\n💡 Run 'bun run scan' to scan your music library`);
});
