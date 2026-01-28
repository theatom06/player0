# Player0 Project Overview

This document provides a summary of the Player0 project, a self-hosted web music player.

## Project Structure

The project is divided into two main parts:

-   **`backend/`**: A Node.js application built with Bun and Express. It is responsible for:
    -   Scanning music libraries and extracting metadata.
    -   Streaming audio files to the frontend.
    -   Storing metadata in JSON files.
    -   Providing a RESTful API for the frontend.
-   **`public/`**: A vanilla JavaScript single-page application (SPA) that provides the user interface for the music player. It features:
    -   Library browsing, searching, and filtering.
    -   Playlist management.
    -   An audio player with queue management.
    -   Offline support via a service worker.

## Key Technologies

-   **Backend**:
    -   [Bun](https://bun.sh/): JavaScript runtime and toolkit.
    -   [Express](https://expressjs.com/): Web framework for Node.js.
    -   [music-metadata](https://github.com/Borewit/music-metadata): Library for reading music metadata from audio files.
    -   [node-id3](https://github.com/Zazama/node-id3): Library for reading and writing ID3 tags.
-   **Frontend**:
    -   Vanilla JavaScript (ES modules).
    -   HTML5 and CSS3.
    -   Service Worker for offline caching.

## Getting Started

1.  **Install dependencies:**
    ```bash
    bun install --cwd backend
    ```
2.  **Configure the application:**
    -   Edit `backend/config.json` to specify your music directories and other settings.
3.  **Start the server:**
    ```bash
    bun run --cwd backend start
    ```
4.  **Scan your music library:**
    ```bash
    bun run --cwd backend scan
    ```
5.  Open the application in your browser at the URL provided by the server (default: `http://localhost:3000`).

## Deployment

For production, it is recommended to:

1.  Build the minified frontend assets:
    ```bash
    bun run --cwd backend build
    ```
2.  Serve the `dist/` directory with a static server like Nginx or Caddy.
3.  Reverse proxy API requests (`/api/*` and `/api/stream/*`) to the backend server.

For more details, refer to the main `README.md` file.

## Frontend Architecture

The frontend is a single-page application (SPA) built with vanilla JavaScript (ES modules). It follows a modular architecture, with different files responsible for specific features.

### Core Concepts

-   **`app.js`**: The main entry point for the frontend application. It registers the service worker and initializes the application.
-   **`js/app/shell.js`**: The "shell" of the application, responsible for initializing all the major components, including navigation, search, player controls, and the router.
-   **`js/api.js`**: The API client, which provides a set of functions for communicating with the backend API. It includes a simple in-memory cache to reduce redundant requests.
-   **`js/state.js`**: The application's state manager. It provides a single source of truth for the application's state, including the song library, playback status, and play queue.
-   **`js/app/views.js`**: The router, which maps URL hashes to different views and loads the appropriate content.
-   **`js/app/viewSwitcher.js`**: The view switcher, which fetches the HTML for a view, injects it into the DOM, and calls the appropriate function to populate it with data.

### Features

-   **Library (`js/app/library.js`)**:
    -   Fetches and displays the entire music library.
    -   Provides functionality for sorting and filtering the library.
    -   Handles playing all or a shuffled selection of the library.
-   **Albums (`js/app/albums.js`)**:
    -   Fetches and displays a list of all albums.
    -   Provides a detail view for each album, showing its songs.
-   **Artists (`js/app/artists.js`)**:
    -   Fetches and displays a list of all artists.
    -   Clicking on an artist filters the library to show only their songs.
-   **Playlists (`js/app/playlists.js`)**:
    -   Manages both user-created and "smart" playlists (e.g., based on BPM).
    -   Provides functionality for creating, editing, and deleting playlists.
    -   Allows users to add and remove songs from playlists.
    -   Includes a modal for adding songs to playlists.
-   **Statistics (`js/app/stats.js`)**:
    -   Fetches and displays various listening statistics, such as most played songs and recently played songs.
    -   Provides an option to export statistics as a CSV file.
-   **Settings (`js/app/settings.js`)**:
    -   Allows users to customize the application's appearance, including the color theme and animations.
    -   Provides options for importing and exporting data (statistics and playlists).
    -   Allows users to view and edit the server configuration.
-   **Player (`js/player.js` and `js/app/playerSetup.js`)**:
    -   Manages the audio player, including playback controls, volume, and the progress bar.
    -   Updates the UI with the currently playing song's information.
-   **Search (`js/app/search.js`)**:
    -   Provides a search bar for finding songs, artists, and albums.
    -   Includes an advanced search feature for more specific queries.
-   **Lyrics (`js/app/lyrics.js`)**:
    -   Fetches and displays lyrics for the currently playing song.
-   **UI Components**:
    -   The application is built with a set of reusable UI components, including modals, dropdowns, and a song row component. These are managed by files in the `js/app` and `js/components` directories.