import { getLyrics } from '../api.js';

let currentSongId = null;
let lyricLines = null; // { synced:boolean, lines:[{time:number,text:string}] } or {synced:false,text:string}
let lastActiveIndex = -1;
let lastUpdateAt = 0;

const LYRICS_COLLAPSED_KEY = 'player0.lyricsCollapsed.v1';

function $(id) {
  return document.getElementById(id);
}

function getLyricsContainers() {
  return ['lyricsContainer', 'npfsLyricsContainer'].map((id) => $(id)).filter(Boolean);
}

function setTextIfPresent(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setLyricsTitle(song) {
  const label = song?.title ? `Lyrics • ${song.title}` : 'Lyrics';
  setTextIfPresent('lyricsTitle', label);
  setTextIfPresent('npfsLyricsTitle', label);
}

function setLyricsSourceText(text) {
  setTextIfPresent('lyricsSource', text);
  setTextIfPresent('npfsLyricsSource', text);
}

function hasTimestamps(text) {
  return /\[\d{1,2}:\d{2}(?:[.:]\d{1,2})?\]/.test(String(text || ''));
}

function parseOffsetMs(raw) {
  const m = String(raw || '').match(/\[offset:([+-]?\d+)\]/i);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function parseLrc(lrcText) {
  const text = String(lrcText || '');
  if (!text.trim()) return { synced: false, text: '' };

  // Instrumental marker (common in some LRC files):
  // e.g. "[au: instrumental]" or just "Instrumental".
  if (/^\s*\[au\s*:\s*instrumental\s*\]\s*$/im.test(text) || /^\s*instrumental\b\s*$/im.test(text.trim())) {
    return { synced: false, text: 'Instrumental' };
  }

  if (!hasTimestamps(text)) {
    return { synced: false, text: text.trim() };
  }

  const offsetMs = parseOffsetMs(text);
  const lines = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\[(ti|ar|al|by|re|ve|length):/i.test(line)) continue;
    if (/^\[offset:/i.test(line)) continue;

    const times = [];
    const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?\]/g;
    let match;
    while ((match = re.exec(line))) {
      const mm = Number(match[1]);
      const ss = Number(match[2]);
      const frac = match[3] ? Number(match[3]) : 0;
      if (!Number.isFinite(mm) || !Number.isFinite(ss) || !Number.isFinite(frac)) continue;
      const ms = match[3]
        ? (match[3].length === 1 ? frac * 100 : frac * 10)
        : 0;
      const seconds = mm * 60 + ss + ms / 1000;
      times.push(seconds);
    }

    const textOnly = line.replace(re, '').trim();
    for (const t of times) {
      const shifted = Math.max(0, t + offsetMs / 1000);
      lines.push({ time: shifted, text: textOnly });
    }
  }

  lines.sort((a, b) => a.time - b.time);

  return { synced: true, lines };
}

function renderEmpty(message) {
  const containers = getLyricsContainers();
  containers.forEach((container) => {
    container.innerHTML = `<div class="lyrics-empty">${message}</div>`;
  });
}

function renderSynced(lines) {
  const html = lines.length
    ? lines.map((l, idx) => `
      <div class="lyric-line" role="button" tabindex="0" data-lyric-index="${idx}" data-lyric-time="${l.time}">${escapeHtml(l.text || '')}</div>
    `).join('')
    : `<div class="lyrics-empty">No synced lyrics</div>`;

  getLyricsContainers().forEach((container) => {
    container.innerHTML = html;
  });
}

function seekToLyricLine(target) {
  if (!lyricLines?.synced) return;

  const lineEl = target?.closest?.('.lyric-line');
  if (!lineEl) return;

  const raw = lineEl.dataset?.lyricTime;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return;

  const audio = document.getElementById('audioPlayer');
  if (!audio) return;

  try {
    audio.currentTime = seconds;
  } catch {
    return;
  }

  // Force immediate highlight update.
  lastUpdateAt = 0;
  updateHighlight(seconds);
}

function wireLyricSeekHandlers() {
  getLyricsContainers().forEach((container) => {
    if (container.dataset.lyricSeekWired === '1') return;
    container.dataset.lyricSeekWired = '1';

    container.addEventListener('click', (e) => {
      seekToLyricLine(e.target);
    });

    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const lineEl = e.target?.closest?.('.lyric-line');
      if (!lineEl) return;
      e.preventDefault();
      seekToLyricLine(lineEl);
    });
  });
}

function renderUnsynced(text) {
  const html = text
    ? `<div class="lyrics-plain">${escapeHtml(text)}</div>`
    : `<div class="lyrics-empty">No lyrics</div>`;

  getLyricsContainers().forEach((container) => {
    container.innerHTML = html;
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadLyricsForSong(song, { force = false } = {}) {
  setLyricsTitle(song);
  setLyricsSourceText('');

  renderEmpty('Loading lyrics…');
  lastActiveIndex = -1;

  try {
    const data = await getLyrics(song.id, { force });
    // Trust backend synced flag so we don't mis-sync for "unsynced" lyrics
    // that happen to include timestamps (e.g. all [00:00.00]).
    lyricLines = data?.synced
      ? parseLrc(data.lrc)
      : { synced: false, text: String(data?.lrc || '').trim() };

    const syncedLabel = data.synced ? 'synced' : 'unsynced';
    setLyricsSourceText(data.source ? `${data.source} • ${syncedLabel}` : syncedLabel);

    if (lyricLines.synced) {
      renderSynced(lyricLines.lines);
    } else {
      renderUnsynced(lyricLines.text);
    }
  } catch (err) {
    lyricLines = null;
    renderEmpty('No local/embedded lyrics. Add a .lrc (synced), .txt (unsynced), or embed USLT/SYLT.');
    setLyricsSourceText(String(err?.message || ''));
  }
}

function findActiveIndex(lines, timeSeconds) {
  let lo = 0;
  let hi = lines.length - 1;
  let best = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = lines[mid].time;
    if (t <= timeSeconds) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

function updateHighlight(currentTimeSeconds) {
  if (!lyricLines?.synced) return;
  const now = Date.now();
  if (now - lastUpdateAt < 90) return;
  lastUpdateAt = now;

  const lines = lyricLines.lines;
  if (!lines?.length) return;

  const idx = findActiveIndex(lines, Number(currentTimeSeconds) || 0);
  if (idx === lastActiveIndex) return;

  const containers = getLyricsContainers();
  if (!containers.length) return;

  containers.forEach((container) => {
    if (lastActiveIndex >= 0) {
      container.querySelector(`.lyric-line[data-lyric-index="${lastActiveIndex}"]`)?.classList.remove('is-active');
    }

    if (idx >= 0) {
      const el = container.querySelector(`.lyric-line[data-lyric-index="${idx}"]`);
      el?.classList.add('is-active');
      // Scroll gently to keep active line visible.
      if (el && typeof el.scrollIntoView === 'function') {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const noAnimations = document.body?.classList?.contains('no-animations');
        el.scrollIntoView({ block: 'center', behavior: (reduceMotion || noAnimations) ? 'auto' : 'smooth' });
      }
    }
  });

  lastActiveIndex = idx;
}

function setLyricsCollapsed(collapsed) {
  const panel = document.querySelector('.np-lyrics');
  const btn = document.getElementById('lyricsCollapseBtn');
  if (!panel || !btn) return;

  const isCollapsed = Boolean(collapsed);
  panel.classList.toggle('is-collapsed', isCollapsed);
  btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  btn.title = isCollapsed ? 'Expand lyrics' : 'Collapse lyrics';
  const icon = btn.querySelector('.material-symbols-rounded');
  if (icon) icon.textContent = isCollapsed ? 'expand_less' : 'expand_more';

  try {
    localStorage.setItem(LYRICS_COLLAPSED_KEY, JSON.stringify({ collapsed: isCollapsed }));
  } catch {
    // ignore
  }
}

function restoreLyricsCollapsed() {
  try {
    const raw = localStorage.getItem(LYRICS_COLLAPSED_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.collapsed === 'boolean') {
      setLyricsCollapsed(parsed.collapsed);
    }
  } catch {
    // ignore
  }
}

export function setupLyrics() {
  // Click-to-seek on synced lyrics.
  wireLyricSeekHandlers();

  // Restore collapsed state.
  restoreLyricsCollapsed();

  // Collapse/expand.
  document.getElementById('lyricsCollapseBtn')?.addEventListener('click', () => {
    const panel = document.querySelector('.np-lyrics');
    setLyricsCollapsed(!panel?.classList.contains('is-collapsed'));
  });

  // Song change -> fetch lyrics
  document.addEventListener('songChanged', (e) => {
    const song = e.detail;
    if (!song?.id) return;
    if (song.id === currentSongId) return;

    currentSongId = song.id;
    void loadLyricsForSong(song);
  });

  // Player time update -> highlight
  document.addEventListener('player0:timeupdate', (e) => {
    updateHighlight(e.detail?.seconds);
  });

  // Force refresh button
  document.getElementById('lyricsRefreshBtn')?.addEventListener('click', async () => {
    if (!currentSongId) return;
    const song = { id: currentSongId, title: document.getElementById('npTitle')?.textContent || '' };
    // We only need the id; backend uses storage to resolve metadata.
    await loadLyricsForSong(song, { force: false });
  });
}
