# Player 0 - API Configuration Guide

## 🎯 How to Change the API URL

To change the backend API URL for your music player, you only need to edit **ONE FILE**:

### 📍 Location
**File:** `/public/js/API.js`

**Line:** 4

### ✏️ What to Change

Find this line:
```javascript
const API_URL = 'https://legendary-chainsaw-r9r6r5jjrr4fwq6p-3000.app.github.dev/api';
```

Change it to your backend URL:
```javascript
const API_URL = 'http://localhost:3000/api';  // For local development
// or
const API_URL = 'https://your-domain.com/api';  // For production
```

### ✅ That's It!

The API_URL is automatically used by all modules:
- `app.js` - Main application
- `player.js` - Audio player
- `ui.js` - User interface
- `API.js` - All API calls

All API endpoints, streaming URLs, and cover image URLs will automatically use the new base URL.

---

## 📚 Project Structure

```
/public
  /js
    API.js      ← CHANGE API URL HERE
    player.js   ← Audio playback
    state.js    ← App state management
    ui.js       ← Rendering functions
    utils.js    ← Utility functions
  app.js        ← Main entry point
  index.html
  style.css
```

## 🔧 Available API Functions

All API functions are in `/public/js/API.js`:

**Search:**
- `simpleSearch(query)`
- `advancedSearch(options)`

**Songs:**
- `fetchAllSongs()`
- `songCoverUrl(id)`
- `songStreamUrl(id)`
- `recordPlay(id)`

**Albums:**
- `listAlbums()`
- `getAlbumDetail(artist, album)`
- `albumCoverUrl(id)`

**Artists:**
- `listArtists()`

**Playlists:**
- `listPlaylists()`
- `createPlaylist(name, description, songs)`

**Statistics:**
- `getStats()`

**Library:**
- `scanLibrary()`
