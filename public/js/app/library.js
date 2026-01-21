import { fetchAllSongs } from '../api.js';
import { currentSongs, setAllSongs, setCurrentSongs, setPlaybackList, setShuffleEnabled, setRepeatMode } from '../state.js';
import { playSong } from '../player.js';
import { renderSongs } from '../ui.js';
import { getSongSortState, setSongSortState, sortSongs, updateLibrarySortUI, setLibraryResultsCount } from './songSort.js';

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
    setAllSongs(songs);
    const sorted = sortSongs(songs, getSongSortState());
    setCurrentSongs(sorted);
    renderSongs(sorted, playSongFromList);
    setLibraryResultsCount({ shown: sorted.length, total: songs.length });

    // Sort UI
    const sortKey = document.getElementById('librarySortKey');
    const sortDir = document.getElementById('librarySortDir');

    const applySort = () => {
      const next = getSongSortState();
      const list = sortSongs([...currentSongs], next);
      setCurrentSongs(list);
      renderSongs(list, playSongFromList);
      setLibraryResultsCount({ shown: list.length, total: songs.length });
      updateLibrarySortUI();
    };

    if (sortKey) {
      sortKey.addEventListener('change', () => {
        setSongSortState({ key: sortKey.value, dir: getSongSortState().dir });
        applySort();
      });
    }
    if (sortDir) {
      sortDir.addEventListener('click', () => {
        const state = getSongSortState();
        setSongSortState({ key: state.key, dir: state.dir === 'desc' ? 'asc' : 'desc' });
        applySort();
      });
    }

    document.querySelectorAll('.song-table thead th[data-sort-key]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        const state = getSongSortState();
        const dir = state.key === key ? (state.dir === 'desc' ? 'asc' : 'desc') : 'asc';
        setSongSortState({ key, dir });
        applySort();
      });
    });

    updateLibrarySortUI();

    // Let other modules (player queue restore) hydrate from the real library.
    document.dispatchEvent(new CustomEvent('player0:songsLoaded', { detail: songs }));

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
