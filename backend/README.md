# Backend (API + scanner)

This folder contains the Bun + Express server that powers Player 0.

## Run

From the repository root:

```bash
# Install deps
bun install --cwd backend

# Start server
bun run --cwd backend start

# Dev/watch mode
bun run --cwd backend dev

# Scan library
bun run --cwd backend scan

# Build for production
bun run --cwd backend build
```

Server defaults to `http://localhost:3000`.

## Features

- **Request logging** (`logger.js`) - Colored console output with timestamps and request tracking
- **Rate limiting** - 200 requests/minute per IP with automatic `X-RateLimit-*` headers
- **Search suggestions API** - `/api/suggestions` endpoint for autocomplete
- **Security headers** - HSTS, XSS protection, clickjacking prevention

## Configuration

Edit `backend/config.json`:

- `musicDirectories`: array of folders to scan
- `supportedFormats`: file extensions allowed
- `dataDirectory`: where JSON data is stored
- `host` / `port`: bind address

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/songs` | GET | List all songs |
| `/api/songs/:id` | GET | Get song by ID |
| `/api/search` | GET | Search songs (query params: `q`, `artist`, `album`, `genre`, `year`) |
| `/api/suggestions` | GET | **NEW** Search autocomplete (query params: `q`, `limit`) |
| `/api/albums` | GET | List all albums |
| `/api/albums/:artist/:album` | GET | Get album details |
| `/api/artists` | GET | List all artists |
| `/api/playlists` | GET/POST | List or create playlists |
| `/api/playlists/:id` | GET/PUT/DELETE | Playlist CRUD |
| `/api/stream/:id` | GET | Stream audio (supports range requests) |
| `/api/cover/:id` | GET | Get album artwork |
| `/api/play/:id` | POST | Record a play for statistics |
| `/api/history` | GET | Get play history |
| `/api/stats` | GET | Get library statistics |
| `/api/scan` | POST | Trigger library scan |

## Files

- `server.js` - Main Express server with all API routes
- `scanner.js` - Music directory scanner with metadata extraction
- `storage.js` - JSON-based data persistence
- `logger.js` - Request logging and rate limiting middleware
- `build.js` - Production build script (CSS/JS minification)
- `config.json` - Server configuration

## API config notes

See `backend/API_CONFIG.md`.
