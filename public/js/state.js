/**
 * ============================================
 * Application State Management
 * ============================================
 * 
 * Centralized state management for the music player.
 * Manages songs and playback state.
 * 
 * State Variables:
 * - allSongs: Complete library of songs
 * - currentSongs: Currently displayed/filtered songs
 * - playbackList: Currently active playback list
 * - playbackIndex: Current position in playback list
 * - isPlaying: Playback status
 * 
 * @module state
 */

/**
 * Complete song library
 * @type {Array<Object>}
 */
export let allSongs = [];

/**
 * Currently displayed songs (filtered/searched)
 * @type {Array<Object>}
 */
export let currentSongs = [];

/**
 * Currently active playback list
 * @type {Array<Object>}
 */
export let playbackList = [];

/**
 * Current song index in playback list
 * @type {number}
 */
export let playbackIndex = -1;

/**
 * Playback state
 * @type {boolean}
 */
export let isPlaying = false;

/**
 * Shuffle mode
 * @type {boolean}
 */
export let isShuffleEnabled = false;

/**
 * Repeat mode
 * - off: stop at end
 * - one: repeat current song
 * - all: loop entire list
 * @type {'off'|'one'|'all'}
 */
export let repeatMode = 'off';

/**
 * Normalize an index to an integer.
 * @param {any} value
 * @returns {number}
 */
function toInt(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : 0;
}

/**
 * Clamp a number to a range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Set all songs
 * @param {Array<any>} songs
 */
export function setAllSongs(songs) {
  allSongs = songs;
}

/**
 * Set current songs
 * @param {Array<any>} songs
 */
export function setCurrentSongs(songs) {
  currentSongs = songs;
}

/**
 * Set active playback list
 * @param {Array<any>} list
 * @param {number} index
 */
export function setPlaybackList(list, index = 0) {
  playbackList = Array.isArray(list) ? list : [];
  if (playbackList.length === 0) {
    playbackIndex = -1;
    return;
  }

  playbackIndex = clamp(toInt(index), 0, playbackList.length - 1);
}

/**
 * Clear the playback list.
 * By default keeps the currently playing song as the only item.
 * @param {{ keepCurrent?: boolean }} [options]
 */
export function clearPlaybackList(options = {}) {
  const keepCurrent = options.keepCurrent !== false;

  if (!keepCurrent || playbackIndex < 0 || playbackIndex >= playbackList.length) {
    playbackList = [];
    playbackIndex = -1;
    return;
  }

  const currentSong = playbackList[playbackIndex];
  playbackList = [currentSong];
  playbackIndex = 0;
}

/**
 * Set playing state
 * @param {boolean} playing
 */
export function setIsPlaying(playing) {
  isPlaying = playing;
}

/**
 * Enable/disable shuffle.
 * @param {boolean} enabled
 */
export function setShuffleEnabled(enabled) {
  isShuffleEnabled = Boolean(enabled);
}

/**
 * Toggle shuffle. When enabling, shuffles upcoming songs in-place.
 * @returns {boolean} New shuffle state
 */
export function toggleShuffle() {
  isShuffleEnabled = !isShuffleEnabled;
  if (isShuffleEnabled) {
    shuffleUpcoming();
  }
  return isShuffleEnabled;
}

/**
 * Set repeat mode.
 * @param {'off'|'one'|'all'} mode
 */
export function setRepeatMode(mode) {
  if (mode === 'off' || mode === 'one' || mode === 'all') {
    repeatMode = mode;
  }
}

/**
 * Cycle repeat mode: off -> all -> one -> off
 * @returns {'off'|'one'|'all'} New repeat mode
 */
export function cycleRepeatMode() {
  repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
  return repeatMode;
}

function shuffleArrayInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Shuffle the list items after the current index.
 * Keeps the currently playing song fixed.
 */
export function shuffleUpcoming() {
  if (!playbackList.length) return;
  const start = Math.max(0, playbackIndex + 1);
  if (start >= playbackList.length - 1) return;
  const upcoming = playbackList.slice(start);
  shuffleArrayInPlace(upcoming);
  playbackList.splice(start, playbackList.length - start, ...upcoming);
}

/**
 * Whether there is a next song in the active list
 * @returns {boolean} - Whether there is a next song
 */
export function hasNext() {
  return playbackIndex >= 0 && playbackIndex < playbackList.length - 1;
}

/**
 * Whether there is a previous song in the active list
 * @returns {boolean} - Whether there is a previous song
 */
export function hasPrevious() {
  return playbackIndex > 0;
}

/**
 * Move to next song
 * @returns {any} - The next song or null
 */
export function getNext() {
  if (hasNext()) {
    playbackIndex++;
    return playbackList[playbackIndex];
  }
  return null;
}

/**
 * Move to previous song
 * @returns {any} - The previous song or null
 */
export function getPrevious() {
  if (hasPrevious()) {
    playbackIndex--;
    return playbackList[playbackIndex];
  }
  return null;
}

/**
 * Get current song
 * @returns {any} - The current song or null
 */
export function getCurrentSong() {
  return playbackList[playbackIndex] || null;
}

/**
 * Set current playing index within the active playback list.
 * @param {number} index
 */
export function setPlaybackIndex(index) {
  if (!playbackList.length) {
    playbackIndex = -1;
    return;
  }
  playbackIndex = clamp(toInt(index), 0, playbackList.length - 1);
}

/**
 * Move an item within the active playback list.
 * Keeps the currently playing track pointing at the same item.
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function movePlaybackItem(fromIndex, toIndex) {
  const from = toInt(fromIndex);
  if (from < 0 || from >= playbackList.length) return;

  const to = clamp(toInt(toIndex), 0, playbackList.length - 1);
  if (from === to) return;

  const [moved] = playbackList.splice(from, 1);
  playbackList.splice(to, 0, moved);

  // Keep playbackIndex referencing the same song.
  if (from === playbackIndex) {
    playbackIndex = to;
    return;
  }

  // Adjust playbackIndex when the moved element crosses it.
  if (from < playbackIndex && to >= playbackIndex) {
    playbackIndex -= 1;
  } else if (from > playbackIndex && to <= playbackIndex) {
    playbackIndex += 1;
  }
}

/**
 * Remove an item from the active playback list.
 * Adjusts playbackIndex so it continues to reference the current song when possible.
 * @param {number} index
 * @returns {{ removed: any, removedWasCurrent: boolean, newIndex: number } | null}
 */
export function removePlaybackItem(index) {
  const i = toInt(index);
  if (i < 0 || i >= playbackList.length) return null;

  const removedWasCurrent = i === playbackIndex;
  const [removed] = playbackList.splice(i, 1);

  if (playbackList.length === 0) {
    playbackIndex = -1;
    return { removed, removedWasCurrent, newIndex: -1 };
  }

  if (i < playbackIndex) {
    playbackIndex -= 1;
  } else if (removedWasCurrent) {
    playbackIndex = clamp(i, 0, playbackList.length - 1);
  }

  return { removed, removedWasCurrent, newIndex: playbackIndex };
}

/**
 * Append one or more songs to the end of the active playback list (queue).
 * Does not start playback.
 * @param {any|any[]} songs
 */
export function enqueueSongs(songs) {
  const items = Array.isArray(songs) ? songs : [songs];
  const toAdd = items.filter(Boolean);
  if (toAdd.length === 0) return;

  if (!playbackList.length) {
    playbackList = [...toAdd];
    playbackIndex = 0;
    return;
  }

  playbackList.push(...toAdd);
}

/**
 * Insert one or more songs as the next items after the current song.
 * If nothing is queued yet, seeds the playback list.
 * Does not start playback.
 * @param {any|any[]} songs
 */
export function playNextSongs(songs) {
  const items = Array.isArray(songs) ? songs : [songs];
  const toAdd = items.filter(Boolean);
  if (toAdd.length === 0) return;

  if (!playbackList.length) {
    playbackList = [...toAdd];
    playbackIndex = 0;
    return;
  }

  const insertAt = playbackIndex >= 0 ? playbackIndex + 1 : playbackList.length;
  playbackList.splice(insertAt, 0, ...toAdd);
}

/**
 * Global state accessor for external modules
 * @type {Object}
 */
export const AppState = {
  get allSongs() { return allSongs; },
  get currentSongs() { return currentSongs; },
  get playbackList() { return playbackList; },
  get playbackIndex() { return playbackIndex; },
  get isPlaying() { return isPlaying; },
  get isShuffleEnabled() { return isShuffleEnabled; },
  get repeatMode() { return repeatMode; },
  get library() { return { songs: allSongs }; }
};
