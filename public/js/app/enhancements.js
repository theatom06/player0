/**
 * ============================================
 * UI Enhancements Module
 * ============================================
 * 
 * Provides advanced UI features:
 * - Album art blur background
 * - Dynamic colors from album art
 * - Smooth view transitions
 * - Context menus
 * - Search filter pills
 * - Similar songs suggestions
 * - Activity heatmap
 * - Top cards
 * - Mini player
 * - Swipe gestures
 * - Toast notifications
 */

import { AppState } from '../state.js';
import { songCoverUrl } from '../API.js';

// Helper to get cover URL
const API = {
  getCoverUrl: (songId) => songCoverUrl(songId)
};

// ============================================
// Album Art Blur Background
// ============================================
export function initBlurBackground() {
  const blurBg = document.createElement('div');
  blurBg.className = 'album-blur-bg';
  document.body.prepend(blurBg);
  
  // Update blur background when song changes
  document.addEventListener('songChanged', (e) => {
    const song = e.detail;
    if (song && song.id) {
      const coverUrl = API.getCoverUrl(song.id);
      blurBg.style.setProperty('--album-bg-image', `url('${coverUrl}')`);
      blurBg.classList.add('has-image');
    } else {
      blurBg.classList.remove('has-image');
    }
  });
}

// ============================================
// Dynamic Colors from Album Art
// ============================================
let colorWorker = null;

export function extractDominantColors(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Sample at small size for performance
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      
      try {
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        const colors = analyzeColors(imageData);
        resolve(colors);
      } catch (e) {
        resolve({ primary: '#7aa2ff', secondary: '#888', accent: '#7aa2ff' });
      }
    };
    
    img.onerror = () => {
      resolve({ primary: '#7aa2ff', secondary: '#888', accent: '#7aa2ff' });
    };
    
    img.src = imageUrl;
  });
}

function analyzeColors(imageData) {
  const colorCounts = {};
  
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    
    // Skip very dark or very light colors
    const brightness = (r + g + b) / 3;
    if (brightness < 30 || brightness > 225) continue;
    
    // Quantize to reduce color count
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    
    const key = `${qr},${qg},${qb}`;
    colorCounts[key] = (colorCounts[key] || 0) + 1;
  }
  
  // Sort by frequency
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => {
      const [r, g, b] = color.split(',').map(Number);
      return { r, g, b };
    });
  
  if (sortedColors.length === 0) {
    return { primary: '#7aa2ff', secondary: '#888', accent: '#7aa2ff' };
  }
  
  // Find most vibrant color for accent
  const vibrant = sortedColors.reduce((best, color) => {
    const saturation = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
    const bestSaturation = Math.max(best.r, best.g, best.b) - Math.min(best.r, best.g, best.b);
    return saturation > bestSaturation ? color : best;
  }, sortedColors[0]);
  
  // Ensure we have a decent primary that isn't too dark
  let primary = sortedColors[0];
  const primaryLum = (primary.r * 299 + primary.g * 587 + primary.b * 114) / 1000;
  if (primaryLum < 40 && sortedColors.length > 1) {
    // If primary is too dark, try the next one
    primary = sortedColors[1];
  }

  // Helper to boost saturation
  const boostSaturation = (rgb, amount = 1.2) => {
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const l = (max + min) / 2;
    if (max === min) return rgb; // Grayscale
    
    // Convert to rough HSL, boost S, convert back? 
    // Simplified approach: move channels away from gray
    const gray = (rgb.r + rgb.g + rgb.b) / 3;
    return {
      r: Math.min(255, Math.max(0, gray + (rgb.r - gray) * amount)),
      g: Math.min(255, Math.max(0, gray + (rgb.g - gray) * amount)),
      b: Math.min(255, Math.max(0, gray + (rgb.b - gray) * amount))
    };
  };

  // Lighter saturation boost for subtler effect
  const boostedVibrant = boostSaturation(vibrant, 1.25);
  const secondary = sortedColors[1] || sortedColors[0];
  
  // Ensure accent has enough brightness for visibility (min 100 luminance)
  const accentLum = (boostedVibrant.r * 299 + boostedVibrant.g * 587 + boostedVibrant.b * 114) / 1000;
  let finalAccent = boostedVibrant;
  if (accentLum < 100) {
    // Lighten the accent to ensure contrast
    const boost = 100 / Math.max(accentLum, 30);
    finalAccent = {
      r: Math.min(255, boostedVibrant.r * boost),
      g: Math.min(255, boostedVibrant.g * boost),
      b: Math.min(255, boostedVibrant.b * boost)
    };
  }
  
  // Create a muted version for backgrounds (30% opacity simulation)
  const muted = {
    r: Math.round(finalAccent.r * 0.3 + 20),
    g: Math.round(finalAccent.g * 0.3 + 20),
    b: Math.round(finalAccent.b * 0.3 + 20)
  };
  
  return {
    primary: `rgb(${Math.round(primary.r)}, ${Math.round(primary.g)}, ${Math.round(primary.b)})`,
    secondary: `rgb(${Math.round(secondary.r)}, ${Math.round(secondary.g)}, ${Math.round(secondary.b)})`,
    accent: `rgb(${Math.round(finalAccent.r)}, ${Math.round(finalAccent.g)}, ${Math.round(finalAccent.b)})`,
    muted: `rgb(${muted.r}, ${muted.g}, ${muted.b})`
  };
}

export function applyDynamicColors(colors) {
  const root = document.documentElement;
  root.style.setProperty('--dynamic-primary', colors.primary);
  root.style.setProperty('--dynamic-secondary', colors.secondary);
  root.style.setProperty('--dynamic-accent', colors.accent);
  root.style.setProperty('--dynamic-muted', colors.muted);
  
  // Don't override global --primary to avoid contrast issues
  // Instead use dedicated dynamic vars that are applied thoughtfully
  document.body.classList.add('dynamic-themed');
}

// ============================================
// View Transitions
// ============================================
export function initViewTransitions() {
  let currentView = null;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList?.contains('view-container')) {
            node.querySelectorAll('.album-card, .artist-item, .playlist-card').forEach((item, i) => {
              item.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;
            });
          }
        });
      }
    });
  });
  
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    observer.observe(mainContent, { childList: true, subtree: true });
  }
}

// ============================================
// Context Menu
// ============================================
let activeContextMenu = null;

export function showContextMenu(x, y, items) {
  hideContextMenu();
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  
  items.forEach((item) => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
    } else {
      const btn = document.createElement('button');
      btn.className = 'context-menu-item';
      btn.innerHTML = `
        ${item.icon ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg>` : ''}
        <span>${item.label}</span>
      `;
      btn.onclick = () => {
        hideContextMenu();
        item.action?.();
      };
      menu.appendChild(btn);
    }
  });
  
  document.body.appendChild(menu);
  activeContextMenu = menu;
  
  // Position menu
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Mobile: bottom sheet style
  if (viewportWidth <= 700) {
    menu.style.left = '0';
    menu.style.bottom = '0';
    menu.style.top = 'auto';
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'context-menu-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;';
    backdrop.onclick = hideContextMenu;
    document.body.appendChild(backdrop);
    menu._backdrop = backdrop;
  } else {
    // Desktop: position near cursor
    let posX = x;
    let posY = y;
    
    if (x + rect.width > viewportWidth) {
      posX = viewportWidth - rect.width - 10;
    }
    if (y + rect.height > viewportHeight) {
      posY = viewportHeight - rect.height - 10;
    }
    
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  }
  
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('contextmenu', hideContextMenu);
  }, 0);
}

function handleOutsideClick(e) {
  if (activeContextMenu && !activeContextMenu.contains(e.target)) {
    hideContextMenu();
  }
}

export function hideContextMenu() {
  if (activeContextMenu) {
    if (activeContextMenu._backdrop) {
      activeContextMenu._backdrop.remove();
    }
    activeContextMenu.remove();
    activeContextMenu = null;
  }
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('contextmenu', hideContextMenu);
}

export function initContextMenus() {
  document.addEventListener('contextmenu', (e) => {
    // Don't intercept clicks on action buttons, dropdowns, or other interactive elements
    if (e.target.closest('.actions-btn, .dropdown, .dropdown-menu, button, a, input, select')) {
      return;
    }
    
    // Find song row
    const songRow = e.target.closest('.song-row, .queue-item');
    if (!songRow) return;
    
    e.preventDefault();
    
    const songId = songRow.dataset.id || songRow.dataset.songId;
    const song = AppState.library?.songs?.find(s => s.id === songId);
    
    if (!song) return;
    
    showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Play Now',
        icon: '<polygon points="5 3 19 12 5 21 5 3"/>',
        action: () => document.dispatchEvent(new CustomEvent('playSong', { detail: song }))
      },
      {
        label: 'Add to Queue',
        icon: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        action: () => {
          document.dispatchEvent(new CustomEvent('addToQueue', { detail: song }));
          showToast('Added to queue', 'success');
        }
      },
      {
        label: 'Play Next',
        icon: '<polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>',
        action: () => {
          document.dispatchEvent(new CustomEvent('playNext', { detail: song }));
          showToast('Will play next', 'success');
        }
      },
      { separator: true },
      {
        label: 'Go to Album',
        icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
        action: () => {
          if (song.albumId) {
            window.location.hash = `#albums/${song.albumId}`;
          }
        }
      },
      {
        label: 'Go to Artist',
        icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        action: () => {
          if (song.artist) {
            window.location.hash = `#artists/${encodeURIComponent(song.artist)}`;
          }
        }
      },
      { separator: true },
      {
        label: 'Add to Playlist',
        icon: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>',
        action: () => {
          document.dispatchEvent(new CustomEvent('showAddToPlaylist', { detail: song }));
        }
      }
    ]);
  });
}

// ============================================
// Search Filter Pills
// ============================================
let activeFilters = [];
let filtersContainer = null;

export function initSearchFilters() {
  filtersContainer = document.createElement('div');
  filtersContainer.className = 'search-filters-active';
  filtersContainer.style.display = 'none';
  
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.parentElement.insertBefore(filtersContainer, mainContent);
  }
}

export function addSearchFilter(type, value) {
  // Check if filter already exists
  const exists = activeFilters.find(f => f.type === type && f.value === value);
  if (exists) return;
  
  activeFilters.push({ type, value });
  renderFilterPills();
  
  // Trigger search with filters
  document.dispatchEvent(new CustomEvent('searchWithFilters', { detail: activeFilters }));
}

export function removeSearchFilter(type, value) {
  activeFilters = activeFilters.filter(f => !(f.type === type && f.value === value));
  renderFilterPills();
  
  document.dispatchEvent(new CustomEvent('searchWithFilters', { detail: activeFilters }));
}

export function clearSearchFilters() {
  activeFilters = [];
  renderFilterPills();
  
  document.dispatchEvent(new CustomEvent('searchWithFilters', { detail: [] }));
}

function renderFilterPills() {
  if (!filtersContainer) return;
  
  if (activeFilters.length === 0) {
    filtersContainer.style.display = 'none';
    return;
  }
  
  filtersContainer.style.display = 'flex';
  filtersContainer.innerHTML = activeFilters.map(filter => `
    <span class="filter-pill">
      <span class="filter-pill-label">${filter.type}:</span>
      ${filter.value}
      <button class="filter-pill-remove" data-type="${filter.type}" data-value="${filter.value}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </span>
  `).join('');
  
  // Add remove handlers
  filtersContainer.querySelectorAll('.filter-pill-remove').forEach(btn => {
    btn.onclick = () => removeSearchFilter(btn.dataset.type, btn.dataset.value);
  });
}

// ============================================
// Similar Songs
// ============================================
export function getSimilarSongs(song, library, limit = 6) {
  if (!song || !library?.songs) return [];
  
  const scores = library.songs
    .filter(s => s.id !== song.id)
    .map(s => {
      let score = 0;
      
      // Same artist: high score
      if (s.artist === song.artist) score += 5;
      
      // Same genre
      if (s.genre && song.genre && s.genre === song.genre) score += 3;
      
      // Same album: medium score
      if (s.albumId === song.albumId) score += 2;
      
      // Similar year
      if (s.year && song.year) {
        const yearDiff = Math.abs(s.year - song.year);
        if (yearDiff <= 2) score += 2;
        else if (yearDiff <= 5) score += 1;
      }
      
      return { song: s, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.song);
  
  return scores;
}

export function renderSimilarSongs(song, container) {
  const similar = getSimilarSongs(song, AppState.library);
  
  if (similar.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="similar-songs-section">
      <div class="similar-songs-header">
        <h4>Similar Songs</h4>
      </div>
      <div class="similar-songs-list">
        ${similar.map(s => `
          <div class="similar-song-card" data-id="${s.id}">
            <img class="similar-song-cover" src="${API.getCoverUrl(s.id)}" alt="" loading="lazy">
            <div class="similar-song-title">${escapeHtml(s.title)}</div>
            <div class="similar-song-artist">${escapeHtml(s.artist || 'Unknown')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Add click handlers
  container.querySelectorAll('.similar-song-card').forEach(card => {
    card.onclick = () => {
      const songId = card.dataset.id;
      const songData = AppState.library?.songs?.find(s => s.id === songId);
      if (songData) {
        document.dispatchEvent(new CustomEvent('playSong', { detail: songData }));
      }
    };
  });
}

// ============================================
// Activity Heatmap
// ============================================
export function renderActivityHeatmap(container, playHistory = []) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364); // Go back ~1 year
  
  // Aggregate plays by date
  const playsByDate = {};
  playHistory.forEach(play => {
    const date = new Date(play.timestamp).toISOString().split('T')[0];
    playsByDate[date] = (playsByDate[date] || 0) + 1;
  });
  
  // Find max plays for scaling
  const maxPlays = Math.max(1, ...Object.values(playsByDate));
  
  // Generate weeks
  const weeks = [];
  let currentDate = new Date(startDate);
  
  // Align to Sunday
  currentDate.setDate(currentDate.getDate() - currentDate.getDay());
  
  while (currentDate <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const plays = playsByDate[dateStr] || 0;
      const level = plays === 0 ? 0 : Math.min(4, Math.ceil((plays / maxPlays) * 4));
      
      week.push({
        date: dateStr,
        plays,
        level,
        isFuture: currentDate > today
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
  }
  
  // Generate month labels
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  container.innerHTML = `
    <div class="activity-heatmap">
      <div class="activity-heatmap-header">
        <h4>Listening Activity</h4>
        <div class="activity-heatmap-legend">
          <span>Less</span>
          <div class="heatmap-legend-cell" data-level="0"></div>
          <div class="heatmap-legend-cell" data-level="1"></div>
          <div class="heatmap-legend-cell" data-level="2"></div>
          <div class="heatmap-legend-cell" data-level="3"></div>
          <div class="heatmap-legend-cell" data-level="4"></div>
          <span>More</span>
        </div>
      </div>
      <div class="heatmap-container">
        <div class="heatmap-day-labels">
          <span>&nbsp;</span>
          <span>Mon</span>
          <span>&nbsp;</span>
          <span>Wed</span>
          <span>&nbsp;</span>
          <span>Fri</span>
          <span>&nbsp;</span>
        </div>
        <div class="heatmap-grid">
          ${weeks.map(week => `
            <div class="heatmap-week">
              ${week.map(day => `
                <div class="heatmap-cell ${day.isFuture ? 'future' : ''}" 
                     data-level="${day.level}" 
                     data-date="${day.date}"
                     title="${day.date}: ${day.plays} plays">
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Top Artists/Albums Cards
// ============================================
export function renderTopCards(container, { topArtists = [], topAlbums = [] }) {
  const getRankClass = (i) => {
    if (i === 0) return 'gold';
    if (i === 1) return 'silver';
    if (i === 2) return 'bronze';
    return '';
  };
  
  // Only render sections that have data
  const artistsSection = topArtists.length > 0 ? `
    <h4 style="margin-bottom: 16px; font-size: 18px;">Top Artists</h4>
    <div class="top-cards-grid">
      ${topArtists.slice(0, 5).map((artist, i) => `
        <div class="top-card" data-type="artist" data-name="${escapeHtml(artist.name)}">
          <span class="top-card-rank ${getRankClass(i)}">${i + 1}</span>
          <div class="top-card-info">
            <div class="top-card-title">${escapeHtml(artist.name)}</div>
            <div class="top-card-subtitle">${artist.playCount || 0} plays</div>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';
  
  const albumsSection = topAlbums.length > 0 ? `
    <h4 style="margin: ${topArtists.length > 0 ? '24px' : '0'} 0 16px; font-size: 18px;">Top Albums</h4>
    <div class="top-cards-grid">
      ${topAlbums.slice(0, 5).map((album, i) => `
        <div class="top-card" data-type="album" data-artist="${escapeHtml(album.artist || '')}" data-album="${escapeHtml(album.name || '')}">
          <span class="top-card-rank ${getRankClass(i)}">${i + 1}</span>
          <div class="top-card-info">
            <div class="top-card-title">${escapeHtml(album.name)}</div>
            <div class="top-card-subtitle">${escapeHtml(album.artist)} • ${album.playCount || 0} plays</div>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';
  
  if (!artistsSection && !albumsSection) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="top-cards-section">
      ${artistsSection}
      ${albumsSection}
    </div>
  `;
  
  // Add click handlers
  container.querySelectorAll('.top-card').forEach(card => {
    card.onclick = () => {
      if (card.dataset.type === 'artist') {
        window.location.hash = `#/artist/${encodeURIComponent(card.dataset.name)}`;
      } else if (card.dataset.type === 'album') {
        const artist = card.dataset.artist;
        const album = card.dataset.album;
        if (artist && album) {
          window.location.hash = `#/album/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`;
        }
      }
    };
  });
}

// ============================================
// Mini Player
// ============================================
let miniPlayer = null;
let miniPlayerProgress = null;

export function initMiniPlayer() {
  // Create mini player element
  miniPlayer = document.createElement('div');
  miniPlayer.className = 'mini-player';
  miniPlayer.innerHTML = `
    <div class="mini-player-progress">
      <div class="mini-player-progress-fill"></div>
    </div>
    <img class="mini-player-artwork" src="" alt="">
    <div class="mini-player-info">
      <div class="mini-player-title">Not Playing</div>
      <div class="mini-player-artist">-</div>
    </div>
    <div class="mini-player-controls">
      <button class="mini-player-btn" data-action="prev">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="19 20 9 12 19 4 19 20"/>
          <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
      <button class="mini-player-btn play-btn" data-action="toggle">
        <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:none">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
      <button class="mini-player-btn" data-action="next">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 4 15 12 5 20 5 4"/>
          <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(miniPlayer);
  miniPlayerProgress = miniPlayer.querySelector('.mini-player-progress-fill');
  
  // Control button handlers
  miniPlayer.querySelectorAll('.mini-player-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'toggle') {
        document.dispatchEvent(new CustomEvent('togglePlayPause'));
      } else if (action === 'prev') {
        document.dispatchEvent(new CustomEvent('playPrevious'));
      } else if (action === 'next') {
        document.dispatchEvent(new CustomEvent('playNext'));
      }
    };
  });
  
  // Click mini player to show full player
  miniPlayer.onclick = () => {
    document.dispatchEvent(new CustomEvent('showFullPlayer'));
  };
  
  // Listen for updates
  document.addEventListener('songChanged', (e) => updateMiniPlayer(e.detail));
  document.addEventListener('playStateChanged', (e) => updateMiniPlayerState(e.detail));
  document.addEventListener('progressUpdated', (e) => updateMiniPlayerProgress(e.detail));
}

export function updateMiniPlayer(song) {
  if (!miniPlayer) return;
  
  if (song) {
    miniPlayer.querySelector('.mini-player-artwork').src = API.getCoverUrl(song.id);
    miniPlayer.querySelector('.mini-player-title').textContent = song.title || 'Unknown';
    miniPlayer.querySelector('.mini-player-artist').textContent = song.artist || 'Unknown';
    miniPlayer.classList.add('visible');
  } else {
    miniPlayer.classList.remove('visible');
  }
}

export function updateMiniPlayerState(isPlaying) {
  if (!miniPlayer) return;
  
  const playIcon = miniPlayer.querySelector('.play-icon');
  const pauseIcon = miniPlayer.querySelector('.pause-icon');
  
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

export function updateMiniPlayerProgress(progress) {
  if (miniPlayerProgress) {
    miniPlayerProgress.style.width = `${progress * 100}%`;
  }
}

export function showMiniPlayer() {
  if (miniPlayer) miniPlayer.classList.add('visible');
}

export function hideMiniPlayer() {
  if (miniPlayer) miniPlayer.classList.remove('visible');
}

// ============================================
// Swipe Gestures (Mobile)
// ============================================
export function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchCurrentX = 0;
  let isSwiping = false;
  
  const playerArea = document.querySelector('.now-playing-sidebar') || document.body;
  
  playerArea.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchCurrentX = touchStartX;
    isSwiping = false;
  }, { passive: true });
  
  playerArea.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    
    touchCurrentX = e.touches[0].clientX;
    const diffX = touchCurrentX - touchStartX;
    const diffY = Math.abs(e.touches[0].clientY - touchStartY);
    
    // Only horizontal swipe
    if (Math.abs(diffX) > 30 && diffY < 50) {
      isSwiping = true;
    }
  }, { passive: true });
  
  playerArea.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    
    const diffX = touchCurrentX - touchStartX;
    const threshold = 80;
    
    if (diffX > threshold) {
      // Swipe right: previous track
      document.dispatchEvent(new CustomEvent('playPrevious'));
      showToast('Previous track', 'info');
    } else if (diffX < -threshold) {
      // Swipe left: next track
      document.dispatchEvent(new CustomEvent('playNext'));
      showToast('Next track', 'info');
    }
    
    isSwiping = false;
  }, { passive: true });
}

// ============================================
// Toast Notifications
// ============================================
let toastContainer = null;

export function initToasts() {
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
}

export function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) initToasts();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// ============================================
// Improved Queue Drag
// ============================================
export function initImprovedQueueDrag() {
  const queueList = document.querySelector('.queue-list');
  if (!queueList) return;
  
  let draggedItem = null;
  let dragOverItem = null;
  let touchDragClone = null;
  
  // Desktop drag events
  queueList.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.queue-item');
    if (!item) return;
    
    draggedItem = item;
    item.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });
  
  queueList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const item = e.target.closest('.queue-item');
    
    if (item && item !== draggedItem) {
      if (dragOverItem) dragOverItem.classList.remove('is-drag-over');
      item.classList.add('is-drag-over');
      dragOverItem = item;
    }
  });
  
  queueList.addEventListener('dragend', () => {
    if (draggedItem) draggedItem.classList.remove('is-dragging');
    if (dragOverItem) dragOverItem.classList.remove('is-drag-over');
    draggedItem = null;
    dragOverItem = null;
  });
  
  queueList.addEventListener('drop', (e) => {
    e.preventDefault();
    
    if (dragOverItem && draggedItem) {
      const fromId = draggedItem.dataset.id;
      const toId = dragOverItem.dataset.id;
      
      document.dispatchEvent(new CustomEvent('reorderQueue', {
        detail: { fromId, toId }
      }));
    }
    
    if (dragOverItem) dragOverItem.classList.remove('is-drag-over');
  });
  
  // Touch drag for mobile
  let touchStartY = 0;
  let touchTimeout = null;
  
  queueList.addEventListener('touchstart', (e) => {
    const handle = e.target.closest('.queue-handle');
    if (!handle) return;
    
    const item = handle.closest('.queue-item');
    if (!item) return;
    
    touchStartY = e.touches[0].clientY;
    
    // Long press to start drag
    touchTimeout = setTimeout(() => {
      draggedItem = item;
      item.classList.add('is-touch-dragging');
      queueList.classList.add('is-touch-dragging');
      
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, 200);
  }, { passive: true });
  
  queueList.addEventListener('touchmove', (e) => {
    if (!draggedItem) {
      // Cancel long press if moved before timeout
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }
      return;
    }
    
    const touch = e.touches[0];
    const targetItem = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.queue-item');
    
    if (targetItem && targetItem !== draggedItem) {
      if (dragOverItem) dragOverItem.classList.remove('is-drag-over');
      targetItem.classList.add('is-drag-over');
      dragOverItem = targetItem;
    }
  }, { passive: true });
  
  queueList.addEventListener('touchend', () => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    
    if (draggedItem && dragOverItem) {
      const fromId = draggedItem.dataset.id;
      const toId = dragOverItem.dataset.id;
      
      document.dispatchEvent(new CustomEvent('reorderQueue', {
        detail: { fromId, toId }
      }));
    }
    
    if (draggedItem) draggedItem.classList.remove('is-touch-dragging');
    if (dragOverItem) dragOverItem.classList.remove('is-drag-over');
    queueList.classList.remove('is-touch-dragging');
    
    draggedItem = null;
    dragOverItem = null;
  }, { passive: true });
}

// ============================================
// Utilities
// ============================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// Initialize All Enhancements
// ============================================
export function initEnhancements() {
  initBlurBackground();
  initViewTransitions();
  initContextMenus();
  initSearchFilters();
  // Skip custom mini player - use existing one
  // initMiniPlayer();
  initSwipeGestures();
  initToasts();
  
  // Initialize queue drag after DOM is ready
  setTimeout(() => {
    initImprovedQueueDrag();
  }, 500);
  
  // Listen for song changes to apply dynamic colors
  document.addEventListener('songChanged', async (e) => {
    const song = e.detail;
    if (song && song.id) {
      try {
        const colors = await extractDominantColors(API.getCoverUrl(song.id));
        applyDynamicColors(colors);
      } catch (err) {
        console.log('Could not extract colors:', err);
      }
    }
  });
  
  console.log('[Enhancements] Initialized all UI enhancements');
}

export default {
  initEnhancements,
  initBlurBackground,
  extractDominantColors,
  applyDynamicColors,
  initViewTransitions,
  showContextMenu,
  hideContextMenu,
  initContextMenus,
  addSearchFilter,
  removeSearchFilter,
  clearSearchFilters,
  getSimilarSongs,
  renderSimilarSongs,
  renderActivityHeatmap,
  renderTopCards,
  initMiniPlayer,
  updateMiniPlayer,
  updateMiniPlayerState,
  showMiniPlayer,
  hideMiniPlayer,
  initSwipeGestures,
  showToast,
  initImprovedQueueDrag
};
