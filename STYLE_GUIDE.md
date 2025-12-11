# Player 0 - Coding Style Guide

## Core Principles
- **Keep it simple** - Prioritize readability over cleverness
- **Modular by default** - Each file has one clear purpose
- **User-first** - Fast, smooth, intuitive UX

---

## File Size Limits
- **Hard limit: 1000 lines** per file
- **Soft target: 500 lines** per file
- If file exceeds 700 lines → consider splitting
- If file hits 1000 lines → MUST split immediately

### How to Split Large Files
- Extract logical sections into separate files
- Create index files that re-export if needed
- Use descriptive names (`albumView.js`, `playlistView.js`)
- Keep related code together (don't over-modularize)

---

## Architecture & Organization

### Module Structure
```
public/
  js/
    API.js       - All API calls (< 500 lines)
    state.js     - App state management (< 200 lines)
    player.js    - Audio player logic (< 400 lines)
    ui.js        - DOM rendering (< 800 lines, split if needed)
    utils.js     - Helper functions (< 300 lines)
  css/
    base.css       - Variables, reset (< 200 lines)
    sidebar.css    - Navigation (< 200 lines)
    header.css     - Top bar (< 150 lines)
    library.css    - Song table (< 300 lines)
    views.css      - View layouts (< 400 lines)
    player.css     - Audio controls (< 300 lines)
    components.css - Reusable UI (< 400 lines)
```

### Responsibilities
- **app.js** - Orchestrator only, wires everything together
- **ui.js** - Pure rendering, no business logic
- **API.js** - All server communication, caching
- **state.js** - Single source of truth for app state
- **player.js** - Audio control, playback logic
- **utils.js** - Pure functions, no side effects

---

## Naming Conventions

### JavaScript
- **Functions**: camelCase (`loadPlaylists`, `renderSongs`)
- **Constants**: UPPER_SNAKE_CASE (`API_URL`, `CACHE_DURATION`)
- **Classes**: PascalCase (if needed)
- **Private/internal**: prefix with `_` (`_internalHelper`)
- **Event handlers**: descriptive or prefix with `on` (`onClick`, `savePlaylist`)

### CSS
- **Classes**: kebab-case (`song-list-item`, `playlist-card`)
- **IDs**: camelCase (`playlistGrid`, `songTableBody`)
- **Variables**: kebab-case (`--text-primary`, `--bg-medium`)
- **BEM when needed**: `.block__element--modifier`

### Files
- **kebab-case**: `playlist-detail.js`, `album-view.css`
- **Descriptive names**: Tell what it does, not what it is

---

## Code Style

### General
```javascript
// ✅ Good - Clear, simple, readable
async function loadSongs() {
  try {
    const songs = await fetchAllSongs();
    renderSongs(songs);
  } catch (error) {
    console.error('Error loading songs:', error);
    showError('Failed to load songs');
  }
}

// ❌ Bad - Too clever, hard to follow
const loadSongs = () => fetchAllSongs().then(renderSongs).catch(e => console.error(e) || showError('Failed'));
```

### Modern JavaScript
- Use `async/await` over promises
- Arrow functions for callbacks
- Template literals over concatenation
- Destructuring where it helps readability
- Optional chaining `?.` for safe access
- Nullish coalescing `??` for defaults

```javascript
// ✅ Good
const { name, description = 'No description' } = playlist;
const songs = playlist?.songs ?? [];

// ❌ Bad
var name = playlist.name;
var description = playlist.description ? playlist.description : 'No description';
var songs = playlist && playlist.songs ? playlist.songs : [];
```

### Functions
```javascript
// ✅ Early returns, guard clauses
function renderSongs(songs) {
  if (!songs || songs.length === 0) {
    showEmptyState();
    return;
  }
  
  songs.forEach(song => renderSongRow(song));
}

// ❌ Nested conditions
function renderSongs(songs) {
  if (songs && songs.length > 0) {
    songs.forEach(song => {
      renderSongRow(song);
    });
  } else {
    showEmptyState();
  }
}
```

---

## Security & Validation

### Always Escape User Content
```javascript
// ✅ Good - Escaped
item.innerHTML = `<div>${escapeHtml(song.title)}</div>`;

// ❌ Bad - XSS vulnerability
item.innerHTML = `<div>${song.title}</div>`;
```

### Validate Inputs
```javascript
// ✅ Good - Validated before API call
if (!name || name.length > 200) {
  alert('Invalid playlist name');
  return;
}
await createPlaylist(name);

// ❌ Bad - No validation
await createPlaylist(name);
```

### Use Dataset Attributes
```javascript
// ✅ Good - Safe, semantic
button.dataset.songId = song.id;
const songId = button.dataset.songId;

// ❌ Bad - Fragile, not semantic
button.setAttribute('onclick', `playSong('${song.id}')`);
```

---

## Performance

### Caching Strategy
- Cache GET requests for static data
- Current: 1 week cache duration
- Clear cache on library scan/mutations
- Use Map for in-memory cache

### DOM Operations
- Event delegation over individual listeners
- Batch DOM updates when possible
- Use `documentFragment` for multiple insertions
- Hardware-accelerated animations only

```javascript
// ✅ Good - Event delegation
document.addEventListener('click', (e) => {
  if (e.target.closest('.play-button')) {
    handlePlay(e);
  }
});

// ❌ Bad - Individual listeners
songs.forEach(song => {
  button.addEventListener('click', () => handlePlay(song));
});
```

### CSS Performance
```css
/* ✅ Good - Hardware accelerated */
.card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
  transform: translateY(-2px);
}

/* ❌ Bad - Causes reflow */
.card {
  transition: top 0.2s;
}
.card:hover {
  top: -2px;
}
```

---

## UI/UX Patterns

### Always Provide Feedback
- Loading states for async operations
- Success/error messages
- Disabled states during processing
- Progress indicators where appropriate

### Empty States
```javascript
// ✅ Always show helpful empty states
if (songs.length === 0) {
  return `
    <div class="empty-state">
      <svg>...</svg>
      <h3>No Songs Yet</h3>
      <p>Add music to get started</p>
    </div>
  `;
}
```

### Animations
- Use for state changes (hover, click, appear)
- Keep under 300ms for UI feedback
- Use cubic-bezier for natural motion
- Only animate `transform` and `opacity`

---

## Error Handling

### Always Handle Errors
```javascript
// ✅ Good - Proper error handling
async function loadPlaylist(id) {
  try {
    const playlist = await getPlaylist(id);
    renderPlaylist(playlist);
  } catch (error) {
    console.error('Error loading playlist:', error);
    alert('Failed to load playlist. Please try again.');
  }
}

// ❌ Bad - Silent failure
async function loadPlaylist(id) {
  const playlist = await getPlaylist(id);
  renderPlaylist(playlist);
}
```

### Error Messages
- User-friendly, not technical
- Suggest next steps when possible
- Log details to console for debugging

---

## Comments & Documentation

### When to Comment
```javascript
// ✅ Good - Complex logic explained
// Calculate time ago using progressive units
// Falls back from seconds → minutes → hours → days
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  // ... more logic
}

// ❌ Bad - Obvious comment
// Get the song ID
const id = song.id;
```

### JSDoc for Exports
```javascript
/**
 * Renders the song list table
 * @param {Array<Song>} songs - Array of song objects
 * @param {Function} onPlaySong - Callback when play button clicked
 */
export function renderSongs(songs, onPlaySong) {
  // ...
}
```

### Section Separators
```javascript
// ============================================
// Statistics APIs
// ============================================
```

---

## Git Workflow

### Commit Messages
```
feat: add playlist detail view with song list
fix: resolve duplicate export error in ui.js
chore: update dependencies to latest versions
refactor: split ui.js into separate view files
```

### Commit Frequency
- After each feature completion
- After each bug fix
- Before major refactors
- Keep commits focused and atomic

### Branch Strategy
- `main` - production ready
- Feature branches for large changes
- Squash merge for clean history

---

## Testing & Quality

### Before Committing
- [ ] No console errors in browser
- [ ] All features work as expected
- [ ] No files exceed 1000 lines
- [ ] User-facing text is clear
- [ ] Security: All user input escaped

### Code Review Checklist
- [ ] Follows style guide
- [ ] No security vulnerabilities
- [ ] Error handling in place
- [ ] Performance considerations
- [ ] Comments where needed

---

## Don't Do This

### Anti-Patterns to Avoid
```javascript
// ❌ Global pollution
window.mySongs = songs;

// ❌ Magic numbers
setTimeout(callback, 5000);  // What's 5000?

// ❌ Deeply nested code
if (a) {
  if (b) {
    if (c) {
      // Too deep!
    }
  }
}

// ❌ God objects/functions
function handleEverything() {
  // 500 lines of mixed concerns
}

// ❌ Mutable shared state
let sharedData = {};

// ❌ Mixing concerns
function renderAndSavePlaylist() {
  // Should be two functions
}
```

---

## Questions?

When in doubt:
1. Keep it simple
2. Follow existing patterns
3. Prioritize readability
4. Test your changes
5. Ask for review if unsure
