// Player Module - Audio playback functionality
import { formatDuration } from './utils.js';
import { API_URL, songStreamUrl, albumCoverUrl, recordPlay as recordPlayAPI } from './API.js';
import { 
  playbackList,
  playbackIndex,
  setPlaybackList,
  setPlaybackIndex,
  movePlaybackItem,
  removePlaybackItem,
  setIsPlaying,
  isShuffleEnabled,
  repeatMode,
  toggleShuffle,
  cycleRepeatMode,
  shuffleUpcoming,
  getCurrentSong,
  getNext,
  getPrevious,
  hasNext,
  hasPrevious
} from './state.js';

let audioPlayer = null;

let draggingPlaybackIndex = null;
let isQueueExpanded = false;
const QUEUE_COLLAPSED_COUNT = 8;

let touchQueueDrag = null;
let touchQueueDragListenersAttached = false;

function isCoarsePointer() {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch {
    return false;
  }
}

function clearQueueDragOverStates(queueList) {
  queueList.querySelectorAll('.queue-item.is-drag-over, .queue-item.is-touch-dragging').forEach((el) => {
    el.classList.remove('is-drag-over', 'is-touch-dragging');
  });
}

function startTouchQueueDrag(event, fromIndex, fromItem, queueList) {
  if (!event || event.button === 2) return;

  touchQueueDrag = {
    pointerId: event.pointerId,
    fromIndex,
    toIndex: null,
    queueList
  };

  clearQueueDragOverStates(queueList);
  fromItem.classList.add('is-touch-dragging');
  queueList.classList.add('is-touch-dragging');

  // Attach listeners to document so moves are captured even if the pointer is
  // captured by the handle (common on mobile browsers).
  if (!touchQueueDragListenersAttached) {
    document.addEventListener('pointermove', handleTouchQueueDragMove, { passive: false });
    document.addEventListener('pointerup', finishTouchQueueDrag);
    document.addEventListener('pointercancel', finishTouchQueueDrag);
    touchQueueDragListenersAttached = true;
  }
}

function handleTouchQueueDragMove(event) {
  if (!touchQueueDrag) return;
  if (event.pointerId !== touchQueueDrag.pointerId) return;
  event.preventDefault();

  const queueList = touchQueueDrag.queueList;
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const overItem = el?.closest?.('.queue-item');
  if (!overItem || !queueList.contains(overItem)) return;

  const toTarget = Number(overItem.dataset.playbackIndex);
  if (!Number.isFinite(toTarget)) return;

  const rect = overItem.getBoundingClientRect();
  const placeAfter = (event.clientY - rect.top) > rect.height / 2;
  const to = computeDropToIndex(touchQueueDrag.fromIndex, toTarget, placeAfter);

  clearQueueDragOverStates(queueList);
  overItem.classList.add('is-drag-over');
  touchQueueDrag.toIndex = to;
}

function finishTouchQueueDrag(event) {
  if (!touchQueueDrag) return;
  if (event.pointerId !== touchQueueDrag.pointerId) return;

  const { queueList, fromIndex, toIndex } = touchQueueDrag;
  touchQueueDrag = null;

  if (touchQueueDragListenersAttached) {
    document.removeEventListener('pointermove', handleTouchQueueDragMove);
    document.removeEventListener('pointerup', finishTouchQueueDrag);
    document.removeEventListener('pointercancel', finishTouchQueueDrag);
    touchQueueDragListenersAttached = false;
  }

  queueList.classList.remove('is-touch-dragging');
  clearQueueDragOverStates(queueList);

  if (toIndex == null || fromIndex === toIndex) return;
  movePlaybackItem(fromIndex, toIndex);
  updateQueue();
}

function setMiniPlayerPresence(hasSong) {
  document.body.classList.toggle('has-mini-player', Boolean(hasSong));

  const miniPlayer = document.getElementById('miniPlayer');
  if (!miniPlayer) return;

  if (!hasSong) {
    miniPlayer.style.display = 'none';
    miniPlayer.style.transform = 'translateY(100%)';
    return;
  }

  const appContainer = document.querySelector('.app-container');
  const sidebarClosed = Boolean(appContainer?.classList.contains('sidebar-closed'));
  if (!sidebarClosed) return;

  miniPlayer.style.display = 'flex';
  requestAnimationFrame(() => {
    miniPlayer.style.transform = 'translateY(0)';
  });
}

function clearPendingHideSidebarTimeout() {
  const id = window.__player0PendingHideSidebarTimeout;
  if (id) {
    clearTimeout(id);
    window.__player0PendingHideSidebarTimeout = null;
  }
}

function setPendingHideSidebarTimeout(id) {
  window.__player0PendingHideSidebarTimeout = id;
}

/**
 * Initialize the player with audio element reference
 * @param {HTMLAudioElement} audioElement
 */
export function initPlayer(audioElement) {
  audioPlayer = audioElement;
  
  // Setup event listeners
  audioPlayer.addEventListener('timeupdate', updateProgress);
  audioPlayer.addEventListener('ended', playNext);
  audioPlayer.addEventListener('play', () => {
    setIsPlaying(true);
    updatePlayButton();
  });
  audioPlayer.addEventListener('pause', () => {
    setIsPlaying(false);
    updatePlayButton();
  });
  initShuffleRepeatControls();
  updateShuffleRepeatButtons();

  const toggleQueueExpanded = document.getElementById('toggleQueueExpanded');
  toggleQueueExpanded?.addEventListener('click', () => {
    isQueueExpanded = !isQueueExpanded;
    updateQueue();
  });

  // Initial render (empty until something starts playing).
  updateQueue();

  setMiniPlayerPresence(Boolean(getCurrentSong()));
}

function initShuffleRepeatControls() {
  const shuffleButton = document.getElementById('shuffleButton');
  const repeatButton = document.getElementById('repeatButton');

  if (shuffleButton) {
    shuffleButton.addEventListener('click', (event) => {
      event.preventDefault();
      toggleShuffle();
      // When shuffle is enabled, upcoming is shuffled in-place.
      updateShuffleRepeatButtons();
      updateQueue();
    });
  }

  if (repeatButton) {
    repeatButton.addEventListener('click', (event) => {
      event.preventDefault();
      cycleRepeatMode();
      updateShuffleRepeatButtons();
    });
  }
}

function computeDropToIndex(fromIndex, targetIndex, placeAfter) {
  let to = targetIndex + (placeAfter ? 1 : 0);
  // Convert from "original" index space to post-removal index space.
  if (fromIndex < to) to -= 1;
  return to;
}

function updateShuffleRepeatButtons() {
  const shuffleButton = document.getElementById('shuffleButton');
  const repeatButton = document.getElementById('repeatButton');

  if (shuffleButton) {
    shuffleButton.classList.toggle('is-active', Boolean(isShuffleEnabled));
    shuffleButton.title = isShuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off';
  }

  if (repeatButton) {
    const label = repeatMode === 'one' ? 'Repeat: One' : repeatMode === 'all' ? 'Repeat: All' : 'Repeat: Off';
    repeatButton.title = label;
    repeatButton.classList.toggle('is-active', repeatMode !== 'off');

    if (repeatMode === 'one') {
      repeatButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M12 8v8"/><path d="M10.5 10.5L12 9l1.5 1.5"/><path d="M10.5 15.5L12 17l1.5-1.5"/></svg>';
    } else {
      // Default repeat icon (off/all)
      repeatButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    }
  }
}

/**
 * Play a specific song
 * @param {any} song - The song to play
 */
export function playSong(song) {
  if (!song || !audioPlayer) return;
  
  audioPlayer.src = songStreamUrl(song.id);
  audioPlayer.play();
  
  // Update UI
  document.getElementById('npTitle').textContent = song.title || 'Unknown';
  document.getElementById('npArtist').textContent = song.artist || 'Unknown Artist';
  document.getElementById('miniTitle').textContent = song.title || 'Unknown';
  document.getElementById('miniArtist').textContent = song.artist || 'Unknown Artist';
  
  // Set album artwork
  const npArtwork = document.getElementById('npArtwork');
  npArtwork.onerror = () => {
    npArtwork.style.display = 'none';
  };
  npArtwork.src = albumCoverUrl(song.id);
  npArtwork.style.display = 'block';

  setMiniPlayerPresence(true);

  updateShuffleRepeatButtons();

  updateQueue();
  
  // Record play
  recordPlay(song.id);
}

/**
 * Toggle play/pause
 */
export function togglePlayPause() {
  if (!audioPlayer) return;
  
  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
}

/**
 * Play next song in the active playback list
 */
export function playNext() {
  if (!playbackList.length) return;

  if (repeatMode === 'one') {
    // Restart current track without re-recording play.
    if (audioPlayer) {
      audioPlayer.currentTime = 0;
      void audioPlayer.play();
    }
    return;
  }

  const nextSong = getNext();
  if (nextSong) {
    playSong(nextSong);
    return;
  }

  if (repeatMode === 'all') {
    if (isShuffleEnabled && playbackList.length > 1) {
      const shuffled = [...playbackList].sort(() => Math.random() - 0.5);
      setPlaybackList(shuffled, 0);
      playSong(shuffled[0]);
      return;
    }

    setPlaybackIndex(0);
    playSong(playbackList[0]);
  }
}

/**
 * Play previous song in the active playback list
 */
export function playPrevious() {
  if (!playbackList.length) return;

  // If we're not near the start, behave like typical players.
  if (audioPlayer && audioPlayer.currentTime > 3) {
    audioPlayer.currentTime = 0;
    return;
  }

  const prevSong = getPrevious();
  if (prevSong) {
    playSong(prevSong);
    return;
  }

  if (repeatMode === 'all') {
    const lastIndex = Math.max(0, playbackList.length - 1);
    setPlaybackIndex(lastIndex);
    playSong(playbackList[lastIndex]);
  }
}

/**
 * Update progress bar
 */
function updateProgress() {
  if (!audioPlayer) return;
  
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  document.getElementById('progressBar').value = progress || 0;
  document.getElementById('currentTime').textContent = formatDuration(audioPlayer.currentTime);
  document.getElementById('totalTime').textContent = formatDuration(audioPlayer.duration);
  
  // Update mini player progress bar
  const miniProgressFill = document.getElementById('miniProgressFill');
  if (miniProgressFill) {
    miniProgressFill.style.width = `${progress || 0}%`;
  }
}

/**
 * Update play/pause button state
 */
function updatePlayButton() {
  const playPauseButton = document.getElementById('playPauseButton');
  const miniPlayPause = document.getElementById('miniPlayPause');
  
  if (!playPauseButton || !miniPlayPause) return;
  
  const isPlaying = !audioPlayer.paused;
  
  if (isPlaying) {
    playPauseButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    miniPlayPause.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  } else {
    playPauseButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>';
    miniPlayPause.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>';
  }
}

/**
 * Update queue display (draggable reorder)
 */
export function updateQueue() {
  const queueList = document.getElementById('queueList');
  if (!queueList) return;

  const toggleQueueExpanded = document.getElementById('toggleQueueExpanded');
  if (toggleQueueExpanded) {
    const needsToggle = playbackList.length > QUEUE_COLLAPSED_COUNT;
    toggleQueueExpanded.style.display = needsToggle ? 'inline-flex' : 'none';
    toggleQueueExpanded.textContent = isQueueExpanded ? 'Less' : 'More';
    toggleQueueExpanded.setAttribute('aria-expanded', isQueueExpanded ? 'true' : 'false');
  }

  queueList.innerHTML = '';

  if (!playbackList.length) {
    queueList.innerHTML = '<p class="empty-queue">Queue is empty</p>';
    return;
  }

  let startIndex = 0;
  let endIndex = playbackList.length;
  if (!isQueueExpanded) {
    const count = QUEUE_COLLAPSED_COUNT;
    const current = Math.max(0, playbackIndex);
    startIndex = Math.max(0, current - Math.floor(count / 2));
    endIndex = Math.min(playbackList.length, startIndex + count);
    startIndex = Math.max(0, endIndex - count);
  }

  for (let index = startIndex; index < endIndex; index++) {
    const song = playbackList[index];
    const item = document.createElement('div');
    item.className = 'queue-item' + (index === playbackIndex ? ' active' : '');
    item.dataset.playbackIndex = String(index);

    const handle = document.createElement('div');
    handle.className = 'queue-handle';
    handle.textContent = '⋮⋮';
    handle.draggable = !isCoarsePointer();
    handle.setAttribute('aria-label', 'Drag to reorder');

    if (isCoarsePointer()) {
      handle.addEventListener('pointerdown', (event) => {
        // Only handle touch/pen here; mouse uses HTML5 drag.
        if (event.pointerType === 'mouse') return;
        event.preventDefault();
        startTouchQueueDrag(event, index, item, queueList);
      }, { passive: false });
    }

    const meta = document.createElement('div');
    meta.className = 'queue-meta';

    const title = document.createElement('div');
    title.className = 'queue-title';
    title.textContent = song?.title || 'Unknown';

    const artist = document.createElement('div');
    artist.className = 'queue-artist';
    artist.textContent = song?.artist || 'Unknown Artist';

    meta.appendChild(title);
    meta.appendChild(artist);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'queue-remove';
    removeBtn.setAttribute('aria-label', 'Remove from queue');
    removeBtn.textContent = '✕';

    item.appendChild(handle);
    item.appendChild(meta);
    item.appendChild(removeBtn);

    item.addEventListener('dblclick', () => {
      if (!playbackList[index]) return;
      setPlaybackIndex(index);
      playSong(playbackList[index]);
    });

    handle.addEventListener('dragstart', (event) => {
      draggingPlaybackIndex = index;
      item.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    });

    handle.addEventListener('dragend', () => {
      draggingPlaybackIndex = null;
      item.classList.remove('is-dragging');
      queueList.querySelectorAll('.queue-item.is-drag-over').forEach((el) => {
        el.classList.remove('is-drag-over');
      });
    });

    removeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const result = removePlaybackItem(index);
      if (!result) return;

      if (result.removedWasCurrent) {
        if (result.newIndex >= 0) {
          playSong(playbackList[result.newIndex]);
        } else {
          // Queue is empty: stop playback.
          if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            audioPlayer.load();
          }
          setIsPlaying(false);
          updatePlayButton();
          const npTitle = document.getElementById('npTitle');
          const npArtist = document.getElementById('npArtist');
          const miniTitle = document.getElementById('miniTitle');
          const miniArtist = document.getElementById('miniArtist');
          if (npTitle) npTitle.textContent = 'No song playing';
          if (npArtist) npArtist.textContent = '';
          if (miniTitle) miniTitle.textContent = 'No song playing';
          if (miniArtist) miniArtist.textContent = '';

          setMiniPlayerPresence(false);
        }
      }

      updateQueue();
    });

    item.addEventListener('dragover', (event) => {
      if (draggingPlaybackIndex == null) return;
      event.preventDefault();
      queueList.querySelectorAll('.queue-item.is-drag-over').forEach((el) => {
        if (el !== item) el.classList.remove('is-drag-over');
      });
      item.classList.add('is-drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('is-drag-over');
    });

    item.addEventListener('drop', (event) => {
      event.preventDefault();

      let from = draggingPlaybackIndex;
      if (from == null) {
        const raw = event.dataTransfer?.getData('text/plain');
        const num = Number(raw);
        from = Number.isFinite(num) ? Math.trunc(num) : null;
      }

      const toTarget = Number(item.dataset.playbackIndex);
      if (from == null || !Number.isFinite(toTarget)) return;

      const rect = item.getBoundingClientRect();
      const placeAfter = (event.clientY - rect.top) > rect.height / 2;
      const to = computeDropToIndex(from, toTarget, placeAfter);

      item.classList.remove('is-drag-over');
      if (from === to) return;

      movePlaybackItem(from, to);
      updateQueue();
    });

    queueList.appendChild(item);
  }
}


/**
 * Record a play to the server
 * @param {string} songId
 */
async function recordPlay(songId) {
  try {
    await recordPlayAPI(songId);
  } catch (error) {
    console.error('Error recording play:', error);
  }
}

/**
 * Seek to position in current song
 * @param {number} percentage - 0-100
 */
export function seek(percentage) {
  if (!audioPlayer) return;
  const time = (percentage / 100) * audioPlayer.duration;
  audioPlayer.currentTime = time;
}

/**
 * Set volume
 * @param {number} volume - 0-100
 */
export function setVolume(volume) {
  if (!audioPlayer) return;
  audioPlayer.volume = volume / 100;
}

/**
 * Get audio player reference
 * @returns {HTMLAudioElement}
 */
export function getAudioPlayer() {
  return audioPlayer;
}
