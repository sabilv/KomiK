/** Shelf (recent books), covers, Continue reading, backup, and the next-volume offer. */
import { loadBookmarksFromStorage, updateBookmarkButton } from './bookmarks.js';
import {
  bookmarksView,
  clearHistoryBtn,
  recentsList,
  recentsView,
  tabBookmarksBtn,
  tabPagesBtn,
  tabRecentsBtn,
  thumbnailGrid
} from './dom.js';
import { openFromLibrary, readLibrary, removeFromLibrary } from './library.js';
import { BLANK_IMG, getThumbUrl } from './pages.js';
import { readHistory } from './progress.js';
import { escapeHtml, filterShelf, findNextVolume, groupShelf } from './pure.js';
import { goToPage } from './reader.js';
import { appState, settings } from './state.js';
import { keys, showToast, toggleDrawer, triggerFilePicker } from './ui.js';

export function renderRecentsList() {
  recentsList.innerHTML = '';
  const history = readHistory();
  if (Object.keys(history).length === 0) {
    recentsList.innerHTML = '<p class="text-xs text-zinc-500 text-center py-8">No recent books read yet.</p>';
    return;
  }
  const lib = readLibrary();
  const shown = filterShelf(history, lib, appState.shelfQuery || '', !!appState.shelfDevice);
  if (Object.keys(shown).length === 0) {
    recentsList.innerHTML = '<p class="text-xs text-zinc-500 text-center py-8">No books match.</p>';
    return;
  }
  groupShelf(shown, settings.groupSeries).forEach((g) => {
    if (g.series && g.keys.length > 1) {
      const done = g.keys.filter((k) => shown[k].finished).length;
      const head = document.createElement('div');
      head.className = 'flex items-center justify-between pt-2 px-1';
      head.innerHTML = `<span class="text-[11px] font-bold text-apple-blue truncate max-w-[200px]">${escapeHtml(g.series)}</span><span class="text-[10px] text-zinc-500 dark:text-zinc-400">${done} of ${g.keys.length} finished</span>`;
      recentsList.appendChild(head);
    }
    g.keys.forEach((key) => recentsList.appendChild(makeShelfCard(key, shown[key], !!lib[key])));
  });
}

export function makeShelfCard(key, item, inLib) {
  const percent = Math.min(100, Math.max(1, Math.round(((item.currentIndex + 1) / item.totalPages) * 100)));
  const card = document.createElement('div');
  card.className =
    'p-2.5 rounded-2xl glass-card border flex items-center space-x-3 hover:border-apple-blue/60 active:scale-[0.98] transition cursor-pointer group shadow-sm';
  const num = item.number ? `<span class="text-apple-blue font-mono mr-1">#${escapeHtml(item.number)}</span>` : '';
  card.innerHTML = `
                <img class="w-12 h-[4.5rem] object-cover rounded-lg bg-zinc-800 shrink-0 border border-black/10 dark:border-white/10" src="${BLANK_IMG}" alt="">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-xs font-bold truncate text-zinc-800 dark:text-zinc-100 group-hover:text-apple-blue transition max-w-[150px]">${num}${escapeHtml(item.fileName)}</span>
                        <span class="text-[10px] font-mono font-bold ${item.finished ? 'text-apple-blue' : 'text-apple-blue'}">${item.finished ? 'Finished' : percent + '%'}</span>
                    </div>
                    <div class="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mb-2">
                        <div class="bg-apple-blue h-full rounded-full" style="width: ${item.finished ? 100 : percent}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>Page ${item.currentIndex + 1} of ${item.totalPages}${inLib ? ' \u2022 On this device' : ''}</span>
                        <span class="text-apple-amber font-medium">${item.finished ? 'Read again' : inLib ? 'Open' : 'Pick file'}</span>
                    </div>
                </div>
                ${inLib ? '<button class="shelf-remove p-2 text-zinc-400 hover:text-rose-500 transition shrink-0" aria-label="Remove from this device" title="Remove from this device"><i class="fa-solid fa-trash text-xs"></i></button>' : ''}`;
  coverUrlFor(key).then((u) => {
    if (u) card.querySelector('img').src = u;
  });
  card.onclick = (e) => {
    if (e.target.closest('.shelf-remove')) {
      e.stopPropagation();
      if (confirm(`Remove "${item.fileName}" from this device? Your progress is kept.`)) removeFromLibrary(key);
      return;
    }
    openFromShelf(item, key);
  };
  return card;
}

export async function openFromShelf(item, key) {
  const idx = item.finished ? 0 : item.currentIndex;
  if (appState.fileName === item.fileName && appState.pages.length > 0) {
    goToPage(idx);
    toggleDrawer(false);
    showToast(`Resumed "${item.fileName}" at Page ${idx + 1}`);
    return;
  }
  appState.pendingResumeFileName = item.fileName;
  appState.pendingResumeIndex = idx;
  if (key && readLibrary()[key]) {
    toggleDrawer(false);
    if (await openFromLibrary(key)) return;
  }
  showToast(`Select "${item.fileName}" to continue`);
  triggerFilePicker();
}

export const idb = {
  db: null,
  open() {
    if (!this.db)
      this.db = new Promise((res, rej) => {
        const r = indexedDB.open('komik', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('covers');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    return this.db;
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res) => {
      const q = db.transaction('covers').objectStore('covers').get(k);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    });
  },
  async put(k, v) {
    const db = await this.open();
    return new Promise((res) => {
      const t = db.transaction('covers', 'readwrite');
      t.objectStore('covers').put(v, k);
      t.oncomplete = () => res(true);
      t.onerror = () => res(false);
    });
  }
};

export const coverUrls = new Map();

export async function coverUrlFor(id) {
  if (coverUrls.has(id)) return coverUrls.get(id);
  try {
    const b = await idb.get(id);
    if (!b) return '';
    const u = URL.createObjectURL(b);
    coverUrls.set(id, u);
    return u;
  } catch (e) {
    return '';
  }
}

export async function ensureCover() {
  const id = appState.bookId;
  if (!id) return;
  try {
    if (await idb.get(id)) return;
    const u = await getThumbUrl(0);
    if (!u || id !== appState.bookId) return;
    await idb.put(id, await (await fetch(u)).blob());
    renderContinueCard();
  } catch (e) {}
}

export async function renderContinueCard() {
  const card = document.getElementById('continueCard');
  if (!card) return;
  const h = readHistory();
  const keys = Object.keys(h).sort((a, b) => new Date(h[b].lastRead) - new Date(h[a].lastRead));
  const key = keys.find((k) => !h[k].finished) || keys[0];
  if (!key) {
    card.classList.add('hidden');
    return;
  }
  const it = h[key];
  document.getElementById('continueTitle').textContent = it.fileName;
  document.getElementById('continueMeta').textContent = it.finished
    ? `Finished \u2022 ${it.totalPages} pages`
    : `Page ${it.currentIndex + 1} of ${it.totalPages} \u2022 pick the file to resume`;
  document.getElementById('continueCover').src = (await coverUrlFor(key)) || BLANK_IMG;
  card.classList.remove('hidden');
  card.onclick = () => openFromShelf(it, key);
}

export function exportBackup() {
  let bm = {};
  try {
    bm = JSON.parse(localStorage.getItem('comic_reader_bookmarks') || '{}');
  } catch (e) {}
  const blob = new Blob(
    [JSON.stringify({ app: 'KomiK', version: 1, exportedAt: new Date().toISOString(), history: readHistory(), bookmarks: bm })],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'komik-backup.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  showToast('Backup exported');
}

export async function importBackup(file) {
  try {
    if (file.size > 5e6) throw new Error('File too large');
    const d = JSON.parse(await file.text());
    if (!d || d.app !== 'KomiK' || typeof d.history !== 'object') throw new Error('Not a KomiK backup');
    const bad = (k) => ['__proto__', 'constructor', 'prototype'].includes(k);
    const h = readHistory();
    let bm = {};
    try {
      bm = JSON.parse(localStorage.getItem('comic_reader_bookmarks') || '{}');
    } catch (e) {}
    let count = 0;
    for (const [k, v] of Object.entries(d.history)) {
      if (
        bad(k) ||
        !v ||
        typeof v.fileName !== 'string' ||
        !Number.isInteger(v.currentIndex) ||
        !Number.isInteger(v.totalPages) ||
        v.totalPages < 1 ||
        Number.isNaN(new Date(v.lastRead).getTime())
      )
        continue;
      if (!h[k] || new Date(v.lastRead) > new Date(h[k].lastRead)) {
        h[k] = {
          fileName: v.fileName.slice(0, 200),
          currentIndex: Math.max(0, v.currentIndex),
          totalPages: v.totalPages,
          finished: !!v.finished,
          series: typeof v.series === 'string' ? v.series.slice(0, 120) : '',
          number: typeof v.number === 'string' ? v.number.slice(0, 20) : '',
          lastRead: new Date(v.lastRead).toISOString()
        };
        count++;
      }
    }
    for (const [k, list] of Object.entries(d.bookmarks || {})) {
      if (bad(k) || !Array.isArray(list)) continue;
      bm[k] = Array.from(new Set([...(bm[k] || []), ...list.filter(Number.isInteger)])).sort((a, b) => a - b);
    }
    localStorage.setItem('comic_reader_history', JSON.stringify(h));
    localStorage.setItem('comic_reader_bookmarks', JSON.stringify(bm));
    loadBookmarksFromStorage();
    renderRecentsList();
    renderContinueCard();
    updateBookmarkButton();
    showToast(`Imported ${count} book${count === 1 ? '' : 's'}`);
  } catch (err) {
    showToast('Import failed: ' + err.message);
  }
}

export let nextOfferTimer = 0;

export function maybeOfferNext() {
  clearTimeout(nextOfferTimer);
  const old = document.getElementById('nextVolBanner');
  if (old) old.remove();
  const n = appState.pages.length;
  if (n < 2 || appState.currentIndex < n - 1 || !appState.bookId || !appState.meta || appState.nextOffered === appState.bookId) return;
  const id = appState.bookId;
  nextOfferTimer = setTimeout(() => {
    if (appState.bookId !== id || appState.currentIndex < appState.pages.length - 1) return;
    const history = readHistory();
    const key = findNextVolume(history, readLibrary(), { key: id, series: appState.meta.series, number: appState.meta.number });
    if (!key) return;
    appState.nextOffered = id;
    showNextBanner(key, history[key]);
  }, 1200);
}

export function showNextBanner(key, item) {
  const b = document.createElement('div');
  b.id = 'nextVolBanner';
  b.setAttribute('role', 'status');
  b.className =
    'fixed left-1/2 -translate-x-1/2 z-40 glass-card rounded-2xl px-4 py-3 flex items-center gap-3 text-xs font-semibold max-w-[92vw]';
  b.style.top = 'calc(env(safe-area-inset-top, 0px) + 72px)';
  const label = document.createElement('span');
  label.className = 'min-w-0 truncate';
  label.textContent = 'Next: ' + item.fileName;
  const open = document.createElement('button');
  open.className = 'px-3 py-1.5 rounded-xl bg-apple-blue text-white font-bold shrink-0';
  open.textContent = 'Open';
  open.onclick = () => {
    b.remove();
    openFromShelf(item, key);
  };
  const close = document.createElement('button');
  close.className = 'text-zinc-400 px-1 shrink-0';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  close.onclick = () => b.remove();
  b.append(label, open, close);
  document.body.appendChild(b);
}

export let shelfTimer = 0;

/** Load-time work, run by main.js in the original order. */
export const steps = [
  [
    98,
    () => {
      clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('comic_reader_history');
        renderRecentsList();
        showToast('History cleared');
      });
    }
  ],
  [
    99,
    () => {
      tabPagesBtn.addEventListener('click', () => {
        tabPagesBtn.classList.add('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabPagesBtn.classList.remove('text-zinc-400', 'text-zinc-500');
        tabBookmarksBtn.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabBookmarksBtn.classList.add('text-zinc-400');
        tabRecentsBtn.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabRecentsBtn.classList.add('text-zinc-400');

        thumbnailGrid.classList.remove('hidden');
        bookmarksView.classList.add('hidden');
        bookmarksView.classList.remove('flex');
        recentsView.classList.add('hidden');
        recentsView.classList.remove('flex');
      });
    }
  ],
  [
    101,
    () => {
      tabRecentsBtn.addEventListener('click', () => {
        tabRecentsBtn.classList.add('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabRecentsBtn.classList.remove('text-zinc-400', 'text-zinc-500');
        tabPagesBtn.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabPagesBtn.classList.add('text-zinc-400');
        tabBookmarksBtn.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabBookmarksBtn.classList.add('text-zinc-400');

        thumbnailGrid.classList.add('hidden');
        bookmarksView.classList.add('hidden');
        bookmarksView.classList.remove('flex');
        recentsView.classList.remove('hidden');
        recentsView.classList.add('flex');

        renderRecentsList();
      });
    }
  ],
  [
    269,
    () => {
      document.getElementById('exportBackupBtn').addEventListener('click', exportBackup);
    }
  ],
  [
    270,
    () => {
      document.getElementById('importBackupBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    }
  ],
  [
    271,
    () => {
      document.getElementById('importFileInput').addEventListener('change', (e) => {
        if (e.target.files[0]) importBackup(e.target.files[0]);
        e.target.value = '';
      });
    }
  ],
  [
    285,
    () => {
      renderContinueCard();
    }
  ],
  [
    318,
    () => {
      document.getElementById('shelfSearch').addEventListener('input', (e) => {
        clearTimeout(shelfTimer);
        shelfTimer = setTimeout(() => {
          appState.shelfQuery = e.target.value;
          renderRecentsList();
        }, 120);
      });
    }
  ],
  [
    319,
    () => {
      document.getElementById('shelfDeviceFilter').addEventListener('click', (e) => {
        appState.shelfDevice = !appState.shelfDevice;
        e.currentTarget.setAttribute('aria-pressed', String(appState.shelfDevice));
        e.currentTarget.classList.toggle('bg-apple-blue', appState.shelfDevice);
        e.currentTarget.classList.toggle('text-white', appState.shelfDevice);
        renderRecentsList();
      });
    }
  ]
];
