# Frontend (UI)

This folder contains the static frontend served by the backend.

## How it talks to the backend

The frontend uses a same-origin API base URL by default:

- API base: `${window.location.origin}/api`

So you usually do not need to edit anything when running the backend and frontend together.

If you ever host the frontend separately, you can override the API base URL by setting:

- `window.__PLAYER0_API_URL = 'https://your-api-host/api'`

before public/js/API.js is loaded.

## Structure

- public/index.html: app shell
- public/app.js: app orchestration + routing
- public/js/: modules (API, state, player, ui, utils)
- public/views/: view templates loaded dynamically
- public/main.css + public/css/: modular styles

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
