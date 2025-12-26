// Main Application Entry Point
import { debounce } from './js/utils.js';
import { 
  simpleSearch,
  advancedSearch as AdvancedSearchAPI,
  fetchAllSongs,
  songCoverUrl,
  listAlbums,
  getAlbumDetail,
  listArtists,
  listPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
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
  renderPlaylistDetail,
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
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupSearch();
  setupPlayer();
  setupSidebar();
  setupModal();

  // IMPORTANT: initRouter() triggers the initial view load.
  // Do not call loadSongs() here; it must run only after the library view HTML exists.
  await initRouter();
  
  // Hide now playing sidebar initially
  if (nowPlayingSidebar) nowPlayingSidebar.style.display = 'none';
  if (miniPlayer) miniPlayer.style.display = 'none';
  document.querySelector('.app-container')?.classList.add('sidebar-closed');
});

function setupModal() {
  document.getElementById('closePlaylistModal').onclick = closePlaylistModal;
  document.getElementById('cancelPlaylist').onclick = closePlaylistModal;
  document.getElementById('savePlaylist').onclick = savePlaylist;
  
  // Add to Playlist Modal
  document.getElementById('closeAddToPlaylistModal').onclick = () => {
    document.getElementById('addToPlaylistModal').style.display = 'none';
  };
  
  document.getElementById('createNewPlaylistFromAdd').onclick = () => {
    document.getElementById('addToPlaylistModal').style.display = 'none';
    openPlaylistModal();
  };
  
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

  // Statistics list modal
  const statsListModal = document.getElementById('statsListModal');
  const closeStatsListModalBtn = document.getElementById('closeStatsListModal');

  if (closeStatsListModalBtn && statsListModal) {
    closeStatsListModalBtn.onclick = () => {
      statsListModal.style.display = 'none';
    };
    statsListModal.onclick = (e) => {
      if (e.target.id === 'statsListModal') {
        statsListModal.style.display = 'none';
      }
    };
  }
  
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
    });
  });
  
  document.getElementById('scanButton').addEventListener('click', scanLibrary);
  
  // Add to playlist button delegation
  document.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-playlist-btn')) {
      const btn = e.target.closest('.add-to-playlist-btn');
      const songId = btn.dataset.songId;
      if (songId) {
        window.openAddToPlaylistModal(songId);
      }
    }
    
    // Remove from playlist button
    if (e.target.closest('.remove-from-playlist-btn')) {
      const btn = e.target.closest('.remove-from-playlist-btn');
      const songId = btn.dataset.songId;
      if (songId && window.currentPlaylistId) {
        removeFromPlaylist(window.currentPlaylistId, songId);
      }
    }
  });
}

async function removeFromPlaylist(playlistId, songId) {
  try {
    await removeSongFromPlaylist(playlistId, songId);
    clearCache();
    window.loadPlaylistDetail(playlistId);
  } catch (error) {
    console.error('Error removing from playlist:', error);
    alert('Error: ' + error.message);
  }
}

async function switchView(viewName, updateUrl = true) {
  const container = document.getElementById('viewContainer');
  if (!container) return;
  
  const viewMap = {
    'library': 'library.html',
    'albums': 'albums.html',
    'artists': 'artists.html',
    'playlists': 'playlists.html',
    'playlistDetailView': 'playlist-detail.html',
    'albumDetailView': 'album-detail.html',
    'stats': 'stats.html'
  };
  
  const htmlFile = viewMap[viewName] || viewMap[viewName.replace('View', '')];
  
  if (htmlFile) {
    try {
      // Load HTML content
      const response = await fetch(`/views/${htmlFile}`);
      const html = await response.text();
      container.innerHTML = html;
      
      // Add fade-in animation
      container.style.animation = 'fadeIn 0.3s ease-out';
      
      // Update URL hash
      if (updateUrl) {
        const route = viewName.replace('View', '');
        window.location.hash = `#/${route}`;
      }
      
      // Update active nav item
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName || item.dataset.view === viewName.replace('View', '')) {
          item.classList.add('active');
        }
      });
      
      // Load data for view
      switch(viewName) {
        case 'library':
          loadSongs();
          break;
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
    } catch (error) {
      console.error('Error loading view:', error);
      container.innerHTML = '<div class="error">Failed to load view</div>';
    }
  }
}

// Router
async function initRouter() {
  const handleRoute = async () => {
    const hash = window.location.hash.slice(2); // Remove #/
    const parts = hash.split('/');
    const view = parts[0];

    if (view && view !== '') {
      if (view === 'playlist' && parts[1]) {
        await window.loadPlaylistDetail(parts[1]);
      } else if (view === 'album' && parts[1] && parts[2]) {
        await loadAlbumDetail(decodeURIComponent(parts[1]), decodeURIComponent(parts[2]));
      } else {
        await switchView(view, false);
      }
    } else {
      await switchView('library', false);
    }
  };

  // Handle hash changes (back/forward buttons)
  window.addEventListener('hashchange', () => {
    void handleRoute();
  });

  // Initial route (await so the first view is in the DOM before any renders)
  await handleRoute();
}

// Search
function setupSearch() {
  const searchButton = document.querySelector('.search-button');

  if (!searchInput || !searchButton || !advancedSearchToggle || !advancedSearchEl) return;

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
  
  document.getElementById('applyFilters')?.addEventListener('click', applyAdvancedSearch);
  document.getElementById('clearFilters')?.addEventListener('click', clearFilters);
}

async function performSearch() {
  const query = searchInput.value.trim();

  // Search UI always renders into the library table.
  // Ensure the library view HTML is present before rendering.
  if (!document.getElementById('songTableBody')) {
    await switchView('library', false);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
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
  if (!document.getElementById('songTableBody')) {
    await switchView('library', false);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
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
  if (!document.getElementById('songTableBody')) {
    await switchView('library', false);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
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
    const playAllBtn = document.getElementById('playAll');
    const shuffleAllBtn = document.getElementById('shuffleAll');
    if (playAllBtn) playAllBtn.onclick = () => playAll();
    if (shuffleAllBtn) shuffleAllBtn.onclick = () => shuffleAll();
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
    
    // Load view HTML first
    await switchView('albumDetailView', false);
    window.location.hash = `#/album/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`;
    
    // Wait for next tick to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Now render content
    renderAlbumDetail(albumData, playAlbumSong);
    
    // Setup album controls
    const playBtn = document.getElementById('playAlbum');
    const shuffleBtn = document.getElementById('shuffleAlbum');
    const backBtn = document.getElementById('backToAlbums');
    
    if (playBtn) playBtn.onclick = () => playAlbumAll();
    if (shuffleBtn) shuffleBtn.onclick = () => shuffleAlbum();
    if (backBtn) {
      backBtn.onclick = () => {
        window.location.hash = '#/albums';
      };
    }
  } catch (error) {
    console.error('Error loading album detail:', error);
  }
}

// Artists
async function loadArtists() {
  try {
    const artists = await listArtists();
    renderArtists(artists, async (artistName) => {
      searchInput.value = artistName;
      await switchView('library');
      await performSearch();
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

    const createBtn = document.getElementById('createPlaylist');
    if (createBtn) createBtn.onclick = openPlaylistModal;
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
    clearCache();
    loadPlaylists();
  } catch (error) {
    console.error('Error creating playlist:', error);
    alert('Error: ' + error.message);
  }
}

// Play song from playlist handler
window.onPlaySongFromPlaylist = function(songs, index) {
  setCurrentSongs(songs);
  setQueue(songs);
  playSong(songs[index]);
};

window.loadPlaylistDetail = async function(playlistId) {
  try {
    const playlist = await getPlaylist(playlistId);
    const allSongs = await fetchAllSongs();
    
    // Get songs in playlist
    const playlistSongs = (playlist.songIds || []).map(id => {
      return allSongs.find(s => s.id === id);
    }).filter(song => song !== undefined);
    
    // Store current playlist for actions
    window.currentPlaylistId = playlistId;
    window.currentPlaylistSongs = playlistSongs;
    
    // Load view HTML first
    await switchView('playlistDetailView', false);
    window.location.hash = `#/playlist/${playlistId}`;
    
    // Wait for next tick to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Now render content
    renderPlaylistDetail(playlist, playlistSongs);
    
    // Setup back button
    const backBtn = document.getElementById('backToPlaylists');
    if (backBtn) {
      backBtn.onclick = () => {
        window.location.hash = '#/playlists';
      };
    }
    
    // Setup play all button
    const playAllBtn = document.getElementById('playPlaylistAll');
    if (playAllBtn) {
      playAllBtn.onclick = () => {
        if (playlistSongs.length > 0) {
          setCurrentSongs(playlistSongs);
          setQueue(playlistSongs);
          playSong(playlistSongs[0]);
        }
      };
    }
    
    // Remove handlers are wired via document-level event delegation in setupNavigation().
  } catch (error) {
    console.error('Error loading playlist:', error);
    alert('Error loading playlist: ' + error.message);
  }
};

let currentSongForPlaylist = null;

window.openAddToPlaylistModal = async function(songId) {
  currentSongForPlaylist = songId;
  const modal = document.getElementById('addToPlaylistModal');
  const listContainer = document.getElementById('playlistSelectionList');
  
  try {
    const playlists = await listPlaylists();
    listContainer.innerHTML = '';
    
    if (playlists.length === 0) {
      listContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 24px;">No playlists yet. Create one below!</p>';
    } else {
      playlists.forEach(playlist => {
        const item = document.createElement('div');
        item.className = 'playlist-selection-item';
        item.innerHTML = `
          <div>
            <div style="font-weight: 500;">${escapeHtml(playlist.name)}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${playlist.songCount || 0} songs</div>
          </div>
        `;
        item.onclick = async () => {
          try {
            await addSongToPlaylist(playlist.id, songId);
            modal.style.display = 'none';
            
            clearCache();
            
            if (window.currentPlaylistId === playlist.id) {
              window.loadPlaylistDetail(playlist.id);
            }
            
            alert(`Added to ${playlist.name}`);
          } catch (error) {
            console.error('Error adding to playlist:', error);
            alert('Error: ' + error.message);
          }
        };
        listContainer.appendChild(item);
      });
    }
    
    modal.style.display = 'flex';
  } catch (error) {
    console.error('Error loading playlists:', error);
    alert('Error loading playlists');
  }
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openStatsListModal(title, items) {
  const modal = document.getElementById('statsListModal');
  const titleEl = document.getElementById('statsListModalTitle');
  const bodyEl = document.getElementById('statsListModalBody');
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title || 'Statistics';
  bodyEl.innerHTML = '';

  if (!items || items.length === 0) {
    bodyEl.innerHTML = `<div class="stats-list-item"><div class="stats-list-item-title">No items</div><div class="stats-list-item-subtitle">Nothing to show yet</div></div>`;
    modal.style.display = 'flex';
    return;
  }

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'stats-list-item';
    const primary = typeof item === 'string' ? item : (item?.title || item?.primary || '');
    const secondary = typeof item === 'string' ? '' : (item?.subtitle || item?.secondary || '');
    el.innerHTML = `
      <div class="stats-list-item-title">${escapeHtml(String(primary))}</div>
      ${secondary ? `<div class="stats-list-item-subtitle">${escapeHtml(String(secondary))}</div>` : ''}
    `;
    bodyEl.appendChild(el);
  });

  modal.style.display = 'flex';
}

async function openStatsSongListModal(title, songItems) {
  const modal = document.getElementById('statsListModal');
  const titleEl = document.getElementById('statsListModalTitle');
  const bodyEl = document.getElementById('statsListModalBody');
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title || 'Songs';
  bodyEl.innerHTML = '';

  if (!songItems || songItems.length === 0) {
    bodyEl.innerHTML = `<div class="stats-list-item"><div class="stats-list-item-title">No songs</div><div class="stats-list-item-subtitle">Nothing to show yet</div></div>`;
    modal.style.display = 'flex';
    return;
  }

  songItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'song-list-item';
    row.style.cursor = 'pointer';
    row.dataset.songId = item.songId;
    row.innerHTML = `
      <img src="${songCoverUrl(item.songId)}" alt="Cover" class="song-list-cover" onerror="this.style.display='none'">
      <div style="flex: 1; min-width: 0;">
        <div>${escapeHtml(item.title || 'Unknown')}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(item.subtitle || '')}</div>
      </div>
      ${item.rightText ? `<div style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(item.rightText)}</div>` : ''}
    `;
    row.addEventListener('click', async () => {
      try {
        const songId = row.dataset.songId;
        if (!songId) return;
        const songs = await fetchAllSongs();
        const index = songs.findIndex(s => s.id === songId);
        if (index >= 0) {
          setQueue(songs);
          playSongFromList(index);
          modal.style.display = 'none';
        }
      } catch (error) {
        console.error('Error playing song from stats modal:', error);
      }
    });
    bodyEl.appendChild(row);
  });

  modal.style.display = 'flex';
}

// Statistics
async function loadStats() {
  try {
    const stats = await getStats();
    renderStats(stats);

    // Tile click behavior:
    // - Navigate tiles: set hash (router loads the page)
    // - Modal tiles: open a list modal
    document.querySelectorAll('.stat-tile').forEach(tile => {
      const activate = async () => {
        const action = tile.dataset.statsAction;
        const target = tile.dataset.statsTarget;
        const modalKey = tile.dataset.statsModal;

        if (action === 'navigate' && target) {
          window.location.hash = `#/${target}`;
          return;
        }

        if (action === 'modal' && modalKey) {
          if (modalKey === 'mostPlayed') {
            const items = (stats.mostPlayed || []).map(song => ({
              songId: song.id,
              title: song.title || 'Unknown',
              subtitle: song.artist || 'Unknown Artist',
              rightText: `${song.playCount || 0} plays`
            }));
            await openStatsSongListModal('Most Played Songs', items);
            return;
          }

          if (modalKey === 'recentlyPlayed') {
            const items = (stats.recentlyPlayed || []).map(play => ({
              songId: play.songId,
              title: play.title || 'Unknown',
              subtitle: play.artist || 'Unknown Artist',
              rightText: play.playedAt ? new Date(play.playedAt).toLocaleString() : ''
            }));
            await openStatsSongListModal('Recently Played', items);
            return;
          }

          if (modalKey === 'genres') {
            const songs = await fetchAllSongs();
            const genreCounts = new Map();
            (songs || []).forEach(s => {
              if (!s.genre) return;
              genreCounts.set(s.genre, (genreCounts.get(s.genre) || 0) + 1);
            });
            const genres = Array.from(genreCounts.entries()).sort((a, b) => {
              if (b[1] !== a[1]) return b[1] - a[1];
              return String(a[0]).localeCompare(String(b[0]));
            });
            const items = genres.map(([g, count]) => ({ title: g, subtitle: `${count} songs` }));
            openStatsListModal('Genres', items);
            return;
          }

          if (modalKey === 'summary') {
            const items = [
              { title: 'Total Songs', subtitle: String(stats.totalSongs || 0) },
              { title: 'Artists', subtitle: String(stats.uniqueArtists || 0) },
              { title: 'Albums', subtitle: String(stats.uniqueAlbums || 0) },
              { title: 'Genres', subtitle: String(stats.uniqueGenres || 0) },
              { title: 'Total Playlists', subtitle: String(stats.totalPlaylists || 0) },
              { title: 'Total Plays', subtitle: String(stats.totalPlays || 0) },
              { title: 'Total Duration', subtitle: formatDuration(stats.totalDuration || 0) }
            ];
            openStatsListModal('Totals', items);
            return;
          }
        }
      };

      tile.addEventListener('click', () => {
        void activate();
      });
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void activate();
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
        document.getElementById('addToPlaylistModal').style.display = 'none';
        document.getElementById('keyboardShortcutsModal').style.display = 'none';
        document.getElementById('statsListModal').style.display = 'none';
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
