/**
 * Lyrics service
 *
 * Implements the flow:
 * 1) Try embedded lyrics (from tags)
 * 2) Try local .lrc next to the audio file
 * 3) Try local .txt next to the audio file (unsynced)
 * 4) If missing, return 404 (no network fetch)
 */

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function safeFileBaseName(name) {
  let s = normalizeWhitespace(name);
  if (!s) s = 'Unknown';

  // Strip characters illegal on Windows and generally annoying elsewhere.
  s = s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) s = 'Unknown';

  // Avoid extremely long filenames.
  if (s.length > 120) s = s.slice(0, 120).trim();
  return s;
}

function hasLrcTimestamps(text) {
  return /\[\d{1,2}:\d{2}(?:[.:]\d{1,2})?\]/.test(String(text || ''));
}

function inferSyncedFromText(text) {
  const s = String(text || '');
  if (!hasLrcTimestamps(s)) return false;

  const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?\]/g;
  let match;
  let maxSeconds = 0;
  let count = 0;
  while ((match = re.exec(s))) {
    const mm = Number(match[1]);
    const ss = Number(match[2]);
    const frac = match[3] ? Number(match[3]) : 0;
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || !Number.isFinite(frac)) continue;
    const ms = match[3]
      ? (match[3].length === 1 ? frac * 100 : frac * 10)
      : 0;
    const seconds = mm * 60 + ss + ms / 1000;
    if (Number.isFinite(seconds)) {
      maxSeconds = Math.max(maxSeconds, seconds);
      count++;
      if (count > 200) break;
    }
  }

  // Guard against "unsynced" lyrics that were written as [00:00.00] for every line.
  return maxSeconds > 0.5;
}

function isInstrumentalText(text) {
  const raw = String(text || '');
  if (!raw.trim()) return false;

  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // If any known metadata tag explicitly says instrumental.
  for (const line of lines) {
    // Common LRC tag forms: [au: instrumental], [artist: ...], etc.
    const m = line.match(/^\[([a-z]{1,12})\s*:\s*(.*?)\s*\]$/i);
    if (!m) continue;
    const key = String(m[1] || '').toLowerCase();
    const value = String(m[2] || '').toLowerCase();
    if ((key === 'au' || key === 'artist' || key === 'by' || key === 're') && value.includes('instrumental')) {
      return true;
    }
  }

  // If the visible lyric text is just the word "instrumental".
  const nonMeta = lines.filter((l) => !/^\[[a-z]{1,12}\s*:.*\]$/i.test(l));
  if (nonMeta.length === 1 && /^instrumental\b/i.test(nonMeta[0])) return true;

  return false;
}


function candidateLrcPaths(song) {
  const filePath = String(song?.filePath || '');
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const stem = path.basename(filePath, ext);

  const byStem = path.join(dir, `${stem}.lrc`);

  const artist = safeFileBaseName(song?.artist || '');
  const title = safeFileBaseName(song?.title || stem);
  const byArtistTitle = path.join(dir, `${artist} - ${title}.lrc`);

  const out = [];
  for (const p of [byStem, byArtistTitle]) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function candidateTxtPaths(song) {
  const filePath = String(song?.filePath || '');
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const stem = path.basename(filePath, ext);

  const byStem = path.join(dir, `${stem}.txt`);

  const artist = safeFileBaseName(song?.artist || '');
  const title = safeFileBaseName(song?.title || stem);
  const byArtistTitle = path.join(dir, `${artist} - ${title}.txt`);

  const out = [];
  for (const p of [byStem, byArtistTitle]) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function looksInstrumental(song) {
  const title = normalizeWhitespace(song?.title).toLowerCase();
  const filePath = String(song?.filePath || '').toLowerCase();
  const base = path.basename(filePath);

  const hay = [title, base].filter(Boolean).join(' ');
  if (!hay) return false;

  // Common markers in filenames/titles.
  if (/(\binstrumental\b|\binst\.?\b)/i.test(hay)) return true;
  if (/\(instrumental\)/i.test(hay)) return true;
  if (/\[instrumental\]/i.test(hay)) return true;
  if (/ - instrumental$/i.test(title)) return true;

  return false;
}

async function readTextIfExists(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    return String(text || '').trim() ? text : null;
  } catch {
    return null;
  }
}


function extractEmbeddedLyrics(metadata) {
  const results = [];

  const commonLyrics = metadata?.common?.lyrics;
  if (Array.isArray(commonLyrics)) {
    for (const item of commonLyrics) {
      const s = String(item || '').trim();
      if (s) results.push(s);
    }
  } else if (typeof commonLyrics === 'string') {
    const s = commonLyrics.trim();
    if (s) results.push(s);
  }

  // Some files store lyrics only in native tags.
  const native = metadata?.native;
  if (native && typeof native === 'object') {
    for (const tagType of Object.keys(native)) {
      const tags = native[tagType];
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        const id = String(tag?.id || '').toUpperCase();
        if (!id) continue;

        // USLT = unsynchronized lyrics, SYLT = synchronized lyrics.
        if (id === 'USLT' || id === 'SYLT' || id.includes('LYRICS')) {
          const val = tag?.value;
          if (typeof val === 'string') {
            const s = val.trim();
            if (s) results.push(s);
          } else if (val && typeof val === 'object') {
            const text = String(val.text || val.lyrics || '').trim();
            if (text) results.push(text);
          }
        }
      }
    }
  }

  // De-dup.
  return [...new Set(results)];
}

export async function resolveLyricsForSong({ storage, song } = {}) {
  if (!storage) throw new Error('storage is required');
  if (!song?.id) throw new Error('song is required');
  if (!song.filePath) throw new Error('song.filePath is required');

  const filePath = String(song.filePath);
  if (!path.isAbsolute(filePath) || !fssync.existsSync(filePath)) {
    return { ok: false, status: 404, error: 'File not found' };
  }

  const lrcCandidates = candidateLrcPaths(song);
  const txtCandidates = candidateTxtPaths(song);

  // 0) If local file exists, prefer it.
  for (const p of lrcCandidates) {
    const local = await readTextIfExists(p);
    if (local) {
      if (isInstrumentalText(local)) {
        return { ok: true, status: 200, lrc: 'Instrumental', synced: false, source: 'instrumental', lrcPath: p };
      }
      const synced = inferSyncedFromText(local);
      return { ok: true, status: 200, lrc: local, synced, source: 'local_file', lrcPath: p };
    }
  }

  // 0b) Local unsynced .txt
  for (const p of txtCandidates) {
    const local = await readTextIfExists(p);
    if (local) {
      if (isInstrumentalText(local)) {
        return { ok: true, status: 200, lrc: 'Instrumental', synced: false, source: 'instrumental', lrcPath: p };
      }
      // Treat .txt as unsynced even if it contains timestamps.
      return { ok: true, status: 200, lrc: local, synced: false, source: 'local_txt', lrcPath: p };
    }
  }

  // 1) Embedded lyrics (if present).
  try {
    const metadata = await parseFile(filePath);
    const embedded = extractEmbeddedLyrics(metadata);
    const embeddedBest = embedded.find((t) => hasLrcTimestamps(t)) || embedded[0];
    if (embeddedBest) {
      const synced = inferSyncedFromText(embeddedBest);
      return { ok: true, status: 200, lrc: embeddedBest, synced, source: 'embedded', lrcPath: null };
    }
  } catch {
    // Ignore tag parsing errors
  }

  // No local file and no embedded lyrics.
  if (looksInstrumental(song)) {
    return { ok: true, status: 200, lrc: 'Instrumental', synced: false, source: 'instrumental', lrcPath: null };
  }

  return { ok: false, status: 404, error: 'No local .lrc/.txt file and no embedded lyrics found' };
}
