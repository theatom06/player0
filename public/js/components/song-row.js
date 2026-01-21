import { escapeHtml, formatDuration, lazyImageHtml } from '../utils.js';
import { songCoverUrl } from '../api.js';

export function buildSongRowHtml(song, index, options) {
  const opts = options || {};
  const context = opts.context || 'library';

  const title = song?.title || 'Unknown';
  const artistName = song?.artist || 'Unknown Artist';
  const albumTitle = song?.album || 'Unknown Album';
  const truncatedAlbum = albumTitle.length > 30 ? `${albumTitle.substring(0, 30)}...` : albumTitle;
  const playCount = Number(song?.playCount) || 0;
  const durationText = formatDuration(song?.duration);
  const copyText = `${title} — ${artistName}`;

  const showTrack = Boolean(opts.showTrack);
  const showDrag = Boolean(opts.showDrag);
  const showPlays = Boolean(opts.showPlays);
  const includeRemoveFromPlaylist = Boolean(opts.includeRemoveFromPlaylist);

  const coverHtml = lazyImageHtml(songCoverUrl(song.id), title, 'song-cover');
  const trackHtml = showTrack ? `<td class="col-track">${escapeHtml(song.trackNumber || '-')}</td>` : '';
  const dragHtml = showDrag
    ? `
    <td class="col-drag">
      <span class="playlist-drag-handle" draggable="true" aria-label="Drag to reorder">⋮⋮</span>
    </td>`
    : '';

  const playsTdHtml = showPlays ? `<td class="col-plays">${playCount}</td>` : '';
  const removeHtml = includeRemoveFromPlaylist
    ? `
          <div class="dropdown-sep" role="separator"></div>
          <button class="dropdown-item is-danger remove-from-playlist-btn" type="button" data-song-id="${song.id}">Remove from playlist</button>`
    : '';

  return `
    ${dragHtml}
    ${trackHtml}
    <td class="col-play">
      <button class="play-button" data-index="${index}">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </td>
    <td class="col-cover">
      ${coverHtml}
    </td>
    <td class="col-title">
      <div class="song-title-row">
        <div class="song-title-text">${escapeHtml(title)}</div>
        <div class="song-subtitle">
          <span class="song-sub-artist">${escapeHtml(artistName)}</span>
          <span class="song-sub-sep">•</span>
          <span class="song-sub-album" title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedAlbum)}</span>
          <span class="song-sub-sep">•</span>
          <span class="song-sub-plays">${playCount} plays</span>
        </div>
      </div>
    </td>
    <td class="col-artist">${escapeHtml(artistName)}</td>
    <td class="col-album" title="${escapeHtml(albumTitle)}">${escapeHtml(truncatedAlbum)}</td>
    <td class="col-duration">${escapeHtml(durationText)}</td>
    ${playsTdHtml}
    <td class="col-add">
      <div class="dropdown">
        <button class="dropdown-trigger is-compact" type="button" data-dropdown-trigger aria-haspopup="menu" aria-expanded="false" title="Song actions">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
        <div class="dropdown-menu" role="menu">
          <button class="dropdown-item song-row-play-btn" type="button">Play</button>
          <button class="dropdown-item song-row-play-next-btn" type="button" data-song-id="${song.id}" data-song-index="${index}" data-song-context="${context}">Play next</button>
          <button class="dropdown-item song-row-queue-btn" type="button" data-song-id="${song.id}" data-song-index="${index}" data-song-context="${context}">Add to queue</button>
          <div class="dropdown-sep" role="separator"></div>
          <button class="dropdown-item add-to-playlist-btn" type="button" data-song-id="${song.id}">Add to playlist</button>
          <button class="dropdown-item song-edit-bpm-btn" type="button" data-song-id="${song.id}" data-song-index="${index}" data-song-context="${context}">Edit BPM</button>
          <button class="dropdown-item song-copy-btn" type="button" data-copy-text="${escapeHtml(copyText)}">Copy title + artist</button>
          ${removeHtml}
        </div>
      </div>
    </td>
  `;
}
