import { exportStatsCsv } from './stats.js';
import { fetchAllSongs, getPlaylist, listPlaylists } from '../API.js';
import {
  exportPlaylistsAsJson,
  exportPlaylistAsM3U,
  exportPlaylistAsPLS,
  importPlaylistsFromJsonFile,
  importPlaylistFromM3uOrPlsFile
} from './playlistImportExport.js';

export function setupSettingsView() {
  const exportButton = document.getElementById('exportStatsCsvButton');
  if (exportButton) {
    exportButton.onclick = () => {
      void exportStatsCsv();
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
}
