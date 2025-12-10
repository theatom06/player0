# Changelog - December 10, 2025

## UI/UX Improvements

### Header & Search
- ✨ Redesigned header layout with left-aligned search bar
- 🎨 Animated search bar expansion on focus (1s smooth transition)
- ⌨️ Added keyboard shortcuts button with modal
- 🔍 Updated advanced search icon to magnifying glass with plus
- 💚 Active state indicator for advanced search (green fill with animation)

### Keyboard Shortcuts
- Added comprehensive keyboard shortcuts system:
  - `Space` - Play/Pause
  - `→` - Next Track
  - `←` - Previous Track  
  - `↑` - Volume Up
  - `↓` - Volume Down
  - `Ctrl/⌘ K` - Focus Search
  - `Ctrl/⌘ P` - Show Shortcuts Menu
  - `Esc` - Close Modal
- Created clean shortcuts modal with inline code blocks

### Animations
- 🎬 Added smooth animations throughout the app:
  - **Song table rows**: Lift effect with shadow on hover (0.3s cubic-bezier)
  - **Album/Artist cards**: Scale and lift animation (0.4s)
  - **Modals**: Fade-in with scale animation
  - **Now Playing Sidebar**: Slide in/out from right (0.4s)
  - **Mini Player**: Slide up/down animation (0.4s)
  - **Album covers**: Zoom effect on hover (1.1x scale)
  - **Navigation items**: Slide and icon rotation on hover
  - **Play buttons**: Pulse effect
- Removed background color changes during animations for cleaner look

### Layout & Design
- 📱 Centered sidebar logo properly
- 📍 Positioned scan library button at bottom (10px margins)
- 🎵 Added mini player progress bar at top with rounded right edge
- 📏 Added padding to content areas to prevent mini player cutoff (100px bottom padding)
- 🎨 Fixed navigation icon transitions and hover effects

## Functionality Improvements

### Statistics & Playback
- ✅ Fixed recently played feature - now enriches play history with song metadata
- 🎵 Added click-to-play functionality for statistics view songs
- ⏱️ Implemented "time ago" display for recently played (e.g., "2h ago", "1d ago")
- 🎯 Made all songs in stats clickable and playable

### Player Features
- 🎵 Now playing sidebar shows on first song play
- 🔄 Smooth transitions between sidebar and mini player views
- 📊 Mini player displays real-time progress bar

## Backend Security Improvements

### Input Validation
- ✅ Added ID format validation (alphanumeric and hyphens only) for:
  - Song retrieval endpoints
  - Stream endpoint
  - Cover art endpoint
  - Play recording endpoint
- ✅ Validated playlist creation inputs:
  - Name length limit (200 chars)
  - Description length limit (1000 chars)
  - Song IDs array validation
- ✅ Added duration validation for play recording
- ✅ Enhanced file path security checks (absolute path validation)

### Data Protection
- 🔒 Prevented path traversal attacks
- 🛡️ Sanitized all user inputs
- ✅ Added proper error handling with safe error messages

## Technical Improvements

### Code Organization
- 📦 Maintained modular architecture:
  - `state.js` - State management
  - `player.js` - Audio playback
  - `ui.js` - Rendering functions
  - `API.js` - API calls
  - `utils.js` - Helper functions
- 🎨 Split CSS into 7 modular files:
  - `base.css`, `sidebar.css`, `header.css`
  - `library.css`, `views.css`, `player.css`, `components.css`

### Performance
- ⚡ Optimized animations with hardware-accelerated transforms
- 🎯 Used cubic-bezier easing for smooth transitions
- 📈 Improved play history enrichment efficiency

## Bug Fixes
- 🐛 Fixed recently played not displaying song information
- 🐛 Fixed content being cut off by mini player
- 🐛 Fixed sidebar logo alignment
- 🐛 Fixed mini player progress bar not syncing
- 🐛 Fixed navigation hover states
- 🐛 Fixed album cover zoom overflow

## Security Vulnerabilities Fixed

### 🔒 Critical Issues Resolved

#### 1. **Missing CORS Configuration**
- **Risk**: Any website could make requests to your API
- **Fix**: Configured CORS with optional origin restriction via environment variable
- **Impact**: Prevents unauthorized cross-origin requests

#### 2. **No Request Size Limits**
- **Risk**: DoS attacks via massive JSON payloads
- **Fix**: Added 10MB limit on JSON and URL-encoded bodies
- **Impact**: Prevents memory exhaustion attacks

#### 3. **Missing Security Headers**
- **Risk**: XSS, clickjacking, and MIME-sniffing attacks
- **Fix**: Added security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security` for HTTPS
- **Impact**: Hardens browser security

#### 4. **Insufficient Input Validation**
- **Risk**: Injection attacks, DoS via large inputs
- **Fixes Applied**:
  - Search query length limits (100 chars)
  - Year range validation (1900-2100)
  - Album/artist parameter limits (200 chars)
  - Playlist name/description limits (200/1000 chars)
  - Song array size limits (1000 max)
  - History limit validation (1-1000)
- **Impact**: Prevents malformed or malicious inputs

#### 5. **Duplicate Routes**
- **Risk**: Confusion and potential security bypasses
- **Fix**: Removed duplicate playlist creation route
- **Impact**: Cleaner, more maintainable codebase

#### 6. **Missing Route for GET Playlists**
- **Risk**: API inconsistency
- **Fix**: Added proper GET /api/playlists route
- **Impact**: Complete REST API implementation

### Production Recommendations
- Configure `ALLOWED_ORIGINS` environment variable for CORS
- Use HTTPS in production with reverse proxy
- Consider rate limiting for public deployments
- Keep dependencies updated regularly

## Project Information
- **Project Name**: Player 0
- **Version**: Enhanced UI with Security Updates
- **Date**: December 10, 2025
