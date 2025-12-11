import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Storage from './storage.js';
import MusicScanner from './scanner.js';
import configData from './config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const storage = new Storage(configData.dataDirectory);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    res.status(500).json({ error: error.message });
  }
});

// Get song by ID
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

// Search songs
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
    res.status(500).json({ error: error.message });
  }
});

// Get album details
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
    res.status(500).json({ error: error.message });
  }
});

// Stream audio file
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

// Get album cover art
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

// Playlists

// Get all playlists
app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await storage.getPlaylists();
    // Ensure backward compatibility: convert songs to songIds if needed
    const normalized = playlists.map(p => ({
      ...p,
      songIds: p.songIds || p.songs || [],
      songCount: p.songCount || (p.songIds || p.songs || []).length,
      songs: undefined // Remove old field
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create playlist
app.post('/api/playlists', async (req, res) => {
  try {
    const { name, description, songIds } = req.body;
    
    // Validate inputs
    if (!name || typeof name !== 'string' || name.length > 200) {
      return res.status(400).json({ error: 'Invalid playlist name' });
    }
    
    if (description && (typeof description !== 'string' || description.length > 1000)) {
      return res.status(400).json({ error: 'Invalid playlist description' });
    }
    
    if (!Array.isArray(songIds)) {
      return res.status(400).json({ error: 'Invalid song IDs' });
    }
    
    // Limit array size to prevent DoS
    if (songIds.length > 1000) {
      return res.status(400).json({ error: 'Too many songs (max 1000)' });
    }
    
    const playlist = await storage.createPlaylist({ name, description, songIds });
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get playlist by ID
app.get('/api/playlists/:id', async (req, res) => {
  try {
    // Validate playlist ID
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid playlist ID' });
    }
    
    const playlist = await storage.getPlaylistById(req.params.id);
    if (playlist) {
      // Normalize playlist structure
      const normalized = {
        ...playlist,
        songIds: playlist.songIds || playlist.songs || [],
        songCount: playlist.songCount || (playlist.songIds || playlist.songs || []).length,
        songs: undefined
      };
      res.json(normalized);
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update playlist
app.put('/api/playlists/:id', async (req, res) => {
  try {
    // Validate playlist ID
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid playlist ID' });
    }
    
    const { name, description, songIds } = req.body;
    
    // Validate inputs
    if (name && (typeof name !== 'string' || name.length > 200)) {
      return res.status(400).json({ error: 'Invalid playlist name' });
    }
    
    if (description && (typeof description !== 'string' || description.length > 1000)) {
      return res.status(400).json({ error: 'Invalid description' });
    }
    
    if (songIds && (!Array.isArray(songIds) || songIds.length > 1000)) {
      return res.status(400).json({ error: 'Invalid song IDs' });
    }
    
    const success = await storage.updatePlaylist(req.params.id, req.body);
    if (success) {
      const playlist = await storage.getPlaylistById(req.params.id);
      res.json(playlist);
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete playlist
app.delete('/api/playlists/:id', async (req, res) => {
  try {
    // Validate playlist ID
    if (!/^[a-zA-Z0-9-]+$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid playlist ID' });
    }
    
    const success = await storage.deletePlaylist(req.params.id);
    if (success) {
      res.json({ message: 'Playlist deleted' });
    } else {
      res.status(404).json({ error: 'Playlist not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Play history

// Record play
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

// Get play history
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

// Statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scan library
app.post('/api/scan', async (req, res) => {
  try {
    const scanner = new MusicScanner();
    const result = await scanner.scan();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  console.log(`🎵 Player 0 Server running on http://${HOST}:${PORT}`);
  console.log(`📁 Data directory: ${configData.dataDirectory}`);
  console.log(`🎶 Music directories: ${configData.musicDirectories.join(', ')}`);
  console.log(`\n💡 Run 'npm run scan' to scan your music library`);
});
