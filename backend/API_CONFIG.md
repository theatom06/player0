# API configuration

Player 0 is designed to run the frontend and backend on the same origin.

## Default behavior

The frontend uses a same-origin API base URL:

- `${window.location.origin}/api`

This includes the port automatically (works on localhost, Codespaces, etc.).

## Override (only if hosting frontend separately)

If your frontend is hosted on a different origin than your backend, set a global override before the frontend modules load:

```html
<script>
  // Example: use a separate API host
  window.__PLAYER0_API_URL = 'https://your-domain.com/api';
</script>
<script type="module" src="/app.js"></script>
```

## Backend routes

All routes are under `/api` on the backend server.

Common ones:
- `GET /api/songs`
- `GET /api/search`
- `GET /api/albums`
- `GET /api/artists`
- `GET /api/playlists`
- `POST /api/playlists`
- `PUT /api/playlists/:id`
- `DELETE /api/playlists/:id`
- `GET /api/stream/:id`
- `GET /api/cover/:id`
- `POST /api/scan`
