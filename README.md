# Player 0

A modern, full-featured music player with advanced library management, smooth animations, and comprehensive keyboard shortcuts.

## Features

### 🎵 Core Playback
- Automatic music library scanning with ID3 tag extraction
- Audio streaming over HTTP with range request support
- Full playback controls (play, pause, skip, seek, volume)
- Now playing sidebar with queue management
- Mini player with real-time progress indicator
- Album artwork display and extraction

### 🎨 Modern UI/UX
- **Smooth Animations**: Hardware-accelerated transitions throughout
  - Animated search bar expansion on focus
  - Card hover effects with lift and scale
  - Slide transitions for sidebar and mini player
  - Modal fade-in animations
  - Album cover zoom effects
- **Responsive Design**: Clean, modern dark theme interface
- **Keyboard Shortcuts**: Complete keyboard navigation system
  - `Space` - Play/Pause
  - `→` / `←` - Next/Previous Track
  - `↑` / `↓` - Volume Up/Down
  - `Ctrl/⌘ K` - Focus Search
  - `Ctrl/⌘ P` - Show Shortcuts
  - `Esc` - Close Modal

### 🔍 Search & Discovery
- Advanced search (by title, artist, album, genre, year)
- Real-time search with animated expansion
- Fuzzy filtering across multiple fields
- Recently played with time ago display

### 📊 Statistics & Analytics
- Comprehensive listening statistics
- Most played songs with play counts
- Recently played tracks with timestamps
- Clickable stats - play any song from statistics view
- Total plays, duration, and library metrics

### 📝 Organization
- Playlist creation and management
- Album browsing with cover art
- Artist library organization
- Genre classification

### 🔒 Security
- Input validation on all endpoints
- Path traversal protection
- Sanitized user inputs
- Secure file serving with absolute path checks

## Recent Updates (December 10, 2025)

See [CHANGELOG.md](./CHANGELOG.md) for detailed changes including:
- Complete UI/UX overhaul with smooth animations
- Comprehensive keyboard shortcuts system
- Enhanced statistics with recently played
- Backend security improvements
- Mini player with progress indicator
- Fixed content layout issues

## Suggested Future Features

### 🔥 High Priority / Quick Wins
- 🔀 **Shuffle & Repeat Modes** - Essential playback features
- 🎯 **Queue Management** - Add to queue, clear queue, save queue
- 🔊 **Remember Volume** - Save volume level in localStorage
- 🎨 **Dark/Light Theme Toggle** - User preference themes
- 🔍 **Search History** - Remember recent searches
- ⭐ **Favorite/Like Songs** - Quick favorite button on each song
- 📱 **Mobile Responsive Design** - Better mobile experience

### Playback & Audio
- 🔀 Shuffle mode with smart shuffle algorithm
- 🔁 Repeat modes (repeat all, repeat one, no repeat)
- 🎚️ Equalizer with presets (Rock, Pop, Jazz, Classical, etc.)
- ⏩ Playback speed control (0.5x to 2x)
- 🎵 Crossfade between tracks
- 🔊 Volume normalization

### Library Management
- 🏷️ Tag editing from web interface
- 📁 Folder-based browsing
- 🎨 Custom album art upload
- ⭐ Star rating system (1-5 stars)
- 🗑️ Delete songs from library
- 📦 Batch operations

### Search & Discovery
- 🔍 Fuzzy search with typo tolerance
- 🎯 Advanced filters (bitrate, format, duration)
- 📈 Trending songs this week/month
- 🎲 Random discovery
- 🎤 Lyrics display

### Playlists
- 📋 Drag-and-drop reordering
- 🔀 Smart playlists with auto-rules
- 📤 Export playlists (M3U, PLS)
- 📥 Import playlists
- 📌 Pin favorites

### Visualization & UI
- 🎨 Theme customization (dark/light/custom)
### Advanced
- 🔐 User authentication
- 🌐 Remote access
- 📱 Mobile/Desktop apps
- 🔌 API for integrations
- ☁️ Cloud storage sync
- 🔗 Spotify/YouTube import
- 🎙️ Voice control

### 🎯 Most Requested Features
1. **Shuffle/Repeat** - Can't believe this isn't here yet!
2. **Keyboard Controls** - Power users will love this
3. **Queue Management** - See and manage what's playing next
4. **Dark Mode Toggle** - Let users choose their theme
5. **Mobile Support** - Make it work great on phones
6. **Lyrics Display** - Show synchronized lyrics
7. **Sleep Timer** - Auto-stop after X minutes
8. **Recently Played** - Quick access to history
9. **Smart Search** - Fuzzy matching for typos
10. **Export/Import** - Backup playlists and settings

### 💡 Unique/Creative Features
- 🎲 **Discovery Mode** - Play random songs you haven't heard in a while
- 🎵 **Mood Playlists** - Auto-generate based on tempo/genre
- 📊 **Year in Review** - Annual listening statistics summary
- 🎮 **Music Quiz Game** - Guess the song from snippet
- 🎨 **Album Art Screensaver** - Display album art when idle
- 🌈 **Color Theme from Album Art** - Dynamic UI colors
- 🎧 **Focus Mode** - Minimal UI, just music
- 📻 **Radio Stations** - Create genre-based radio
- 🎼 **BPM Detection** - Auto-tag songs with tempo
- 🔔 **New Music Notifications** - Alert when new songs addedbums/genres reports
- ⏱️ Total listening time
- 📅 Calendar view
- 📊 Export statistics to CSV

### Advanced
- 🔐 User authentication
- 🌐 Remote access
- 📱 Mobile/Desktop apps
- 🔌 API for integrations
- ☁️ Cloud storage sync
- 🔗 Spotify/YouTube import
- 🎙️ Voice control

## Tech Stack

- **Backend**: Node.js/Bun.js with Express and SQLite
- **Frontend**: Plain HTML, CSS, and JavaScript
- **Audio**: music-metadata for tag extraction, HTTP streaming
- **Database**: better-sqlite3 for music metadata

## Setup

### Install dependencies
```bash
npm install
# or with bun
bun install
```

### Run the server
```bash
npm start
# or with bun
bun run start
```

## Configuration

Edit `config.json` to set your music directories.

You can specify multiple directories as an array:
```json
{
  "musicDirectories": [
    "/path/to/your/music1",
    "/path/to/your/music2"
  ]
}
```

## Default Port

Server runs on http://localhost:3000
