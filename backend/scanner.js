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
import { AubioAnalyzer } from './analyzer/aubioAnalyzer.js';

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUnknownText(text) {
  const t = normalizeWhitespace(text).toLowerCase();
  return !t || t === 'unknown' || t === 'unknown artist' || t === 'unknown album';
}

function cleanFilenameStem(stem) {
  let s = normalizeWhitespace(stem);

  // Strip common prefixes like track numbers: "01 ", "01-", "01." etc.
  s = s.replace(/^\(?\s*\d{1,3}\s*\)?\s*[-._]+\s*/i, '');
  s = s.replace(/^\d{1,3}\s+/i, '');

  // Strip common bracketed noise (kept conservative).
  s = s.replace(/\s*[\[(]{1}[^\])]{1,40}[\])]{1}\s*/g, ' ');

  // Normalize separators.
  s = s.replace(/[•·]/g, '-');
  s = normalizeWhitespace(s);

  return s;
}

function splitArtistTitle(stem) {
  const s = cleanFilenameStem(stem);
  const parts = s.split(/\s+-\s+|\s+–\s+|\s+—\s+/).map(x => normalizeWhitespace(x)).filter(Boolean);
  if (parts.length < 2) return null;
  const artist = parts[0];
  const title = parts.slice(1).join(' - ');
  if (!artist || !title) return null;
  return { artist, title };
}

function parseLeadingTrackNumber(stem) {
  const m = String(stem || '').match(/^\s*(\d{1,3})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return Math.trunc(n);
}

function inferFromFolders(filePath, rootDir) {
  try {
    const rel = rootDir ? path.relative(rootDir, filePath) : null;
    const parts = (rel ? rel.split(path.sep) : filePath.split(path.sep)).filter(Boolean);
    // Expect .../<artist>/<album>/<file>
    const fileName = parts[parts.length - 1] || '';
    const album = parts.length >= 2 ? parts[parts.length - 2] : null;
    const artist = parts.length >= 3 ? parts[parts.length - 3] : null;
    return {
      artist: artist ? normalizeWhitespace(artist) : null,
      album: album ? normalizeWhitespace(album) : null,
      fileName
    };
  } catch {
    return { artist: null, album: null, fileName: '' };
  }
}

function inferYearFromFolderName(name) {
  const m = String(name || '').match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  return Math.trunc(y);
}

function normalizeBpm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Keep conservative bounds to avoid garbage values.
  if (n < 30 || n > 300) return null;
  return Math.round(n);
}

function normalizeKey(value) {
  const s = normalizeWhitespace(value);
  if (!s) return null;
  if (s.length > 32) return s.slice(0, 32);
  return s;
}

class MusicScanner {
  /**
   * Initialize music scanner with configuration
   */
  constructor() {
    this.storage = new Storage(configData.dataDirectory);
    this.supportedFormats = configData.supportedFormats;
    this.musicDirectories = configData.musicDirectories;

    // Background analyzer: never blocks scan() completion.
    this.analyzer = new AubioAnalyzer({
      cacheFilePath: path.join(this.storage.dataDir, 'analysis_cache.json'),
      concurrency: 1,
      logger: console
    });
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
            // Even if unchanged, opportunistically analyze missing BPM/key in background.
            if (ext === '.mp3' && (existingSong.bpm == null || existingSong.key == null)) {
              void this.analyzer.enqueue({
                filePath,
                statHint: { size: stats.size, mtimeMs: stats.mtimeMs },
                songId: existingSong.id,
                storage: this.storage
              });
            }
            songs.push(existingSong);
            continue;
          }
          
          // Extract metadata from audio file
          const metadata = await this.extractMetadata(filePath, stats, directory);
          
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

            if (ext === '.mp3' && (updatedSong.bpm == null || updatedSong.key == null)) {
              void this.analyzer.enqueue({
                filePath,
                statHint: { size: stats.size, mtimeMs: stats.mtimeMs },
                songId: updatedSong.id,
                storage: this.storage
              });
            }
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

            if (ext === '.mp3' && (newSong.bpm == null || newSong.key == null)) {
              void this.analyzer.enqueue({
                filePath,
                statHint: { size: stats.size, mtimeMs: stats.mtimeMs },
                songId: newSong.id,
                storage: this.storage
              });
            }
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
  async extractMetadata(filePath, stats, rootDir) {
    try {
      const metadata = await parseFile(filePath);
      const { common, format } = metadata;

      const ext = path.extname(filePath);
      const stemRaw = path.basename(filePath, ext);
      const stem = cleanFilenameStem(stemRaw);
      const folderGuess = inferFromFolders(filePath, rootDir);

      const parsedArtistTitle = splitArtistTitle(stemRaw);

      const titleFromTags = common.title;
      const artistFromTags = common.artist;
      const albumFromTags = common.album;

      const title = !isUnknownText(titleFromTags)
        ? normalizeWhitespace(titleFromTags)
        : (parsedArtistTitle?.title || stem || path.basename(filePath, ext));

      const artist = !isUnknownText(artistFromTags)
        ? normalizeWhitespace(artistFromTags)
        : (parsedArtistTitle?.artist || folderGuess.artist || 'Unknown Artist');

      const album = !isUnknownText(albumFromTags)
        ? normalizeWhitespace(albumFromTags)
        : (folderGuess.album || 'Unknown Album');

      const albumArtist = !isUnknownText(common.albumartist)
        ? normalizeWhitespace(common.albumartist)
        : (!isUnknownText(artistFromTags) ? normalizeWhitespace(artistFromTags) : (folderGuess.artist || null));

      const trackNumber = common.track?.no || parseLeadingTrackNumber(stemRaw) || null;
      const discNumber = common.disk?.no || null;

      const year = common.year || inferYearFromFolderName(folderGuess.album) || inferYearFromFolderName(folderGuess.artist) || null;

      const bpm = normalizeBpm(common.bpm);
      const key = normalizeKey(common.key);

      return {
        title,
        artist,
        album,
        albumArtist,
        genre: common.genre?.[0] || null,
        year,
        trackNumber,
        discNumber,
        bpm,
        key,
        duration: format.duration || null,
        bitrate: format.bitrate || null,
        fileSize: stats.size,
        format: format.container || path.extname(filePath).substring(1)
      };
    } catch (error) {
      console.error(`Error extracting metadata from ${filePath}:`, error.message);
      // Return basic metadata from filename if extraction fails

      const ext = path.extname(filePath);
      const stemRaw = path.basename(filePath, ext);
      const stem = cleanFilenameStem(stemRaw);
      const folderGuess = inferFromFolders(filePath, rootDir);
      const parsedArtistTitle = splitArtistTitle(stemRaw);

      const title = parsedArtistTitle?.title || stem || path.basename(filePath, ext);
      const artist = parsedArtistTitle?.artist || folderGuess.artist || 'Unknown Artist';
      const album = folderGuess.album || 'Unknown Album';
      const year = inferYearFromFolderName(folderGuess.album) || inferYearFromFolderName(folderGuess.artist) || null;

      return {
        title,
        artist,
        album,
        albumArtist: folderGuess.artist || null,
        genre: null,
        year,
        trackNumber: parseLeadingTrackNumber(stemRaw) || null,
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
  scanner.scan().then(async () => {
    // When invoked as a CLI, wait for background analysis/tagging to finish.
    // (The API route still returns immediately after scan completes.)
    try {
      await scanner.analyzer.idle();
      await scanner.analyzer.cache.flush();
    } catch {
      // ignore
    }
    console.log('Scan completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Scan failed:', error);
    process.exit(1);
  });
}

export default MusicScanner;
