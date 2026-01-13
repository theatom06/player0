function clearPendingHideTimeout() {
  const id = window.__player0PendingHideSidebarTimeout;
  if (id) {
    clearTimeout(id);
    window.__player0PendingHideSidebarTimeout = null;
  }
}

function setPendingHideTimeout(id) {
  window.__player0PendingHideSidebarTimeout = id;
}

export function setupSidebar() {
  const nowPlayingSidebar = document.getElementById('nowPlayingSidebar');
  const miniPlayer = document.getElementById('miniPlayer');
  const appContainer = document.querySelector('.app-container');
  const closeSidebar = document.getElementById('closeSidebar');
  const expandSidebar = document.getElementById('expandSidebar');
  const miniQueue = document.getElementById('miniQueue');

  if (!nowPlayingSidebar || !miniPlayer || !appContainer) return;

  function isMobile() {
    return window.matchMedia('(max-width: 700px)').matches;
  }

  function openSidebar({ scrollToQueue = false } = {}) {
    clearPendingHideTimeout();

    nowPlayingSidebar.style.display = 'flex';
    requestAnimationFrame(() => {
      nowPlayingSidebar.style.transform = isMobile() ? 'translateY(0)' : 'translateX(0)';
    });

    miniPlayer.style.transform = 'translateY(100%)';
    setPendingHideTimeout(setTimeout(() => {
      miniPlayer.style.display = 'none';
      setPendingHideTimeout(null);
    }, 400));

    appContainer.classList.remove('sidebar-closed');

    if (scrollToQueue) {
      // Wait for display/transform updates to settle.
      setTimeout(() => {
        const queueEl = nowPlayingSidebar.querySelector('.np-queue');
        queueEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 0);
    }
  }

  closeSidebar?.addEventListener('click', () => {
    nowPlayingSidebar.style.transform = isMobile() ? 'translateY(100%)' : 'translateX(320px)';

    if (document.body.classList.contains('has-mini-player')) {
      miniPlayer.style.display = 'flex';
      requestAnimationFrame(() => {
        miniPlayer.style.transform = 'translateY(0)';
      });
    } else {
      miniPlayer.style.display = 'none';
      miniPlayer.style.transform = 'translateY(100%)';
    }

    clearPendingHideTimeout();
    setPendingHideTimeout(setTimeout(() => {
      nowPlayingSidebar.style.display = 'none';
      setPendingHideTimeout(null);
    }, 400));

    appContainer.classList.add('sidebar-closed');
  });

  expandSidebar?.addEventListener('click', () => {
    openSidebar({ scrollToQueue: false });
  });

  miniQueue?.addEventListener('click', () => {
    // If sidebar is already open, just scroll to queue.
    if (nowPlayingSidebar.style.display !== 'none' && !appContainer.classList.contains('sidebar-closed')) {
      const queueEl = nowPlayingSidebar.querySelector('.np-queue');
      queueEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }

    openSidebar({ scrollToQueue: true });
  });
}
