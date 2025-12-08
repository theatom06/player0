import fs from 'fs/promises';
import path from 'path';
import { parseFile } from 'music-metadata';
import Storage from './storage.js';
import configData from './config.json' with { type: 'json' };

class MusicScanner {
  constructor() {
    this.storage = new Storage(configData.dataDirectory);
    this.supportedFormats = configData.supportedFormats;
    this.musicDirectories = configData.musicDirectories;
  }

  async scan() {
    console.log('Starting music library scan...');
    await this.storage.init();
    
    const songs = await this.storage.getSongs();
    const existingSongs = new Map(songs.map(song => [song.filePath, song]));
    
    let totalAdded = 0;
    let totalUpdated = 0;
    let allSongs = [];

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

    // Save all songs
    await this.storage.saveSongs(allSongs);
    
    console.log(`\nScan complete! Added: ${totalAdded}, Updated: ${totalUpdated}, Total: ${allSongs.length}`);
    return { added: totalAdded, updated: totalUpdated, total: allSongs.length };
  }

  async scanDirectory(directory, existingSongs) {
    let added = 0;
    let updated = 0;
    let songs = [];

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

    for await (const filePath of walk(directory)) {
      const ext = path.extname(filePath).toLowerCase();
      
      if (this.supportedFormats.includes(ext)) {
        try {
          const stats = await fs.stat(filePath);
          const lastModified = stats.mtime.toISOString();
          
          const existingSong = existingSongs.get(filePath);
          
          // If exists and hasn't been modified, keep it
          if (existingSong && existingSong.lastModified === lastModified) {
            songs.push(existingSong);
            continue;
          }
          
          // Extract metadata
          const metadata = await this.extractMetadata(filePath, stats);
          
          if (existingSong) {
            // Update existing song, preserving play stats
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
            // New song
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

  generateId(filePath) {
    // Generate a simple hash-based ID from file path
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36) + Date.now().toString(36);
  }
}

// Run scanner if this file is executed directly
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
