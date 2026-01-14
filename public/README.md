# Frontend (UI)

This folder contains the static frontend served by the backend.

## Features

- **Search autocomplete** - Real-time suggestions as you type (artists, albums, songs, genres)
- **Offline support** - Service worker caches static assets and API responses
- **Lazy loading** - Album artwork loads on-demand for better performance
- **Keyboard navigation** - Arrow keys + Enter in search suggestions

## How it talks to the backend

The frontend uses a same-origin API base URL by default:

- API base: `${window.location.origin}/api`

So you usually do not need to edit anything when running the backend and frontend together.

If you ever host the frontend separately, you can override the API base URL by setting:

- `window.__PLAYER0_API_URL = 'https://your-api-host/api'`

before public/js/API.js is loaded.

## Structure

```
public/
├── index.html          # App shell
├── app.js              # App entry point
├── sw.js               # Service worker (offline support)
├── main.css            # CSS imports
├── css/                # Modular styles
│   ├── base.css        # Variables, reset
│   ├── components.css  # Dropdowns, modals
│   ├── header.css      # Search bar, suggestions
│   ├── library.css     # Song table, lazy loading
│   ├── player.css      # Player controls
│   ├── sidebar.css     # Navigation
│   ├── views.css       # View-specific styles
│   └── mobile.css      # Responsive overrides
├── js/
│   ├── API.js          # Backend API client
│   ├── player.js       # Audio playback
│   ├── state.js        # App state management
│   ├── ui.js           # UI rendering helpers
│   ├── utils.js        # Utilities (debounce, lazy loading)
│   └── app/            # Feature modules
│       ├── search.js   # Search + autocomplete
│       ├── shell.js    # App bootstrap
│       └── ...         # Other features
└── views/              # View templates (loaded dynamically)
```

## UI components

- Dropdown menus (⋯): `public/js/app/dropdowns.js` + styles in `public/css/components.css`
- View-specific logic lives under `public/js/app/` and uses rendering helpers in `public/js/ui.js`

### Song row actions

Song tables (Library + Playlist Detail) expose per-row actions via the dropdown menu:

- Play / Play next
- Add to queue
- Add to playlist
- Copy title + artist

Handlers are delegated in `public/js/app/navigation.js` and queue state lives in `public/js/state.js`.

## Service Worker

The service worker (`sw.js`) provides offline support with different caching strategies:

| Resource | Strategy | Details |
|----------|----------|--------|
| Static assets (HTML, CSS, JS) | Cache-first | Fast loads, updated on new version |
| API data (songs, playlists) | Network-first | Fresh data with offline fallback |
| Cover art | Cache-first | 7-day expiry, saves bandwidth |
| Audio streams | Network-only | Too large to cache |

## Performance

- **Lazy loading**: Images use `IntersectionObserver` to load only when visible
- **Debounced search**: 150ms debounce prevents excessive API calls
- **In-memory caching**: API responses cached client-side (1 week TTL)
- **Build optimization**: Run `bun run build` from backend for minified assets
