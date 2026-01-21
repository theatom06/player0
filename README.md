# Player 0
[![Hackatime](https://hackatime-badge.hackclub.com/U05J8AF58S1/player0)](https://hackatime-badge.hackclub.com/U05J8AF58S1/player0)

Self-hosted web music player.

- Backend: Bun + Express (scans library, streams audio, stores JSON metadata)
- Frontend: vanilla HTML/CSS/JS (ES modules), offline caching via service worker

## Features

- Library scan (reads tags, extracts cover art)
- Search + autocomplete suggestions
- Playlists (create/edit/delete, drag reorder, import/export)
- Queue + “play next” actions
- Stats (plays, recently played, reports)
- Theming: dynamic colors from album art + manual overrides
- Offline support (static assets + cached API responses)

## Requirements

- Bun (recommended)
- A folder containing music files (configured in `backend/config.json`)

Optional:
- `aubio-tools` for automatic BPM/key detection during scans

## Quick start

From the repository root:

```bash
bun install --cwd backend
bun run --cwd backend start
```

In another terminal (or after first start):

```bash
bun run --cwd backend scan
```

Open the URL printed by the server on startup (port is configurable; default is `3000`, but `backend/config.json` can override it).

## Configuration

Edit `backend/config.json`:

```json
{
  "musicDirectories": ["/path/to/your/music"],
  "supportedFormats": [".mp3"],
  "dataDirectory": "./data",
  "host": "0.0.0.0",
  "port": 3000
}
```

You can also override the port with `PORT`.

## Production build

Build minified/bundled frontend assets:

```bash
bun run --cwd backend build
```

This generates `dist/` at the repository root (including `index.html` + `app.min.js`).

## Deployment

Recommended production setup:

1. Run the backend as the API + streaming server.
2. Serve `dist/` from a static server (Nginx/Caddy).
3. Reverse-proxy `/api/*` (and `/api/stream/*`) to the backend.

Notes:
- Audio streaming uses range requests; ensure your proxy supports them.
- If you host frontend separately, set `window.__PLAYER0_API_URL` (see [backend/API_CONFIG.md](backend/API_CONFIG.md)).

## Docs

- Backend: [backend/README.md](backend/README.md)
- Frontend: [public/README.md](public/README.md)
- API config: [backend/API_CONFIG.md](backend/API_CONFIG.md)
- Style guide: [STYLE_GUIDE.md](STYLE_GUIDE.md)

## License

MIT
