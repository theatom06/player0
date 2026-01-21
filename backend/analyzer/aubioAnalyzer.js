/**
 * AubioAnalyzer
 *
 * Offline BPM + key detection using aubio CLI.
 *
 * Requirements satisfied:
 * - Uses child_process.spawn (not exec)
 * - Runs asynchronously (queue with limited concurrency)
 * - Results cached by file fingerprint
 * - Never blocks playback/UI (scanner enqueues work after scan completes)
 * - Can be swapped later (single analyzer module boundary)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { AnalysisCache } from './analysisCache.js';

const require = createRequire(import.meta.url);
// node-id3 is CommonJS.
const NodeID3 = require('node-id3');

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalizeBpm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 30 || n > 300) return null;
  return Math.round(n);
}

function normalizeKey(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  return s.length > 32 ? s.slice(0, 32) : s;
}

function parseTempoStdout(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return { bpm: null, confidence: 0 };

  // 1) Direct patterns like "bpm 128".
  const direct = text.match(/\b(bpm)\b[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
  if (direct) {
    const bpm = normalizeBpm(direct[2]);
    return { bpm, confidence: bpm ? 0.7 : 0 };
  }

  // 2) Many aubio builds output beat timestamps per line. If we see multiple
  // increasing numbers, infer BPM from median interval.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const values = [];
  for (const line of lines) {
    const m = line.match(/-?\d+(?:\.\d+)?/);
    if (m) values.push(Number(m[0]));
  }

  if (values.length >= 4) {
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      const d = values[i] - values[i - 1];
      if (Number.isFinite(d) && d > 0.1 && d < 5) diffs.push(d);
    }

    if (diffs.length >= 3) {
      diffs.sort((a, b) => a - b);
      const median = diffs[Math.floor(diffs.length / 2)];
      const bpm = normalizeBpm(60 / median);

      // Confidence: stability of intervals (lower relative spread -> higher confidence).
      const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const variance = diffs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / diffs.length;
      const std = Math.sqrt(variance);
      const rel = mean > 0 ? std / mean : 1;
      const confidence = bpm ? clamp(1 - rel / 0.25, 0, 1) : 0;

      return { bpm, confidence };
    }
  }

  // 3) Fallback: single numeric could be BPM.
  const single = text.match(/\b([0-9]{2,3}(?:\.[0-9]+)?)\b/);
  if (single) {
    const bpm = normalizeBpm(single[1]);
    return { bpm, confidence: bpm ? 0.4 : 0 };
  }

  return { bpm: null, confidence: 0 };
}

function parseKeyStdout(stdout) {
  // NOTE: Ubuntu aubio-tools (0.4.x) does not ship an `aubio key` subcommand.
  // We estimate key from `aubio pitch` output using a simple pitch-class histogram
  // + Krumhansl-style template matching.
  const text = String(stdout || '').trim();
  if (!text) return { key: null, confidence: 0 };

  const majorTemplate = [
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
  ];
  const minorTemplate = [
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
  ];
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  const hist = new Array(12).fill(0);
  const lines = text.split(/\r?\n/);

  // aubio pitch output (default): "<time> <pitch>".
  // We call it with -u midi, so second column is MIDI note number (0 if unvoiced).
  let used = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const midi = Number(parts[1]);
    if (!Number.isFinite(midi) || midi <= 0) continue;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    hist[pc] += 1;
    used += 1;
    if (used >= 4000) break;
  }

  const total = hist.reduce((a, b) => a + b, 0);
  if (total < 50) return { key: null, confidence: 0 };

  // Normalize histogram.
  const h = hist.map((v) => v / total);

  const dot = (a, b) => a.reduce((acc, v, i) => acc + v * b[i], 0);
  const rotate = (arr, n) => arr.map((_, i) => arr[(i - n + 12) % 12]);

  let best = { score: -Infinity, root: 0, mode: 'maj' };
  let second = { score: -Infinity };

  for (let root = 0; root < 12; root++) {
    const majScore = dot(h, rotate(majorTemplate, root));
    const minScore = dot(h, rotate(minorTemplate, root));

    const candidates = [
      { score: majScore, root, mode: 'maj' },
      { score: minScore, root, mode: 'min' }
    ];

    for (const c of candidates) {
      if (c.score > best.score) {
        second = best;
        best = c;
      } else if (c.score > second.score) {
        second = c;
      }
    }
  }

  const name = noteNames[best.root] + (best.mode === 'min' ? 'm' : '');
  const key = normalizeKey(name);

  // Confidence from separation between best and runner-up.
  const sep = best.score - (second.score ?? best.score);
  const confidence = clamp(sep / Math.max(1e-6, Math.abs(best.score)), 0, 1);

  return { key, confidence };
}

function runAubio(args, { timeoutMs = 60_000, maxStdoutBytes = 8 * 1024 * 1024, maxStderrBytes = 512 * 1024 } = {}) {
  return new Promise((resolve) => {
    const child = spawn('aubio', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const killTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      if (stdout.length >= maxStdoutBytes) return;
      stdout += d.toString();
      if (stdout.length >= maxStdoutBytes) {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }
    });
    child.stderr.on('data', (d) => {
      if (stderr.length >= maxStderrBytes) return;
      stderr += d.toString();
    });

    const done = (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      resolve({ code, signal, stdout, stderr });
    };

    child.on('error', (err) => {
      // Spawn failure (aubio missing, permission issues, etc.)
      stderr = String(err?.message || err);
      done(null, null);
    });

    child.on('close', done);
  });
}

function shouldLogAubioStderr(stderr) {
  const s = String(stderr || '').trim();
  if (!s) return false;

  // Common FFmpeg/mp3 decoder warnings that appear frequently but are not fatal.
  const ignorable = [
    'Could not update timestamps',
    'Could not update timestamps for discarded samples',
    'Could not update timestamps for skipped samples',
    'filesize and duration do not match',
    'overread, skip'
  ];
  for (const needle of ignorable) {
    if (s.includes(needle)) return false;
  }

  // Only surface likely-actionable errors.
  return /\berror\b|\btraceback\b|\binvalid\b|\bfail/i.test(s);
}

async function writeId3Tags(filePath, { bpm, key }) {
  // Only write if we have something meaningful.
  const tags = {};
  const b = normalizeBpm(bpm);
  const k = normalizeKey(key);

  if (b != null) tags.bpm = String(b);
  // node-id3 uses `initialKey` which maps to TKEY.
  if (k) tags.initialKey = String(k);

  if (Object.keys(tags).length === 0) return { written: false };

  // node-id3 update returns boolean
  const ok = NodeID3.update(tags, filePath);
  return { written: Boolean(ok) };
}

export class AubioAnalyzer {
  constructor({ cacheFilePath, concurrency = 1, logger = console } = {}) {
    this.cache = new AnalysisCache(cacheFilePath);
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.logger = logger;

    this._queue = [];
    this._running = 0;
    this._enqueuedKeys = new Set();
    this._aubioAvailable = null; // lazy
  }

  idle() {
    if (this._running === 0 && this._queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this._running === 0 && this._queue.length === 0) return resolve();
        setTimeout(check, 250);
      };
      check();
    });
  }

  async isAvailable() {
    if (this._aubioAvailable !== null) return this._aubioAvailable;

    // Fast check: try to spawn "aubio --version".
    const res = await runAubio(['--version'], { timeoutMs: 3000 });
    this._aubioAvailable = res.code === 0 || (res.stdout && res.stdout.length > 0);
    if (!this._aubioAvailable) {
      this.logger?.warn?.('[aubio] aubio CLI not available; skipping analysis.');
    }
    return this._aubioAvailable;
  }

  /**
   * Enqueue analysis for an MP3 file.
   * Returns immediately; work happens asynchronously.
   */
  async enqueue({ filePath, statHint, songId, storage } = {}) {
    if (!filePath) return;

    const abs = path.resolve(filePath);
    const ext = path.extname(abs).toLowerCase();
    if (ext !== '.mp3') return;

    await this.cache.load();

    let key;
    try {
      // Avoid reading MP3 bytes during scanning; mtime+size is enough to be stable.
      key = await this.cache.computeKeyFast(abs, statHint);
    } catch (err) {
      this.logger?.warn?.('[aubio] fingerprint failed:', err?.message || err);
      return;
    }

    // Deduplicate within-process.
    if (this._enqueuedKeys.has(key)) return;
    this._enqueuedKeys.add(key);

    this._queue.push({ abs, key, songId, storage, statHint });
    this._drain();
  }

  _drain() {
    while (this._running < this.concurrency && this._queue.length > 0) {
      const task = this._queue.shift();
      this._running += 1;
      void this._runTask(task).finally(() => {
        this._running -= 1;
        this._drain();
      });
    }
  }

  async _runTask({ abs, key, songId, storage, statHint }) {
    const cached = this.cache.get(key);
    if (cached && cached.ok && (cached.bpm != null || cached.key != null)) {
      // Best-effort: ensure tags exist.
      try {
        const { written } = await writeId3Tags(abs, { bpm: cached.bpm, key: cached.key });
        if (storage && songId) {
          const updates = { bpm: cached.bpm ?? null, key: cached.key ?? null };
          if (written) {
            try {
              const st = await (await import('node:fs/promises')).default.stat(abs);
              updates.lastModified = st.mtime.toISOString();
            } catch {
              // ignore
            }
          }
          try {
            await storage.updateSong(songId, updates);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
      return;
    }

    if (!(await this.isAvailable())) {
      this.cache.set(key, {
        ok: false,
        filePath: abs,
        updatedAt: new Date().toISOString(),
        error: 'aubio_not_installed'
      });
      return;
    }

    // Run aubio tempo + pitch-derived key.
    const tempoRes = await runAubio(['tempo', abs], { timeoutMs: 90_000 });
    const pitchRes = await runAubio(['pitch', '-u', 'midi', '-q', '-B', '8192', '-H', '4096', abs], {
      timeoutMs: 120_000,
      maxStdoutBytes: 6 * 1024 * 1024
    });

    const tempoParsed = tempoRes.code === 0 ? parseTempoStdout(tempoRes.stdout) : { bpm: null, confidence: 0 };
    const keyParsed = pitchRes.code === 0 ? parseKeyStdout(pitchRes.stdout) : { key: null, confidence: 0 };

    const bpm = normalizeBpm(tempoParsed.bpm);
    const musicalKey = normalizeKey(keyParsed.key);

    // Combine confidence heuristically.
    const confidence = clamp(
      Math.max(tempoParsed.confidence || 0, keyParsed.confidence || 0),
      0,
      1
    );

    const ok = (bpm != null || musicalKey != null) && confidence >= 0.15;

    // Log stderr but never crash.
    if (shouldLogAubioStderr(tempoRes.stderr)) this.logger?.warn?.('[aubio tempo stderr]', tempoRes.stderr.trim());
    if (shouldLogAubioStderr(pitchRes.stderr)) this.logger?.warn?.('[aubio pitch stderr]', pitchRes.stderr.trim());

    this.cache.set(key, {
      ok,
      filePath: abs,
      bpm,
      key: musicalKey,
      confidence,
      updatedAt: new Date().toISOString(),
      tempoExitCode: tempoRes.code,
      pitchExitCode: pitchRes.code
    });

    // Persist cache even in short-lived processes.
    try {
      await this.cache.flush();
    } catch {
      // ignore
    }

    if (!ok) return;

    // Write tags back into the MP3 so future scans pick them up from ID3.
    try {
      const { written } = await writeId3Tags(abs, { bpm, key: musicalKey });

      // If we modified the file, bump lastModified in songs.json to match new mtime
      // so the next scan doesn't immediately treat it as changed.
      if (written && storage && songId) {
        try {
          const st = await (await import('node:fs/promises')).default.stat(abs);
          await storage.updateSong(songId, {
            bpm,
            key: musicalKey,
            lastModified: st.mtime.toISOString()
          });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      this.logger?.warn?.('[id3] Failed to write tags:', err?.message || err);
    }

    // Optional: also update songs.json for immediate UI access after scan.
    // This must run AFTER scanner has saved the full songs list.
    if (storage && songId) {
      try {
        await storage.updateSong(songId, { bpm, key: musicalKey });
      } catch {
        // ignore
      }
    }

    // Cache already flushed above.
  }
}
