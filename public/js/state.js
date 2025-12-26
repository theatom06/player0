/**
 * ============================================
 * Application State Management
 * ============================================
 * 
 * Centralized state management for the music player.
 * Manages songs, queue, and playback state.
 * 
 * State Variables:
 * - allSongs: Complete library of songs
 * - currentSongs: Currently displayed/filtered songs
 * - queue: Playback queue
 * - currentIndex: Current position in queue
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
 * Playback queue
 * @type {Array<Object>}
 */
export let queue = [];

/**
 * Current song index in queue
 * @type {number}
 */
export let currentIndex = -1;

/**
 * Playback state
 * @type {boolean}
 */
export let isPlaying = false;

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
 * Set playback queue
 * @param {Array<any>} newQueue
 * @param {number} index
 */
export function setQueue(newQueue, index = 0) {
  queue = newQueue;
  currentIndex = index;
}

/**
 * Set current playing index
 * @param {number} index
 */
export function setCurrentIndex(index) {
  currentIndex = index;
}

/**
 * Set playing state
 * @param {boolean} playing
 */
export function setIsPlaying(playing) {
  isPlaying = playing;
}

/**
 * Get next song in queue
 * @returns {boolean} - Whether there is a next song
 */
export function hasNext() {
  return currentIndex < queue.length - 1;
}

/**
 * Get previous song in queue
 * @returns {boolean} - Whether there is a previous song
 */
export function hasPrevious() {
  return currentIndex > 0;
}

/**
 * Move to next song
 * @returns {any} - The next song or null
 */
export function getNext() {
  if (hasNext()) {
    currentIndex++;
    return queue[currentIndex];
  }
  return null;
}

/**
 * Move to previous song
 * @returns {any} - The previous song or null
 */
export function getPrevious() {
  if (hasPrevious()) {
    currentIndex--;
    return queue[currentIndex];
  }
  return null;
}

/**
 * Get current song
 * @returns {any} - The current song or null
 */
export function getCurrentSong() {
  return queue[currentIndex] || null;
}
