# Player 0 Backend

Bun + Express server providing:

- Library scanning (reads tags, cover art, optional BPM/key tagging)
- JSON storage (`backend/data/`)
- Audio streaming (range requests)
- REST API under `/api`

## Requirements

- Bun
- Read access to your music directories

Optional:
- `aubio-tools` for automatic BPM/key detection

## Install & run

From the repository root:

```bash
bun install --cwd backend
bun run --cwd backend start
```

Dev/watch mode:

```bash
bun run --cwd backend dev
```

Trigger a scan:

```bash
bun run --cwd backend scan
```

The server listens on `PORT` (env) or `backend/config.json` (`port`), falling back to `3000`.

## Configuration

Edit `backend/config.json`:

- `musicDirectories`: folders to scan
- `supportedFormats`: allowed extensions
- `dataDirectory`: where JSON files are stored
- `host` / `port`: bind address

Important:
- Treat `dataDirectory` as persistent state (back it up).

### Config endpoint

Player 0 can edit `backend/config.json` from the Settings page via:

- `GET /api/config`
- `PUT /api/config`

This is intended for a device-hosted setup (same device / same network). If you expose the backend publicly, protect these endpoints behind your network or reverse proxy.

## API overview

Common endpoints:

- `GET /api/songs`
- `GET /api/songs/:id`
- `GET /api/search`
- `GET /api/suggestions`
- `GET /api/albums`
- `GET /api/albums/:artist/:album`
- `GET /api/artists`
- `GET /api/playlists` / `POST /api/playlists`
- `GET|PUT|DELETE /api/playlists/:id`
- `GET /api/stream/:id` (range requests)
- `GET /api/cover/:id`
- `POST /api/play/:id`
- `GET /api/history`
- `GET /api/stats`
- `POST /api/scan`

API base URL notes (hosting frontend separately): see [backend/API_CONFIG.md](API_CONFIG.md).

## Optional: aubio BPM/key tagging

On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y aubio-tools
```

If installed, the scanner can detect BPM/key for MP3s missing those tags and write TBPM/TKEY.

## Build frontend assets

```bash
bun run --cwd backend build
```

Outputs `dist/` at the repo root.

## Production deployment

Recommended:

1. Run the backend (this folder) as the API + streaming server.
2. Serve `dist/` from a static server.
3. Reverse-proxy `/api/*` to the backend.

Notes:
- Ensure your proxy supports range requests for `/api/stream/*`.

## Key files

- `server.js`: Express app + routes
- `scanner.js`: library scanner
- `storage.js`: JSON persistence
- `logger.js`: logging + rate limiting
- `build.js`: frontend build into `dist/`
- `config.json`: server config
