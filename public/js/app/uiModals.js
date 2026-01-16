import { closePlaylistModal, openPlaylistModal, savePlaylist } from './playlists.js';

export function setupModal() {
  // Create playlist modal
  const closePlaylist = document.getElementById('closePlaylistModal');
  const cancelPlaylist = document.getElementById('cancelPlaylist');
  const savePlaylistBtn = document.getElementById('savePlaylist');

  if (closePlaylist) closePlaylist.onclick = () => closePlaylistModal();
  if (cancelPlaylist) cancelPlaylist.onclick = () => closePlaylistModal();
  if (savePlaylistBtn) savePlaylistBtn.onclick = () => { void savePlaylist(); };

  const playlistModal = document.getElementById('playlistModal');
  if (playlistModal) {
    playlistModal.onclick = (e) => {
      if (e.target?.id === 'playlistModal') closePlaylistModal();
    };
  }

  // Add to Playlist modal
  const closeAdd = document.getElementById('closeAddToPlaylistModal');
  const addToPlaylistModal = document.getElementById('addToPlaylistModal');
  if (closeAdd && addToPlaylistModal) {
    closeAdd.onclick = () => {
      addToPlaylistModal.style.display = 'none';
    };
  }

  const createFromAdd = document.getElementById('createNewPlaylistFromAdd');
  if (createFromAdd && addToPlaylistModal) {
    createFromAdd.onclick = () => {
      addToPlaylistModal.style.display = 'none';
      openPlaylistModal();
    };
  }

  // Keyboard shortcuts modal
  const shortcutsBtn = document.getElementById('keyboardShortcutsBtn');
  const shortcutsModal = document.getElementById('keyboardShortcutsModal');
  const closeShortcutsBtn = document.getElementById('closeShortcutsModal');

  if (shortcutsBtn && shortcutsModal) {
    shortcutsBtn.onclick = () => {
      shortcutsModal.style.display = 'flex';
    };
  }
  if (closeShortcutsBtn && shortcutsModal) {
    closeShortcutsBtn.onclick = () => {
      shortcutsModal.style.display = 'none';
    };
  }
  if (shortcutsModal) {
    shortcutsModal.onclick = (e) => {
      if (e.target?.id === 'keyboardShortcutsModal') shortcutsModal.style.display = 'none';
    };
  }

  // Stats list modal
  const statsListModal = document.getElementById('statsListModal');
  const closeStatsListModalBtn = document.getElementById('closeStatsListModal');

  if (closeStatsListModalBtn && statsListModal) {
    closeStatsListModalBtn.onclick = () => {
      statsListModal.style.display = 'none';
    };
    statsListModal.onclick = (e) => {
      if (e.target?.id === 'statsListModal') statsListModal.style.display = 'none';
    };
  }
}

export function closeAllModals() {
  const ids = ['playlistModal', 'addToPlaylistModal', 'keyboardShortcutsModal', 'statsListModal', 'nowPlayingFullscreen'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // Fullscreen now playing needs extra cleanup.
    if (id === 'nowPlayingFullscreen') {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('npfs-open');
      el.style.display = 'none';
      return;
    }

    el.style.display = 'none';
  });
}
