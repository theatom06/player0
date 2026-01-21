import fs from 'fs/promises';

function sanitizeConfigForClient(cfg) {
  return {
    musicDirectories: Array.isArray(cfg.musicDirectories) ? cfg.musicDirectories : [],
    supportedFormats: Array.isArray(cfg.supportedFormats) ? cfg.supportedFormats : [],
    dataDirectory: String(cfg.dataDirectory || './data'),
    host: String(cfg.host || '0.0.0.0'),
    port: Number(cfg.port) || 3000
  };
}

function sanitizeUpdate(body, current) {
  const next = JSON.parse(JSON.stringify(current || {}));

  // Ensure expected shapes exist.
  if (!Array.isArray(next.musicDirectories)) next.musicDirectories = [];
  if (!Array.isArray(next.supportedFormats)) next.supportedFormats = [];

  if (body && typeof body === 'object') {
    if (Array.isArray(body.musicDirectories)) {
      next.musicDirectories = body.musicDirectories
        .map((p) => String(p || '').trim())
        .filter(Boolean);
    }

    if (Array.isArray(body.supportedFormats)) {
      next.supportedFormats = body.supportedFormats
        .map((ext) => String(ext || '').trim())
        .filter(Boolean);
    }

    if (body.dataDirectory != null) {
      next.dataDirectory = String(body.dataDirectory || '').trim() || next.dataDirectory;
    }

    if (body.host != null) {
      next.host = String(body.host || '').trim() || next.host;
    }

    if (body.port != null) {
      const port = Number(body.port);
      if (Number.isFinite(port) && port > 0 && port < 65536) next.port = Math.trunc(port);
    }

  }

  return next;
}

export function registerConfigRoutes(app, { runtimeConfig, configFilePath, requireAdmin }) {
  const auth = (typeof requireAdmin === 'function') ? requireAdmin : (req, res, next) => next();

  app.get('/api/config', auth, async (req, res) => {
    res.json(sanitizeConfigForClient(runtimeConfig));
  });

  app.put('/api/config', auth, async (req, res) => {
    try {
      const next = sanitizeUpdate(req.body, runtimeConfig);

      // Mutate the runtime config so changes apply immediately where supported (e.g., rate limit).
      Object.assign(runtimeConfig, next);

      // Persist to config.json for scanner/next restart.
      await fs.writeFile(configFilePath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');

      res.json({ ok: true, config: sanitizeConfigForClient(runtimeConfig) });
    } catch (error) {
      res.status(500).json({ message: error?.message || 'Failed to update config' });
    }
  });
}
