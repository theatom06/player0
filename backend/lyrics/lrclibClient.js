/**
 * LRCLIB client (modeled after lrcget's behavior)
 *
 * lrcget is the official LRCLIB client. It primarily calls:
 * - GET {instance}/api/get?artist_name=...&track_name=...&album_name=...&duration=...
 * and (for manual search) uses:
 * - GET {instance}/api/search?track_name=...&artist_name=...&album_name=...&q=...
 *
 * We mirror that request/response shape so our backend behaves like lrcget,
 * while still returning the same result shape used by lyricsService.
 */

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function stripTimestampPerLine(syncedLyrics) {
  // Similar intent to lrcget's strip_timestamp, but correctly applied per-line.
  return String(syncedLyrics || '').replace(/^\[[^\]]*\]\s*/gm, '');
}

function getUserAgent() {
  // We can't (and shouldn't) pretend to be lrcget exactly.
  // But setting a UA helps with some public APIs and makes debugging clearer.
  return 'player0/1.0 (LRCLIB; lrcget-style)';
}

async function fetchJsonWithTimeout(url, { timeoutMs = 10_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': getUserAgent()
      }
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }

    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function pickLyricsFromRaw(raw) {
  const instrumental = Boolean(raw?.instrumental);
  const syncedLyrics = raw?.syncedLyrics ?? raw?.synced_lyrics;
  const plainLyrics = raw?.plainLyrics ?? raw?.plain_lyrics;

  const synced = typeof syncedLyrics === 'string' ? syncedLyrics.trim() : '';
  const plain = typeof plainLyrics === 'string' ? plainLyrics.trim() : '';

  if (instrumental) {
    return { type: 'instrumental', lrc: '[au: instrumental]\n', synced: false };
  }

  if (synced) {
    const lrc = synced.endsWith('\n') ? synced : synced + '\n';
    const derivedPlain = plain || stripTimestampPerLine(synced).trim();
    return { type: 'synced', lrc, synced: true, plainLyrics: derivedPlain ? derivedPlain + '\n' : '' };
  }

  if (plain) {
    return { type: 'plain', lrc: plain.endsWith('\n') ? plain : plain + '\n', synced: false };
  }

  return { type: 'none', lrc: '', synced: false };
}

function scoreSearchItem(item, targetDurationSeconds) {
  const hasSynced = Boolean(item?.syncedLyrics || item?.synced_lyrics);
  const hasPlain = Boolean(item?.plainLyrics || item?.plain_lyrics);
  const instrumental = Boolean(item?.instrumental);

  const duration = Number(item?.duration);
  const target = Number(targetDurationSeconds);
  const diff = Number.isFinite(duration) && Number.isFinite(target) ? Math.abs(duration - target) : 9999;

  // Prefer synced, then plain, then instrumental; within that, closest duration.
  // Lower score wins.
  const typePenalty = hasSynced ? 0 : hasPlain ? 50 : instrumental ? 200 : 10_000;
  return typePenalty + diff;
}

function toUrl(instanceUrl, pathname, paramsObj) {
  const base = String(instanceUrl || 'https://lrclib.net').replace(/\/$/, '');
  const url = new URL(base + pathname);
  for (const [k, v] of Object.entries(paramsObj || {})) {
    url.searchParams.set(k, String(v ?? ''));
  }
  return url.toString();
}

/**
 * Fetch lyrics using lrcget's strategy:
 * 1) /api/get with duration
 * 2) if not found, /api/search and pick best candidate
 */
export async function fetchLyricsLrcgetStyle({
  artist,
  title,
  album,
  durationSeconds,
  instanceUrl = 'https://lrclib.net'
} = {}) {
  const artistName = normalizeWhitespace(artist);
  const trackName = normalizeWhitespace(title);
  const albumName = normalizeWhitespace(album);

  const duration = Number(durationSeconds);
  const hasDuration = Number.isFinite(duration) && duration > 0;

  // lrcget rounds duration.
  const roundedDuration = hasDuration ? Math.round(duration) : 0;

  if (artistName && trackName && hasDuration) {
    const getUrl = toUrl(instanceUrl, '/api/get', {
      artist_name: artistName,
      track_name: trackName,
      album_name: albumName,
      duration: roundedDuration
    });

    const getRes = await fetchJsonWithTimeout(getUrl);

    if (getRes.status === 200 && getRes.json) {
      const picked = pickLyricsFromRaw(getRes.json);
      if (picked.type !== 'none') {
        return {
          found: true,
          status: 200,
          lrc: picked.lrc,
          synced: picked.synced,
          providerId: getRes.json?.id ?? null,
          sourceUrl: getUrl,
          instrumental: picked.type === 'instrumental'
        };
      }

      return { found: false, status: 404 };
    }

    if (getRes.status === 404) {
      // Fall through to search.
    } else if (!getRes.ok) {
      // For server errors etc, still try search as a fallback.
    }
  }

  // Search fallback (doesn't require duration).
  if (!artistName || !trackName) {
    return { found: false, status: 400 };
  }

  const searchUrl = toUrl(instanceUrl, '/api/search', {
    track_name: trackName,
    artist_name: artistName,
    album_name: albumName,
    q: ''
  });

  const searchRes = await fetchJsonWithTimeout(searchUrl);
  if (!searchRes.ok || !Array.isArray(searchRes.json)) {
    return { found: false, status: searchRes.status || 500 };
  }

  const items = searchRes.json;
  if (items.length === 0) {
    return { found: false, status: 404 };
  }

  const best = items
    .slice()
    .sort((a, b) => scoreSearchItem(a, durationSeconds) - scoreSearchItem(b, durationSeconds))[0];

  const picked = pickLyricsFromRaw(best);
  if (picked.type === 'none') {
    return { found: false, status: 404 };
  }

  return {
    found: true,
    status: 200,
    lrc: picked.lrc,
    synced: picked.synced,
    providerId: best?.id ?? null,
    sourceUrl: searchUrl,
    instrumental: picked.type === 'instrumental'
  };
}
