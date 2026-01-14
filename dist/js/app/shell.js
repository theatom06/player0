import { setupModal } from './uiModals.js';
import { setupNavigation } from './navigation.js';
import { setupSearch } from './search.js';
import { setupPlayerControls } from './playerSetup.js';
import { setupSidebar } from './sidebar.js';
import { initRouter } from './views.js';
import { setupDropdowns } from './dropdowns.js';
import { initLazyLoading } from '../utils.js';

export function bootstrapApp() {
  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize lazy loading for images
    initLazyLoading();
    
    setupNavigation();
    setupSearch();
    setupPlayerControls();
    setupSidebar();
    setupModal();
    setupDropdowns();

    // IMPORTANT: initRouter() triggers the initial view load.
    await initRouter();

    // Default: keep the now playing sidebar closed.
    // Users can expand it (mini player arrow or queue button).
    const nowPlayingSidebar = document.getElementById('nowPlayingSidebar');
    const miniPlayer = document.getElementById('miniPlayer');

    const mobileQuery = window.matchMedia('(max-width: 700px)');
    const isMobile = mobileQuery.matches;

    if (nowPlayingSidebar) {
      // Desktop: slide in from right. Mobile: fullscreen sheet from bottom.
      nowPlayingSidebar.style.display = 'none';
      nowPlayingSidebar.style.transform = isMobile ? 'translateY(100%)' : 'translateX(320px)';
    }
    if (miniPlayer) {
      // Hidden by default; will be shown when something is loaded/playing.
      miniPlayer.style.display = 'none';
      miniPlayer.style.transform = 'translateY(100%)';
    }
    document.querySelector('.app-container')?.classList.add('sidebar-closed');
  });
}
