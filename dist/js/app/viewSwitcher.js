import { loadSongs } from './library.js';
import { loadAlbums } from './albums.js';
import { loadArtists } from './artists.js';
import { loadPlaylists } from './playlists.js';
import { loadStats } from './stats.js';
import { setupSettingsView } from './settings.js';

export async function switchView(viewName, updateUrl = true) {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  // Mobile: hide the search bar when navigating between views.
  if (window.matchMedia('(max-width: 700px)').matches) {
    document.body.classList.remove('mobile-search-open');
    document.getElementById('searchInput')?.blur();

    const advanced = document.getElementById('advancedSearch');
    if (advanced) advanced.style.display = 'none';
    document.getElementById('advancedSearchToggle')?.classList.remove('active');
  }

  const viewMap = {
    library: 'library.html',
    albums: 'albums.html',
    artists: 'artists.html',
    playlists: 'playlists.html',
    playlistDetailView: 'playlist-detail.html',
    albumDetailView: 'album-detail.html',
    stats: 'stats.html',
    settings: 'settings.html'
  };

  const htmlFile = viewMap[viewName] || viewMap[viewName.replace('View', '')];
  if (!htmlFile) return;

  try {
    const response = await fetch(`/views/${htmlFile}`);
    const html = await response.text();
    container.innerHTML = html;

    container.style.animation = 'fadeIn 0.3s ease-out';

    if (updateUrl) {
      const route = viewName.replace('View', '');
      window.location.hash = `#/${route}`;
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName || item.dataset.view === viewName.replace('View', '')) {
        item.classList.add('active');
      }
    });

    switch (viewName) {
      case 'library':
        void loadSongs();
        break;
      case 'albums':
        void loadAlbums();
        break;
      case 'artists':
        void loadArtists();
        break;
      case 'playlists':
        void loadPlaylists();
        break;
      case 'stats':
        void loadStats();
        break;
      case 'settings':
        setupSettingsView();
        break;
    }
  } catch (error) {
    console.error('Error loading view:', error);
    container.innerHTML = '<div class="error">Failed to load view</div>';
  }
}
