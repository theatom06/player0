// Application State Management

/**
 * Application State
 * @type {Array<any>}
 */
export let allSongs = [];

/**
 * Current Songs in View
 * @type {Array<any>}
 */
export let currentSongs = [];

/**
 * Playback Queue
 * @type {Array<any>}
 */
export let queue = [];
export let currentIndex = -1;
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
