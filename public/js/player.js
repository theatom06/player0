// Player Module - Audio playback functionality
import { formatDuration } from './utils.js';
import { API_URL, songStreamUrl, albumCoverUrl, recordPlay as recordPlayAPI } from './API.js';
import { 
  queue, 
  currentIndex, 
  setQueue, 
  setCurrentIndex, 
  setIsPlaying,
  getNext,
  getPrevious,
  hasNext,
  hasPrevious
} from './state.js';

let audioPlayer = null;

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
}

/**
 * Play a specific song
 * @param {any} song - The song to play
 */
export function playSong(song) {
  if (!song || !audioPlayer) return;
  
  audioPlayer.src = songStreamUrl(song.id);
  audioPlayer.play();
  
  // Show now playing sidebar when a song starts playing
  const nowPlayingSidebar = document.getElementById('nowPlayingSidebar');
  const miniPlayer = document.getElementById('miniPlayer');
  const appContainer = document.querySelector('.app-container');
  
  if (nowPlayingSidebar && miniPlayer && appContainer) {
    nowPlayingSidebar.style.display = 'flex';
    // Trigger animation
    requestAnimationFrame(() => {
      nowPlayingSidebar.style.transform = 'translateX(0)';
    });
    miniPlayer.style.transform = 'translateY(100%)';
    setTimeout(() => {
      miniPlayer.style.display = 'none';
    }, 400);
    appContainer.classList.remove('sidebar-closed');
  }
  
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
  
  // Update queue display
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
 * Play next song in queue
 */
export function playNext() {
  const nextSong = getNext();
  if (nextSong) {
    playSong(nextSong);
  }
}

/**
 * Play previous song in queue
 */
export function playPrevious() {
  const prevSong = getPrevious();
  if (prevSong) {
    playSong(prevSong);
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
 * Update queue display
 */
function updateQueue() {
  const queueList = document.getElementById('queueList');
  if (!queueList) return;
  
  queueList.innerHTML = '';
  
  if (queue.length === 0) {
    queueList.innerHTML = '<p class="empty-queue">Queue is empty</p>';
    return;
  }
  
  queue.forEach((song, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item' + (index === currentIndex ? ' active' : '');
    item.innerHTML = `
      <div class="queue-title">${escapeHtml(song.title)}</div>
      <div class="queue-artist">${escapeHtml(song.artist)}</div>
    `;
    item.addEventListener('click', () => {
      setCurrentIndex(index);
      playSong(queue[index]);
    });
    queueList.appendChild(item);
  });
}

/**
 * Escape HTML for safe display
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
