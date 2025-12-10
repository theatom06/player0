// Main Application Entry Point
import { debounce } from './js/utils.js';
import { 
  simpleSearch,
  advancedSearch as AdvancedSearchAPI,
  fetchAllSongs,
  listAlbums,
  getAlbumDetail,
  listArtists,
  listPlaylists,
  createPlaylist,
  getStats,
  scanLibrary as scanLibraryAPI,
  clearCache
} from './js/API.js';
import { 
  currentSongs, 
  setCurrentSongs, 
  setQueue 
} from './js/state.js';
import { 
  initPlayer, 
  playSong, 
  togglePlayPause, 
  playNext, 
  playPrevious, 
  seek, 
  setVolume 
} from './js/player.js';
import { 
  renderSongs, 
  renderAlbums, 
  renderAlbumDetail, 
  renderArtists, 
  renderPlaylists, 
  renderStats 
} from './js/ui.js';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const advancedSearchEl = document.getElementById('advancedSearch');
const advancedSearchToggle = document.getElementById('advancedSearchToggle');
const nowPlayingSidebar = document.getElementById('nowPlayingSidebar');
const miniPlayer = document.getElementById('miniPlayer');

// Store for album songs
let currentAlbumSongs = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSearch();
  setupPlayer();
  setupSidebar();
  setupModal();
  loadSongs();
  
  // Hide now playing sidebar initially
  nowPlayingSidebar.style.display = 'none';
  miniPlayer.style.display = 'none';
  document.querySelector('.app-container').classList.add('sidebar-closed');
});

function setupModal() {
  document.getElementById('closePlaylistModal').onclick = closePlaylistModal;
  document.getElementById('cancelPlaylist').onclick = closePlaylistModal;
  document.getElementById('savePlaylist').onclick = savePlaylist;
  
  // Keyboard shortcuts modal
  const shortcutsBtn = document.getElementById('keyboardShortcutsBtn');
  const shortcutsModal = document.getElementById('keyboardShortcutsModal');
  const closeShortcutsBtn = document.getElementById('closeShortcutsModal');
  
  shortcutsBtn.onclick = () => {
    shortcutsModal.style.display = 'flex';
  };
  
  closeShortcutsBtn.onclick = () => {
    shortcutsModal.style.display = 'none';
  };
  
  shortcutsModal.onclick = (e) => {
    if (e.target.id === 'keyboardShortcutsModal') {
      shortcutsModal.style.display = 'none';
    }
  };
  
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
    const isVisible = advancedSearchEl.style.display === 'block';
    advancedSearchEl.style.display = isVisible ? 'none' : 'block';
    advancedSearchToggle.classList.toggle('active', !isVisible);
  });
  
  document.getElementById('applyFilters').addEventListener('click', applyAdvancedSearch);
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

async function performSearch() {
  const query = searchInput.value.trim();
  
  if (!query) {
    const songs = await fetchAllSongs();
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
    return;
  }
  
  try {
    const songs = await simpleSearch(query);
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
  } catch (error) {
    console.error('Search error:', error);
  }
}

async function applyAdvancedSearch() {
  const artist = document.getElementById('filterArtist').value;
  const album = document.getElementById('filterAlbum').value;
  const genre = document.getElementById('filterGenre').value;
  const year = document.getElementById('filterYear').value;
  
  try {
    const songs = await AdvancedSearchAPI({
      artist,
      album,
      genre,
      year
    });

    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
  } catch (error) {
    console.error('Advanced search error:', error);
  }
}

async function clearFilters() {
  document.getElementById('filterArtist').value = '';
  document.getElementById('filterAlbum').value = '';
  document.getElementById('filterGenre').value = '';
  document.getElementById('filterYear').value = '';
  searchInput.value = '';
  
  const songs = await fetchAllSongs();
  setCurrentSongs(songs);
  renderSongs(songs, playSongFromList);
}

// Load Songs
async function loadSongs() {
  try {
    const songs = await fetchAllSongs();
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
    
    // Setup play all and shuffle buttons
    document.getElementById('playAll').onclick = () => playAll();
    document.getElementById('shuffleAll').onclick = () => shuffleAll();
  } catch (error) {
    console.error('Error loading songs:', error);
  }
}

// Albums
async function loadAlbums() {
  try {
    const albums = await listAlbums();
    renderAlbums(albums, loadAlbumDetail);
  } catch (error) {
    console.error('Error loading albums:', error);
  }
}

async function loadAlbumDetail(artist, album) {
  try {
    const albumData = await getAlbumDetail(artist, album);
    
    // Store album songs
    currentAlbumSongs = albumData.songs;
    
    renderAlbumDetail(albumData, playAlbumSong);
    
    document.getElementById('albumsView').classList.add('hidden');
    document.getElementById('albumDetailView').classList.remove('hidden');
    
    // Setup album controls
    document.getElementById('playAlbum').onclick = () => playAlbumAll();
    document.getElementById('shuffleAlbum').onclick = () => shuffleAlbum();
    document.getElementById('backToAlbums').onclick = () => {
      document.getElementById('albumDetailView').classList.add('hidden');
      document.getElementById('albumsView').classList.remove('hidden');
    };
  } catch (error) {
    console.error('Error loading album detail:', error);
  }
}

// Artists
async function loadArtists() {
  try {
    const artists = await listArtists();
    renderArtists(artists, (artistName) => {
      searchInput.value = artistName;
      performSearch();
      switchView('library');
    });
  } catch (error) {
    console.error('Error loading artists:', error);
  }
}

// Playlists
async function loadPlaylists() {
  try {
    const playlists = await listPlaylists();
    renderPlaylists(playlists);
    
    document.getElementById('createPlaylist').onclick = openPlaylistModal;
  } catch (error) {
    console.error('Error loading playlists:', error);
  }
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
    await createPlaylist(name, description, []);
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
    const stats = await getStats();
    renderStats(stats);
    
    // Add click handlers for song items
    document.querySelectorAll('.song-list-item').forEach(item => {
      item.addEventListener('click', async () => {
        const songId = item.dataset.songId;
        if (songId) {
          const songs = await fetchAllSongs();
          const song = songs.find(s => s.id === songId);
          if (song) {
            setQueue(songs);
            const index = songs.findIndex(s => s.id === songId);
            playSongFromList(index);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Player Setup
function setupPlayer() {
  const audioPlayer = document.getElementById('audioPlayer');
  const playPauseButton = document.getElementById('playPauseButton');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const progressBar = document.getElementById('progressBar');
  const volumeSlider = document.getElementById('volumeSlider');
  
  // Initialize player module
  initPlayer(audioPlayer);
  
  // Setup controls
  playPauseButton.addEventListener('click', togglePlayPause);
  prevButton.addEventListener('click', playPrevious);
  nextButton.addEventListener('click', playNext);
  
  progressBar.addEventListener('input', (e) => {
    seek(e.target.value);
  });
  
  volumeSlider.addEventListener('input', (e) => {
    setVolume(e.target.value / 100);
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Allow Ctrl/Cmd + F and Ctrl/Cmd + K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        // Handle below
      } else {
        return;
      }
    }
    
    switch(e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        playNext();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        playPrevious();
        break;
      case 'ArrowUp':
        e.preventDefault();
        const currentVol = audioPlayer.volume;
        setVolume(Math.min(1, currentVol + 0.1));
        volumeSlider.value = Math.min(100, parseFloat(volumeSlider.value) + 10);
        break;
      case 'ArrowDown':
        e.preventDefault();
        const currentVolDown = audioPlayer.volume;
        setVolume(Math.max(0, currentVolDown - 0.1));
        volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 10);
        break;
      case 'k':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          searchInput.focus();
        }
        break;
      case 'p':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          document.getElementById('keyboardShortcutsModal').style.display = 'flex';
        }
        break;
      case 'Escape':
        // Close any open modals
        document.getElementById('playlistModal').style.display = 'none';
        document.getElementById('keyboardShortcutsModal').style.display = 'none';
        break;
    }
  });
  
  // Mini player controls
  document.getElementById('miniPlayPause').addEventListener('click', togglePlayPause);
  document.getElementById('miniPrev').addEventListener('click', playPrevious);
  document.getElementById('miniNext').addEventListener('click', playNext);
}

// Playback Functions
function playSongFromList(index) {
  setQueue([...currentSongs], index);
  playSong(currentSongs[index]);
}

function playAlbumSong(index) {
  setQueue([...currentAlbumSongs], index);
  playSong(currentAlbumSongs[index]);
}

function playAll() {
  setQueue([...currentSongs], 0);
  playSong(currentSongs[0]);
}

function shuffleAll() {
  const shuffled = [...currentSongs].sort(() => Math.random() - 0.5);
  setQueue(shuffled, 0);
  playSong(shuffled[0]);
}

function playAlbumAll() {
  setQueue([...currentAlbumSongs], 0);
  playSong(currentAlbumSongs[0]);
}

function shuffleAlbum() {
  const shuffled = [...currentAlbumSongs].sort(() => Math.random() - 0.5);
  setQueue(shuffled, 0);
  playSong(shuffled[0]);
}

// Sidebar Toggle
function setupSidebar() {
  document.getElementById('closeSidebar').addEventListener('click', () => {
    nowPlayingSidebar.style.transform = 'translateX(320px)';
    miniPlayer.style.display = 'flex';
    requestAnimationFrame(() => {
      miniPlayer.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      nowPlayingSidebar.style.display = 'none';
    }, 400);
    document.querySelector('.app-container').classList.add('sidebar-closed');
  });
  
  document.getElementById('expandSidebar').addEventListener('click', () => {
    nowPlayingSidebar.style.display = 'flex';
    requestAnimationFrame(() => {
      nowPlayingSidebar.style.transform = 'translateX(0)';
    });
    miniPlayer.style.transform = 'translateY(100%)';
    setTimeout(() => {
      miniPlayer.style.display = 'none';
    }, 400);
    document.querySelector('.app-container').classList.remove('sidebar-closed');
  });
}

// Scan Library
async function scanLibrary() {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>Scanning...</span>';
  
  try {
    const result = await scanLibraryAPI();
    
    // Clear cache after scan
    clearCache();
    
    alert(`Scan complete!\nAdded: ${result.added}\nUpdated: ${result.updated}\nTotal: ${result.total}`);
    
    // Reload the page to refresh all data
    window.location.reload();
  } catch (error) {
    console.error('Scan error:', error);
    alert('Error scanning library');
    button.disabled = false;
    button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg><span>Scan Library</span>';
  }
}

// Make functions globally accessible (for backwards compatibility if needed)
window.playSongFromList = playSongFromList;
window.playAlbumSong = playAlbumSong;
