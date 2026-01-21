import { initPlayer, playNext, playPrevious, seek, setVolume, togglePlayPause } from '../player.js';
import { closeAllModals } from './uiModals.js';

export function setupPlayerControls() {
  const audioPlayer = document.getElementById('audioPlayer');
  if (!audioPlayer) return;

  const playPauseButton = document.getElementById('playPauseButton');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const progressBar = document.getElementById('progressBar');
  const volumeSlider = document.getElementById('volumeSlider');

  initPlayer(audioPlayer);

  playPauseButton?.addEventListener('click', togglePlayPause);
  prevButton?.addEventListener('click', playPrevious);
  nextButton?.addEventListener('click', playNext);

  progressBar?.addEventListener('input', (e) => {
    seek(e.target.value);
  });

  volumeSlider?.addEventListener('input', (e) => {
    // `setVolume` expects 0-100.
    setVolume(Number(e.target.value) || 0);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        // allow below
      } else {
        return;
      }
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        playNext();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        playPrevious();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        document.getElementById('shuffleButton')?.click();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        document.getElementById('repeatButton')?.click();
        break;
      case 'ArrowUp': {
        e.preventDefault();
        const current = volumeSlider ? Number(volumeSlider.value || 0) : (audioPlayer.volume * 100);
        const next = Math.min(100, current + 10);
        setVolume(next);
        if (volumeSlider) volumeSlider.value = String(next);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const current = volumeSlider ? Number(volumeSlider.value || 0) : (audioPlayer.volume * 100);
        const next = Math.max(0, current - 10);
        setVolume(next);
        if (volumeSlider) volumeSlider.value = String(next);
        break;
      }
      case 'k':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          document.getElementById('searchInput')?.focus();
        }
        break;
      case 'p':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const m = document.getElementById('keyboardShortcutsModal');
          if (m) m.style.display = 'flex';
        }
        break;
      case 'Escape':
        closeAllModals();
        break;
    }
  });

  // Mini player controls
  document.getElementById('miniPlayPause')?.addEventListener('click', togglePlayPause);
  document.getElementById('miniPrev')?.addEventListener('click', playPrevious);
  document.getElementById('miniNext')?.addEventListener('click', playNext);
}
