import { switchView } from './views.js';
import { scanLibrary } from './scan.js';
import { removeFromPlaylist } from './playlists.js';
import { updateSong } from '../api.js';
import { allSongs, currentSongs, enqueueSongs, playNextSongs, setAllSongs, setCurrentSongs } from '../state.js';
import { updateQueue } from '../player.js';
import { renderSongs } from '../ui.js';

async function copyToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Fallback for older/locked-down contexts.
  }

  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

function resolveSongFromActionButton(btn) {
  const songId = btn?.dataset?.songId;
  const songContext = btn?.dataset?.songContext;
  const index = Number(btn?.dataset?.songIndex);

  const tryFindInList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    if (Number.isFinite(index) && index >= 0 && index < list.length) {
      const byIndex = list[index];
      if (byIndex && (!songId || byIndex.id === songId)) return byIndex;
    }
    if (songId) return list.find((s) => s?.id === songId) || null;
    return null;
  };

  if (songContext === 'playlist') {
    const fromPlaylist = tryFindInList(window.currentPlaylistSongs);
    if (fromPlaylist) return fromPlaylist;
  }

  const fromCurrent = tryFindInList(currentSongs);
  if (fromCurrent) return fromCurrent;

  const fromAll = tryFindInList(allSongs);
  if (fromAll) return fromAll;

  const fromPlaylistFallback = tryFindInList(window.currentPlaylistSongs);
  if (fromPlaylistFallback) return fromPlaylistFallback;

  return null;
}

export function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      const action = item.dataset.action;
      if (action === 'search') {
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        if (!isMobile) return;

        const isOpen = document.body.classList.toggle('mobile-search-open');

        if (!isOpen) {
          document.getElementById('searchInput')?.blur();

          const advanced = document.getElementById('advancedSearch');
          if (advanced) advanced.style.display = 'none';
          document.getElementById('advancedSearchToggle')?.classList.remove('active');
          return;
        }

        const header = document.querySelector('.header');
        header?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Focus search input so the keyboard opens on mobile.
        const input = document.getElementById('searchInput');
        if (input) {
          input.focus();
          input.select?.();
        }
        return;
      }

      const view = item.dataset.view;
      if (!view) return;
      void switchView(view);
    });
  });

  document.getElementById('scanButton')?.addEventListener('click', () => {
    void scanLibrary();
  });

  // Add to playlist button delegation
  document.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-playlist-btn')) {
      const btn = e.target.closest('.add-to-playlist-btn');
      const songId = btn.dataset.songId;
      if (songId) {
        window.openAddToPlaylistModal?.(songId);
      }
    }

    // Remove from playlist button
    if (e.target.closest('.remove-from-playlist-btn')) {
      const btn = e.target.closest('.remove-from-playlist-btn');
      const songId = btn.dataset.songId;
      if (songId && window.currentPlaylistId) {
        void removeFromPlaylist(window.currentPlaylistId, songId);
      }
    }

    if (e.target.closest('.song-copy-btn')) {
      const btn = e.target.closest('.song-copy-btn');
      const text = btn.dataset.copyText;
      void copyToClipboard(text);
    }

    if (e.target.closest('.song-row-queue-btn')) {
      const btn = e.target.closest('.song-row-queue-btn');
      const song = resolveSongFromActionButton(btn);
      if (!song) return;
      enqueueSongs(song);
      updateQueue();
    }

    if (e.target.closest('.song-row-play-next-btn')) {
      const btn = e.target.closest('.song-row-play-next-btn');
      const song = resolveSongFromActionButton(btn);
      if (!song) return;
      playNextSongs(song);
      updateQueue();
    }

    if (e.target.closest('.song-edit-bpm-btn')) {
      const btn = e.target.closest('.song-edit-bpm-btn');
      const song = resolveSongFromActionButton(btn);
      if (!song) return;
      openBpmTagModal(song);
    }
  });

  wireBpmTagModalSave();
}

function openBpmTagModal(song) {
  const modal = document.getElementById('bpmTagModal');
  const label = document.getElementById('bpmTagSongLabel');
  const input = document.getElementById('bpmTagValue');
  if (!modal || !input) return;

  modal.dataset.songId = String(song.id || '');
  modal.dataset.songTitle = String(song.title || '');

  const artist = String(song.artist || '').trim();
  const title = String(song.title || 'Unknown').trim();
  if (label) {
    label.textContent = artist ? `${title} — ${artist}` : title;
  }

  input.value = Number.isFinite(Number(song.bpm)) ? String(Math.round(Number(song.bpm))) : '';
  modal.style.display = 'flex';
  input.focus();
  input.select?.();
}

function wireBpmTagModalSave() {
  const modal = document.getElementById('bpmTagModal');
  const saveBtn = document.getElementById('saveBpmTag');
  const input = document.getElementById('bpmTagValue');
  if (!modal || !saveBtn || !input) return;
  if (saveBtn.dataset.wired) return;
  saveBtn.dataset.wired = '1';

  const save = async () => {
    const songId = String(modal.dataset.songId || '').trim();
    if (!songId) return;

    const raw = String(input.value || '').trim();
    const bpm = raw ? Number(raw) : null;
    if (raw && (!Number.isFinite(bpm) || bpm < 30 || bpm > 300)) {
      alert('BPM must be between 30 and 300');
      return;
    }

    saveBtn.disabled = true;

    try {
      const updated = await updateSong(songId, { bpm: raw ? Math.round(bpm) : null });
      applySongPatchToClientState(updated);
      modal.style.display = 'none';

      // Refresh current view if needed.
      if (window.currentPlaylistId && window.location.hash.startsWith('#/playlist/')) {
        void window.loadPlaylistDetail?.(window.currentPlaylistId);
      } else if (document.getElementById('songTableBody')) {
        // Re-render library table in place.
        renderSongs(currentSongs, window.playSongFromList || (() => {}));
      }
    } catch (err) {
      console.error('BPM update failed:', err);
      alert('Failed to update BPM: ' + (err?.message || err));
    } finally {
      saveBtn.disabled = false;
    }
  };

  saveBtn.addEventListener('click', () => { void save(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  });
}

function applySongPatchToClientState(updatedSong) {
  if (!updatedSong?.id) return;
  const id = updatedSong.id;

  const patchList = (list) => (Array.isArray(list)
    ? list.map((s) => (s?.id === id ? { ...s, ...updatedSong } : s))
    : list);

  setAllSongs(patchList(allSongs));
  setCurrentSongs(patchList(currentSongs));

  if (Array.isArray(window.currentPlaylistSongs)) {
    window.currentPlaylistSongs = patchList(window.currentPlaylistSongs);
  }
}
