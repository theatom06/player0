import { switchView } from './viewSwitcher.js';
import { loadAlbumDetail } from './albums.js';
import { loadPlaylistDetail } from './playlists.js';

export { switchView };

export async function initRouter() {
  const handleRoute = async () => {
    const hash = window.location.hash.slice(2); // Remove #/
    const parts = hash.split('/');
    const view = parts[0];

    if (view && view !== '') {
      if (view === 'playlist' && parts[1]) {
        await loadPlaylistDetail(parts[1]);
      } else if (view === 'album' && parts[1] && parts[2]) {
        await loadAlbumDetail(decodeURIComponent(parts[1]), decodeURIComponent(parts[2]));
      } else {
        await switchView(view, false);
      }
    } else {
      await switchView('library', false);
    }
  };

  window.addEventListener('hashchange', () => {
    void handleRoute();
  });

  await handleRoute();
}
