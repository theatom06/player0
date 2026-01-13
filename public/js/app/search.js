import { debounce } from '../utils.js';
import { advancedSearch as AdvancedSearchAPI, fetchAllSongs, simpleSearch } from '../API.js';
import { setCurrentSongs } from '../state.js';
import { renderSongs } from '../ui.js';
import { switchView } from './views.js';
import { playSongFromList } from './library.js';

const searchInput = document.getElementById('searchInput');
const advancedSearchEl = document.getElementById('advancedSearch');
const advancedSearchToggle = document.getElementById('advancedSearchToggle');

function setAdvancedSearchVisible(visible) {
  if (!advancedSearchEl || !advancedSearchToggle) return;
  advancedSearchEl.style.display = visible ? 'block' : 'none';
  advancedSearchToggle.classList.toggle('active', visible);
}

function isAdvancedSearchVisible() {
  return Boolean(advancedSearchEl && advancedSearchEl.style.display === 'block');
}

export function setupSearch() {
  const searchButton = document.querySelector('.search-button');
  if (!searchInput || !searchButton || !advancedSearchToggle || !advancedSearchEl) return;

  searchInput.addEventListener('input', debounce(performSearch, 300));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') void performSearch();
  });

  searchButton.addEventListener('click', () => {
    void performSearch();
  });

  advancedSearchToggle.addEventListener('click', () => {
    setAdvancedSearchVisible(!isAdvancedSearchVisible());
  });

  // Close the panel when focus moves anywhere outside it.
  document.addEventListener('focusin', (event) => {
    if (!isAdvancedSearchVisible()) return;

    const target = event.target;
    if (!target) return;

    if (advancedSearchEl.contains(target)) return;
    if (advancedSearchToggle === target || advancedSearchToggle.contains(target)) return;

    setAdvancedSearchVisible(false);
  });

  // Also close on pointer interactions outside (covers clicks on non-focusable elements).
  document.addEventListener('pointerdown', (event) => {
    if (!isAdvancedSearchVisible()) return;

    const target = event.target;
    if (!target) return;

    if (advancedSearchEl.contains(target)) return;
    if (advancedSearchToggle === target || advancedSearchToggle.contains(target)) return;

    setAdvancedSearchVisible(false);
  }, true);

  document.getElementById('applyFilters')?.addEventListener('click', () => {
    void applyAdvancedSearch();
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    void clearFilters();
  });

  document.getElementById('discoveryNotPlayed')?.addEventListener('click', () => {
    void runDiscoveryNotPlayedRecently();
  });
  document.getElementById('discoveryLowPlays')?.addEventListener('click', () => {
    void runDiscoveryLowPlayCount();
  });
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyScore(query, haystack) {
  if (!query) return -1;
  const q = normalizeText(query);
  const h = normalizeText(haystack);
  if (!q || !h) return -1;

  const tokens = q.split(' ').filter(Boolean);
  let total = 0;
  for (const token of tokens) {
    const idx = h.indexOf(token);
    if (idx >= 0) {
      total += 100 - Math.min(80, idx);
      continue;
    }

    let pos = 0;
    let gaps = 0;
    for (const ch of token) {
      const found = h.indexOf(ch, pos);
      if (found === -1) return -1;
      gaps += Math.max(0, found - pos);
      pos = found + 1;
    }
    total += Math.max(5, 60 - Math.min(55, gaps));
  }
  return total;
}

export async function ensureLibraryViewForResults() {
  if (!document.getElementById('songTableBody')) {
    await switchView('library', false);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

export async function performSearch() {
  if (!searchInput) return;
  const query = searchInput.value.trim();

  await ensureLibraryViewForResults();

  if (!query) {
    const songs = await fetchAllSongs();
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
    return;
  }

  try {
    const songs = await simpleSearch(query);
    if (songs.length > 0) {
      setCurrentSongs(songs);
      renderSongs(songs, playSongFromList);
      return;
    }

    const all = await fetchAllSongs();
    const scored = all
      .map(song => {
        const haystack = `${song.title || ''} ${song.artist || ''} ${song.album || ''} ${song.genre || ''}`;
        return { song, score: fuzzyScore(query, haystack) };
      })
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 300)
      .map(x => x.song);

    setCurrentSongs(scored);
    renderSongs(scored, playSongFromList);
  } catch (error) {
    console.error('Search error:', error);
  }
}

async function applyAdvancedSearch() {
  await ensureLibraryViewForResults();
  const artist = document.getElementById('filterArtist')?.value;
  const album = document.getElementById('filterAlbum')?.value;
  const genre = document.getElementById('filterGenre')?.value;
  const year = document.getElementById('filterYear')?.value;

  try {
    const songs = await AdvancedSearchAPI({ artist, album, genre, year });
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
  } catch (error) {
    console.error('Advanced search error:', error);
  }
}

async function clearFilters() {
  await ensureLibraryViewForResults();
  const artist = document.getElementById('filterArtist');
  const album = document.getElementById('filterAlbum');
  const genre = document.getElementById('filterGenre');
  const year = document.getElementById('filterYear');

  if (artist) artist.value = '';
  if (album) album.value = '';
  if (genre) genre.value = '';
  if (year) year.value = '';
  if (searchInput) searchInput.value = '';

  const songs = await fetchAllSongs();
  setCurrentSongs(songs);
  renderSongs(songs, playSongFromList);
}

async function runDiscoveryNotPlayedRecently() {
  await ensureLibraryViewForResults();
  const songs = await fetchAllSongs();
  const sorted = [...songs].sort((a, b) => {
    const aTime = a.lastPlayed ? Date.parse(a.lastPlayed) : 0;
    const bTime = b.lastPlayed ? Date.parse(b.lastPlayed) : 0;
    if (!a.lastPlayed && b.lastPlayed) return -1;
    if (a.lastPlayed && !b.lastPlayed) return 1;
    return aTime - bTime;
  });
  const pick = sorted.slice(0, 300);
  setCurrentSongs(pick);
  renderSongs(pick, playSongFromList);
}

async function runDiscoveryLowPlayCount() {
  await ensureLibraryViewForResults();
  const songs = await fetchAllSongs();
  const sorted = [...songs].sort((a, b) => {
    const aCount = Number.isFinite(Number(a.playCount)) ? Number(a.playCount) : 0;
    const bCount = Number.isFinite(Number(b.playCount)) ? Number(b.playCount) : 0;
    if (aCount !== bCount) return aCount - bCount;
    const aTime = a.lastPlayed ? Date.parse(a.lastPlayed) : 0;
    const bTime = b.lastPlayed ? Date.parse(b.lastPlayed) : 0;
    return aTime - bTime;
  });
  const pick = sorted.slice(0, 300);
  setCurrentSongs(pick);
  renderSongs(pick, playSongFromList);
}
