// Media Session integration (lockscreen / hardware media keys)
// Safe no-op on unsupported browsers.

function hasMediaSession() {
  try {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  } catch {
    return false;
  }
}

function safeSetActionHandler(action, handler) {
  try {
    // Some browsers throw for unsupported actions.
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // ignore
  }
}

function asArtworkArray(artworkUrl) {
  if (!artworkUrl) return [];

  // We only have one URL (cover endpoint), but Media Session allows a list.
  // Supplying a few common size hints helps some UIs choose well.
  return [
    { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
    { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
    { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
    { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
  ];
}

export function initMediaSession(audioEl, handlers = {}) {
  if (!hasMediaSession()) return;
  if (!audioEl) return;

  const {
    onPlay,
    onPause,
    onNext,
    onPrevious,
    onSeekTo,
    onSeekBy
  } = handlers;

  safeSetActionHandler('play', () => {
    if (typeof onPlay === 'function') return void onPlay();
    void audioEl.play();
  });

  safeSetActionHandler('pause', () => {
    if (typeof onPause === 'function') return void onPause();
    audioEl.pause();
  });

  safeSetActionHandler('previoustrack', () => {
    if (typeof onPrevious === 'function') return void onPrevious();
  });

  safeSetActionHandler('nexttrack', () => {
    if (typeof onNext === 'function') return void onNext();
  });

  safeSetActionHandler('seekto', (details) => {
    const seekTime = details?.seekTime;
    if (typeof seekTime !== 'number' || !Number.isFinite(seekTime)) return;

    if (typeof onSeekTo === 'function') {
      onSeekTo(seekTime);
      return;
    }

    if (details?.fastSeek && typeof audioEl.fastSeek === 'function') {
      audioEl.fastSeek(seekTime);
      return;
    }

    audioEl.currentTime = seekTime;
  });

  // Common 10s skip behavior.
  safeSetActionHandler('seekbackward', (details) => {
    const offset = Number(details?.seekOffset) || 10;
    if (typeof onSeekBy === 'function') {
      onSeekBy(-offset);
      return;
    }
    audioEl.currentTime = Math.max(0, audioEl.currentTime - offset);
  });

  safeSetActionHandler('seekforward', (details) => {
    const offset = Number(details?.seekOffset) || 10;
    if (typeof onSeekBy === 'function') {
      onSeekBy(offset);
      return;
    }
    audioEl.currentTime = Math.min(audioEl.duration || Infinity, audioEl.currentTime + offset);
  });

  // Keep media session playback state in sync.
  const syncPlaybackState = () => {
    try {
      navigator.mediaSession.playbackState = audioEl.paused ? 'paused' : 'playing';
    } catch {
      // ignore
    }
  };

  audioEl.addEventListener('play', syncPlaybackState);
  audioEl.addEventListener('pause', syncPlaybackState);
  audioEl.addEventListener('ended', syncPlaybackState);

  syncPlaybackState();
}

export function setMediaSessionMetadata({ title, artist, album, artworkUrl } = {}) {
  if (!hasMediaSession()) return;

  try {
    // MediaMetadata is not available in every browser even when mediaSession exists.
    if (typeof MediaMetadata === 'undefined') return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || '',
      artist: artist || '',
      album: album || '',
      artwork: asArtworkArray(artworkUrl)
    });
  } catch {
    // ignore
  }
}

export function setMediaSessionPosition(audioEl) {
  if (!hasMediaSession()) return;
  if (!audioEl) return;

  try {
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;

    const duration = Number(audioEl.duration);
    const position = Number(audioEl.currentTime);
    const playbackRate = Number(audioEl.playbackRate || 1);

    if (!Number.isFinite(duration) || duration <= 0) return;
    if (!Number.isFinite(position) || position < 0) return;

    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: Number.isFinite(playbackRate) ? playbackRate : 1,
      position: Math.min(duration, position)
    });
  } catch {
    // ignore
  }
}
