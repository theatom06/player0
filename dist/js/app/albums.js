import { getAlbumDetail, listAlbums } from '../API.js';
import { currentSongs, setPlaybackList, setShuffleEnabled, setRepeatMode } from '../state.js';
import { playSong } from '../player.js';
import { renderAlbumDetail, renderAlbums } from '../ui.js';
import { switchView } from './views.js';

let currentAlbumSongs = [];

export function playAlbumSong(index) {
  setPlaybackList([...currentAlbumSongs], index);
  playSong(currentAlbumSongs[index]);
}

function playAlbumAll() {
  setShuffleEnabled(false);
  setRepeatMode('off');
  setPlaybackList([...currentAlbumSongs], 0);
  playSong(currentAlbumSongs[0]);
}

function shuffleAlbum() {
  setShuffleEnabled(true);
  setRepeatMode('off');
  const shuffled = [...currentAlbumSongs].sort(() => Math.random() - 0.5);
  setPlaybackList(shuffled, 0);
  playSong(shuffled[0]);
}

export async function loadAlbums() {
  try {
    const albums = await listAlbums();
    renderAlbums(albums, loadAlbumDetail);
  } catch (error) {
    console.error('Error loading albums:', error);
  }
}

export async function loadAlbumDetail(artist, album) {
  try {
    const albumData = await getAlbumDetail(artist, album);
    currentAlbumSongs = albumData.songs;

    await switchView('albumDetailView', false);
    window.location.hash = `#/album/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`;
    await new Promise(resolve => setTimeout(resolve, 0));

    renderAlbumDetail(albumData, playAlbumSong);

    const playBtn = document.getElementById('playAlbum');
    const shuffleBtn = document.getElementById('shuffleAlbum');
    const backBtn = document.getElementById('backToAlbums');

    if (playBtn) playBtn.onclick = () => playAlbumAll();
    if (shuffleBtn) shuffleBtn.onclick = () => shuffleAlbum();
    if (backBtn) {
      backBtn.onclick = () => {
        window.location.hash = '#/albums';
      };
    }
  } catch (error) {
    console.error('Error loading album detail:', error);
  }
}

// Backwards compatibility
window.playAlbumSong = playAlbumSong;
