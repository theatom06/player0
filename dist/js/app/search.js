import { debounce } from '../utils.js';
import { advancedSearch as AdvancedSearchAPI, fetchAllSongs, simpleSearch, getSearchSuggestions } from '../API.js';
import { setCurrentSongs } from '../state.js';
import { renderSongs } from '../ui.js';
import { switchView } from './views.js';
import { playSongFromList } from './library.js';

const searchInput = document.getElementById('searchInput');
const advancedSearchEl = document.getElementById('advancedSearch');
const advancedSearchToggle = document.getElementById('advancedSearchToggle');

// Autocomplete elements
let suggestionsDropdown = null;
let selectedSuggestionIndex = -1;
let currentSuggestions = [];

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

  // Create suggestions dropdown
  createSuggestionsDropdown();

  searchInput.addEventListener('input', debounce(handleSearchInput, 150));
  searchInput.addEventListener('keydown', handleSearchKeydown);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      hideSuggestions();
      void performSearch();
    }
  });
  
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2 && currentSuggestions.length > 0) {
      showSuggestions();
    }
  });

  searchButton.addEventListener('click', () => {
    hideSuggestions();
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

// ============================================
// Search Autocomplete Functions
// ============================================

function createSuggestionsDropdown() {
  if (suggestionsDropdown) return;
  
  suggestionsDropdown = document.createElement('div');
  suggestionsDropdown.className = 'search-suggestions';
  suggestionsDropdown.style.display = 'none';
  
  // Insert after search input's parent
  const searchBar = searchInput.closest('.search-bar');
  if (searchBar) {
    searchBar.style.position = 'relative';
    searchBar.appendChild(suggestionsDropdown);
  }
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
      hideSuggestions();
    }
  });
}

async function handleSearchInput(e) {
  const query = searchInput.value.trim();
  
  if (query.length < 2) {
    hideSuggestions();
    currentSuggestions = [];
    // Still perform search to show all results when input is cleared
    if (query.length === 0) {
      void performSearch();
    }
    return;
  }
  
  try {
    const suggestions = await getSearchSuggestions(query, 5);
    currentSuggestions = flattenSuggestions(suggestions);
    
    if (currentSuggestions.length > 0) {
      renderSuggestions(suggestions);
      showSuggestions();
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('Error getting suggestions:', error);
    hideSuggestions();
  }
}

function flattenSuggestions(suggestions) {
  const flat = [];
  
  if (suggestions.artists?.length) {
    suggestions.artists.forEach(s => flat.push({ ...s, category: 'artist' }));
  }
  if (suggestions.albums?.length) {
    suggestions.albums.forEach(s => flat.push({ ...s, category: 'album' }));
  }
  if (suggestions.songs?.length) {
    suggestions.songs.forEach(s => flat.push({ ...s, category: 'song' }));
  }
  if (suggestions.genres?.length) {
    suggestions.genres.forEach(s => flat.push({ ...s, category: 'genre' }));
  }
  
  return flat;
}

function renderSuggestions(suggestions) {
  if (!suggestionsDropdown) return;
  
  let html = '';
  selectedSuggestionIndex = -1;
  
  const categoryIcons = {
    artists: `<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M9 9h.01M15 9h.01M9 15s1.5 2 3 2 3-2 3-2"/></svg>`,
    albums: `<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
    songs: `<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    genres: `<svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`
  };
  
  let globalIndex = 0;
  
  for (const [category, items] of Object.entries(suggestions)) {
    if (!items || items.length === 0) continue;
    
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
    html += `<div class="suggestion-category">
      <div class="suggestion-category-header">${categoryIcons[category] || ''} ${categoryLabel}</div>`;
    
    for (const item of items) {
      const subtitle = item.artist ? `<span class="suggestion-subtitle">${escapeHtml(item.artist)}</span>` : '';
      html += `<div class="suggestion-item" data-index="${globalIndex}" data-type="${item.type}" data-value="${escapeHtml(item.value)}" ${item.id ? `data-id="${item.id}"` : ''} ${item.artist ? `data-artist="${escapeHtml(item.artist)}"` : ''}>
        <span class="suggestion-text">${escapeHtml(item.value)}</span>
        ${subtitle}
      </div>`;
      globalIndex++;
    }
    
    html += '</div>';
  }
  
  suggestionsDropdown.innerHTML = html;
  
  // Add click handlers
  suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => handleSuggestionClick(item));
    item.addEventListener('mouseenter', () => {
      selectedSuggestionIndex = parseInt(item.dataset.index, 10);
      updateSelectedSuggestion();
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function showSuggestions() {
  if (suggestionsDropdown) {
    suggestionsDropdown.style.display = 'block';
  }
}

function hideSuggestions() {
  if (suggestionsDropdown) {
    suggestionsDropdown.style.display = 'none';
  }
  selectedSuggestionIndex = -1;
}

function handleSearchKeydown(e) {
  if (!suggestionsDropdown || suggestionsDropdown.style.display === 'none') return;
  
  const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
      updateSelectedSuggestion();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
      updateSelectedSuggestion();
      break;
    case 'Enter':
      if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
        e.preventDefault();
        handleSuggestionClick(items[selectedSuggestionIndex]);
      }
      break;
    case 'Escape':
      hideSuggestions();
      break;
  }
}

function updateSelectedSuggestion() {
  const items = suggestionsDropdown?.querySelectorAll('.suggestion-item');
  if (!items) return;
  
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedSuggestionIndex);
  });
  
  // Scroll into view
  if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
    items[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
  }
}

async function handleSuggestionClick(item) {
  const type = item.dataset.type;
  const value = item.dataset.value;
  const artist = item.dataset.artist;
  const id = item.dataset.id;
  
  hideSuggestions();
  
  switch (type) {
    case 'artist':
      searchInput.value = '';
      document.getElementById('filterArtist')?.setAttribute('value', value);
      await searchByArtist(value);
      break;
    case 'album':
      searchInput.value = '';
      await searchByAlbum(value, artist);
      break;
    case 'song':
      searchInput.value = value;
      await performSearch();
      break;
    case 'genre':
      searchInput.value = '';
      await searchByGenre(value);
      break;
    default:
      searchInput.value = value;
      await performSearch();
  }
}

async function searchByArtist(artist) {
  await ensureLibraryViewForResults();
  try {
    const songs = await advancedSearch({ artist });
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
  } catch (error) {
    console.error('Error searching by artist:', error);
  }
}

async function searchByAlbum(album, artist) {
  await ensureLibraryViewForResults();
  try {
    const filters = { album };
    if (artist) filters.artist = artist;
    const songs = await advancedSearch(filters);
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
  } catch (error) {
    console.error('Error searching by album:', error);
  }
}

async function searchByGenre(genre) {
  await ensureLibraryViewForResults();
  try {
    const songs = await advancedSearch({ genre });
    setCurrentSongs(songs);
    renderSongs(songs, playSongFromList);
  } catch (error) {
    console.error('Error searching by genre:', error);
  }
}

async function advancedSearch(filters) {
  return await AdvancedSearchAPI(filters);
}
