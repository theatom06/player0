/**
 * AnalysisCache
 *
 * JSON-backed cache for aubio results.
 *
 * Design goals:
 * - Fast lookups by stable file fingerprint
 * - No DB dependency (offline-friendly)
 * - Safe-ish persistence (atomic write)
 *
 * Cache key: a lightweight "content fingerprint" (sha1 of size + mtimeMs + head/tail chunks)
 * This avoids hashing full MP3s (often huge) while still invalidating on changes.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

async function fileFingerprint(filePath, { size, mtimeMs } = {}) {
  const abs = path.resolve(filePath);
  const st = size != null && mtimeMs != null ? { size, mtimeMs } : await fs.stat(abs);

  const headSize = 64 * 1024;
  const tailSize = 64 * 1024;
  const handle = await fs.open(abs, 'r');

  try {
    const headLen = Math.min(headSize, st.size);
    const headBuf = Buffer.alloc(headLen);
    if (headLen > 0) {
      await handle.read(headBuf, 0, headLen, 0);
    }

    const tailLen = Math.min(tailSize, st.size);
    const tailBuf = Buffer.alloc(tailLen);
    if (tailLen > 0) {
      const start = Math.max(0, st.size - tailLen);
      await handle.read(tailBuf, 0, tailLen, start);
    }

    const h = crypto.createHash('sha1');
    h.update(String(abs));
    h.update('\n');
    h.update(String(st.size));
    h.update('\n');
    h.update(String(Math.round(Number(st.mtimeMs || 0))));
    h.update('\n');
    h.update(headBuf);
    h.update(tailBuf);
    return h.digest('hex');
  } finally {
    await handle.close();
  }
}

async function fileFingerprintFast(filePath, { size, mtimeMs } = {}) {
  const abs = path.resolve(filePath);
  const st = size != null && mtimeMs != null ? { size, mtimeMs } : await fs.stat(abs);

  const h = crypto.createHash('sha1');
  h.update(String(abs));
  h.update('\n');
  h.update(String(st.size));
  h.update('\n');
  h.update(String(Math.round(Number(st.mtimeMs || 0))));
  return h.digest('hex');
}

async function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmp = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const text = JSON.stringify(data, null, 2);
  await fs.writeFile(tmp, text);
  await fs.rename(tmp, filePath);
}

export class AnalysisCache {
  constructor(cacheFilePath) {
    this.cacheFilePath = cacheFilePath;
    this._loaded = false;
    this._data = { version: 1, entries: {} };
    this._dirty = false;
    this._flushTimer = null;
  }

  async load() {
    if (this._loaded) return;
    this._loaded = true;

    try {
      const raw = await fs.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
        this._data = parsed;
      }
    } catch {
      // Missing/invalid cache is fine.
      this._data = { version: 1, entries: {} };
    }
  }

  get(key) {
    return this._data.entries[key] || null;
  }

  set(key, value) {
    this._data.entries[key] = value;
    this._dirty = true;
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      void this.flush();
    }, 750);
  }

  async flush() {
    if (!this._dirty) return;
    this._dirty = false;
    await atomicWriteJson(this.cacheFilePath, this._data);
  }

  async computeKey(filePath, statHint) {
    await this.load();
    return await fileFingerprint(filePath, statHint);
  }

  async computeKeyFast(filePath, statHint) {
    await this.load();
    return await fileFingerprintFast(filePath, statHint);
  }
}
