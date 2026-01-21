import {
  addSongToPlaylist,
  clearCache,
  createPlaylist,
  deletePlaylist,
  fetchAllSongs,
  getPlaylist,
  listPlaylists,
  updatePlaylist,
  removeSongFromPlaylist
} from '../api.js';
import { escapeHtml } from '../utils.js';
import { setCurrentSongs, setPlaybackList } from '../state.js';
import { playSong } from '../player.js';
import { renderPlaylistDetail, renderPlaylists } from '../ui.js';
import { switchView } from './views.js';
import { exportPlaylistAsM3U, exportPlaylistAsPLS } from './playlistImportExport.js';

let currentSongForPlaylist = null;
let lastPlaylists = [];

function inferTone(key) {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return null;

  // Common forms:
  // - "C#m" / "Am" -> minor
  // - "A minor" / "C major" -> minor/major
  // - "Cmaj" / "Cmin" -> major/minor
  if (k.includes('minor') || k.includes('min')) return 'dark';
  if (k.includes('major') || k.includes('maj')) return 'bright';
  if (/[a-g](#|b)?m\b/.test(k)) return 'dark';
  return null;
}

function normalizeBpm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 30 || n > 300) return null;
  return Math.round(n);
}

function getSmartMoodPlaylists(allSongs) {
  const songs = Array.isArray(allSongs) ? allSongs : [];

  const defs = [
    {
      id: 'mood_chill',
      name: 'Chill',
      description: '60–95 BPM',
      filter: (s) => {
        const bpm = normalizeBpm(s?.bpm);
        return bpm !== null && bpm >= 60 && bpm <= 95;
      }
    },
    {
      id: 'mood_focus',
      name: 'Focus',
      description: '96–120 BPM',
      filter: (s) => {
        const bpm = normalizeBpm(s?.bpm);
        return bpm !== null && bpm >= 96 && bpm <= 120;
      }
    },
    {
      id: 'mood_energy',
      name: 'Energy',
      description: '121–145 BPM',
      filter: (s) => {
        const bpm = normalizeBpm(s?.bpm);
        return bpm !== null && bpm >= 121 && bpm <= 145;
      }
    },
    {
      id: 'mood_hype',
      name: 'Hype',
      description: '146+ BPM',
      filter: (s) => {
        const bpm = normalizeBpm(s?.bpm);
        return bpm !== null && bpm >= 146;
      }
    },
    {
      id: 'tone_bright',
      name: 'Bright Tone',
      description: 'Major key (when tagged)',
      filter: (s) => inferTone(s?.key) === 'bright'
    },
    {
      id: 'tone_dark',
      name: 'Dark Tone',
      description: 'Minor key (when tagged)',
      filter: (s) => inferTone(s?.key) === 'dark'
    },
    {
      id: 'needs_bpm',
      name: 'Needs BPM',
      description: 'Missing BPM tags',
      filter: (s) => normalizeBpm(s?.bpm) === null
    }
  ];

  return defs.map((d) => {
    const list = songs.filter(d.filter);
    return {
      ...d,
      songCount: list.length,
      _songs: list
    };
  });
}

function renderMoodPlaylists(playlists) {
  const grid = document.getElementById('moodPlaylistGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const list = (playlists || []).filter(p => (p.songCount || 0) > 0);
  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-content" style="grid-column: 1 / -1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <h3>No Mood Playlists Yet</h3>
        <p>Add BPM tags (⋯ → Edit BPM) or rescan your library.</p>
      </div>`;
    return;
  }

  list.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.dataset.smartPlaylistId = p.id;
    card.innerHTML = `
      <div class="playlist-cover">
        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
          <path d="M12 3v10.55a4 4 0 1 0 2 3.45V7h4V3h-6z"/>
        </svg>
      </div>
      <div class="playlist-info">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${p.songCount || 0} songs • ${escapeHtml(p.description || '')}</p>
      </div>
    `;
    card.addEventListener('click', () => {
      void loadSmartPlaylistDetail(p);
    });
    grid.appendChild(card);
  });
}

async function loadSmartPlaylistDetail(def) {
  const allSongs = await fetchAllSongs();
  const songs = (Array.isArray(def?._songs) && def._songs.length)
    ? def._songs
    : (Array.isArray(allSongs) ? allSongs.filter(def.filter) : []);

  // Mark as smart playlist so normal delete/remove actions don't apply.
  window.currentPlaylistId = null;
  window.currentPlaylistSongs = songs;

  await switchView('playlistDetailView', false);
  window.location.hash = `#/mood/${def.id}`;
  await new Promise(resolve => setTimeout(resolve, 0));

  renderPlaylistDetail({ id: def.id, name: def.name, description: def.description }, songs);

  const backBtn = document.getElementById('backToPlaylists');
  if (backBtn) {
    backBtn.onclick = () => {
      window.location.hash = '#/playlists';
    };
  }

  const playAllBtn = document.getElementById('playPlaylistAll');
  if (playAllBtn) {
    playAllBtn.onclick = () => {
      if (songs.length > 0) {
        setCurrentSongs(songs);
        setPlaybackList(songs, 0);
        playSong(songs[0]);
      }
    };
  }

  const shuffleBtn = document.getElementById('playlistShuffle');
  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      if (!songs.length) return;
      const shuffled = [...songs]
        .map((s) => ({ s, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.s);
      setCurrentSongs(shuffled);
      setPlaybackList(shuffled, 0);
      playSong(shuffled[0]);
    };
  }

  // Hide actions that only apply to real playlists.
  const idsToHide = ['playlistEdit', 'playlistDelete', 'playlistExportM3U', 'playlistExportPLS'];
  idsToHide.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  document.querySelectorAll('.remove-from-playlist-btn').forEach((btn) => {
    btn.style.display = 'none';
  });
  document.querySelectorAll('.playlist-drag-handle').forEach((h) => {
    h.style.display = 'none';
  });
}

function getPlaylistSortMode() {
  try {
    return localStorage.getItem('player0.playlists.sort') || 'pinned';
  } catch {
    return 'pinned';
  }
}

function setPlaylistSortMode(value) {
  try {
    localStorage.setItem('player0.playlists.sort', value);
  } catch {
    // ignore
  }
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function applyPlaylistFilterSort(list, { query, sortMode } = {}) {
  const q = normalizeText(query);
  const filtered = q
    ? (list || []).filter(p => {
        const name = normalizeText(p?.name);
        const desc = normalizeText(p?.description);
        return name.includes(q) || desc.includes(q);
      })
    : (list || []);

  const byName = (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''));

  if (sortMode === 'songs') {
    return [...filtered].sort((a, b) => {
      const as = Number(a?.songCount || 0);
      const bs = Number(b?.songCount || 0);
      if (as !== bs) return bs - as;
      return byName(a, b);
    });
  }

  if (sortMode === 'name') {
    return [...filtered].sort(byName);
  }

  // Default: pinned first, then name.
  return [...filtered].sort((a, b) => {
    const ap = Boolean(a?.pinned);
    const bp = Boolean(b?.pinned);
    if (ap !== bp) return ap ? -1 : 1;
    return byName(a, b);
  });
}

function wirePlaylistsControls() {
  const search = document.getElementById('playlistSearch');
  const sort = document.getElementById('playlistSort');
  const grid = document.getElementById('playlistGrid');

  if (sort && !sort.dataset.wired) {
    sort.dataset.wired = '1';
    sort.value = getPlaylistSortMode();
    sort.addEventListener('change', () => {
      setPlaylistSortMode(sort.value);
      const display = applyPlaylistFilterSort(lastPlaylists, {
        query: search?.value,
        sortMode: sort.value
      });
      renderPlaylists(display);
    });
  }

  if (search && !search.dataset.wired) {
    search.dataset.wired = '1';
    search.addEventListener('input', () => {
      const display = applyPlaylistFilterSort(lastPlaylists, {
        query: search.value,
        sortMode: sort?.value || getPlaylistSortMode()
      });
      renderPlaylists(display);
    });
  }

  if (grid && !grid.dataset.pinHandlerAttached) {
    grid.dataset.pinHandlerAttached = '1';
    grid.addEventListener('click', (e) => {
      const pinBtn = e.target.closest('.playlist-pin-btn');
      if (!pinBtn) return;
      e.preventDefault();
      e.stopPropagation();

      const playlistId = pinBtn.dataset.playlistId;
      const pinned = pinBtn.dataset.pinned === '1';
      if (!playlistId) return;

      void (async () => {
        try {
          await updatePlaylist(playlistId, { pinned: !pinned });
          await loadPlaylists();
        } catch (err) {
          console.error('Toggle pin failed:', err);
          alert('Failed to pin playlist: ' + (err?.message || err));
        }
      })();
    });
  }
}

export async function loadPlaylists() {
  try {
    // Smart playlists (moods) are computed from the library.
    try {
      const songs = await fetchAllSongs();
      renderMoodPlaylists(getSmartMoodPlaylists(songs));
    } catch (err) {
      console.warn('Failed to load mood playlists:', err);
      renderMoodPlaylists([]);
    }

    const playlists = await listPlaylists();

    lastPlaylists = Array.isArray(playlists) ? playlists : [];

    const sortMode = document.getElementById('playlistSort')?.value || getPlaylistSortMode();
    const query = document.getElementById('playlistSearch')?.value || '';
    renderPlaylists(applyPlaylistFilterSort(lastPlaylists, { query, sortMode }));

    wirePlaylistsControls();

    const createBtn = document.getElementById('createPlaylist');
    if (createBtn) createBtn.onclick = openPlaylistModal;
  } catch (error) {
    console.error('Error loading playlists:', error);
  }
}

export function openPlaylistModal() {
  // Backwards compatible signature:
  // - openPlaylistModal() => create
  // - openPlaylistModal({ mode: 'edit', playlist }) => edit
  const arg = arguments?.[0];
  const mode = arg?.mode === 'edit' ? 'edit' : 'create';
  const playlist = arg?.playlist || null;

  const modal = document.getElementById('playlistModal');
  const title = modal?.querySelector('.modal-header h3');
  const saveBtn = document.getElementById('savePlaylist');

  if (mode === 'edit' && playlist?.id) {
    modal.dataset.editingPlaylistId = String(playlist.id);
    if (title) title.textContent = 'Edit Playlist';
    if (saveBtn) saveBtn.textContent = 'Save Changes';
    document.getElementById('playlistName').value = playlist.name || '';
    document.getElementById('playlistDescription').value = playlist.description || '';
  } else {
    delete modal.dataset.editingPlaylistId;
    if (title) title.textContent = 'Create New Playlist';
    if (saveBtn) saveBtn.textContent = 'Create Playlist';
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistDescription').value = '';
  }

  modal.style.display = 'flex';
  document.getElementById('playlistName').focus();
}

export function closePlaylistModal() {
  const modal = document.getElementById('playlistModal');
  if (!modal) return;
  modal.style.display = 'none';
  delete modal.dataset.editingPlaylistId;
}

export async function savePlaylist() {
  const name = document.getElementById('playlistName').value.trim();
  const description = document.getElementById('playlistDescription').value.trim();
  const modal = document.getElementById('playlistModal');
  const editingId = modal?.dataset?.editingPlaylistId;

  if (!name) {
    alert('Please enter a playlist name');
    return;
  }

  try {
    if (editingId) {
      await updatePlaylist(editingId, { name, description });
    } else {
      await createPlaylist(name, description, []);
    }
    closePlaylistModal();
    clearCache();
    void loadPlaylists();
  } catch (error) {
    console.error('Error creating playlist:', error);
    alert('Error: ' + error.message);
  }
}

export async function removeFromPlaylist(playlistId, songId) {
  try {
    await removeSongFromPlaylist(playlistId, songId);
    clearCache();
    await loadPlaylistDetail(playlistId);
  } catch (error) {
    console.error('Error removing from playlist:', error);
    alert('Error: ' + error.message);
  }
}

export function onPlaySongFromPlaylist(songs, index) {
  setCurrentSongs(songs);
  setPlaybackList(songs, index);
  playSong(songs[index]);
}

export async function loadPlaylistDetail(playlistId) {
  try {
    const playlist = await getPlaylist(playlistId);
    const allSongs = await fetchAllSongs();

    const playlistSongs = (playlist.songIds || [])
      .map(id => allSongs.find(s => s.id === id))
      .filter(Boolean);

    window.currentPlaylistId = playlistId;
    window.currentPlaylistSongs = playlistSongs;

    await switchView('playlistDetailView', false);
    window.location.hash = `#/playlist/${playlistId}`;
    await new Promise(resolve => setTimeout(resolve, 0));

    renderPlaylistDetail(playlist, playlistSongs);

    const backBtn = document.getElementById('backToPlaylists');
    if (backBtn) {
      backBtn.onclick = () => {
        window.location.hash = '#/playlists';
      };
    }

    const playAllBtn = document.getElementById('playPlaylistAll');
    if (playAllBtn) {
      playAllBtn.onclick = () => {
        if (playlistSongs.length > 0) {
          setCurrentSongs(playlistSongs);
          setPlaybackList(playlistSongs, 0);
          playSong(playlistSongs[0]);
        }
      };
    }

    const shuffleBtn = document.getElementById('playlistShuffle');
    if (shuffleBtn) {
      shuffleBtn.onclick = () => {
        if (!playlistSongs.length) return;
        const shuffled = [...playlistSongs]
          .map((s) => ({ s, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .map((x) => x.s);
        setCurrentSongs(shuffled);
        setPlaybackList(shuffled, 0);
        playSong(shuffled[0]);
      };
    }

    const editBtn = document.getElementById('playlistEdit');
    if (editBtn) {
      editBtn.onclick = () => {
        openPlaylistModal({ mode: 'edit', playlist });
      };
    }

    const delBtn = document.getElementById('playlistDelete');
    if (delBtn) {
      delBtn.onclick = () => {
        const ok = confirm(`Delete playlist "${playlist.name || 'Untitled Playlist'}"?`);
        if (!ok) return;
        void (async () => {
          try {
            await deletePlaylist(playlistId);
            clearCache();
            window.location.hash = '#/playlists';
            await loadPlaylists();
          } catch (err) {
            console.error('Delete playlist failed:', err);
            alert('Delete failed: ' + (err?.message || err));
          }
        })();
      };
    }

    const exportM3uBtn = document.getElementById('playlistExportM3U');
    if (exportM3uBtn) {
      exportM3uBtn.onclick = () => {
        exportPlaylistAsM3U(playlist.name, playlistSongs);
      };
    }

    const exportPlsBtn = document.getElementById('playlistExportPLS');
    if (exportPlsBtn) {
      exportPlsBtn.onclick = () => {
        exportPlaylistAsPLS(playlist.name, playlistSongs);
      };
    }

  } catch (error) {
    console.error('Error loading playlist:', error);
    alert('Error loading playlist: ' + error.message);
  }
}

export async function openAddToPlaylistModal(songId) {
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
              await loadPlaylistDetail(playlist.id);
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
}

window.onPlaySongFromPlaylist = onPlaySongFromPlaylist;
window.loadPlaylistDetail = loadPlaylistDetail;
window.openAddToPlaylistModal = openAddToPlaylistModal;
