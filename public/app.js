// API Base URL
const API_URL = 'https://legendary-chainsaw-r9r6r5jjrr4fwq6p-3000.app.github.dev/api';

// State
let allSongs = [];
let currentSongs = [];
let queue = [];
let currentIndex = -1;
let isPlaying = false;

// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const searchInput = document.getElementById('searchInput');
const advancedSearch = document.getElementById('advancedSearch');
const advancedSearchToggle = document.getElementById('advancedSearchToggle');
const nowPlayingSidebar = document.getElementById('nowPlayingSidebar');
const miniPlayer = document.getElementById('miniPlayer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSearch();
  setupPlayer();
  setupSidebar();
  setupModal();
  loadSongs();
});

function setupModal() {
  document.getElementById('closePlaylistModal').onclick = closePlaylistModal;
  document.getElementById('cancelPlaylist').onclick = closePlaylistModal;
  document.getElementById('savePlaylist').onclick = savePlaylist;
  
  // Close modal on outside click
  document.getElementById('playlistModal').onclick = (e) => {
    if (e.target.id === 'playlistModal') {
      closePlaylistModal();
    }
  };
}

// Navigation
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  document.getElementById('scanButton').addEventListener('click', scanLibrary);
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  
  const viewMap = {
    'library': 'libraryView',
    'albums': 'albumsView',
    'artists': 'artistsView',
    'playlists': 'playlistsView',
    'stats': 'statsView'
  };
  
  const viewId = viewMap[viewName];
  if (viewId) {
    document.getElementById(viewId).classList.remove('hidden');
    
    // Load data for view
    switch(viewName) {
      case 'albums':
        loadAlbums();
        break;
      case 'artists':
        loadArtists();
        break;
      case 'playlists':
        loadPlaylists();
        break;
      case 'stats':
        loadStats();
        break;
    }
  }
}

// Search
function setupSearch() {
  const searchButton = document.querySelector('.search-button');
  
  searchInput.addEventListener('input', debounce(performSearch, 300));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
  
  searchButton.addEventListener('click', performSearch);
  
  advancedSearchToggle.addEventListener('click', () => {
    advancedSearch.style.display = advancedSearch.style.display === 'none' ? 'block' : 'none';
  });
  
  document.getElementById('applyFilters').addEventListener('click', applyAdvancedSearch);
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function performSearch() {
  const query = searchInput.value.trim();
  
  if (!query) {
    currentSongs = allSongs;
    renderSongs(currentSongs);
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    const songs = await response.json();
    currentSongs = songs;
    renderSongs(currentSongs);
  } catch (error) {
    console.error('Search error:', error);
  }
}

async function applyAdvancedSearch() {
  const artist = document.getElementById('filterArtist').value;
  const album = document.getElementById('filterAlbum').value;
  const genre = document.getElementById('filterGenre').value;
  const year = document.getElementById('filterYear').value;
  
  const params = new URLSearchParams();
  if (artist) params.append('artist', artist);
  if (album) params.append('album', album);
  if (genre) params.append('genre', genre);
  if (year) params.append('year', year);
  
  try {
    const response = await fetch(`${API_URL}/search?${params}`);
    const songs = await response.json();
    currentSongs = songs;
    renderSongs(currentSongs);
  } catch (error) {
    console.error('Advanced search error:', error);
  }
}

function clearFilters() {
  document.getElementById('filterArtist').value = '';
  document.getElementById('filterAlbum').value = '';
  document.getElementById('filterGenre').value = '';
  document.getElementById('filterYear').value = '';
  searchInput.value = '';
  currentSongs = allSongs;
  renderSongs(currentSongs);
}

// Load Songs
async function loadSongs() {
  try {
    const response = await fetch(`${API_URL}/songs`);
    allSongs = await response.json();
    currentSongs = allSongs;
    renderSongs(currentSongs);
  } catch (error) {
    console.error('Error loading songs:', error);
  }
}

function renderSongs(songs) {
  const tbody = document.getElementById('songTableBody');
  tbody.innerHTML = '';
  
  if (songs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 48px;">No songs found</td></tr>';
    return;
  }
  
  songs.forEach((song, index) => {
    const tr = document.createElement('tr');
    const coverUrl = `${API_URL}/cover/${song.id}`;
    const albumTitle = song.album || 'Unknown Album';
    const truncatedAlbum = albumTitle.length > 30 ? albumTitle.substring(0, 30) + '...' : albumTitle;
    tr.innerHTML = `
      <td class="col-play">
        <button class="play-button" onclick="playSongFromList(${index})">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </td>
      <td class="col-cover">
        <img class="song-cover" src="${coverUrl}" alt="" onerror="this.style.display='none'" />
      </td>
      <td class="col-title">${escapeHtml(song.title || 'Unknown')}</td>
      <td class="col-artist">${escapeHtml(song.artist || 'Unknown Artist')}</td>
      <td class="col-album" title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedAlbum)}</td>
      <td class="col-duration">${formatDuration(song.duration)}</td>
      <td class="col-plays">${song.playCount || 0}</td>
    `;
    tr.addEventListener('dblclick', () => playSongFromList(index));
    tbody.appendChild(tr);
  });
  
  // Setup play all and shuffle buttons
  document.getElementById('playAll').onclick = () => playAll();
  document.getElementById('shuffleAll').onclick = () => shuffleAll();
}

// Albums
async function loadAlbums() {
  try {
    const response = await fetch(`${API_URL}/albums`);
    const albums = await response.json();
    renderAlbums(albums);
  } catch (error) {
    console.error('Error loading albums:', error);
  }
}

function renderAlbums(albums) {
  const grid = document.getElementById('albumGrid');
  grid.innerHTML = '';
  
  albums.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    const coverUrl = album.songs && album.songs[0] ? `${API_URL}/cover/${album.songs[0].id}` : '';
    const albumTitle = album.album || 'Unknown Album';
    const truncatedTitle = albumTitle.length > 25 ? albumTitle.substring(0, 25) + '...' : albumTitle;
    card.innerHTML = `
      <div class="album-cover-wrapper">
        <img class="album-artwork" src="${coverUrl}" alt="${escapeHtml(albumTitle)}" onerror="this.style.display='none';" />
        <div class="album-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
      </div>
      <h3 title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedTitle)}</h3>
      <p>${escapeHtml(album.artist || 'Unknown Artist')}</p>
      <p style="font-size: 12px; margin-top: 4px;">${album.songCount} songs</p>
    `;
    card.addEventListener('click', () => loadAlbumDetail(album.artist, album.album));
    grid.appendChild(card);
  });
}

async function loadAlbumDetail(artist, album) {
  try {
    const response = await fetch(`${API_URL}/albums/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`);
    const albumData = await response.json();
    renderAlbumDetail(albumData);
    
    document.getElementById('albumsView').classList.add('hidden');
    document.getElementById('albumDetailView').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading album detail:', error);
  }
}

function renderAlbumDetail(album) {
  document.getElementById('albumTitle').textContent = album.album;
  document.getElementById('albumArtist').textContent = album.artist;
  document.getElementById('albumMeta').textContent = `${album.year || 'Unknown Year'} • ${album.songs.length} songs • ${formatDuration(album.duration)}`;
  
  // Set album artwork
  const albumArtwork = document.getElementById('albumArtwork');
  albumArtwork.style.display = 'block';
  if (album.songs && album.songs[0]) {
    albumArtwork.onerror = () => {
      albumArtwork.style.display = 'none';
    };
    albumArtwork.src = `${API_URL}/cover/${album.songs[0].id}`;
  } else {
    albumArtwork.style.display = 'none';
  }
  
  const tbody = document.getElementById('albumSongTableBody');
  tbody.innerHTML = '';
  
  album.songs.forEach((song, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-track">${song.trackNumber || '-'}</td>
      <td class="col-play">
        <button class="play-button" onclick="playAlbumSong(${index})">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </td>
      <td class="col-title">${escapeHtml(song.title)}</td>
      <td class="col-duration">${formatDuration(song.duration)}</td>
    `;
    tr.addEventListener('dblclick', () => playAlbumSong(index));
    tbody.appendChild(tr);
  });
  
  // Store album songs for playback
  window.currentAlbumSongs = album.songs;
  
  document.getElementById('playAlbum').onclick = () => playAlbumAll();
  document.getElementById('shuffleAlbum').onclick = () => shuffleAlbum();
  document.getElementById('backToAlbums').onclick = () => {
    document.getElementById('albumDetailView').classList.add('hidden');
    document.getElementById('albumsView').classList.remove('hidden');
  };
}

// Artists
async function loadArtists() {
  try {
    const response = await fetch(`${API_URL}/artists`);
    const artists = await response.json();
    renderArtists(artists);
  } catch (error) {
    console.error('Error loading artists:', error);
  }
}

function renderArtists(artists) {
  const list = document.getElementById('artistList');
  list.innerHTML = '';
  
  artists.forEach(artist => {
    const item = document.createElement('div');
    item.className = 'artist-item';
    item.innerHTML = `
      <div>
        <div class="artist-name">${escapeHtml(artist.name)}</div>
        <div class="artist-meta">${artist.songCount} songs • ${artist.albumCount} albums</div>
      </div>
    `;
    item.addEventListener('click', () => {
      searchInput.value = artist.name;
      performSearch();
      switchView('library');
    });
    list.appendChild(item);
  });
}

// Playlists
async function loadPlaylists() {
  try {
    const response = await fetch(`${API_URL}/playlists`);
    const playlists = await response.json();
    renderPlaylists(playlists);
  } catch (error) {
    console.error('Error loading playlists:', error);
  }
}

function renderPlaylists(playlists) {
  const grid = document.getElementById('playlistGrid');
  grid.innerHTML = '';
  
  playlists.forEach(playlist => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
        </svg>
      </div>
      <h3>${escapeHtml(playlist.name)}</h3>
      <p>${playlist.songCount || 0} songs</p>
    `;
    grid.appendChild(card);
  });
  
  document.getElementById('createPlaylist').onclick = openPlaylistModal;
}

function openPlaylistModal() {
  document.getElementById('playlistModal').style.display = 'flex';
  document.getElementById('playlistName').value = '';
  document.getElementById('playlistDescription').value = '';
  document.getElementById('playlistName').focus();
}

function closePlaylistModal() {
  document.getElementById('playlistModal').style.display = 'none';
}

async function savePlaylist() {
  const name = document.getElementById('playlistName').value.trim();
  const description = document.getElementById('playlistDescription').value.trim();
  
  if (!name) {
    alert('Please enter a playlist name');
    return;
  }
  
  try {
    await fetch(`${API_URL}/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, songs: [] })
    });
    closePlaylistModal();
    loadPlaylists();
  } catch (error) {
    console.error('Error creating playlist:', error);
    alert('Error creating playlist');
  }
}

// Statistics
async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    const stats = await response.json();
    renderStats(stats);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function renderStats(stats) {
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${stats.totalSongs}</div>
      <div class="stat-label">Total Songs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.uniqueArtists}</div>
      <div class="stat-label">Artists</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.uniqueAlbums}</div>
      <div class="stat-label">Albums</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.uniqueGenres}</div>
      <div class="stat-label">Genres</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatDuration(stats.totalDuration)}</div>
      <div class="stat-label">Total Duration</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalPlays}</div>
      <div class="stat-label">Total Plays</div>
    </div>
  `;
  
  // Most played
  const mostPlayedList = document.getElementById('mostPlayedList');
  mostPlayedList.innerHTML = '';
  stats.mostPlayed.forEach(song => {
    const item = document.createElement('div');
    item.className = 'song-list-item';
    item.innerHTML = `
      <div>
        <div>${escapeHtml(song.title)}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(song.artist)}</div>
      </div>
      <div style="color: var(--text-secondary);">${song.playCount} plays</div>
    `;
    mostPlayedList.appendChild(item);
  });
}

// Player
function setupPlayer() {
  const playPauseButton = document.getElementById('playPauseButton');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const progressBar = document.getElementById('progressBar');
  const volumeSlider = document.getElementById('volumeSlider');
  
  playPauseButton.addEventListener('click', togglePlayPause);
  prevButton.addEventListener('click', playPrevious);
  nextButton.addEventListener('click', playNext);
  
  progressBar.addEventListener('input', (e) => {
    const time = (e.target.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = time;
  });
  
  volumeSlider.addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value / 100;
  });
  
  audioPlayer.addEventListener('timeupdate', updateProgress);
  audioPlayer.addEventListener('ended', playNext);
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updatePlayButton();
  });
  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayButton();
  });
  
  // Mini player controls
  document.getElementById('miniPlayPause').addEventListener('click', togglePlayPause);
  document.getElementById('miniPrev').addEventListener('click', playPrevious);
  document.getElementById('miniNext').addEventListener('click', playNext);
}

function playSongFromList(index) {
  queue = [...currentSongs];
  currentIndex = index;
  playSong(queue[currentIndex]);
}

function playAlbumSong(index) {
  queue = [...window.currentAlbumSongs];
  currentIndex = index;
  playSong(queue[currentIndex]);
}

function playAll() {
  queue = [...currentSongs];
  currentIndex = 0;
  playSong(queue[currentIndex]);
}

function shuffleAll() {
  queue = [...currentSongs].sort(() => Math.random() - 0.5);
  currentIndex = 0;
  playSong(queue[currentIndex]);
}

function playAlbumAll() {
  queue = [...window.currentAlbumSongs];
  currentIndex = 0;
  playSong(queue[currentIndex]);
}

function shuffleAlbum() {
  queue = [...window.currentAlbumSongs].sort(() => Math.random() - 0.5);
  currentIndex = 0;
  playSong(queue[currentIndex]);
}

function playSong(song) {
  if (!song) return;
  
  audioPlayer.src = `${API_URL}/stream/${song.id}`;
  audioPlayer.play();
  
  document.getElementById('npTitle').textContent = song.title || 'Unknown';
  document.getElementById('npArtist').textContent = song.artist || 'Unknown Artist';
  document.getElementById('miniTitle').textContent = song.title || 'Unknown';
  document.getElementById('miniArtist').textContent = song.artist || 'Unknown Artist';
  
  // Set album artwork
  const npArtwork = document.getElementById('npArtwork');
  npArtwork.onerror = () => {
    npArtwork.style.display = 'none';
  };
  npArtwork.src = `${API_URL}/cover/${song.id}`;
  npArtwork.style.display = 'block';
  
  updateQueue();
  
  // Record play
  recordPlay(song.id);
}

function togglePlayPause() {
  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
}

function updatePlayButton() {
  const playPauseButton = document.getElementById('playPauseButton');
  const miniPlayPause = document.getElementById('miniPlayPause');
  
  if (isPlaying) {
    playPauseButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    miniPlayPause.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  } else {
    playPauseButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>';
    miniPlayPause.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>';
  }
}

function playPrevious() {
  if (currentIndex > 0) {
    currentIndex--;
    playSong(queue[currentIndex]);
  }
}

function playNext() {
  if (currentIndex < queue.length - 1) {
    currentIndex++;
    playSong(queue[currentIndex]);
  }
}

function updateProgress() {
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  document.getElementById('progressBar').value = progress || 0;
  document.getElementById('currentTime').textContent = formatDuration(audioPlayer.currentTime);
  document.getElementById('totalTime').textContent = formatDuration(audioPlayer.duration);
}

function updateQueue() {
  const queueList = document.getElementById('queueList');
  queueList.innerHTML = '';
  
  if (queue.length === 0) {
    queueList.innerHTML = '<p class="empty-queue">Queue is empty</p>';
    return;
  }
  
  queue.forEach((song, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item' + (index === currentIndex ? ' active' : '');
    item.innerHTML = `
      <div class="queue-title">${escapeHtml(song.title)}</div>
      <div class="queue-artist">${escapeHtml(song.artist)}</div>
    `;
    item.addEventListener('click', () => {
      currentIndex = index;
      playSong(queue[currentIndex]);
    });
    queueList.appendChild(item);
  });
}

async function recordPlay(songId) {
  try {
    await fetch(`${API_URL}/play/${songId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationPlayed: 0 })
    });
  } catch (error) {
    console.error('Error recording play:', error);
  }
}

// Sidebar Toggle
function setupSidebar() {
  document.getElementById('closeSidebar').addEventListener('click', () => {
    nowPlayingSidebar.style.display = 'none';
    miniPlayer.style.display = 'flex';
    document.querySelector('.app-container').classList.add('sidebar-closed');
  });
  
  document.getElementById('expandSidebar').addEventListener('click', () => {
    nowPlayingSidebar.style.display = 'flex';
    miniPlayer.style.display = 'none';
    document.querySelector('.app-container').classList.remove('sidebar-closed');
  });
}

// Scan Library
async function scanLibrary() {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>Scanning...</span>';
  
  try {
    const response = await fetch(`${API_URL}/scan`, { method: 'POST' });
    const result = await response.json();
    alert(`Scan complete!\nAdded: ${result.added}\nUpdated: ${result.updated}\nTotal: ${result.total}`);
    loadSongs();
  } catch (error) {
    console.error('Scan error:', error);
    alert('Error scanning library');
  } finally {
    button.disabled = false;
    button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>Scan Library</span>';
  }
}

// Utility Functions
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally accessible
window.playSongFromList = playSongFromList;
window.playAlbumSong = playAlbumSong;
