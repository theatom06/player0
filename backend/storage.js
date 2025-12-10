import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Storage {
  constructor(dataDir = './data') {
    this.dataDir = path.resolve(__dirname, dataDir);
    this.songsFile = path.join(this.dataDir, 'songs.json');
    this.playlistsFile = path.join(this.dataDir, 'playlists.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.playHistoryFile = path.join(this.dataDir, 'play_history.json');
  }

  async init() {
    // Create data directory if it doesn't exist
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Initialize files if they don't exist
    await this.ensureFile(this.songsFile, []);
    await this.ensureFile(this.playlistsFile, []);
    await this.ensureFile(this.statsFile, {});
    await this.ensureFile(this.playHistoryFile, []);
  }

  async ensureFile(filePath, defaultContent) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }

  async readJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
      return null;
    }
  }

  async writeJSON(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error);
      return false;
    }
  }

  // Songs
  async getSongs() {
    return await this.readJSON(this.songsFile) || [];
  }

  async saveSongs(songs) {
    return await this.writeJSON(this.songsFile, songs);
  }

  async getSongById(id) {
    const songs = await this.getSongs();
    return songs.find(song => song.id === id);
  }

  async addSong(song) {
    const songs = await this.getSongs();
    songs.push(song);
    return await this.saveSongs(songs);
  }

  async updateSong(id, updates) {
    const songs = await this.getSongs();
    const index = songs.findIndex(song => song.id === id);
    if (index !== -1) {
      songs[index] = { ...songs[index], ...updates };
      return await this.saveSongs(songs);
    }
    return false;
  }

  // Playlists
  async getPlaylists() {
    return await this.readJSON(this.playlistsFile) || [];
  }

  async savePlaylists(playlists) {
    return await this.writeJSON(this.playlistsFile, playlists);
  }

  async getPlaylistById(id) {
    const playlists = await this.getPlaylists();
    return playlists.find(playlist => playlist.id === id);
  }

  async createPlaylist(playlist) {
    const playlists = await this.getPlaylists();
    const newPlaylist = {
      id: Date.now().toString(),
      name: playlist.name,
      description: playlist.description || '',
      songs: [],
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString()
    };
    playlists.push(newPlaylist);
    await this.savePlaylists(playlists);
    return newPlaylist;
  }

  async updatePlaylist(id, updates) {
    const playlists = await this.getPlaylists();
    const index = playlists.findIndex(playlist => playlist.id === id);
    if (index !== -1) {
      playlists[index] = {
        ...playlists[index],
        ...updates,
        modifiedDate: new Date().toISOString()
      };
      return await this.savePlaylists(playlists);
    }
    return false;
  }

  async deletePlaylist(id) {
    const playlists = await this.getPlaylists();
    const filtered = playlists.filter(playlist => playlist.id !== id);
    if (filtered.length !== playlists.length) {
      return await this.savePlaylists(filtered);
    }
    return false;
  }

  // Play History
  async getPlayHistory(limit = 100) {
    const history = await this.readJSON(this.playHistoryFile) || [];
    return history.slice(-limit).reverse();
  }

  async addPlayHistory(songId, durationPlayed) {
    const history = await this.readJSON(this.playHistoryFile) || [];
    history.push({
      id: Date.now().toString(),
      songId,
      playedAt: new Date().toISOString(),
      durationPlayed
    });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    // Update song play count
    await this.incrementPlayCount(songId);
    
    return await this.writeJSON(this.playHistoryFile, history);
  }

  async incrementPlayCount(songId) {
    const songs = await this.getSongs();
    const index = songs.findIndex(song => song.id === songId);
    if (index !== -1) {
      songs[index].playCount = (songs[index].playCount || 0) + 1;
      songs[index].lastPlayed = new Date().toISOString();
      await this.saveSongs(songs);
    }
  }

  // Stats
  async getStats() {
    const songs = await this.getSongs();
    const playlists = await this.getPlaylists();
    const history = await this.readJSON(this.playHistoryFile) || [];
    
    // Calculate various statistics
    const totalSongs = songs.length;
    const totalDuration = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
    const totalPlays = songs.reduce((sum, song) => sum + (song.playCount || 0), 0);
    
    // Get unique artists, albums, genres
    const artists = new Set(songs.map(s => s.artist).filter(Boolean));
    const albums = new Set(songs.map(s => s.album).filter(Boolean));
    const genres = new Set(songs.map(s => s.genre).filter(Boolean));
    
    // Most played songs
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
