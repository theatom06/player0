/**
 * ============================================
 * Music Scanner Module
 * ============================================
 * 
 * Scans music directories and extracts metadata using music-metadata library.
 * 
 * Features:
 * - Recursive directory traversal
 * - ID3 tag extraction (title, artist, album, etc.)
 * - Incremental updates (only scans modified files)
 * - Play count preservation during updates
 * - Batch processing with progress logging
 * - Error handling per file (one bad file won't stop entire scan)
 * 
 * Supported Formats: MP3, FLAC, OGG, M4A, WAV
 * 
 * @module scanner
 */

import fs from 'fs/promises';
import path from 'path';
import { parseFile } from 'music-metadata';
import Storage from './storage.js';
import configData from './config.json' with { type: 'json' };

class MusicScanner {
  /**
   * Initialize music scanner with configuration
   */
  constructor() {
    this.storage = new Storage(configData.dataDirectory);
    this.supportedFormats = configData.supportedFormats;
    this.musicDirectories = configData.musicDirectories;
  }

  /**
   * Scan all configured music directories
   * Performs incremental scan - only processes new/modified files
   * Preserves play counts and other user data during updates
   * @returns {Object} Scan results with added/updated/total counts
   */
  async scan() {
    console.log('Starting music library scan...');
    await this.storage.init();
    
    // Load existing songs for comparison
    const songs = await this.storage.getSongs();
    const existingSongs = new Map(songs.map(song => [song.filePath, song]));
    
    let totalAdded = 0;
    let totalUpdated = 0;
    let allSongs = [];

    // Scan each configured directory
    for (const directory of this.musicDirectories) {
      try {
        await fs.access(directory);
        console.log(`Scanning: ${directory}`);
        const { added, updated, songs: dirSongs } = await this.scanDirectory(directory, existingSongs);
        totalAdded += added;
        totalUpdated += updated;
        allSongs.push(...dirSongs);
      } catch (error) {
        console.log(`Directory not found or inaccessible: ${directory}`);
      }
    }

    // Save all songs to storage
    await this.storage.saveSongs(allSongs);
    
    console.log(`\nScan complete! Added: ${totalAdded}, Updated: ${totalUpdated}, Total: ${allSongs.length}`);
    return { added: totalAdded, updated: totalUpdated, total: allSongs.length };
  }

  /**
   * Scan a single directory recursively
   * Walks through all subdirectories and processes audio files
   * @param {string} directory - Root directory to scan
   * @param {Map} existingSongs - Map of existing songs by file path
   * @returns {Object} Results with added/updated counts and song list
   */
  async scanDirectory(directory, existingSongs) {
    let added = 0;
    let updated = 0;
    let songs = [];

    /**
     * Async generator for recursive directory traversal
     * Yields full file paths for all files in directory tree
     */
    async function* walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          yield* walk(fullPath);
        } else {
          yield fullPath;
        }
      }
    }

    // Process each file in the directory tree
    for await (const filePath of walk(directory)) {
      const ext = path.extname(filePath).toLowerCase();
      
      // Only process supported audio formats
      if (this.supportedFormats.includes(ext)) {
        try {
          const stats = await fs.stat(filePath);
          const lastModified = stats.mtime.toISOString();
          
          const existingSong = existingSongs.get(filePath);
          
          // Skip if file hasn't been modified since last scan
          if (existingSong && existingSong.lastModified === lastModified) {
            songs.push(existingSong);
            continue;
          }
          
          // Extract metadata from audio file
          const metadata = await this.extractMetadata(filePath, stats);
          
          if (existingSong) {
            // Update existing song, preserve user data (play stats)
            const updatedSong = {
              ...existingSong,
              ...metadata,
              lastModified,
              playCount: existingSong.playCount || 0,
              lastPlayed: existingSong.lastPlayed || null
            };
            songs.push(updatedSong);
            updated++;
          } else {
            // New song - create with default values
            const newSong = {
              id: this.generateId(filePath),
              ...metadata,
              filePath,
              lastModified,
              addedDate: new Date().toISOString(),
              playCount: 0,
              lastPlayed: null
            };
            songs.push(newSong);
            added++;
          }
          
          // Progress logging every 100 files
          if ((added + updated) % 100 === 0) {
            console.log(`Processed ${added + updated} files...`);
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error.message);
        }
      }
    }

    return { added, updated, songs };
  }

  /**
   * Extract metadata from audio file using music-metadata library
   * Parses ID3 tags and audio format information
   * Falls back to filename if metadata extraction fails
   * @param {string} filePath - Path to audio file
   * @param {Object} stats - File system stats object
   * @returns {Object} Extracted metadata
   */
  async extractMetadata(filePath, stats) {
    try {
      const metadata = await parseFile(filePath);
      const { common, format } = metadata;
      
      return {
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        albumArtist: common.albumartist || common.artist || null,
        genre: common.genre?.[0] || null,
        year: common.year || null,
        trackNumber: common.track?.no || null,
        discNumber: common.disk?.no || null,
        duration: format.duration || null,
        bitrate: format.bitrate || null,
        fileSize: stats.size,
        format: format.container || path.extname(filePath).substring(1)
      };
    } catch (error) {
      console.error(`Error extracting metadata from ${filePath}:`, error.message);
      // Return basic metadata from filename if extraction fails
      return {
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        albumArtist: null,
        genre: null,
        year: null,
        trackNumber: null,
        discNumber: null,
        duration: null,
        bitrate: null,
        fileSize: stats.size,
        format: path.extname(filePath).substring(1)
      };
    }
  }

  /**
   * Generate unique ID for a song based on file path and timestamp
   * Uses simple hash algorithm combined with timestamp for uniqueness
   * @param {string} filePath - File path to hash
   * @returns {string} Base36 encoded unique ID
   */
  generateId(filePath) {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36) + Date.now().toString(36);
  }
}

// ============================================
// CLI Entry Point
// ============================================

/**
 * Run scanner directly from command line
 * Usage: bun run backend/scanner.js
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new MusicScanner();
  scanner.scan().then(() => {
    console.log('Scan completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Scan failed:', error);
    process.exit(1);
  });
}

export default MusicScanner;
