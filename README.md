# Player 0
[![Hackatime](https://hackatime-badge.hackclub.com/U05J8AF58S1/player0)](https://hackatime-badge.hackclub.com/U05J8AF58S1/player0)

Simple web-based music player.

## Features

- Shuffle + repeat (off / all / one)
- Search + discovery shortcuts (not played recently, low play count)
- **Search autocomplete** with suggestions for artists, albums, songs, and genres
- Playlists (create/edit/delete, drag-reorder, pin, import/export)
- Per-item action menus (⋯ dropdowns) to keep the UI clean
- Mobile-first layout + responsive library table
- **Offline support** via service worker
- **Lazy loading** for album artwork

### UI Enhancements

- **Album art blur background** - Blurred album art behind the player for ambient visuals
- **Dynamic colors** - UI colors extracted from album art for cohesive theming
- **Smooth transitions** - Animated view changes and staggered item animations
- **Context menus** - Right-click on songs for quick actions (desktop), bottom sheet (mobile)
- **Search filter pills** - Active search filters shown as removable chips
- **Similar songs** - Song recommendations based on artist/genre/album
- **Activity heatmap** - GitHub-style listening activity visualization in stats
- **Top cards** - Visual cards for top artists/albums in stats
- **Mini player** - Compact player with progress and controls
- **Swipe gestures** - Swipe left/right on mobile to skip tracks
- **Improved queue** - Better drag-to-reorder with visual feedback
- **Toast notifications** - Non-intrusive feedback messages

## Quick start

From the repository root:

```bash
# Install backend deps
bun install --cwd backend

# Start backend
bun run --cwd backend start

# Scan music
bun run --cwd backend scan
```

Then open `http://localhost:3000`.

### Production build

```bash
# Build optimized assets (minified CSS/JS)
bun run --cwd backend build
```

Output is in `/dist` with minified CSS, bundled JS, and optimized HTML.

Tip: edit `backend/config.json` to point at your music directories.

## Docs

- Backend docs: `backend/README.md`
- Frontend docs: `public/README.md`
- API configuration: `backend/API_CONFIG.md`
- Style guide: `STYLE_GUIDE.md`

## New Ideas

### Playback & controls
- Shuffle / repeat modes
- Sleep timer (stop after N minutes)
- Mobile-friendly layout and touch controls

### Playlists & library
- Playlist drag-and-drop reordering
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

- **Backend**: Bun + Express + JSON file storage
- **Frontend**: plain HTML/CSS/JS (ES modules)
- **Audio**: `music-metadata` tag parsing + HTTP streaming
- **Performance**: Service worker caching, lazy loading, build optimization

## Configuration

Edit `backend/config.json`:

```json
{
  "musicDirectories": ["/path/to/your/music"],
  "port": 3000
}
```
