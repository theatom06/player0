# Player 0

Simple web-based music player.

## Quick start

From the repository root:

- Install backend deps: `bun install --cwd backend`
- Start backend: `bun run --cwd backend start`
- Scan music: `bun run --cwd backend scan`

Then open `http://localhost:3000`.

## Docs

- Backend docs: backend/README.md
- Frontend docs: public/README.md
- API configuration: backend/API_CONFIG.md
- Style guide: STYLE_GUIDE.md

## New Ideas

### Playback & controls
- Shuffle / repeat modes
- Queue management (view, reorder, clear)
- Sleep timer (stop after N minutes)
- Mobile-friendly layout and touch controls

### Playlists & library
- Drag-and-drop reordering
- Smart playlists (rule-based auto playlists)
- Pin favorites
- Import / export playlists and settings (M3U, PLS, JSON)

### Search & discovery
- Smarter search (fuzzy matching, typo tolerance)
- Discovery mode (surface songs you haven’t heard in a while)
- Radio stations (genre/artist “stations”)

### UI & theming
- Theme customization (light/dark/custom)
- Dark mode toggle
- Album art screensaver / idle view
- Dynamic colors generated from album art
- Focus mode (minimal UI)

### Metadata & extras
- Lyrics display (time-synced where available)
- Mood playlists (tempo/genre-based)
- BPM detection / tagging
- New music notifications when scans find additions

### Stats & reports
- Year in Review summary
- Total listening time
- Albums / genres reports
- Calendar view
- Export statistics to CSV

### Fun
- Music quiz game (guess the track from a short snippet)

## Tech Stack

- **Backend**: Bun.js with Express and SQLite
- **Frontend**: Plain HTML, CSS, and JavaScript
- **Audio**: music-metadata for tag extraction, HTTP streaming
- **Database**: better-sqlite3 for music metadata

## Setup

### Install dependencies

```bash
bun install
# or with bun
bun install
```

### Run the server

```bash
bun start
# or with bun
bun run start
```

## Configuration

Edit `config.json` to set your music directories.

You can specify multiple directories as an array:

```json
{
  "musicDirectories": ["/path/to/your/music1", "/path/to/your/music2"]
}
```

## Default Port

Server runs on http://localhost:3000
