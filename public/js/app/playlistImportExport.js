import { clearCache, createPlaylist, fetchAllSongs, listPlaylists } from '../api.js';

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportPlaylistsAsJson() {
  const playlists = await listPlaylists();

  const settings = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('player0.')) continue;
      settings[key] = localStorage.getItem(key);
    }
  } catch {
    // ignore (storage may be unavailable)
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    playlists: (playlists || []).map(p => ({
      name: p.name,
      description: p.description || '',
      songIds: Array.isArray(p.songIds) ? p.songIds : []
    })),
    settings
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(`player0-playlists-${new Date().toISOString().slice(0, 10)}.json`, blob);
}

function normalizeImportedPayload(data) {
  if (!data) return [];

  // Accept either {playlists:[...]} or raw array
  const list = Array.isArray(data) ? data : Array.isArray(data.playlists) ? data.playlists : [];

  return list
    .map(p => ({
      name: String(p?.name || '').trim(),
      description: String(p?.description || '').trim(),
      songIds: Array.isArray(p?.songIds) ? p.songIds.filter(Boolean) : []
    }))
    .filter(p => p.name.length > 0);
}

export async function importPlaylistsFromJsonFile(file) {
  if (!file) return;

  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file');
  }

  // If present, import settings (localStorage keys under player0.*)
  try {
    const settings = parsed && typeof parsed === 'object' ? parsed.settings : null;
    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        if (typeof key !== 'string' || !key.startsWith('player0.')) continue;
        localStorage.setItem(key, String(value ?? ''));
      }
    }
  } catch {
    // ignore
  }

  const toImport = normalizeImportedPayload(parsed);
  if (toImport.length === 0) {
    throw new Error('No playlists found in file');
  }

  // Create sequentially to keep it simple and avoid spamming the server.
  for (const p of toImport) {
    await createPlaylist(p.name, p.description, p.songIds);
  }

  clearCache();
}

function safeFileBaseName(name) {
  const base = String(name || 'playlist')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .slice(0, 80);
  return base.length ? base : 'playlist';
}

function normalizePathLike(value) {
  let v = String(value || '').trim();
  if (!v) return '';

  // strip surrounding quotes
  v = v.replace(/^['"]|['"]$/g, '');

  // file:// URI support
  if (v.startsWith('file://')) {
    v = v.replace(/^file:\/\//, '');
    try {
      v = decodeURIComponent(v);
    } catch {
      // ignore
    }
  }

  // normalize separators
  v = v.replace(/\\/g, '/');
  return v;
}

function parseM3u(text) {
  const entries = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    entries.push(line);
  }
  return entries;
}

function parsePls(text) {
  const filesByIndex = new Map();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith(';')) continue;
    if (line.startsWith('[') && line.endsWith(']')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    const m = /^File(\d+)$/i.exec(key);
    if (!m) continue;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx <= 0) continue;
    filesByIndex.set(idx, value);
  }

  const maxIndex = Math.max(0, ...filesByIndex.keys());
  const entries = [];
  for (let i = 1; i <= maxIndex; i++) {
    const v = filesByIndex.get(i);
    if (v) entries.push(v);
  }
  return entries;
}

function formatExtinf(song) {
  const seconds = Number.isFinite(song?.duration) ? Math.round(song.duration) : -1;
  const artist = song?.artist ? String(song.artist) : '';
  const title = song?.title ? String(song.title) : '';
  const label = [artist, title].filter(Boolean).join(' - ') || title || 'Unknown';
  return `#EXTINF:${seconds},${label}`;
}

export function exportPlaylistAsM3U(playlistName, songs) {
  const safeName = safeFileBaseName(playlistName);

  const lines = ['#EXTM3U'];
  for (const song of songs || []) {
    if (!song?.filePath) continue;
    lines.push(formatExtinf(song));
    lines.push(String(song.filePath));
  }

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'audio/x-mpegurl' });
  downloadBlob(`player0-${safeName}.m3u8`, blob);
}

export function exportPlaylistAsPLS(playlistName, songs) {
  const safeName = safeFileBaseName(playlistName);

  const validSongs = (songs || []).filter(s => s?.filePath);
  const lines = ['[playlist]'];

  validSongs.forEach((song, index) => {
    const n = index + 1;
    const seconds = Number.isFinite(song?.duration) ? Math.round(song.duration) : -1;
    const artist = song?.artist ? String(song.artist) : '';
    const title = song?.title ? String(song.title) : '';
    const label = [artist, title].filter(Boolean).join(' - ') || title || 'Unknown';
    lines.push(`File${n}=${String(song.filePath)}`);
    lines.push(`Title${n}=${label}`);
    lines.push(`Length${n}=${seconds}`);
  });

  lines.push(`NumberOfEntries=${validSongs.length}`);
  lines.push('Version=2');

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'audio/x-scpls' });
  downloadBlob(`player0-${safeName}.pls`, blob);
}

export async function importPlaylistFromM3uOrPlsFile(file) {
  if (!file) return;

  const filename = String(file.name || '').toLowerCase();
  const text = await file.text();

  let entries;
  if (filename.endsWith('.pls')) {
    entries = parsePls(text);
  } else if (filename.endsWith('.m3u') || filename.endsWith('.m3u8')) {
    entries = parseM3u(text);
  } else {
    throw new Error('Unsupported playlist file type (use .m3u/.m3u8/.pls)');
  }

  if (!entries || entries.length === 0) {
    throw new Error('No entries found in playlist file');
  }

  const allSongs = await fetchAllSongs();
  const byPath = new Map();
  const byBase = new Map();

  for (const song of allSongs || []) {
    const fp = song?.filePath;
    if (!fp) continue;
    const norm = normalizePathLike(fp);
    byPath.set(norm, song.id);

    const base = norm.split('/').pop()?.toLowerCase();
    if (base && !byBase.has(base)) byBase.set(base, song.id);
  }

  const songIds = [];
  let missingCount = 0;
  for (const entry of entries) {
    const norm = normalizePathLike(entry);
    if (!norm) continue;

    const direct = byPath.get(norm);
    if (direct) {
      songIds.push(direct);
      continue;
    }

    const base = norm.split('/').pop()?.toLowerCase();
    const viaBase = base ? byBase.get(base) : null;
    if (viaBase) {
      songIds.push(viaBase);
    } else {
      missingCount++;
    }
  }

  const playlistName = safeFileBaseName(file.name);
  const created = await createPlaylist(playlistName, '', songIds);
  clearCache();

  return {
    playlistId: created?.id,
    playlistName: created?.name || playlistName,
    importedCount: songIds.length,
    missingCount
  };
}
