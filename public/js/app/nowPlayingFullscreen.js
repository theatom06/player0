import { formatDuration, escapeHtml } from '../utils.js';
import { albumCoverUrl } from '../API.js';
import {
  playbackList,
  playbackIndex,
  setPlaybackIndex,
  clearPlaybackList,
  getCurrentSong
} from '../state.js';
import { playSong, playNext, playPrevious, togglePlayPause, setVolume, seek } from '../player.js';

function $(id) {
  return document.getElementById(id);
}

function setOpen(open) {
  const overlay = $('nowPlayingFullscreen');
  if (!overlay) return;

  const syncUI = () => {
    const current = getCurrentSong();
    renderSong(current);
    renderQueue();
    renderProgressFromAudio();
    const audio = $('audioPlayer');
    if (audio) renderPlayPauseButton(!audio.paused);
  };

  if (open) {
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('npfs-open');

    // Ensure UI is populated even if the song started before opening.
    syncUI();

    requestAnimationFrame(() => overlay.classList.add('is-open'));
    return;
  }

  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('npfs-open');
  overlay.style.removeProperty('--npfs-art-url');
  // Let CSS transition finish.
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 200);
}

function isOpen() {
  const overlay = $('nowPlayingFullscreen');
  return Boolean(overlay && overlay.style.display !== 'none' && overlay.classList.contains('is-open'));
}

function renderPlayPauseButton(isPlaying) {
  const btn = $('npfsPlayPause');
  if (!btn) return;

  btn.innerHTML = isPlaying
    ? '<svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
}

function renderSong(song) {
  const title = $('npfsTitle');
  const artist = $('npfsArtist');
  const artwork = $('npfsArtwork');

  if (!title || !artist || !artwork) return;

  if (!song) {
    title.textContent = 'No song playing';
    artist.textContent = '';
    artwork.removeAttribute('src');
    artwork.style.opacity = '0.2';
    return;
  }

  title.textContent = song.title || 'Unknown';
  artist.textContent = song.artist || 'Unknown Artist';

  const artUrl = albumCoverUrl(song.id);
  artwork.style.opacity = '1';
  artwork.onerror = () => {
    artwork.style.opacity = '0.2';
  };
  artwork.src = artUrl;

  // Ambient background
  const overlay = $('nowPlayingFullscreen');
  overlay?.style?.setProperty('--npfs-art-url', `url("${artUrl}")`);
}

function renderProgressFromAudio() {
  const audio = $('audioPlayer');
  const currentTimeEl = $('npfsCurrentTime');
  const totalTimeEl = $('npfsTotalTime');
  const range = $('npfsProgressBar');

  if (!audio || !currentTimeEl || !totalTimeEl || !range) return;

  const duration = Number(audio.duration);
  const current = Number(audio.currentTime);

  currentTimeEl.textContent = formatDuration(current);
  totalTimeEl.textContent = formatDuration(duration);

  const percent = duration > 0 ? (current / duration) * 100 : 0;
  range.value = String(Number.isFinite(percent) ? percent : 0);
}

function renderQueue() {
  const list = $('npfsQueueList');
  if (!list) return;

  list.innerHTML = '';

  if (!Array.isArray(playbackList) || playbackList.length === 0 || playbackIndex < 0) {
    list.innerHTML = '<div class="npfs-queue-empty">Queue is empty</div>';
    return;
  }

  const start = Math.min(playbackIndex + 1, playbackList.length);
  const end = Math.min(playbackList.length, start + 12);

  if (start >= end) {
    list.innerHTML = '<div class="npfs-queue-empty">End of queue</div>';
    return;
  }

  for (let i = start; i < end; i++) {
    const song = playbackList[i];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'npfs-queue-item';
    row.dataset.index = String(i);

    const t = escapeHtml(song?.title || 'Unknown');
    const a = escapeHtml(song?.artist || 'Unknown Artist');

    row.innerHTML = `
      <div class="npfs-queue-item-title">${t}</div>
      <div class="npfs-queue-item-artist">${a}</div>
    `;

    row.addEventListener('click', () => {
      if (!playbackList[i]) return;
      setPlaybackIndex(i);
      playSong(playbackList[i]);
    });

    list.appendChild(row);
  }
}

export function setupNowPlayingFullscreen() {
  const overlay = $('nowPlayingFullscreen');
  if (!overlay) return;

  // Open triggers
  $('openNowPlayingFullscreen')?.addEventListener('click', () => setOpen(true));

  // Clicking on art/title areas should open as well.
  document.getElementById('npArtwork')?.addEventListener('click', () => setOpen(true));
  document.querySelector('.np-song-info')?.addEventListener('click', () => setOpen(true));

  // Mini player: tap info to open fullscreen
  document.querySelector('#miniPlayer .mini-player-info')?.addEventListener('click', () => setOpen(true));

  // Close triggers
  $('closeNowPlayingFullscreen')?.addEventListener('click', () => setOpen(false));

  overlay.addEventListener('click', (e) => {
    // Click outside the surface closes.
    if (e.target?.id === 'nowPlayingFullscreen') setOpen(false);
  });

  // Escape closes fullscreen (even if focus is inside a button).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!isOpen()) return;
    e.preventDefault();
    setOpen(false);
  });

  // Controls
  $('npfsPrev')?.addEventListener('click', () => playPrevious());
  $('npfsNext')?.addEventListener('click', () => playNext());
  $('npfsPlayPause')?.addEventListener('click', () => togglePlayPause());

  $('npfsShuffle')?.addEventListener('click', () => document.getElementById('shuffleButton')?.click());
  $('npfsRepeat')?.addEventListener('click', () => document.getElementById('repeatButton')?.click());

  $('npfsOpenQueue')?.addEventListener('click', () => {
    // Reuse existing sidebar open-to-queue behavior.
    document.getElementById('miniQueue')?.click();
  });

  $('npfsClear')?.addEventListener('click', () => {
    clearPlaybackList({ keepCurrent: true });

    // Keep sidebar queue in sync.
    document.dispatchEvent(new CustomEvent('queueUpdated'));
  });

  // Seek
  $('npfsProgressBar')?.addEventListener('input', (e) => {
    seek(e.target.value);
    renderProgressFromAudio();
  });

  // Sync from player events
  document.addEventListener('songChanged', (e) => {
    if (!isOpen()) return;
    renderSong(e.detail);
    renderQueue();
    renderProgressFromAudio();
  });

  document.addEventListener('playStateChanged', (e) => {
    if (!isOpen()) return;
    renderPlayPauseButton(Boolean(e.detail));
  });

  document.addEventListener('progressUpdated', () => {
    if (!isOpen()) return;
    renderProgressFromAudio();
  });

  document.addEventListener('queueUpdated', () => {
    if (!isOpen()) return;
    renderQueue();
  });

  // Initial state (so opening instantly shows correct info)
  const current = getCurrentSong();
  renderSong(current);
  renderQueue();
  renderProgressFromAudio();

  // If user opens it before a playStateChanged event fires, derive from audio.
  const audio = $('audioPlayer');
  if (audio) renderPlayPauseButton(!audio.paused);

  // Improve mobile feel: when opened, nudge volume down a bit if blasting.
  // (No UI here yet; just a small sanity guard.)
  if (audio && audio.volume > 0.95) {
    setVolume(0.95);
  }
}
