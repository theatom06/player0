import { listArtists } from '../API.js';
import { renderArtists } from '../ui.js';
import { switchView } from './views.js';
import { performSearch } from './search.js';

const searchInput = document.getElementById('searchInput');

export async function loadArtists() {
  try {
    const artists = await listArtists();
    renderArtists(artists, async (artistName) => {
      if (searchInput) searchInput.value = artistName;
      await switchView('library');
      await performSearch();
    });
  } catch (error) {
    console.error('Error loading artists:', error);
  }
}
