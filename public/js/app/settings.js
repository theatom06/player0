import { exportStatsCsv } from './stats.js';
import { fetchAllSongs, getPlaylist, getServerConfig, importStatsCsv, listPlaylists, updateServerConfig } from '../api.js';
import {
  exportPlaylistsAsJson,
  exportPlaylistAsM3U,
  exportPlaylistAsPLS,
  importPlaylistsFromJsonFile,
  importPlaylistFromM3uOrPlsFile
} from './playlistImportExport.js';

const PREF_DYNAMIC_COLORS_KEY = 'player0.dynamicColorsEnabled.v1';
const PREF_NO_ANIMATIONS_KEY = 'player0.noAnimations.v1';
const PREF_THEME_OVERRIDES_KEY = 'player0.themeOverrides.v1';
// Back-compat (older single-accent setting)
const PREF_ACCENT_COLOR_KEY = 'player0.themeAccentColor.v1';

const DEFAULT_ACCENT = '#f8fafc';
const DEFAULTS = {
  '--primary': '#f8fafc',
  '--bg-dark': '#050505',
  '--bg-medium': '#0b0b0b',
  '--bg-light': '#121212',
  '--text-primary': '#f8fafc',
  '--text-secondary': '#a1a1aa',
  '--border': '#2a2a2a'
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].some((x) => Number.isNaN(x))) return null;
    return { r, g, b };
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

function rgbToHex({ r, g, b }) {
  const to2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t
  });
}

function pickButtonText(bgHex) {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#050505';
  // Relative luminance approximation
  const lum = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return lum >= 150 ? '#050505' : '#f8fafc';
}

function readThemeOverrides() {
  try {
    const raw = localStorage.getItem(PREF_THEME_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const vars = parsed?.vars;
    if (vars && typeof vars === 'object') return vars;
  } catch {
    // ignore
  }
  return {};
}

function writeThemeOverrides(vars) {
  try {
    localStorage.setItem(PREF_THEME_OVERRIDES_KEY, JSON.stringify({ vars }));
  } catch {
    // ignore
  }
}

function setThemeOverride(varName, value) {
  const vars = readThemeOverrides();
  if (value == null || value === '') {
    delete vars[varName];
  } else {
    vars[varName] = value;
  }
  writeThemeOverrides(vars);
}

export function applyAppearancePreferences() {
  // Dynamic colors
  let dynamicEnabled = true;
  try {
    const raw = localStorage.getItem(PREF_DYNAMIC_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (typeof parsed?.enabled === 'boolean') dynamicEnabled = parsed.enabled;
  } catch {
    // ignore
  }

  if (!dynamicEnabled) {
    document.body.classList.remove('dynamic-themed');
    // Clear any per-song inline vars.
    const root = document.documentElement;
    root.style.removeProperty('--dynamic-primary');
    root.style.removeProperty('--dynamic-secondary');
    root.style.removeProperty('--dynamic-tertiary');
    root.style.removeProperty('--dynamic-accent');
    root.style.removeProperty('--dynamic-muted');
  }

  // Theme overrides (Tumblr-style colors)
  const overrides = readThemeOverrides();
  const root = document.documentElement;
  const managedKeys = [
    '--bg-dark',
    '--bg-medium',
    '--bg-light',
    '--text-primary',
    '--text-secondary',
    '--border',
    '--primary',
    '--primary-dark',
    '--glow-primary',
    '--btn-primary-bg',
    '--btn-primary-fg',
    '--btn-primary-hover-bg'
  ];

  managedKeys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) {
      root.style.setProperty(k, overrides[k]);
    } else {
      root.style.removeProperty(k);
    }
  });

  // No animations
  let noAnimations = false;
  try {
    const raw = localStorage.getItem(PREF_NO_ANIMATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (typeof parsed?.enabled === 'boolean') noAnimations = parsed.enabled;
  } catch {
    // ignore
  }
  document.body.classList.toggle('no-animations', Boolean(noAnimations));

  // Back-compat: if the old accent-only key exists and no overrides exist yet,
  // migrate it into the new overrides store.
  try {
    const raw = localStorage.getItem(PREF_ACCENT_COLOR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.color && Object.keys(overrides).length === 0) {
        const accent = String(parsed.color).trim();
        const btnFg = pickButtonText(accent);
        writeThemeOverrides({
          '--primary': accent,
          '--btn-primary-bg': accent,
          '--btn-primary-hover-bg': mixHex(accent, '#ffffff', 0.12),
          '--btn-primary-fg': btnFg,
          '--primary-dark': mixHex(accent, '#ffffff', 0.18),
          '--glow-primary': mixHex(accent, '#ffffff', 0.22)
        });
        localStorage.removeItem(PREF_ACCENT_COLOR_KEY);
      }
    }
  } catch {
    // ignore
  }
}

export function setupSettingsView() {
  // Wire appearance settings UI.
  const dynamicColorsToggle = document.getElementById('settingsDynamicColorsEnabled');
  const noAnimationsToggle = document.getElementById('settingsNoAnimations');
  const accentColor = document.getElementById('settingsColorAccent');
  const bgDark = document.getElementById('settingsColorBgDark');
  const bgMedium = document.getElementById('settingsColorBgMedium');
  const bgLight = document.getElementById('settingsColorBgLight');
  const textPrimary = document.getElementById('settingsColorTextPrimary');
  const textSecondary = document.getElementById('settingsColorTextSecondary');
  const border = document.getElementById('settingsColorBorder');
  const resetTheme = document.getElementById('settingsResetTheme');

  // Hydrate controls.
  try {
    const raw = localStorage.getItem(PREF_DYNAMIC_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (dynamicColorsToggle && typeof parsed?.enabled === 'boolean') {
      dynamicColorsToggle.checked = Boolean(parsed.enabled);
    } else if (dynamicColorsToggle) {
      dynamicColorsToggle.checked = true;
    }
  } catch {
    if (dynamicColorsToggle) dynamicColorsToggle.checked = true;
  }

  try {
    const raw = localStorage.getItem(PREF_NO_ANIMATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (noAnimationsToggle && typeof parsed?.enabled === 'boolean') {
      noAnimationsToggle.checked = Boolean(parsed.enabled);
    }
  } catch {
    // ignore
  }

  const hydrateThemeInputs = () => {
    const vars = readThemeOverrides();
    if (accentColor) accentColor.value = vars['--primary'] || DEFAULTS['--primary'];
    if (bgDark) bgDark.value = vars['--bg-dark'] || DEFAULTS['--bg-dark'];
    if (bgMedium) bgMedium.value = vars['--bg-medium'] || DEFAULTS['--bg-medium'];
    if (bgLight) bgLight.value = vars['--bg-light'] || DEFAULTS['--bg-light'];
    if (textPrimary) textPrimary.value = vars['--text-primary'] || DEFAULTS['--text-primary'];
    if (textSecondary) textSecondary.value = vars['--text-secondary'] || DEFAULTS['--text-secondary'];
    if (border) border.value = vars['--border'] || DEFAULTS['--border'];
  };
  hydrateThemeInputs();

  // Apply once when opening settings.
  applyAppearancePreferences();

  const ensureManualThemeMode = () => {
    // When the user edits theme colors, disable dynamic colors for predictability.
    if (!dynamicColorsToggle) return;
    if (dynamicColorsToggle.checked) {
      dynamicColorsToggle.checked = false;
      try {
        localStorage.setItem(PREF_DYNAMIC_COLORS_KEY, JSON.stringify({ enabled: false }));
      } catch {
        // ignore
      }
    }
  };

  dynamicColorsToggle?.addEventListener('change', () => {
    try {
      localStorage.setItem(PREF_DYNAMIC_COLORS_KEY, JSON.stringify({ enabled: Boolean(dynamicColorsToggle.checked) }));
    } catch {
      // ignore
    }
    applyAppearancePreferences();
  });

  noAnimationsToggle?.addEventListener('change', () => {
    try {
      localStorage.setItem(PREF_NO_ANIMATIONS_KEY, JSON.stringify({ enabled: Boolean(noAnimationsToggle.checked) }));
    } catch {
      // ignore
    }
    applyAppearancePreferences();
  });

  accentColor?.addEventListener('input', () => {
    ensureManualThemeMode();
    const accent = String(accentColor.value || DEFAULT_ACCENT);
    setThemeOverride('--primary', accent);
    setThemeOverride('--primary-dark', mixHex(accent, '#ffffff', 0.18));
    setThemeOverride('--glow-primary', mixHex(accent, '#ffffff', 0.22));
    setThemeOverride('--btn-primary-bg', accent);
    setThemeOverride('--btn-primary-hover-bg', mixHex(accent, '#ffffff', 0.12));
    setThemeOverride('--btn-primary-fg', pickButtonText(accent));
    applyAppearancePreferences();
  });

  bgDark?.addEventListener('input', () => {
    ensureManualThemeMode();
    setThemeOverride('--bg-dark', String(bgDark.value));
    applyAppearancePreferences();
  });
  bgMedium?.addEventListener('input', () => {
    ensureManualThemeMode();
    setThemeOverride('--bg-medium', String(bgMedium.value));
    applyAppearancePreferences();
  });
  bgLight?.addEventListener('input', () => {
    ensureManualThemeMode();
    setThemeOverride('--bg-light', String(bgLight.value));
    applyAppearancePreferences();
  });
  textPrimary?.addEventListener('input', () => {
    ensureManualThemeMode();
    setThemeOverride('--text-primary', String(textPrimary.value));
    applyAppearancePreferences();
  });
  textSecondary?.addEventListener('input', () => {
    ensureManualThemeMode();
    // The CSS var normally expects rgba; we store a hex and let it apply as a color.
    // It works because it's used as a color token everywhere.
    setThemeOverride('--text-secondary', String(textSecondary.value));
    applyAppearancePreferences();
  });
  border?.addEventListener('input', () => {
    ensureManualThemeMode();
    setThemeOverride('--border', String(border.value));
    applyAppearancePreferences();
  });

  resetTheme?.addEventListener('click', () => {
    try {
      localStorage.removeItem(PREF_THEME_OVERRIDES_KEY);
    } catch {
      // ignore
    }
    hydrateThemeInputs();
    applyAppearancePreferences();
  });

  const exportButton = document.getElementById('exportStatsCsvButton');
  if (exportButton) {
    exportButton.onclick = () => {
      void exportStatsCsv();
    };
  }

  const importStatsBtn = document.getElementById('importStatsCsvButton');
  const importStatsInput = document.getElementById('importStatsCsvFile');
  if (importStatsBtn && importStatsInput) {
    importStatsBtn.onclick = () => importStatsInput.click();
    importStatsInput.onchange = () => {
      const file = importStatsInput.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const text = await file.text();
          const result = await importStatsCsv(text);
          alert(
            `Import complete. Updated ${result.updatedCount || 0} songs` +
              (result.skippedCount ? `, skipped ${result.skippedCount}.` : '.')
          );
        } catch (err) {
          console.error('Import stats failed:', err);
          alert('Import failed: ' + (err?.message || err));
        } finally {
          importStatsInput.value = '';
        }
      })();
    };
  }

  const exportPlaylistsBtn = document.getElementById('settingsExportPlaylistsJson');
  if (exportPlaylistsBtn) {
    exportPlaylistsBtn.onclick = () => {
      void exportPlaylistsAsJson().catch(err => {
        console.error('Export playlists failed:', err);
        alert('Export failed: ' + (err?.message || err));
      });
    };
  }

  const importPlaylistsBtn = document.getElementById('settingsImportPlaylistsJson');
  const jsonInput = document.getElementById('settingsPlaylistsJsonFile');
  if (importPlaylistsBtn && jsonInput) {
    importPlaylistsBtn.onclick = () => jsonInput.click();
    jsonInput.onchange = () => {
      const file = jsonInput.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          await importPlaylistsFromJsonFile(file);
          alert('Import complete');
        } catch (err) {
          console.error('Import playlists failed:', err);
          alert('Import failed: ' + (err?.message || err));
        } finally {
          jsonInput.value = '';
        }
      })();
    };
  }

  const importM3uPlsBtn = document.getElementById('settingsImportPlaylistsM3uPls');
  const m3uPlsInput = document.getElementById('settingsPlaylistsM3uPlsFile');
  if (importM3uPlsBtn && m3uPlsInput) {
    importM3uPlsBtn.onclick = () => m3uPlsInput.click();
    m3uPlsInput.onchange = () => {
      const file = m3uPlsInput.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const result = await importPlaylistFromM3uOrPlsFile(file);
          if (result) {
            alert(
              `Imported playlist "${result.playlistName}". Added ${result.importedCount} tracks` +
                (result.missingCount ? `, skipped ${result.missingCount} missing.` : '.')
            );
          } else {
            alert('Import complete');
          }
          void refreshPlaylistExportSelect();
        } catch (err) {
          console.error('Import M3U/PLS failed:', err);
          alert('Import failed: ' + (err?.message || err));
        } finally {
          m3uPlsInput.value = '';
        }
      })();
    };
  }

  const playlistSelect = document.getElementById('settingsPlaylistExportSelect');
  const exportM3uBtn = document.getElementById('settingsExportPlaylistM3U');
  const exportPlsBtn = document.getElementById('settingsExportPlaylistPLS');
  if (playlistSelect && exportM3uBtn && exportPlsBtn) {
    exportM3uBtn.onclick = () => void exportSelectedPlaylist('m3u');
    exportPlsBtn.onclick = () => void exportSelectedPlaylist('pls');
    void refreshPlaylistExportSelect();
  }

  async function refreshPlaylistExportSelect() {
    const select = document.getElementById('settingsPlaylistExportSelect');
    if (!select) return;

    try {
      const playlists = await listPlaylists();
      const previous = select.value;
      select.innerHTML = '';

      const list = Array.isArray(playlists) ? playlists : [];
      if (list.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No playlists available';
        select.appendChild(opt);
        select.disabled = true;
        return;
      }

      select.disabled = false;
      for (const p of list) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      }

      if (previous && Array.from(select.options).some(o => o.value === previous)) {
        select.value = previous;
      }
    } catch (err) {
      console.error('Failed to load playlists for export:', err);
    }
  }

  async function exportSelectedPlaylist(format) {
    const select = document.getElementById('settingsPlaylistExportSelect');
    if (!select) return;
    const playlistId = select.value;
    if (!playlistId) {
      alert('Select a playlist to export');
      return;
    }

    try {
      const playlist = await getPlaylist(playlistId);
      const allSongs = await fetchAllSongs();
      const playlistSongs = (playlist.songIds || [])
        .map(id => (allSongs || []).find(s => s.id === id))
        .filter(Boolean);

      if (format === 'm3u') {
        exportPlaylistAsM3U(playlist.name, playlistSongs);
      } else {
        exportPlaylistAsPLS(playlist.name, playlistSongs);
      }
    } catch (err) {
      console.error('Export playlist failed:', err);
      alert('Export failed: ' + (err?.message || err));
    }
  }

  // Server config controls
  const loadConfigBtn = document.getElementById('settingsServerConfigLoad');
  const saveConfigBtn = document.getElementById('settingsServerConfigSave');
  const statusEl = document.getElementById('settingsServerConfigStatus');
  const musicDirectories = document.getElementById('settingsMusicDirectories');
  const dataDirectory = document.getElementById('settingsDataDirectory');

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = String(msg || '');
  };

  const splitLines = (text) =>
    String(text || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  loadConfigBtn?.addEventListener('click', () => {
    void (async () => {
      setStatus('Loading…');
      try {
        const cfg = await getServerConfig();
        if (musicDirectories) musicDirectories.value = (cfg?.musicDirectories || []).join('\n');
        if (dataDirectory) dataDirectory.value = String(cfg?.dataDirectory || './data');
        setStatus('Loaded.');
      } catch (err) {
        console.error('Load server config failed:', err);
        setStatus('Load failed: ' + (err?.message || err));
      }
    })();
  });

  saveConfigBtn?.addEventListener('click', () => {
    void (async () => {
      const musicDirs = splitLines(musicDirectories?.value);
      const dataDir = String(dataDirectory?.value || '').trim();

      const payload = {
        musicDirectories: musicDirs,
        dataDirectory: dataDir || undefined
      };

      setStatus('Saving…');
      try {
        const result = await updateServerConfig(payload);
        const cfg = result?.config || result;
        if (musicDirectories) musicDirectories.value = (cfg?.musicDirectories || []).join('\n');
        if (dataDirectory) dataDirectory.value = String(cfg?.dataDirectory || './data');
        setStatus('Saved.');
      } catch (err) {
        console.error('Save server config failed:', err);
        setStatus('Save failed: ' + (err?.message || err));
      }
    })();
  });

  // Auto-load once when entering Settings (best effort).
  if (loadConfigBtn) {
    void (async () => {
      setStatus('Loading…');
      try {
        const cfg = await getServerConfig();
        if (musicDirectories) musicDirectories.value = (cfg?.musicDirectories || []).join('\n');
        if (dataDirectory) dataDirectory.value = String(cfg?.dataDirectory || './data');
        setStatus('Loaded.');
      } catch (err) {
        console.warn('Auto-load server config failed:', err);
        setStatus('');
      }
    })();
  }
}
