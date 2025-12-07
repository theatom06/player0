# Project 0 - Music Player Server

A full-featured music server with advanced library management, playback, and statistics.

## Features

- 🎵 Automatic music library scanning with ID3 tag extraction
- 🔍 Advanced search (by title, artist, album, genre, year)
- 📊 Listening statistics and analytics
- 📝 Playlist creation and management
- 💿 Album browsing and playback
- 🎧 Now playing sidebar with queue management
- 🎼 Audio streaming over HTTP

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

## Default Port

Server runs on http://localhost:3000
