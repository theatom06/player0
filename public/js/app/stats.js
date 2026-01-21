import { formatDuration } from '../utils.js';
import { fetchAllSongs, getStats, songCoverUrl } from '../api.js';
import { setCurrentSongs } from '../state.js';
import { renderStats } from '../ui.js';
import { playSongFromList } from './library.js';

let latestStats = null;

export async function loadStats() {
  try {
    latestStats = await getStats();
    renderStats(latestStats);

    const layout = document.getElementById('statsLayout');
    if (!layout) return;

    const activateTile = async (tile) => {
      try {
        const stats = latestStats;
        if (!stats) return;

        const action = tile.dataset.statsAction;
        const target = tile.dataset.statsTarget;
        const modalKey = tile.dataset.statsModal;

        if (action === 'navigate' && target) {
          window.location.hash = `#/${target}`;
          return;
        }

        if (action === 'modal' && modalKey) {
          if (modalKey === 'mostPlayed') {
            const items = (stats.mostPlayed || []).map(song => ({
              songId: song.id,
              title: song.title || 'Unknown',
              subtitle: song.artist || 'Unknown Artist',
              rightText: `${song.playCount || 0} plays`
            }));
            await openStatsSongListModal('Most Played Songs', items);
            return;
          }

          if (modalKey === 'recentlyPlayed') {
            const items = (stats.recentlyPlayed || []).map(play => ({
              songId: play.songId,
              title: play.title || 'Unknown',
              subtitle: play.artist || 'Unknown Artist',
              rightText: play.playedAt ? new Date(play.playedAt).toLocaleString() : ''
            }));
            await openStatsSongListModal('Recently Played', items);
            return;
          }

          if (modalKey === 'genres') {
            if (Array.isArray(stats.genreReport) && stats.genreReport.length) {
              const items = stats.genreReport.map(g => ({
                title: g.genre,
                subtitle: `${g.songs} songs • ${g.totalPlays} plays • ${formatDurationLong(g.listeningTime || 0)}`
              }));
              openStatsListModal('Genre Report', items);
              return;
            }

            const songs = await fetchAllSongs();
            const genreCounts = new Map();
            (songs || []).forEach(s => {
              if (!s.genre) return;
              genreCounts.set(s.genre, (genreCounts.get(s.genre) || 0) + 1);
            });
            const genres = Array.from(genreCounts.entries()).sort((a, b) => {
              if (b[1] !== a[1]) return b[1] - a[1];
              return String(a[0]).localeCompare(String(b[0]));
            });
            const items = genres.map(([g, count]) => ({ title: g, subtitle: `${count} songs` }));
            openStatsListModal('Genres', items);
            return;
          }

          if (modalKey === 'summary') {
            const showAlbumReport = () => {
              if (Array.isArray(stats.albumReport) && stats.albumReport.length) {
                const items = stats.albumReport.map(a => ({
                  title: `${a.album} — ${a.artist}`,
                  subtitle: `${a.tracks} tracks • ${a.totalPlays} plays • ${formatDurationLong(a.listeningTime || 0)}`
                }));
                openStatsListModal('Album Report', items);
                return;
              }
              openStatsListModal('Album Report', []);
            };

            const items = [
              { title: 'Total Songs', subtitle: String(stats.totalSongs || 0) },
              { title: 'Artists', subtitle: String(stats.uniqueArtists || 0) },
              { title: 'Albums', subtitle: String(stats.uniqueAlbums || 0) },
              { title: 'Genres', subtitle: String(stats.uniqueGenres || 0) },
              { title: 'Total Playlists', subtitle: String(stats.totalPlaylists || 0) },
              { title: 'Total Plays', subtitle: String(stats.totalPlays || 0) },
              { title: 'Library Duration', subtitle: formatDuration(stats.totalDuration || 0) },
              { title: 'Total Listening Time', subtitle: formatDurationLong(stats.totalListeningTime || 0) },
              { title: 'Album Report', subtitle: 'Open top albums', onClick: showAlbumReport },
              { title: 'Export Stats (CSV)', subtitle: 'Download song-level stats', onClick: () => { void exportStatsCsv(); } }
            ];
            openStatsListModal('Totals', items);
            return;
          }
        }
      } catch (err) {
        console.error('Error activating stats tile:', err);
      }
    };

    if (!layout.dataset.statsBound) {
      layout.dataset.statsBound = '1';
      layout.addEventListener('click', (e) => {
        const tile = e.target?.closest?.('.stat-tile');
        if (!tile) return;
        void activateTile(tile);
      });
      layout.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const tile = e.target?.closest?.('.stat-tile');
        if (!tile) return;
        e.preventDefault();
        void activateTile(tile);
      });
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function openStatsListModal(title, items) {
  const modal = document.getElementById('statsListModal');
  const titleEl = document.getElementById('statsListModalTitle');
  const bodyEl = document.getElementById('statsListModalBody');
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title || 'Statistics';
  bodyEl.innerHTML = '';

  if (!items || items.length === 0) {
    bodyEl.innerHTML = `<div class="stats-list-item"><div class="stats-list-item-title">No items</div><div class="stats-list-item-subtitle">Nothing to show yet</div></div>`;
    modal.style.display = 'flex';
    return;
  }

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'stats-list-item';
    const primary = typeof item === 'string' ? item : (item?.title || item?.primary || '');
    const secondary = typeof item === 'string' ? '' : (item?.subtitle || item?.secondary || '');

    if (typeof item === 'object' && typeof item?.onClick === 'function') {
      el.classList.add('is-clickable');
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.addEventListener('click', () => item.onClick());
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onClick();
        }
      });
    }

    el.innerHTML = `
      <div class="stats-list-item-title">${escapeHtml(String(primary))}</div>
      ${secondary ? `<div class="stats-list-item-subtitle">${escapeHtml(String(secondary))}</div>` : ''}
    `;
    bodyEl.appendChild(el);
  });

  modal.style.display = 'flex';
}

export async function openStatsSongListModal(title, songItems) {
  const modal = document.getElementById('statsListModal');
  const titleEl = document.getElementById('statsListModalTitle');
  const bodyEl = document.getElementById('statsListModalBody');
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title || 'Songs';
  bodyEl.innerHTML = '';

  if (!songItems || songItems.length === 0) {
    bodyEl.innerHTML = `<div class="stats-list-item"><div class="stats-list-item-title">No songs</div><div class="stats-list-item-subtitle">Nothing to show yet</div></div>`;
    modal.style.display = 'flex';
    return;
  }

  songItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'song-list-item';
    row.style.cursor = 'pointer';
    row.dataset.songId = item.songId;
    row.innerHTML = `
      <img src="${songCoverUrl(item.songId)}" alt="Cover" class="song-list-cover" onerror="this.style.display='none'">
      <div style="flex: 1; min-width: 0;">
        <div>${escapeHtml(item.title || 'Unknown')}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(item.subtitle || '')}</div>
      </div>
      ${item.rightText ? `<div style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(item.rightText)}</div>` : ''}
    `;
    row.addEventListener('click', async () => {
      try {
        const songId = row.dataset.songId;
        if (!songId) return;
        const songs = await fetchAllSongs();
        const index = songs.findIndex(s => s.id === songId);
        if (index >= 0) {
          setCurrentSongs(songs);
          playSongFromList(index);
          modal.style.display = 'none';
        }
      } catch (error) {
        console.error('Error playing song from stats modal:', error);
      }
    });
    bodyEl.appendChild(row);
  });

  modal.style.display = 'flex';
}

function downloadTextFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsvValue(value) {
  const text = String(value ?? '');
  if (/[\n\r",]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function exportStatsCsv() {
  const songs = await fetchAllSongs();
  const header = ['id','title','artist','album','genre','year','durationSeconds','playCount','lastPlayed','listeningTimeSeconds'];
  const lines = [header.join(',')];

  (songs || []).forEach(song => {
    const playCount = Number.isFinite(Number(song.playCount)) ? Number(song.playCount) : 0;
    const duration = Number.isFinite(Number(song.duration)) ? Number(song.duration) : 0;
    const listeningTime = playCount * duration;
    const row = [
      song.id,
      song.title || '',
      song.artist || '',
      song.album || '',
      song.genre || '',
      song.year || '',
      duration,
      playCount,
      song.lastPlayed || '',
      listeningTime
    ].map(toCsvValue);
    lines.push(row.join(','));
  });

  const filename = `player0-stats-${new Date().toISOString().slice(0,10)}.csv`;
  downloadTextFile(filename, lines.join('\n'), 'text/csv');
}

function formatDurationLong(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
