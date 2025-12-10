import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Storage from './storage.js';
import MusicScanner from './scanner.js';
import configData from './config.json' with { type: 'json' };
import {
  validate,
  isPathSafe,
  fileExists,
  searchValidation,
  playlistCreateValidation,
  playlistUpdateValidation,
  playHistoryValidation,
  historyLimitValidation,
  idValidation,
  sanitizeError
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const storage = new Storage(configData.dataDirectory);

// Security Middleware
// Add helmet for security headers
app.use(helmet({
  // Configure Content Security Policy to allow external scripts and media
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for dynamic UI
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false // Disabled to allow audio streaming
}));

// Configure CORS with specific origin (adjust in production)
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser with size limits to prevent DoS
app.use(express.json({ limit: '1mb' }));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to API routes
app.use('/api/', limiter);

// Stricter rate limit for write operations
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

// Even stricter rate limit for scan operations
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many scan requests, please try again later.'
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize storage
await storage.init();

// API Routes

// Get all songs
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await storage.getSongs();
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get song by ID
app.get('/api/songs/:id', idValidation, async (req, res) => {
  try {
    const song = await storage.getSongById(req.params.id);
    if (song) {
      res.json(song);
    } else {
      res.status(404).json({ error: 'Song not found' });
    }
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Search songs
app.get('/api/search', searchValidation, async (req, res) => {
  try {
    const { q, artist, album, genre, year } = req.query;
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
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get all albums
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
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get album details
app.get('/api/albums/:artist/:album', async (req, res) => {
  try {
    const { artist, album } = req.params;
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
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get all artists
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
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Stream audio file
app.get('/api/stream/:id', idValidation, async (req, res) => {
  try {
    const song = await storage.getSongById(req.params.id);
    
    if (!song || !song.filePath) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const filePath = song.filePath;
    
    // Security: Validate that the file path is within allowed directories
    if (!isPathSafe(filePath, configData.musicDirectories)) {
      console.error(`Path traversal attempt blocked: ${filePath}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fileExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      // Validate range values
      if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
        return res.status(416).json({ error: 'Invalid range' });
      }
      
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
    console.error('Stream error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get album cover art
app.get('/api/cover/:id', idValidation, async (req, res) => {
  try {
    const song = await storage.getSongById(req.params.id);
    
    if (!song || !song.filePath) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const filePath = song.filePath;
    
    // Security: Validate that the file path is within allowed directories
    if (!isPathSafe(filePath, configData.musicDirectories)) {
      console.error(`Path traversal attempt blocked: ${filePath}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fileExists(filePath)) {
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
    return res.status(500).json({ error: sanitizeError(error) });
  }
});

// Playlists

// Get all playlists
app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await storage.getPlaylists();
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get playlist by ID
app.get('/api/playlists/:id', idValidation, async (req, res) => {
  try {
    const playlist = await storage.getPlaylistById(req.params.id);
    if (playlist) {
      res.json(playlist);
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Create playlist
app.post('/api/playlists', writeLimiter, playlistCreateValidation, async (req, res) => {
  try {
    const playlist = await storage.createPlaylist(req.body);
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Update playlist
app.put('/api/playlists/:id', writeLimiter, idValidation, playlistUpdateValidation, async (req, res) => {
  try {
    const success = await storage.updatePlaylist(req.params.id, req.body);
    if (success) {
      const playlist = await storage.getPlaylistById(req.params.id);
      res.json(playlist);
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Delete playlist
app.delete('/api/playlists/:id', writeLimiter, idValidation, async (req, res) => {
  try {
    const success = await storage.deletePlaylist(req.params.id);
    if (success) {
      res.json({ message: 'Playlist deleted' });
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Play history

// Record play
app.post('/api/play/:id', idValidation, playHistoryValidation, async (req, res) => {
  try {
    const { durationPlayed } = req.body;
    await storage.addPlayHistory(req.params.id, durationPlayed);
    res.json({ message: 'Play recorded' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get play history
app.get('/api/history', historyLimitValidation, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await storage.getPlayHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Scan library
app.post('/api/scan', scanLimiter, async (req, res) => {
  try {
    const scanner = new MusicScanner();
    const result = await scanner.scan();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = configData.port || 3000;
const HOST = configData.host || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🎵 Project 0 Music Server running on http://${HOST}:${PORT}`);
  console.log(`📁 Data directory: ${configData.dataDirectory}`);
  console.log(`🎶 Music directories: ${configData.musicDirectories.join(', ')}`);
  console.log(`\n💡 Run 'npm run scan' to scan your music library`);
});
