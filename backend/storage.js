/**
 * ============================================
 * Storage Module
 * ============================================
 * 
 * JSON-based persistent storage for music library data.
 * Manages songs, playlists, play history, and statistics.
 * 
 * Data Files:
 * - songs.json: Music library with metadata
 * - playlists.json: User-created playlists
 * - play_history.json: Play history (last 1000 plays)
 * - stats.json: Aggregated statistics (currently unused)
 * 
 * Features:
 * - Automatic initialization and file creation
 * - Safe JSON read/write with error handling
 * - Playlist management with song count tracking
 * - Play history with automatic pruning
 * - Statistics calculation on-demand
 * 
 * @module storage
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Storage {
  /**
   * Initialize storage with data directory path
   * @param {string} dataDir - Directory for data files (relative to backend/)
   */
  constructor(dataDir = './data') {
    this.dataDir = path.resolve(__dirname, dataDir);
    this.songsFile = path.join(this.dataDir, 'songs.json');
    this.playlistsFile = path.join(this.dataDir, 'playlists.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.playHistoryFile = path.join(this.dataDir, 'play_history.json');
  }

  /**
   * Initialize storage system
   * Creates data directory and initializes JSON files with empty defaults
   * Safe to call multiple times - will not overwrite existing data
   */
  async init() {
    // Create data directory if it doesn't exist
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Initialize files if they don't exist
    await this.ensureFile(this.songsFile, []);
    await this.ensureFile(this.playlistsFile, []);
    await this.ensureFile(this.statsFile, {});
    await this.ensureFile(this.playHistoryFile, []);
  }

  /**
   * Ensure a file exists with default content
   * Only creates file if it doesn't already exist
   * @param {string} filePath - Path to file
   * @param {*} defaultContent - Default content (will be JSON stringified)
   */
  async ensureFile(filePath, defaultContent) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }

  /**
   * Read and parse JSON file
   * Returns null on error instead of throwing
   * @param {string} filePath - Path to JSON file
   * @returns {*} Parsed JSON data or null
   */
  async readJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write data to JSON file with pretty formatting
   * @param {string} filePath - Path to JSON file
   * @param {*} data - Data to write (will be JSON stringified)
   * @returns {boolean} Success status
   */
  async writeJSON(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error);
      return false;
    }
  }

  // ============================================
  // Songs Management
  // ============================================

  /**
   * Get all songs from library
   * @returns {Array<Object>} Array of song objects
   */
  async getSongs() {
    return await this.readJSON(this.songsFile) || [];
  }

  /**
   * Save entire songs array (replaces all songs)
   * Used by scanner to update library
   * @param {Array<Object>} songs - Complete array of songs
   * @returns {boolean} Success status
   */
  async saveSongs(songs) {
    return await this.writeJSON(this.songsFile, songs);
  }

  /**
   * Get a single song by ID
   * @param {string} id - Song ID
   * @returns {Object|undefined} Song object or undefined
   */
  async getSongById(id) {
    const songs = await this.getSongs();
    return songs.find(song => song.id === id);
  }

  /**
   * Add a new song to library
   * @param {Object} song - Song object to add
   * @returns {boolean} Success status
   */
  async addSong(song) {
    const songs = await this.getSongs();
    songs.push(song);
    return await this.saveSongs(songs);
  }

  /**
   * Update an existing song
   * @param {string} id - Song ID to update
   * @param {Object} updates - Fields to update
   * @returns {boolean} Success status
   */
  async updateSong(id, updates) {
    const songs = await this.getSongs();
    const index = songs.findIndex(song => song.id === id);
    if (index !== -1) {
      songs[index] = { ...songs[index], ...updates };
      return await this.saveSongs(songs);
    }
    return false;
  }

  // ============================================
  // Playlists Management
  // ============================================

  /**
   * Get all playlists
   * Ensures proper structure and backwards compatibility
   * @returns {Array<Object>} Array of playlist objects
   */
  async getPlaylists() {
    const playlists = await this.readJSON(this.playlistsFile) || [];
    // Ensure all playlists have proper structure (backwards compatibility)
    return playlists.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      songIds: Array.isArray(p.songIds) ? p.songIds : (Array.isArray(p.songs) ? p.songs : []),
      songCount: Array.isArray(p.songIds) ? p.songIds.length : (Array.isArray(p.songs) ? p.songs.length : 0),
      createdDate: p.createdDate || new Date().toISOString(),
      modifiedDate: p.modifiedDate || new Date().toISOString()
    }));
  }

  /**
   * Save all playlists (internal use)
   * @param {Array<Object>} playlists - Complete playlist array
   * @returns {boolean} Success status
   */
  async savePlaylists(playlists) {
    return await this.writeJSON(this.playlistsFile, playlists);
  }

  /**
   * Get a single playlist by ID
   * @param {string} id - Playlist ID
   * @returns {Object|undefined} Playlist object or undefined
   */
  async getPlaylistById(id) {
    const playlists = await this.getPlaylists();
    return playlists.find(playlist => playlist.id === id);
  }

  /**
   * Create a new playlist
   * @param {Object} data - Playlist data (name, description, songIds)
   * @returns {Object} Created playlist with generated ID and timestamps
   */
  async createPlaylist(data) {
    const playlists = await this.getPlaylists();
    const newPlaylist = {
      id: `pl_${Date.now()}`,
      name: data.name,
      description: data.description || '',
      songIds: Array.isArray(data.songIds) ? data.songIds : [],
      songCount: Array.isArray(data.songIds) ? data.songIds.length : 0,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString()
    };
    playlists.push(newPlaylist);
    await this.savePlaylists(playlists);
    return newPlaylist;
  }

  /**
   * Update an existing playlist
   * Automatically updates modifiedDate and recalculates songCount
   * @param {string} id - Playlist ID
   * @param {Object} updates - Fields to update
   * @returns {Object|boolean} Updated playlist or false if not found
   */
  async updatePlaylist(id, updates) {
    const playlists = await this.getPlaylists();
    const index = playlists.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    const updated = {
      ...playlists[index],
      ...updates,
      modifiedDate: new Date().toISOString()
    };
    
    // Always recalculate songCount from songIds
    if (Array.isArray(updated.songIds)) {
      updated.songCount = updated.songIds.length;
    }
    
    playlists[index] = updated;
    await this.savePlaylists(playlists);
    return updated;
  }

  /**
   * Delete a playlist
   * @param {string} id - Playlist ID
   * @returns {boolean} True if deleted, false if not found
   */
  async deletePlaylist(id) {
    const playlists = await this.getPlaylists();
    const filtered = playlists.filter(p => p.id !== id);
    if (filtered.length < playlists.length) {
      await this.savePlaylists(filtered);
      return true;
    }
    return false;
  }

  // ============================================
  // Play History Tracking
  // ============================================

  /**
   * Get play history (most recent first)
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array<Object>} Play history entries
   */
  async getPlayHistory(limit = 100) {
    const history = await this.readJSON(this.playHistoryFile) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Add a play to history
   * Also increments song play count and updates last played
   * Automatically prunes history to last 1000 entries
   * @param {string} songId - ID of played song
   * @param {number} durationPlayed - Seconds played
   * @returns {boolean} Success status
   */
  async addPlayHistory(songId, durationPlayed) {
    const history = await this.readJSON(this.playHistoryFile) || [];
    history.push({
      id: Date.now().toString(),
      songId,
      playedAt: new Date().toISOString(),
      durationPlayed
    });
    
    // Keep only last 1000 entries to prevent unbounded growth
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    // Update song play count and timestamp
    await this.incrementPlayCount(songId);
    
    return await this.writeJSON(this.playHistoryFile, history);
  }

  /**
   * Increment play count for a song and update last played timestamp
   * @param {string} songId - Song ID
   */
  async incrementPlayCount(songId) {
    const songs = await this.getSongs();
    const index = songs.findIndex(song => song.id === songId);
    if (index !== -1) {
      songs[index].playCount = (songs[index].playCount || 0) + 1;
      songs[index].lastPlayed = new Date().toISOString();
      await this.saveSongs(songs);
    }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Calculate comprehensive library statistics
   * Generates stats on-the-fly from songs, playlists, and history
   * @returns {Object} Statistics object with various metrics
   */
  async getStats() {
    const songs = await this.getSongs();
    const playlists = await this.getPlaylists();
    const history = await this.readJSON(this.playHistoryFile) || [];
    
    // Calculate various statistics
    const totalSongs = songs.length;
    const totalDuration = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
    const totalPlays = songs.reduce((sum, song) => sum + (song.playCount || 0), 0);
    
    // Get unique counts
    const artists = new Set(songs.map(s => s.artist).filter(Boolean));
    const albums = new Set(songs.map(s => s.album).filter(Boolean));
    const genres = new Set(songs.map(s => s.genre).filter(Boolean));
    
    // Most played songs (top 10)
    const mostPlayed = [...songs]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 10);
    
    // Recently played - enrich with song data
    const recentPlays = history.slice(-10).reverse();
    const recentlyPlayed = recentPlays.map(play => {
      const song = songs.find(s => s.id === play.songId);
      return {
        ...play,
        title: song?.title || 'Unknown',
        artist: song?.artist || 'Unknown Artist',
        album: song?.album || 'Unknown Album'
      };
    }).filter(play => play.title !== 'Unknown');
    
    return {
      totalSongs,
      totalDuration,
      totalPlays,
      totalPlaylists: playlists.length,
      uniqueArtists: artists.size,
      uniqueAlbums: albums.size,
      uniqueGenres: genres.size,
      mostPlayed,
      recentlyPlayed
    };
  }
}

export default Storage;
