import { scanLibrary as scanLibraryAPI, clearCache } from '../API.js';

export async function scanLibrary() {
  const button = document.getElementById('scanButton');
  if (!button) return;

  button.disabled = true;
  button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>Scanning...</span>';

  try {
    const result = await scanLibraryAPI();
    clearCache();
    alert(`Scan complete!\nAdded: ${result.added}\nUpdated: ${result.updated}\nTotal: ${result.total}`);
    window.location.reload();
  } catch (error) {
    console.error('Scan error:', error);
    alert('Error scanning library');
    button.disabled = false;
    button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg><span>Scan Library</span>';
  }
}
