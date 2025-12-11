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
  
  if (playlists.length === 0) {
    grid.innerHTML = `<div class="empty-state-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
      </svg>
      <h3>No Playlists Yet</h3>
      <p>Create your first playlist to organize your music</p>
    </div>`;
    return;
  }
  
  playlists.forEach(playlist => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div class="playlist-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
        </svg>
      </div>
      <h3>${escapeHtml(playlist.name)}</h3>
      <p>${playlist.songCount || 0} songs</p>
    `;
    card.dataset.playlistId = playlist.id;
    card.onclick = () => {
      if (window.loadPlaylistDetail) {
        window.loadPlaylistDetail(playlist.id);
      }
    };
    grid.appendChild(card);
  });
}

/**
 * Render statistics
 * @param {any} stats - The statistics data
 */
export function renderStats(stats) {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;
  
  // Check if we have any data
  const hasData = stats && stats.totalSongs > 0;
  
  if (!hasData) {
    grid.innerHTML = `<div class="empty-state-content" style="grid-column: 1 / -1;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
        <path d="M3 3v18h18"/>
        <path d="M7 16V9M12 16V6M17 16v-4"/>
      </svg>
      <h3>No Statistics Yet</h3>
      <p>Start playing some music to see your stats</p>
    </div>`;
    document.getElementById('mostPlayedList').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 24px;">No plays recorded yet</p>';
    document.getElementById('recentlyPlayedList').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 24px;">No recent plays</p>';
    return;
  }
  
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${stats.totalSongs || 0}</div>
      <div class="stat-label">Total Songs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.uniqueArtists || 0}</div>
      <div class="stat-label">Artists</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.uniqueAlbums || 0}</div>
      <div class="stat-label">Albums</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.uniqueGenres || 0}</div>
      <div class="stat-label">Genres</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatDuration(stats.totalDuration || 0)}</div>
      <div class="stat-label">Total Duration</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalPlays || 0}</div>
      <div class="stat-label">Total Plays</div>
    </div>
  `;
  
  // Most played
  const mostPlayedList = document.getElementById('mostPlayedList');
  if (mostPlayedList) {
    mostPlayedList.innerHTML = '';
    if (stats.mostPlayed && stats.mostPlayed.length > 0) {
      stats.mostPlayed.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-list-item';
        item.style.cursor = 'pointer';
        item.innerHTML = `
          <img src="${songCoverUrl(song.id)}" alt="Cover" class="song-list-cover" onerror="this.style.display='none'">
          <div style="flex: 1;">
            <div>${escapeHtml(song.title || 'Unknown')}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(song.artist || 'Unknown Artist')}</div>
          </div>
          <div style="color: var(--text-secondary);">${song.playCount || 0} plays</div>
        `;
        item.dataset.songId = song.id;
        mostPlayedList.appendChild(item);
      });
    } else {
      mostPlayedList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 24px;">No plays recorded yet</p>';
    }
  }
  
  // Recently played
  const recentlyPlayedList = document.getElementById('recentlyPlayedList');
  const expandButton = document.getElementById('recentlyPlayedExpand');
  if (recentlyPlayedList) {
    recentlyPlayedList.innerHTML = '';
    if (stats.recentlyPlayed && stats.recentlyPlayed.length > 0) {
      const INITIAL_SHOW = 5;
      let isExpanded = false;
      
      const renderRecentlyPlayed = (showAll = false) => {
        recentlyPlayedList.innerHTML = '';
        const itemsToShow = showAll ? stats.recentlyPlayed : stats.recentlyPlayed.slice(0, INITIAL_SHOW);
        
        itemsToShow.forEach(play => {
          const item = document.createElement('div');
          item.className = 'song-list-item';
          item.style.cursor = 'pointer';
          const playDate = new Date(play.playedAt);
          const timeAgo = getTimeAgo(playDate);
          item.innerHTML = `
            <img src="${songCoverUrl(play.songId)}" alt="Cover" class="song-list-cover" onerror="this.style.display='none'">
            <div style="flex: 1;">
              <div>${escapeHtml(play.title || 'Unknown')}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(play.artist || 'Unknown Artist')}</div>
            </div>
            <div style="color: var(--text-secondary); font-size: 12px;">${timeAgo}</div>
          `;
          item.dataset.songId = play.songId;
          recentlyPlayedList.appendChild(item);
        });
      };
      
      renderRecentlyPlayed(false);
      
      // Show expand button if there are more than INITIAL_SHOW items
      if (stats.recentlyPlayed.length > INITIAL_SHOW) {
        expandButton.style.display = 'block';
        expandButton.textContent = 'Show More';
        
        expandButton.onclick = () => {
          isExpanded = !isExpanded;
          renderRecentlyPlayed(isExpanded);
          expandButton.textContent = isExpanded ? 'Show Less' : 'Show More';
        };
      } else {
        expandButton.style.display = 'none';
      }
    } else {
      recentlyPlayedList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 24px;">No recent plays</p>';
      expandButton.style.display = 'none';
    }
  }
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
  
  if (!tbody) return;
  
  nameEl.textContent = playlist.name;
  descEl.textContent = playlist.description || `${songs.length} songs`;
  
  tbody.innerHTML = '';
  
  if (songs.length === 0) {
    tbody.innerHTML = `
    <tr>
      <td colspan=\"7\" class=\"empty-state\">
        <div class=\"empty-state-content\">
          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"64\" height=\"64\">
            <path d=\"M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z\"/>
            <path d=\"M21 16c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z\"/>
          </svg>
          <h3>No Songs in Playlist</h3>
          <p>Add songs to this playlist from the library</p>
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
      <td class=\"col-play\">
        <button class=\"play-button\" data-index=\"${index}\">
          <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\">
            <path d=\"M8 5v14l11-7z\"/>
          </svg>
        </button>
      </td>
      <td class=\"col-cover\">
        <img class=\"song-cover\" src=\"${songCoverUrl(song.id)}\" alt=\"${escapeHtml(song.title || 'Unknown')}\" onerror=\"this.style.display='none';\" />
      </td>
      <td class=\"col-title\">${escapeHtml(song.title || 'Unknown')}</td>
      <td class=\"col-artist\">${escapeHtml(song.artist || 'Unknown Artist')}</td>
      <td class=\"col-album\" title=\"${escapeHtml(albumTitle)}\">${escapeHtml(truncatedAlbum)}</td>
      <td class=\"col-duration\">${formatDuration(song.duration)}</td>
      <td class=\"col-remove\">
        <button class=\"remove-from-playlist-btn\" data-song-id=\"${song.id}\" title=\"Remove from playlist\">
          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"16\" height=\"16\">
            <line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line>
            <line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line>
          </svg>
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Add click handlers for play buttons
  const playButtons = tbody.querySelectorAll('.play-button');
  playButtons.forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      if (window.onPlaySongFromPlaylist) {
        window.onPlaySongFromPlaylist(songs, index);
      }
    });
  });
}

