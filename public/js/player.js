// Player Module - Audio playback functionality
import { formatDuration } from './utils.js';
import { API_URL, songStreamUrl, albumCoverUrl, recordPlay as recordPlayAPI } from './api.js';
import { initMediaSession, setMediaSessionMetadata, setMediaSessionPosition } from './mediaSession.js';
import { 
  playbackList,
  playbackIndex,
  setPlaybackList,
  setPlaybackIndex,
  clearPlaybackList,
  movePlaybackItem,
  removePlaybackItem,
  setIsPlaying,
  setShuffleEnabled,
  setRepeatMode,
  isShuffleEnabled,
  repeatMode,
  toggleShuffle,
  cycleRepeatMode,
  shuffleUpcoming,
  getCurrentSong,
  getNext,
  getPrevious,
  hasNext,
  hasPrevious
} from './state.js';

let audioPlayer = null;

let lastMediaSessionPositionUpdate = 0;

const RESUME_STORAGE_KEY = 'player0.resume.v1';
const RESUME_SAVE_INTERVAL_MS = 5000;
let lastResumeSaveAt = 0;
let lastResumeSavedPositionSeconds = null;
let didAttemptResumeRestore = false;

const QUEUE_STORAGE_KEY = 'player0.queue.v1';
const QUEUE_SAVE_INTERVAL_MS = 750;
let lastQueueSaveAt = 0;

const SLEEP_TIMER_KEY = 'player0.sleepTimer.v1';
let sleepTimerTargetAt = null;
let sleepTimerIntervalId = null;
let sleepTimerMode = 'pause';
let sleepTimerFadeSeconds = 0;
let sleepTimerPendingStopAfterTrack = false;
let sleepTimerOriginalVolume = null;

let draggingPlaybackIndex = null;
let isQueueExpanded = false;
const QUEUE_COLLAPSED_COUNT = 8;

let touchQueueDrag = null;
let touchQueueDragListenersAttached = false;

function isCoarsePointer() {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch {
    return false;
  }
}

function clearQueueDragOverStates(queueList) {
  queueList.querySelectorAll('.queue-item.is-drag-over, .queue-item.is-touch-dragging').forEach((el) => {
    el.classList.remove('is-drag-over', 'is-touch-dragging');
  });
}

function startTouchQueueDrag(event, fromIndex, fromItem, queueList) {
  if (!event || event.button === 2) return;

  touchQueueDrag = {
    pointerId: event.pointerId,
    fromIndex,
    toIndex: null,
    queueList
  };

  clearQueueDragOverStates(queueList);
  fromItem.classList.add('is-touch-dragging');
  queueList.classList.add('is-touch-dragging');

  // Attach listeners to document so moves are captured even if the pointer is
  // captured by the handle (common on mobile browsers).
  if (!touchQueueDragListenersAttached) {
    document.addEventListener('pointermove', handleTouchQueueDragMove, { passive: false });
    document.addEventListener('pointerup', finishTouchQueueDrag);
    document.addEventListener('pointercancel', finishTouchQueueDrag);
    touchQueueDragListenersAttached = true;
  }
}

function handleTouchQueueDragMove(event) {
  if (!touchQueueDrag) return;
  if (event.pointerId !== touchQueueDrag.pointerId) return;
  event.preventDefault();

  const queueList = touchQueueDrag.queueList;
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const overItem = el?.closest?.('.queue-item');
  if (!overItem || !queueList.contains(overItem)) return;

  const toTarget = Number(overItem.dataset.playbackIndex);
  if (!Number.isFinite(toTarget)) return;

  const rect = overItem.getBoundingClientRect();
  const placeAfter = (event.clientY - rect.top) > rect.height / 2;
  const to = computeDropToIndex(touchQueueDrag.fromIndex, toTarget, placeAfter);

  clearQueueDragOverStates(queueList);
  overItem.classList.add('is-drag-over');
  touchQueueDrag.toIndex = to;
}

function finishTouchQueueDrag(event) {
  if (!touchQueueDrag) return;
  if (event.pointerId !== touchQueueDrag.pointerId) return;

  const { queueList, fromIndex, toIndex } = touchQueueDrag;
  touchQueueDrag = null;

  if (touchQueueDragListenersAttached) {
    document.removeEventListener('pointermove', handleTouchQueueDragMove);
    document.removeEventListener('pointerup', finishTouchQueueDrag);
    document.removeEventListener('pointercancel', finishTouchQueueDrag);
    touchQueueDragListenersAttached = false;
  }

  queueList.classList.remove('is-touch-dragging');
  clearQueueDragOverStates(queueList);

  if (toIndex == null || fromIndex === toIndex) return;

  let to = toIndex;
  // Keep the current track pinned at the top of the queue.
  if (playbackIndex >= 0 && to <= playbackIndex) {
    to = playbackIndex + 1;
  }

  movePlaybackItem(fromIndex, to);
  updateQueue();
}

function setMiniPlayerPresence(hasSong) {
  document.body.classList.toggle('has-mini-player', Boolean(hasSong));

  const miniPlayer = document.getElementById('miniPlayer');
  if (!miniPlayer) return;

  if (!hasSong) {
    miniPlayer.style.display = 'none';
    miniPlayer.style.transform = 'translateY(100%)';
    return;
  }

  const appContainer = document.querySelector('.app-container');
  const sidebarClosed = Boolean(appContainer?.classList.contains('sidebar-closed'));
  if (!sidebarClosed) return;

  miniPlayer.style.display = 'flex';
  requestAnimationFrame(() => {
    miniPlayer.style.transform = 'translateY(0)';
  });
}

function clearPendingHideSidebarTimeout() {
  const id = window.__player0PendingHideSidebarTimeout;
  if (id) {
    clearTimeout(id);
    window.__player0PendingHideSidebarTimeout = null;
  }
}

function setPendingHideSidebarTimeout(id) {
  window.__player0PendingHideSidebarTimeout = id;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readResumeState() {
  try {
    const raw = localStorage.getItem(RESUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.songId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeResumeState(state) {
  try {
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore (private mode / quota)
  }
}

function clearResumeState() {
  try {
    localStorage.removeItem(RESUME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function persistResumeState({ force = false } = {}) {
  if (!audioPlayer) return;

  const song = getCurrentSong();
  if (!song?.id) return;

  const now = Date.now();
  const currentTime = Number(audioPlayer.currentTime) || 0;
  const duration = Number(audioPlayer.duration) || 0;
  if (!Number.isFinite(currentTime) || currentTime < 0) return;

  const progressedEnough =
    lastResumeSavedPositionSeconds == null ||
    Math.abs(currentTime - lastResumeSavedPositionSeconds) >= 1.25;

  const timeElapsedEnough = now - lastResumeSaveAt >= RESUME_SAVE_INTERVAL_MS;

  if (!force && !timeElapsedEnough && !progressedEnough) return;

  // Avoid resuming *exactly* at the end of a track.
  const safeTime = (Number.isFinite(duration) && duration > 0)
    ? Math.min(currentTime, Math.max(0, duration - 1))
    : currentTime;

  lastResumeSaveAt = now;
  lastResumeSavedPositionSeconds = safeTime;
  writeResumeState({
    songId: song.id,
    title: song.title || '',
    artist: song.artist || '',
    album: song.album || '',
    positionSeconds: safeTime,
    updatedAt: now
  });
}

function readQueueState() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeQueueState(state) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function clearQueueState() {
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function persistQueueState({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastQueueSaveAt < QUEUE_SAVE_INTERVAL_MS) return;

  if (!Array.isArray(playbackList) || playbackList.length === 0 || playbackIndex < 0) {
    lastQueueSaveAt = now;
    clearQueueState();
    return;
  }

  const items = playbackList
    .filter(Boolean)
    .map((s) => ({
      id: s.id,
      title: s.title || '',
      artist: s.artist || '',
      album: s.album || ''
    }))
    .filter((s) => Boolean(s.id));

  lastQueueSaveAt = now;
  writeQueueState({
    items,
    index: playbackIndex,
    shuffleEnabled: Boolean(isShuffleEnabled),
    repeatMode: repeatMode,
    savedAt: now
  });
}

function hydrateQueueWithSongs(songs) {
  if (!Array.isArray(songs) || songs.length === 0) return;
  if (!Array.isArray(playbackList) || playbackList.length === 0 || playbackIndex < 0) return;

  const byId = new Map(songs.map((s) => [s.id, s]));
  const hydrated = playbackList.map((s) => byId.get(s?.id) || s).filter(Boolean);
  setPlaybackList(hydrated, playbackIndex);

  const current = getCurrentSong();
  if (current?.id) {
    const npTitle = document.getElementById('npTitle');
    const npArtist = document.getElementById('npArtist');
    const miniTitle = document.getElementById('miniTitle');
    const miniArtist = document.getElementById('miniArtist');
    if (npTitle) npTitle.textContent = current.title || 'Unknown';
    if (npArtist) npArtist.textContent = current.artist || 'Unknown Artist';
    if (miniTitle) miniTitle.textContent = current.title || 'Unknown';
    if (miniArtist) miniArtist.textContent = current.artist || 'Unknown Artist';

    const miniArtwork = document.getElementById('miniArtwork');
    if (miniArtwork) {
      miniArtwork.src = albumCoverUrl(current.id);
      miniArtwork.style.opacity = '1';
    }

    setMediaSessionMetadata({
      title: current.title || 'Unknown',
      artist: current.artist || 'Unknown Artist',
      album: current.album || 'Unknown Album',
      artworkUrl: albumCoverUrl(current.id)
    });
  }

  updateQueue();
  persistQueueState({ force: true });
}

function tryRestoreQueueState() {
  const queue = readQueueState();
  if (!queue?.items || queue.items.length === 0) return false;

  const items = queue.items
    .map((s) => ({
      id: s.id,
      title: s.title || 'Unknown',
      artist: s.artist || 'Unknown Artist',
      album: s.album || 'Unknown Album'
    }))
    .filter((s) => Boolean(s.id));

  if (items.length === 0) return false;

  setShuffleEnabled(Boolean(queue.shuffleEnabled));
  setRepeatMode(queue.repeatMode);

  const idx = Number.isFinite(Number(queue.index)) ? Math.trunc(Number(queue.index)) : 0;
  setPlaybackList(items, idx);

  const resume = readResumeState();
  const current = getCurrentSong();
  const seekSeconds = (resume?.songId && current?.id && resume.songId === current.id)
    ? resume.positionSeconds
    : null;

  if (current) {
    loadSong(current, { autoplay: false, recordPlay: false, seekSeconds });
  }

  setIsPlaying(false);
  updatePlayButton();
  setMiniPlayerPresence(Boolean(current));
  updateShuffleRepeatButtons();
  updateQueue();
  return true;
}

function formatRemaining(seconds) {
  const s = Math.max(0, Math.trunc(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function getSleepTimerRemainingSeconds() {
  if (!sleepTimerTargetAt) return null;
  const diffMs = sleepTimerTargetAt - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
}

function restoreSleepTimerVolume() {
  if (!audioPlayer) {
    sleepTimerOriginalVolume = null;
    return;
  }
  if (sleepTimerOriginalVolume == null) return;
  try {
    audioPlayer.volume = Math.max(0, Math.min(1, Number(sleepTimerOriginalVolume)));
  } catch {
    // ignore
  }
  sleepTimerOriginalVolume = null;
}

function applySleepTimerFade(ratio) {
  if (!audioPlayer) return;
  const r = Math.max(0, Math.min(1, Number(ratio)));
  if (sleepTimerOriginalVolume == null) {
    sleepTimerOriginalVolume = Number(audioPlayer.volume);
    if (!Number.isFinite(sleepTimerOriginalVolume)) sleepTimerOriginalVolume = 1;
  }
  const next = Math.max(0, Math.min(1, sleepTimerOriginalVolume * r));
  audioPlayer.volume = next;
}

function updateSleepTimerUI() {
  const badge = document.getElementById('miniSleepTimer');
  const status = document.getElementById('sleepTimerStatus');
  const btn = document.getElementById('sleepTimerButton');

  const remaining = getSleepTimerRemainingSeconds();
  if (remaining == null) {
    if (badge) {
      badge.textContent = '';
      badge.classList.remove('is-active');
    }
    if (status) status.textContent = '';
    if (btn) {
      btn.classList.remove('is-active');
      btn.title = 'Sleep timer';
    }
    return;
  }

  const text = sleepTimerPendingStopAfterTrack
    ? 'Stopping after this track'
    : `Sleep in ${formatRemaining(remaining)}`;
  if (badge) {
    badge.textContent = text;
    badge.classList.add('is-active');
  }
  if (status) status.textContent = text;
  if (btn) {
    btn.classList.add('is-active');
    btn.title = text;
  }
}

function stopSleepTimerInterval() {
  if (sleepTimerIntervalId) {
    clearInterval(sleepTimerIntervalId);
    sleepTimerIntervalId = null;
  }
}

function persistSleepTimer() {
  try {
    if (!sleepTimerTargetAt) {
      localStorage.removeItem(SLEEP_TIMER_KEY);
      return;
    }
    localStorage.setItem(SLEEP_TIMER_KEY, JSON.stringify({
      targetAt: sleepTimerTargetAt,
      mode: sleepTimerMode,
      fadeSeconds: sleepTimerFadeSeconds
    }));
  } catch {
    // ignore
  }
}

function restoreSleepTimer() {
  try {
    const raw = localStorage.getItem(SLEEP_TIMER_KEY);
    if (!raw) return;
    const parsed = safeJsonParse(raw);
    const targetAt = Number(parsed?.targetAt);
    if (!Number.isFinite(targetAt) || targetAt <= Date.now()) {
      localStorage.removeItem(SLEEP_TIMER_KEY);
      return;
    }
    sleepTimerTargetAt = targetAt;
    sleepTimerMode = (parsed?.mode === 'endOfTrack') ? 'endOfTrack' : 'pause';
    sleepTimerFadeSeconds = Number.isFinite(Number(parsed?.fadeSeconds)) ? Math.max(0, Math.trunc(Number(parsed.fadeSeconds))) : 0;
    sleepTimerPendingStopAfterTrack = false;
    restoreSleepTimerVolume();
    startSleepTimerInterval();
    updateSleepTimerUI();
  } catch {
    // ignore
  }
}

function cancelSleepTimer() {
  sleepTimerTargetAt = null;
  sleepTimerMode = 'pause';
  sleepTimerFadeSeconds = 0;
  sleepTimerPendingStopAfterTrack = false;
  restoreSleepTimerVolume();
  stopSleepTimerInterval();
  persistSleepTimer();
  updateSleepTimerUI();
}

function startSleepTimerAt(targetAt, options = {}) {
  const t = Number(targetAt);
  if (!Number.isFinite(t) || t <= Date.now()) return;

  sleepTimerTargetAt = t;
  sleepTimerMode = options?.mode === 'endOfTrack' ? 'endOfTrack' : 'pause';
  sleepTimerFadeSeconds = Number.isFinite(Number(options?.fadeSeconds)) ? Math.max(0, Math.trunc(Number(options.fadeSeconds))) : 0;
  sleepTimerPendingStopAfterTrack = false;
  restoreSleepTimerVolume();

  persistSleepTimer();
  startSleepTimerInterval();
  updateSleepTimerUI();
}

function startSleepTimer(minutes, options = {}) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return;
  startSleepTimerAt(Date.now() + Math.trunc(m * 60 * 1000), options);
}

function computeNextTimeTargetAt(hhmm) {
  const raw = String(hhmm || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  const now = new Date();
  const target = new Date(now);
  target.setHours(h, min, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

function startSleepTimerInterval() {
  stopSleepTimerInterval();
  sleepTimerIntervalId = setInterval(() => {
    const remaining = getSleepTimerRemainingSeconds();
    if (remaining == null) return;

    updateSleepTimerUI();

    // Fade behavior
    if (!sleepTimerPendingStopAfterTrack && sleepTimerMode === 'pause' && sleepTimerFadeSeconds > 0 && remaining > 0 && remaining <= sleepTimerFadeSeconds) {
      applySleepTimerFade(remaining / sleepTimerFadeSeconds);
    }

    if (sleepTimerPendingStopAfterTrack && sleepTimerFadeSeconds > 0 && audioPlayer) {
      const dur = Number(audioPlayer.duration);
      const ct = Number(audioPlayer.currentTime);
      if (Number.isFinite(dur) && dur > 0 && Number.isFinite(ct) && ct >= 0) {
        const trackRemaining = Math.max(0, dur - ct);
        if (trackRemaining <= sleepTimerFadeSeconds) {
          applySleepTimerFade(trackRemaining / sleepTimerFadeSeconds);
        }
      }
    }

    if (remaining <= 0) {
      if (sleepTimerMode === 'endOfTrack') {
        sleepTimerPendingStopAfterTrack = true;
        // Keep interval running to update UI + allow end-of-track fade.
        updateSleepTimerUI();
        return;
      }

      if (audioPlayer) {
        audioPlayer.pause();
      }
      cancelSleepTimer();
    }
  }, 1000);
}

function seekWhenReady(seconds) {
  if (!audioPlayer) return;
  const target = Number(seconds);
  if (!Number.isFinite(target) || target <= 0) return;

  const applySeek = () => {
    if (!audioPlayer) return;
    const duration = Number(audioPlayer.duration);
    const clamped = Number.isFinite(duration) && duration > 0
      ? Math.max(0, Math.min(target, Math.max(0, duration - 0.25)))
      : Math.max(0, target);
    audioPlayer.currentTime = clamped;
    updateProgress();
    setMediaSessionPosition(audioPlayer);
  };

  if (audioPlayer.readyState >= 1) {
    applySeek();
    return;
  }

  audioPlayer.addEventListener('loadedmetadata', applySeek, { once: true });
}

function loadSong(song, options = {}) {
  if (!song || !audioPlayer) return;

  const autoplay = options.autoplay !== false;
  const record = options.recordPlay !== false;
  const seekSeconds = options.seekSeconds;

  audioPlayer.src = songStreamUrl(song.id);
  if (autoplay) {
    void audioPlayer.play();
  } else {
    // Ensure metadata loads so we can seek even without autoplay.
    audioPlayer.load();
  }

  // Update UI
  document.getElementById('npTitle').textContent = song.title || 'Unknown';
  document.getElementById('npArtist').textContent = song.artist || 'Unknown Artist';
  document.getElementById('miniTitle').textContent = song.title || 'Unknown';
  document.getElementById('miniArtist').textContent = song.artist || 'Unknown Artist';

  // Mini player artwork
  const miniArtwork = document.getElementById('miniArtwork');
  if (miniArtwork) {
    miniArtwork.onerror = () => {
      miniArtwork.style.opacity = '0';
    };
    miniArtwork.onload = () => {
      miniArtwork.style.opacity = '1';
    };
    miniArtwork.src = albumCoverUrl(song.id);
    miniArtwork.style.opacity = '1';
  }

  // Set album artwork
  const npArtwork = document.getElementById('npArtwork');
  npArtwork.onerror = () => {
    npArtwork.style.display = 'none';
  };
  npArtwork.src = albumCoverUrl(song.id);
  npArtwork.style.display = 'block';

  setMiniPlayerPresence(true);

  updateShuffleRepeatButtons();
  updateQueue();

  if (Number.isFinite(Number(seekSeconds)) && Number(seekSeconds) > 0) {
    seekWhenReady(seekSeconds);
  }

  if (record) {
    recordPlay(song.id);
  }

  // Update Media Session metadata (lockscreen / media keys UI).
  setMediaSessionMetadata({
    title: song.title || 'Unknown',
    artist: song.artist || 'Unknown Artist',
    album: song.album || 'Unknown Album',
    artworkUrl: albumCoverUrl(song.id)
  });
  setMediaSessionPosition(audioPlayer);

  // Dispatch song changed event for UI features
  document.dispatchEvent(new CustomEvent('songChanged', { detail: song }));
}

function tryRestoreResumeState() {
  if (didAttemptResumeRestore) return;
  didAttemptResumeRestore = true;

  const resume = readResumeState();
  if (!resume?.songId) return;

  const restoredSong = {
    id: resume.songId,
    title: resume.title || 'Unknown',
    artist: resume.artist || 'Unknown Artist',
    album: resume.album || 'Unknown Album'
  };

  setPlaybackList([restoredSong], 0);
  loadSong(restoredSong, {
    autoplay: false,
    recordPlay: false,
    seekSeconds: resume.positionSeconds
  });

  setIsPlaying(false);
  updatePlayButton();
}

/**
 * Initialize the player with audio element reference
 * @param {HTMLAudioElement} audioElement
 */
export function initPlayer(audioElement) {
  audioPlayer = audioElement;

  // Helps resume/seek work without autoplay.
  try {
    audioPlayer.preload = 'metadata';
  } catch {
    // ignore
  }

  // Lockscreen/hardware media controls (supported browsers only).
  initMediaSession(audioPlayer, {
    onPlay: () => void audioPlayer.play(),
    onPause: () => audioPlayer.pause(),
    onNext: () => playNext(),
    onPrevious: () => playPrevious(),
    onSeekTo: (time) => {
      if (!audioPlayer) return;
      audioPlayer.currentTime = Math.max(0, Math.min(Number(audioPlayer.duration || Infinity), Number(time) || 0));
    },
    onSeekBy: (deltaSeconds) => {
      if (!audioPlayer) return;
      const next = (Number(audioPlayer.currentTime) || 0) + (Number(deltaSeconds) || 0);
      audioPlayer.currentTime = Math.max(0, Math.min(Number(audioPlayer.duration || Infinity), next));
    }
  });
  
  // Setup event listeners
  audioPlayer.addEventListener('timeupdate', updateProgress);
  audioPlayer.addEventListener('ended', () => {
    if (sleepTimerPendingStopAfterTrack) {
      // Timer expired and user requested "stop after track".
      // Don't advance to the next track; just stop playback.
      restoreSleepTimerVolume();
      cancelSleepTimer();
      setIsPlaying(false);
      updatePlayButton();
      return;
    }

    const atEndOfQueue = repeatMode === 'off' && !hasNext();
    playNext();

    if (atEndOfQueue) {
      // If playback naturally finished, reopen should start from the beginning.
      const resume = readResumeState();
      if (resume?.songId) {
        writeResumeState({
          ...resume,
          positionSeconds: 0,
          updatedAt: Date.now()
        });
      }
    }
  });
  audioPlayer.addEventListener('play', () => {
    setIsPlaying(true);
    updatePlayButton();
  });
  audioPlayer.addEventListener('pause', () => {
    setIsPlaying(false);
    updatePlayButton();
    // Best-effort save when pausing.
    persistResumeState({ force: true });
  });
  window.addEventListener('beforeunload', () => {
    persistResumeState({ force: true });
    persistQueueState({ force: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistResumeState({ force: true });
      persistQueueState({ force: true });
    }
  });
  initShuffleRepeatControls();
  updateShuffleRepeatButtons();

  const toggleQueueExpanded = document.getElementById('toggleQueueExpanded');
  toggleQueueExpanded?.addEventListener('click', () => {
    isQueueExpanded = !isQueueExpanded;
    updateQueue();
  });

  // Initial render (empty until something starts playing).
  updateQueue();

  setMiniPlayerPresence(Boolean(getCurrentSong()));

  // If the shell finalizes layout later (e.g. toggling sidebar-closed), re-apply
  // mini player visibility. This is important when we restored a prior track.
  document.addEventListener('player0:layoutReady', () => {
    setMiniPlayerPresence(Boolean(getCurrentSong()));
  });

  // Restore last session (queue first, then fallback to single-track resume).
  const restoredQueue = tryRestoreQueueState();
  if (!restoredQueue) {
    tryRestoreResumeState();
  }

  // Restore a running sleep timer (if any).
  restoreSleepTimer();

  // Hydrate queue entries from real library when it loads.
  document.addEventListener('player0:songsLoaded', (e) => {
    hydrateQueueWithSongs(e.detail);
  });

  // Sleep timer UI wiring
  const sleepTimerButton = document.getElementById('sleepTimerButton');
  const sleepTimerModal = document.getElementById('sleepTimerModal');
  const sleepTimerMinutes = document.getElementById('sleepTimerMinutes');
  const startSleepTimerBtn = document.getElementById('startSleepTimer');
  const cancelSleepTimerBtn = document.getElementById('cancelSleepTimer');

  const stopAfterTrackEl = document.getElementById('sleepStopAfterTrack');
  const fadeEnabledEl = document.getElementById('sleepFadeEnabled');
  const fadeSecondsEl = document.getElementById('sleepFadeSeconds');
  const endAtTimeEl = document.getElementById('sleepEndAtTime');
  const setEndAtBtn = document.getElementById('sleepSetEndAt');

  const openSleepModal = () => {
    if (!sleepTimerModal) return;
    sleepTimerModal.style.display = 'flex';
    updateSleepTimerUI();

     if (stopAfterTrackEl) stopAfterTrackEl.checked = sleepTimerMode === 'endOfTrack';
     if (fadeEnabledEl) fadeEnabledEl.checked = sleepTimerFadeSeconds > 0;
     if (fadeSecondsEl) fadeSecondsEl.value = sleepTimerFadeSeconds > 0 ? String(sleepTimerFadeSeconds) : '';

    if (sleepTimerMinutes) {
      sleepTimerMinutes.focus();
    }
  };

  sleepTimerButton?.addEventListener('click', (event) => {
    event.preventDefault();
    openSleepModal();
  });

  document.getElementById('sleepPreset15')?.addEventListener('click', () => {
    if (sleepTimerMinutes) sleepTimerMinutes.value = '15';
  });
  document.getElementById('sleepPreset30')?.addEventListener('click', () => {
    if (sleepTimerMinutes) sleepTimerMinutes.value = '30';
  });
  document.getElementById('sleepPreset60')?.addEventListener('click', () => {
    if (sleepTimerMinutes) sleepTimerMinutes.value = '60';
  });

  startSleepTimerBtn?.addEventListener('click', () => {
    const minutes = Number(sleepTimerMinutes?.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      alert('Enter a valid number of minutes');
      return;
    }

    const mode = stopAfterTrackEl?.checked ? 'endOfTrack' : 'pause';
    const fadeSeconds = (fadeEnabledEl?.checked)
      ? Math.max(1, Math.min(60, Math.trunc(Number(fadeSecondsEl?.value || 10))))
      : 0;

    startSleepTimer(minutes, { mode, fadeSeconds });
    if (sleepTimerModal) sleepTimerModal.style.display = 'none';
  });

  setEndAtBtn?.addEventListener('click', () => {
    const targetAt = computeNextTimeTargetAt(endAtTimeEl?.value);
    if (!targetAt) {
      alert('Enter a valid time');
      return;
    }

    const mode = stopAfterTrackEl?.checked ? 'endOfTrack' : 'pause';
    const fadeSeconds = (fadeEnabledEl?.checked)
      ? Math.max(1, Math.min(60, Math.trunc(Number(fadeSecondsEl?.value || 10))))
      : 0;

    startSleepTimerAt(targetAt, { mode, fadeSeconds });
    if (sleepTimerModal) sleepTimerModal.style.display = 'none';
  });

  cancelSleepTimerBtn?.addEventListener('click', () => {
    cancelSleepTimer();
    if (sleepTimerModal) sleepTimerModal.style.display = 'none';
  });

  // Clear upcoming UX
  document.getElementById('clearQueueButton')?.addEventListener('click', () => {
    if (!playbackList.length || playbackIndex < 0) return;
    const ok = confirm('Clear upcoming songs from the queue?');
    if (!ok) return;
    clearPlaybackList({ keepCurrent: true });
    updateQueue();
    persistQueueState({ force: true });
  });
  
  // Listen for custom events from UI features
  document.addEventListener('togglePlayPause', () => togglePlayPause());
  document.addEventListener('playPrevious', () => playPrevious());
  document.addEventListener('playNext', () => playNext());
  document.addEventListener('playSong', (e) => {
    const song = e.detail;
    if (song) {
      // Set up playback list with just this song, or add to queue
      setPlaybackList([song], 0);
      playSong(song);
    }
  });
  document.addEventListener('addToQueue', (e) => {
    const song = e.detail;
    if (song) {
      addToQueue(song);
    }
  });
  document.addEventListener('playNext', (e) => {
    // If custom event has detail, it's "play this song next"
    if (e.detail) {
      addToQueueNext(e.detail);
    }
  });
  document.addEventListener('reorderQueue', (e) => {
    const { fromId, toId } = e.detail || {};
    if (fromId && toId) {
      reorderQueueById(fromId, toId);
    }
  });
}

function initShuffleRepeatControls() {
  const shuffleButton = document.getElementById('shuffleButton');
  const repeatButton = document.getElementById('repeatButton');

  if (shuffleButton) {
    shuffleButton.addEventListener('click', (event) => {
      event.preventDefault();
      toggleShuffle();
      // When shuffle is enabled, upcoming is shuffled in-place.
      updateShuffleRepeatButtons();
      updateQueue();
    });
  }

  if (repeatButton) {
    repeatButton.addEventListener('click', (event) => {
      event.preventDefault();
      cycleRepeatMode();
      updateShuffleRepeatButtons();
    });
  }
}

function computeDropToIndex(fromIndex, targetIndex, placeAfter) {
  let to = targetIndex + (placeAfter ? 1 : 0);
  // Convert from "original" index space to post-removal index space.
  if (fromIndex < to) to -= 1;
  return to;
}

function updateShuffleRepeatButtons() {
  const shuffleButton = document.getElementById('shuffleButton');
  const repeatButton = document.getElementById('repeatButton');

  if (shuffleButton) {
    shuffleButton.classList.toggle('is-active', Boolean(isShuffleEnabled));
    shuffleButton.title = isShuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off';
  }

  if (repeatButton) {
    const label = repeatMode === 'one' ? 'Repeat: One' : repeatMode === 'all' ? 'Repeat: All' : 'Repeat: Off';
    repeatButton.title = label;
    repeatButton.classList.toggle('is-active', repeatMode !== 'off');

    if (repeatMode === 'one') {
      repeatButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M12 8v8"/><path d="M10.5 10.5L12 9l1.5 1.5"/><path d="M10.5 15.5L12 17l1.5-1.5"/></svg>';
    } else {
      // Default repeat icon (off/all)
      repeatButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    }
  }
}

/**
 * Play a specific song
 * @param {any} song - The song to play
 */
export function playSong(song) {
  if (!song || !audioPlayer) return;
  loadSong(song, { autoplay: true, recordPlay: true });
  persistResumeState({ force: true });
  persistQueueState({ force: true });
}

/**
 * Toggle play/pause
 */
export function togglePlayPause() {
  if (!audioPlayer) return;
  
  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
}

/**
 * Play next song in the active playback list
 */
export function playNext() {
  if (!playbackList.length) return;

  if (repeatMode === 'one') {
    // Restart current track without re-recording play.
    if (audioPlayer) {
      audioPlayer.currentTime = 0;
      void audioPlayer.play();
    }
    return;
  }

  const nextSong = getNext();
  if (nextSong) {
    playSong(nextSong);
    return;
  }

  if (repeatMode === 'all') {
    if (isShuffleEnabled && playbackList.length > 1) {
      const shuffled = [...playbackList].sort(() => Math.random() - 0.5);
      setPlaybackList(shuffled, 0);
      playSong(shuffled[0]);
      return;
    }

    setPlaybackIndex(0);
    playSong(playbackList[0]);
  }
}

/**
 * Play previous song in the active playback list
 */
export function playPrevious() {
  if (!playbackList.length) return;

  // If we're not near the start, behave like typical players.
  if (audioPlayer && audioPlayer.currentTime > 3) {
    audioPlayer.currentTime = 0;
    return;
  }

  const prevSong = getPrevious();
  if (prevSong) {
    playSong(prevSong);
    return;
  }

  if (repeatMode === 'all') {
    const lastIndex = Math.max(0, playbackList.length - 1);
    setPlaybackIndex(lastIndex);
    playSong(playbackList[lastIndex]);
  }
}

/**
 * Update progress bar
 */
function updateProgress() {
  if (!audioPlayer) return;
  
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  document.getElementById('progressBar').value = progress || 0;
  document.getElementById('currentTime').textContent = formatDuration(audioPlayer.currentTime);
  document.getElementById('totalTime').textContent = formatDuration(audioPlayer.duration);
  
  // Update mini player progress bar
  const miniProgressFill = document.getElementById('miniProgressFill');
  if (miniProgressFill) {
    miniProgressFill.style.width = `${progress || 0}%`;
  }
  
  // Dispatch progress event for UI features
  document.dispatchEvent(new CustomEvent('progressUpdated', { 
    detail: audioPlayer.duration ? audioPlayer.currentTime / audioPlayer.duration : 0 
  }));

  // Lyrics / time-based UI features
  document.dispatchEvent(new CustomEvent('player0:timeupdate', {
    detail: { seconds: Number(audioPlayer.currentTime) || 0 }
  }));

  // Throttle Media Session position updates (some browsers are sensitive to spam).
  const now = Date.now();
  if (now - lastMediaSessionPositionUpdate >= 1000) {
    lastMediaSessionPositionUpdate = now;
    setMediaSessionPosition(audioPlayer);
  }

  // Persist resume position (throttled).
  persistResumeState();
}

/**
 * Update play/pause button state
 */
function updatePlayButton() {
  const playPauseButton = document.getElementById('playPauseButton');
  const miniPlayPause = document.getElementById('miniPlayPause');
  
  if (!playPauseButton || !miniPlayPause) return;
  
  const isPlaying = !audioPlayer.paused;
  
  if (isPlaying) {
    playPauseButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    miniPlayPause.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">pause</span>';
  } else {
    playPauseButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>';
    miniPlayPause.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>';
  }
  
  // Dispatch play state changed event for UI features
  document.dispatchEvent(new CustomEvent('playStateChanged', { detail: isPlaying }));
}

/**
 * Update queue display (draggable reorder)
 */
export function updateQueue() {
  const queueList = document.getElementById('queueList');
  if (!queueList) return;

  const toggleQueueExpanded = document.getElementById('toggleQueueExpanded');
  const currentIndex = Math.max(0, playbackIndex);
  const upcomingCount = Math.max(0, playbackList.length - currentIndex);

  if (toggleQueueExpanded) {
    const needsToggle = upcomingCount > QUEUE_COLLAPSED_COUNT;
    toggleQueueExpanded.style.display = needsToggle ? 'inline-flex' : 'none';
    toggleQueueExpanded.textContent = isQueueExpanded ? 'Less' : 'More';
    toggleQueueExpanded.setAttribute('aria-expanded', isQueueExpanded ? 'true' : 'false');
  }

  queueList.innerHTML = '';

  if (!playbackList.length || playbackIndex < 0) {
    queueList.innerHTML = '<p class="empty-queue">Queue is empty</p>';
    persistQueueState({ force: true });
    return;
  }

  // Always keep the currently playing song at the top of the queue UI.
  let startIndex = currentIndex;
  let endIndex = playbackList.length;
  if (!isQueueExpanded) {
    endIndex = Math.min(playbackList.length, startIndex + QUEUE_COLLAPSED_COUNT);
  }

  for (let index = startIndex; index < endIndex; index++) {
    const song = playbackList[index];
    const item = document.createElement('div');
    item.className = 'queue-item' + (index === playbackIndex ? ' active' : '');
    item.dataset.playbackIndex = String(index);

    const handle = document.createElement('div');
    handle.className = 'queue-handle';
    handle.textContent = '⋮⋮';
    // Don't allow reordering the currently playing track.
    handle.draggable = index !== playbackIndex && !isCoarsePointer();
    handle.setAttribute('aria-label', 'Drag to reorder');

    if (isCoarsePointer() && index !== playbackIndex) {
      handle.addEventListener('pointerdown', (event) => {
        // Only handle touch/pen here; mouse uses HTML5 drag.
        if (event.pointerType === 'mouse') return;
        event.preventDefault();
        startTouchQueueDrag(event, index, item, queueList);
      }, { passive: false });
    }

    const meta = document.createElement('div');
    meta.className = 'queue-meta';

    const title = document.createElement('div');
    title.className = 'queue-title';
    title.textContent = song?.title || 'Unknown';

    const artist = document.createElement('div');
    artist.className = 'queue-artist';
    artist.textContent = song?.artist || 'Unknown Artist';

    meta.appendChild(title);
    meta.appendChild(artist);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'queue-remove';
    removeBtn.setAttribute('aria-label', 'Remove from queue');
    removeBtn.textContent = '✕';

    item.appendChild(handle);
    item.appendChild(meta);
    item.appendChild(removeBtn);

    item.addEventListener('dblclick', () => {
      if (!playbackList[index]) return;
      setPlaybackIndex(index);
      playSong(playbackList[index]);
    });

    handle.addEventListener('dragstart', (event) => {
      if (index === playbackIndex) {
        event.preventDefault();
        return;
      }
      draggingPlaybackIndex = index;
      item.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    });

    handle.addEventListener('dragend', () => {
      draggingPlaybackIndex = null;
      item.classList.remove('is-dragging');
      queueList.querySelectorAll('.queue-item.is-drag-over').forEach((el) => {
        el.classList.remove('is-drag-over');
      });
    });

    removeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const result = removePlaybackItem(index);
      if (!result) return;

      if (result.removedWasCurrent) {
        if (result.newIndex >= 0) {
          playSong(playbackList[result.newIndex]);
        } else {
          // Queue is empty: stop playback.
          if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            audioPlayer.load();
          }
          setIsPlaying(false);
          updatePlayButton();
          const npTitle = document.getElementById('npTitle');
          const npArtist = document.getElementById('npArtist');
          const miniTitle = document.getElementById('miniTitle');
          const miniArtist = document.getElementById('miniArtist');
          const miniArtwork = document.getElementById('miniArtwork');
          if (npTitle) npTitle.textContent = 'No song playing';
          if (npArtist) npArtist.textContent = '';
          if (miniTitle) miniTitle.textContent = 'No song playing';
          if (miniArtist) miniArtist.textContent = '';
          if (miniArtwork) {
            miniArtwork.removeAttribute('src');
            miniArtwork.style.opacity = '0';
          }

          setMiniPlayerPresence(false);

          clearResumeState();
          clearQueueState();
        }
      }

      updateQueue();
    });

    item.addEventListener('dragover', (event) => {
      if (draggingPlaybackIndex == null) return;
      event.preventDefault();
      queueList.querySelectorAll('.queue-item.is-drag-over').forEach((el) => {
        if (el !== item) el.classList.remove('is-drag-over');
      });
      item.classList.add('is-drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('is-drag-over');
    });

    item.addEventListener('drop', (event) => {
      event.preventDefault();

      let from = draggingPlaybackIndex;
      if (from == null) {
        const raw = event.dataTransfer?.getData('text/plain');
        const num = Number(raw);
        from = Number.isFinite(num) ? Math.trunc(num) : null;
      }

      const toTarget = Number(item.dataset.playbackIndex);
      if (from == null || !Number.isFinite(toTarget)) return;

      const rect = item.getBoundingClientRect();
      const placeAfter = (event.clientY - rect.top) > rect.height / 2;
      let to = computeDropToIndex(from, toTarget, placeAfter);
      // Keep the current track pinned at the top of the queue.
      if (playbackIndex >= 0 && to <= playbackIndex) {
        to = playbackIndex + 1;
      }

      item.classList.remove('is-drag-over');
      if (from === to) return;

      movePlaybackItem(from, to);
      updateQueue();
    });

    queueList.appendChild(item);
  }

  // Let other UI surfaces (fullscreen now playing, etc.) stay in sync.
  document.dispatchEvent(new CustomEvent('queueUpdated'));

  // Persist queue (throttled).
  persistQueueState();
}


/**
 * Record a play to the server
 * @param {string} songId
 */
async function recordPlay(songId) {
  try {
    await recordPlayAPI(songId);
  } catch (error) {
    console.error('Error recording play:', error);
  }
}

/**
 * Seek to position in current song
 * @param {number} percentage - 0-100
 */
export function seek(percentage) {
  if (!audioPlayer) return;
  const time = (percentage / 100) * audioPlayer.duration;
  audioPlayer.currentTime = time;
}

/**
 * Set volume
 * @param {number} volume - 0-100
 */
export function setVolume(volume) {
  if (!audioPlayer) return;
  audioPlayer.volume = volume / 100;
}

/**
 * Get audio player reference
 * @returns {HTMLAudioElement}
 */
export function getAudioPlayer() {
  return audioPlayer;
}

/**
 * Add a song to the end of the queue
 * @param {Object} song
 */
export function addToQueue(song) {
  if (!song) return;
  const newList = [...playbackList, song];
  setPlaybackList(newList, playbackIndex);
  updateQueue();
}

/**
 * Add a song to play next (after current)
 * @param {Object} song
 */
export function addToQueueNext(song) {
  if (!song) return;
  const insertIndex = playbackIndex + 1;
  const newList = [
    ...playbackList.slice(0, insertIndex),
    song,
    ...playbackList.slice(insertIndex)
  ];
  setPlaybackList(newList, playbackIndex);
  updateQueue();
}

/**
 * Reorder queue by song IDs
 * @param {string} fromId
 * @param {string} toId
 */
export function reorderQueueById(fromId, toId) {
  const fromIndex = playbackList.findIndex(s => s.id === fromId);
  const toIndex = playbackList.findIndex(s => s.id === toId);
  
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
  
  movePlaybackItem(fromIndex, toIndex);
  updateQueue();
}
