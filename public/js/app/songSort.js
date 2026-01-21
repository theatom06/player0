const SORT_KEY = 'player0.library.sort.v1';

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampDir(dir) {
  return dir === 'desc' ? 'desc' : 'asc';
}

function clampKey(key) {
  const allowed = new Set(['title', 'artist', 'album', 'duration', 'plays', 'added']);
  return allowed.has(key) ? key : 'title';
}

export function getSongSortState() {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    const parsed = raw ? safeJsonParse(raw) : null;
    return {
      key: clampKey(parsed?.key),
      dir: clampDir(parsed?.dir)
    };
  } catch {
    return { key: 'title', dir: 'asc' };
  }
}

export function setSongSortState(next) {
  const state = {
    key: clampKey(next?.key),
    dir: clampDir(next?.dir)
  };

  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }

  document.dispatchEvent(new CustomEvent('player0:songSortChanged', { detail: state }));
  return state;
}

function normalizeSortText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^the\s+/i, '')
    .trim();
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareText(a, b) {
  const aa = normalizeSortText(a);
  const bb = normalizeSortText(b);
  const aEmpty = aa.length === 0;
  const bEmpty = bb.length === 0;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return collator.compare(aa, bb);
}

function compareNumber(a, b) {
  const aa = Number(a);
  const bb = Number(b);
  const aOk = Number.isFinite(aa);
  const bOk = Number.isFinite(bb);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return aa - bb;
}

function compareDate(a, b) {
  const aa = Date.parse(a);
  const bb = Date.parse(b);
  const aOk = Number.isFinite(aa);
  const bOk = Number.isFinite(bb);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return aa - bb;
}

export function sortSongs(songs, state = getSongSortState()) {
  const list = Array.isArray(songs) ? songs : [];
  const { key, dir } = {
    key: clampKey(state?.key),
    dir: clampDir(state?.dir)
  };

  // stable sort: decorate with index
  const decorated = list.map((song, index) => ({ song, index }));

  decorated.sort((a, b) => {
    let cmp = 0;

    if (key === 'title') {
      cmp = compareText(a.song?.title, b.song?.title);
      if (cmp === 0) cmp = compareText(a.song?.artist, b.song?.artist);
      if (cmp === 0) cmp = compareText(a.song?.album, b.song?.album);
    } else if (key === 'artist') {
      cmp = compareText(a.song?.artist, b.song?.artist);
      if (cmp === 0) cmp = compareText(a.song?.album, b.song?.album);
      if (cmp === 0) cmp = compareText(a.song?.title, b.song?.title);
    } else if (key === 'album') {
      cmp = compareText(a.song?.album, b.song?.album);
      if (cmp === 0) cmp = compareText(a.song?.artist, b.song?.artist);
      if (cmp === 0) cmp = compareText(a.song?.title, b.song?.title);
    } else if (key === 'duration') {
      cmp = compareNumber(a.song?.duration, b.song?.duration);
      if (cmp === 0) cmp = compareText(a.song?.title, b.song?.title);
    } else if (key === 'plays') {
      cmp = compareNumber(a.song?.playCount ?? 0, b.song?.playCount ?? 0);
      if (cmp === 0) cmp = compareText(a.song?.title, b.song?.title);
    } else if (key === 'added') {
      cmp = compareDate(a.song?.addedDate, b.song?.addedDate);
      if (cmp === 0) cmp = compareText(a.song?.title, b.song?.title);
    }

    if (cmp === 0) cmp = a.index - b.index;
    return dir === 'desc' ? -cmp : cmp;
  });

  return decorated.map((x) => x.song);
}

export function updateLibrarySortUI() {
  const { key, dir } = getSongSortState();

  const select = document.getElementById('librarySortKey');
  if (select) select.value = key;

  const dirBtn = document.getElementById('librarySortDir');
  if (dirBtn) {
    dirBtn.dataset.dir = dir;
    dirBtn.textContent = dir === 'desc' ? 'Z→A' : 'A→Z';
    dirBtn.title = dir === 'desc' ? 'Sort: Descending' : 'Sort: Ascending';
  }

  document.querySelectorAll('.song-table thead th[data-sort-key]').forEach((th) => {
    th.classList.toggle('is-sorted', th.dataset.sortKey === key);
    th.classList.toggle('is-sorted-desc', th.dataset.sortKey === key && dir === 'desc');
  });
}

export function setLibraryResultsCount({ shown, total, label = 'songs' }) {
  const el = document.getElementById('libraryResultsCount');
  if (!el) return;

  const shownNum = Number(shown);
  const totalNum = Number(total);
  const hasTotal = Number.isFinite(totalNum) && totalNum > 0;

  if (!Number.isFinite(shownNum)) {
    el.textContent = '';
    return;
  }

  if (hasTotal && shownNum !== totalNum) {
    el.textContent = `${shownNum.toLocaleString()} / ${totalNum.toLocaleString()} ${label}`;
    return;
  }

  el.textContent = `${shownNum.toLocaleString()} ${label}`;
}
