// UI Rendering Module
import { formatDuration, escapeHtml } from './utils.js';
import { API_URL, songCoverUrl, albumCoverUrl } from './API.js';

/**
 * Renders the song list
 * @param {Array<any>} songs - The list of songs to render
 * @param {Function} onPlaySong - Callback when play button is clicked
 */
export function renderSongs(songs, onPlaySong) {
  const tbody = document.getElementById('songTableBody');

  if (!tbody) return;

  tbody.innerHTML = '';
  
  if (songs.length === 0) {
    tbody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-state">
        <div class="empty-state-content">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
            <path d="M9 18V5l12-2v13M9 18l-5 1V6l5-1M9 18l5-1m0-13V6"/>
          </svg>
          <h3>No Songs Found</h3>
          <p>Click "Scan Library" to add your music</p>
        </div>
      </td>
    </tr>`;

    return;
  }
  
  songs.forEach((song, index) => {
    const tr = document.createElement('tr');
    const albumTitle = song.album || 'Unknown Album';
    const truncatedAlbum = albumTitle.length > 30 ? albumTitle.substring(0, 30) + '...' : albumTitle;
    tr.innerHTML = `
      <td class="col-play">
        <button class="play-button" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </td>
      <td class="col-cover">
        <img class="song-cover" src="${songCoverUrl(song.id)}" alt="${escapeHtml(song.title || 'Unknown')}" onerror="this.style.display='none';" />
      </td>
      <td class="col-title">${escapeHtml(song.title || 'Unknown')}</td>
      <td class="col-artist">${escapeHtml(song.artist || 'Unknown Artist')}</td>
      <td class="col-album" title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedAlbum)}</td>
      <td class="col-duration">${formatDuration(song.duration)}</td>
      <td class="col-plays">${song.playCount || 0}</td>
      <td class="col-add">
        <button class="add-to-playlist-btn" data-song-id="${song.id}" title="Add to Playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </td>
    `;
    
    // Add event listeners
    tr.querySelector('.play-button').addEventListener('click', () => onPlaySong(index));
    tr.addEventListener('dblclick', () => onPlaySong(index));
    
    tbody.appendChild(tr);
  });
}

/**
 * Render albums grid
 * @param {Array<any>} albums - The list of albums
 * @param {Function} onAlbumClick - Callback when album is clicked
 */
export function renderAlbums(albums, onAlbumClick) {
  const grid = document.getElementById('albumGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (albums.length === 0) {
    grid.innerHTML = `<div class="empty-state-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <h3>No Albums Found</h3>
      <p>Your albums will appear here once you scan your library</p>
    </div>`;
    return;
  }
  
  albums.forEach(album => {
    const card = document.createElement('div');
    card.className = 'album-card';
    const coverUrl = album.songs && album.songs[0] ? albumCoverUrl(album.songs[0].id) : '';
    const albumTitle = album.album || 'Unknown Album';
    const truncatedTitle = albumTitle.length > 25 ? albumTitle.substring(0, 25) + '...' : albumTitle;
    card.innerHTML = `
      <div class="album-cover-wrapper">
        <img class="album-artwork" src="${coverUrl}" alt="${escapeHtml(albumTitle)}" onerror="this.style.display='none';" />
        <div class="album-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
      </div>
      <h3 title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedTitle)}</h3>
      <p>${escapeHtml(album.artist || 'Unknown Artist')}</p>
      <p style="font-size: 12px; margin-top: 4px;">${album.songCount} songs</p>
    `;
    card.addEventListener('click', () => onAlbumClick(album.artist, album.album));
    grid.appendChild(card);
  });
}

/**
 * Render album detail view
 * @param {any} album - The album data
 * @param {Function} onPlaySong - Callback when song is played
 */
export function renderAlbumDetail(album, onPlaySong) {
  document.getElementById('albumTitle').textContent = album.album;
  document.getElementById('albumArtist').textContent = album.artist;
  document.getElementById('albumMeta').textContent = `${album.year || 'Unknown Year'} • ${album.songs.length} songs • ${formatDuration(album.duration)}`;
  
  // Set album artwork
  const albumArtwork = document.getElementById('albumArtwork');
  albumArtwork.style.display = 'block';
  if (album.songs && album.songs[0]) {
    albumArtwork.onerror = () => {
      albumArtwork.style.display = 'none';
    };
    albumArtwork.src = albumCoverUrl(album.songs[0].id);
  } else {
    albumArtwork.style.display = 'none';
  }
  
  const tbody = document.getElementById('albumSongTableBody');
  tbody.innerHTML = '';
  
  album.songs.forEach((song, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-track">${song.trackNumber || '-'}</td>
      <td class="col-play">
        <button class="play-button" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </td>
      <td class="col-title">${escapeHtml(song.title)}</td>
      <td class="col-duration">${formatDuration(song.duration)}</td>
    `;
    
    tr.querySelector('.play-button').addEventListener('click', () => onPlaySong(index));
    tr.addEventListener('dblclick', () => onPlaySong(index));
    
    tbody.appendChild(tr);
  });
}

/**
 * Render artists list
 * @param {Array<any>} artists - The list of artists
 * @param {Function} onArtistClick - Callback when artist is clicked
 */
export function renderArtists(artists, onArtistClick) {
  const list = document.getElementById('artistList');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (artists.length === 0) {
    list.innerHTML = `<div class="empty-state-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <h3>No Artists Found</h3>
      <p>Artists will appear here after scanning your music</p>
    </div>`;
    return;
  }
  
  artists.forEach(artist => {
    const item = document.createElement('div');
    item.className = 'artist-item';
    item.innerHTML = `
      <div>
        <div class="artist-name">${escapeHtml(artist.name)}</div>
        <div class="artist-meta">${artist.songCount} songs • ${artist.albumCount} albums</div>
      </div>
    `;
    item.addEventListener('click', () => onArtistClick(artist.name));
    list.appendChild(item);
  });
}

/**
 * Render playlists grid
 * @param {Array<any>} playlists - The list of playlists
 */
export function renderPlaylists(playlists) {
  const grid = document.getElementById('playlistGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (!playlists || playlists.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <h3>No Playlists Yet</h3>
        <p>Create your first playlist to organize your music</p>
      </div>`;
    return;
  }
  
  playlists.forEach(playlist => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-cover">
        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
        </svg>
      </div>
      <div class="playlist-info">
        <h3>${escapeHtml(playlist.name)}</h3>
        <p>${playlist.songCount || 0} songs</p>
      </div>
    `;
    
    card.addEventListener('click', () => {
      if (window.loadPlaylistDetail) {
        window.loadPlaylistDetail(playlist.id);
      }
    });
    
    grid.appendChild(card);
  });
}

/**
 * Render statistics
 * @param {any} stats - The statistics data
 */
export function renderStats(stats) {
  const layout = document.getElementById('statsLayout');
  if (!layout) return;
  
  // Check if we have any data
  const hasData = stats && stats.totalSongs > 0;
  
  if (!hasData) {
    layout.innerHTML = `<div class="empty-state-content" style="grid-column: 1 / -1;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
        <path d="M3 3v18h18"/>
        <path d="M7 16V9M12 16V6M17 16v-4"/>
      </svg>
      <h3>No Statistics Yet</h3>
      <p>Start playing some music to see your stats</p>
    </div>`;
    return;
  }

  const PREVIEW_COUNT = 5;
  const mostPlayedPreview = (stats.mostPlayed || []).slice(0, PREVIEW_COUNT);
  const recentlyPlayedPreview = (stats.recentlyPlayed || []).slice(0, PREVIEW_COUNT);

  layout.innerHTML = `
    <div class="stat-tile tile-most" role="button" tabindex="0" aria-label="Most Played Songs" data-stats-action="modal" data-stats-modal="mostPlayed">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Most Played</div>
        <div class="stat-tile-hint">Open list</div>
      </div>
      <div class="stat-preview">
        ${mostPlayedPreview.length ? mostPlayedPreview.map(song => `
          <div class="stat-preview-item">
            <div style="min-width: 0;">
              <div class="stat-preview-primary">${escapeHtml(song.title || 'Unknown')}</div>
              <div class="stat-preview-secondary">${escapeHtml(song.artist || 'Unknown Artist')}</div>
            </div>
            <div class="stat-preview-right">${song.playCount || 0} plays</div>
          </div>
        `).join('') : `
          <div class="stat-preview-item">
            <div style="min-width: 0;">
              <div class="stat-preview-primary">No plays recorded</div>
              <div class="stat-preview-secondary">Play some music to populate this</div>
            </div>
          </div>
        `}
      </div>
    </div>

    <div class="stat-tile tile-songs" role="button" tabindex="0" aria-label="Open Songs" data-stats-action="navigate" data-stats-target="library">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Songs</div>
        <div class="stat-tile-value">${stats.totalSongs || 0}</div>
      </div>
      <div class="stat-tile-hint">Open songs</div>
    </div>

    <div class="stat-tile tile-artists" role="button" tabindex="0" aria-label="Open Artists" data-stats-action="navigate" data-stats-target="artists">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Artists</div>
        <div class="stat-tile-value">${stats.uniqueArtists || 0}</div>
      </div>
      <div class="stat-tile-hint">Open artists</div>
    </div>

    <div class="stat-tile tile-albums" role="button" tabindex="0" aria-label="Open Albums" data-stats-action="navigate" data-stats-target="albums">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Albums</div>
        <div class="stat-tile-value">${stats.uniqueAlbums || 0}</div>
      </div>
      <div class="stat-tile-hint">Open albums</div>
    </div>

    <div class="stat-tile tile-playlists" role="button" tabindex="0" aria-label="Open Playlists" data-stats-action="navigate" data-stats-target="playlists">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Playlists</div>
        <div class="stat-tile-value">${stats.totalPlaylists || 0}</div>
      </div>
      <div class="stat-tile-hint">Open playlists</div>
    </div>

    <div class="stat-tile tile-genres" role="button" tabindex="0" aria-label="Genres" data-stats-action="modal" data-stats-modal="genres">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Genres</div>
        <div class="stat-tile-value">${stats.uniqueGenres || 0}</div>
      </div>
      <div class="stat-tile-hint">Open list</div>
    </div>

    <div class="stat-tile tile-totals" role="button" tabindex="0" aria-label="Totals" data-stats-action="modal" data-stats-modal="summary">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Totals</div>
        <div class="stat-tile-value">${stats.totalPlays || 0}</div>
      </div>
      <div class="stat-tile-hint">${escapeHtml(formatDuration(stats.totalDuration || 0))} • open details</div>
    </div>

    <div class="stat-tile tile-recent" role="button" tabindex="0" aria-label="Recently Played" data-stats-action="modal" data-stats-modal="recentlyPlayed">
      <div class="stat-tile-header">
        <div class="stat-tile-title">Recently Played</div>
        <div class="stat-tile-hint">Open list</div>
      </div>
      <div class="stat-preview">
        ${recentlyPlayedPreview.length ? recentlyPlayedPreview.map(play => {
          const timeAgo = play.playedAt ? getTimeAgo(new Date(play.playedAt)) : '';
          return `
            <div class="stat-preview-item">
              <div style="min-width: 0;">
                <div class="stat-preview-primary">${escapeHtml(play.title || 'Unknown')}</div>
                <div class="stat-preview-secondary">${escapeHtml(play.artist || 'Unknown Artist')}</div>
              </div>
              <div class="stat-preview-right">${escapeHtml(timeAgo)}</div>
            </div>
          `;
        }).join('') : `
          <div class="stat-preview-item">
            <div style="min-width: 0;">
              <div class="stat-preview-primary">No recent plays</div>
              <div class="stat-preview-secondary">Start playing music to populate this</div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function renderPlaylistDetail(playlist, songs) {
  const nameEl = document.getElementById('playlistDetailName');
  const descEl = document.getElementById('playlistDetailDescription');
  const tbody = document.getElementById('playlistDetailTableBody');
  
  if (!tbody || !nameEl || !descEl) return;
  
  // Set playlist info
  nameEl.textContent = playlist.name || 'Untitled Playlist';
  descEl.textContent = playlist.description || `${songs.length} songs`;
  
  // Clear table
  tbody.innerHTML = '';
  
  // Empty state
  if (!songs || songs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <h3>No Songs in This Playlist</h3>
            <p>Add songs using the + button in your library</p>
          </div>
        </td>
      </tr>`;
    return;
  }
  
  // Render each song
  songs.forEach((song, index) => {
    const tr = document.createElement('tr');
    const albumTitle = song.album || 'Unknown Album';
    const truncatedAlbum = albumTitle.length > 30 ? albumTitle.substring(0, 30) + '...' : albumTitle;
    
    tr.innerHTML = `
      <td class="col-play">
        <button class="play-button" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </td>
      <td class="col-cover">
        <img class="song-cover" src="${songCoverUrl(song.id)}" alt="${escapeHtml(song.title || 'Unknown')}" onerror="this.style.display='none';" />
      </td>
      <td class="col-title">${escapeHtml(song.title || 'Unknown')}</td>
      <td class="col-artist">${escapeHtml(song.artist || 'Unknown Artist')}</td>
      <td class="col-album" title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedAlbum)}</td>
      <td class="col-duration">${formatDuration(song.duration)}</td>
      <td class="col-remove">
        <button class="remove-from-playlist-btn" data-song-id="${song.id}" title="Remove from playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Add play button handlers
  tbody.querySelectorAll('.play-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      if (window.onPlaySongFromPlaylist) {
        window.onPlaySongFromPlaylist(songs, index);
      }
    });
  });
}

