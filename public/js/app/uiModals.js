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

  // BPM tag modal (open is handled by navigation.js; we wire close UX here)
  const bpmModal = document.getElementById('bpmTagModal');
  const closeBpm = document.getElementById('closeBpmTagModal');
  const cancelBpm = document.getElementById('cancelBpmTag');
  if (closeBpm && bpmModal) closeBpm.onclick = () => { bpmModal.style.display = 'none'; };
  if (cancelBpm && bpmModal) cancelBpm.onclick = () => { bpmModal.style.display = 'none'; };
  if (bpmModal) {
    bpmModal.onclick = (e) => {
      if (e.target?.id === 'bpmTagModal') bpmModal.style.display = 'none';
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

  // Sleep timer modal (open/close is handled by player.js; we just wire close UX)
  const sleepTimerModal = document.getElementById('sleepTimerModal');
  const closeSleepTimerModalBtn = document.getElementById('closeSleepTimerModal');
  if (sleepTimerModal) {
    sleepTimerModal.onclick = (e) => {
      if (e.target?.id === 'sleepTimerModal') sleepTimerModal.style.display = 'none';
    };
  }
  if (closeSleepTimerModalBtn && sleepTimerModal) {
    closeSleepTimerModalBtn.onclick = () => {
      sleepTimerModal.style.display = 'none';
    };
  }
}

export function closeAllModals() {
  const ids = ['playlistModal', 'addToPlaylistModal', 'bpmTagModal', 'keyboardShortcutsModal', 'statsListModal', 'sleepTimerModal'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.style.display = 'none';
  });
}
