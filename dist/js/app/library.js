import { fetchAllSongs } from '../API.js';
import { currentSongs, setCurrentSongs, setPlaybackList, setShuffleEnabled, setRepeatMode } from '../state.js';
import { playSong } from '../player.js';
import { renderSongs } from '../ui.js';

export function playSongFromList(index) {
  setPlaybackList([...currentSongs], index);
  playSong(currentSongs[index]);
}

export function playAll() {
  setShuffleEnabled(false);
  setRepeatMode('off');
  setPlaybackList([...currentSongs], 0);
  playSong(currentSongs[0]);
}

export function shuffleAll() {
  setShuffleEnabled(true);
  setRepeatMode('off');
  const shuffled = [...currentSongs].sort(() => Math.random() - 0.5);
  setPlaybackList(shuffled, 0);
  playSong(shuffled[0]);
}

export async function loadSongs() {
  try {
    const songs = await fetchAllSongs();
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);

    const playAllBtn = document.getElementById('playAll');
    const shuffleAllBtn = document.getElementById('shuffleAll');
    if (playAllBtn) playAllBtn.onclick = () => playAll();
    if (shuffleAllBtn) shuffleAllBtn.onclick = () => shuffleAll();
  } catch (error) {
    console.error('Error loading songs:', error);
  }
}

// Backwards compatibility (used by some UI renderers)
window.playSongFromList = playSongFromList;
