/** Books kept on the device (private file system) and the saved-books manager. */
import { recentsView } from './dom.js';
import { handleFilesSelect } from './files.js';
import { readHistory } from './progress.js';
import { libraryRows } from './pure.js';
import { logIssue, requestPersist, updateStorageInfo } from './pwa.js';
import { renderContinueCard, renderRecentsList } from './shelf.js';
import { settings } from './state.js';
import { showToast } from './ui.js';

export let libModal;

export let libSort = 'size';

export let libPrevFocus = null;

export function renderLibraryManager() {
  const rows = libraryRows(readLibrary(), readHistory(), libSort);
  const mb = (n) => (n / 1048576).toFixed(1);
  libModal.querySelector('#libTotal').textContent =
    `${rows.length} book${rows.length === 1 ? '' : 's'} \u2022 ${mb(rows.reduce((a, r) => a + r.size, 0))} MB`;
  libModal.querySelectorAll('[data-sort]').forEach((b) => {
    const on = b.dataset.sort === libSort;
    b.setAttribute('aria-pressed', String(on));
    b.className =
      'px-3 py-1.5 rounded-xl text-[11px] font-semibold ' + (on ? 'bg-apple-blue text-white' : 'text-zinc-600 dark:text-zinc-300');
  });
  const list = libModal.querySelector('#libRows');
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<p class="text-xs text-zinc-500 text-center py-8">No books are kept on this device.</p>';
    return;
  }
  rows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'p-2.5 rounded-2xl border border-black/10 dark:border-white/10 flex items-center gap-3';
    const info = document.createElement('div');
    info.className = 'min-w-0 flex-1';
    const name = document.createElement('p');
    name.className = 'text-xs font-bold truncate';
    name.textContent = r.name;
    const meta = document.createElement('p');
    meta.className = 'text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5';
    const read = r.lastRead
      ? 'Last read ' + new Date(r.lastRead).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      : 'Not read yet';
    meta.textContent = `${mb(r.size)} MB \u2022 ${read}${r.finished ? ' \u2022 Finished' : ''}`;
    info.append(name, meta);
    const del = document.createElement('button');
    del.className = 'p-2 text-zinc-400 hover:text-rose-500 transition shrink-0';
    del.setAttribute('aria-label', 'Remove ' + r.name + ' from this device');
    del.innerHTML = '<i class="fa-solid fa-trash text-xs"></i>';
    del.onclick = async () => {
      await removeFromLibrary(r.id, true);
      afterLibraryChange();
    };
    row.append(info, del);
    list.appendChild(row);
  });
}

export function afterLibraryChange() {
  renderLibraryManager();
  renderContinueCard();
  renderRecentsList();
  updateStorageInfo();
}

export function openLibraryManager() {
  libPrevFocus = document.activeElement;
  renderLibraryManager();
  libModal.classList.remove('hidden');
  libModal.classList.add('flex');
  libModal.querySelector('button').focus();
}

export function closeLibraryManager() {
  if (libModal.classList.contains('hidden')) return;
  libModal.classList.add('hidden');
  libModal.classList.remove('flex');
  if (libPrevFocus && libPrevFocus.focus) libPrevFocus.focus();
}

export function readLibrary() {
  try {
    return JSON.parse(localStorage.getItem('komik_library') || '{}');
  } catch (e) {
    return {};
  }
}

export function writeLibrary(l) {
  try {
    localStorage.setItem('komik_library', JSON.stringify(l));
  } catch (e) {}
}

export const libSupported = () => !!(navigator.storage && navigator.storage.getDirectory && window.Worker);

export let libWorker = null;

export let libSeq = 0;

export let libChain = Promise.resolve();

export const libPending = new Map();

export function libWrite(file, name) {
  if (!libWorker) {
    libWorker = new Worker(new URL('./workers/library.worker.js', import.meta.url), { type: 'module' });
    libWorker.onmessage = (e) => {
      const r = libPending.get(e.data.id);
      if (r) {
        libPending.delete(e.data.id);
        r(e.data);
      }
    };
    libWorker.onerror = () => {
      libPending.forEach((r) => r({ ok: false, error: 'worker failed' }));
      libPending.clear();
      libWorker = null;
    };
  }
  return new Promise((res) => {
    const id = ++libSeq;
    libPending.set(id, res);
    libWorker.postMessage({ id, name, file });
  });
}

export function saveToLibrary(file, id) {
  if (!settings.autoSave || !libSupported() || !id) return;
  libChain = libChain.then(async () => {
    if (readLibrary()[id]) return;
    try {
      const est = navigator.storage.estimate ? await navigator.storage.estimate() : null;
      if (est && est.quota && est.quota - (est.usage || 0) < file.size + 50 * 1048576) {
        showToast('Not enough free space to keep this book on the device.');
        return;
      }
      requestPersist();
      const r = await libWrite(file, id + '.arc');
      if (!r.ok) throw new Error(r.error);
      const lib = readLibrary();
      lib[id] = { name: file.name, size: file.size, savedAt: Date.now() };
      writeLibrary(lib);
      showToast(`Saved "${file.name}" on this device`);
      renderContinueCard();
      if (!recentsView.classList.contains('hidden')) renderRecentsList();
    } catch (e) {
      console.warn('Library save failed:', e);
      logIssue('library', e);
      showToast('Could not keep this book on the device. You can still read it.');
    }
  });
}

export async function openFromLibrary(id) {
  const lib = readLibrary(),
    meta = lib[id];
  if (!meta) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const f = await (await root.getFileHandle(id + '.arc')).getFile();
    if (f.size !== meta.size) throw new Error('size mismatch');
    await handleFilesSelect([new File([f], meta.name)], { id, fromLibrary: true });
    return true;
  } catch (e) {
    delete lib[id];
    writeLibrary(lib);
    showToast('That book is no longer stored on this device. Select the file again.');
    renderContinueCard();
    return false;
  }
}

export async function removeFromLibrary(id, silent) {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(id + '.arc');
  } catch (e) {}
  const lib = readLibrary();
  delete lib[id];
  writeLibrary(lib);
  if (silent) return;
  showToast('Removed from this device. Your progress is kept.');
  renderContinueCard();
  renderRecentsList();
  updateStorageInfo();
}

export async function removeAllFromLibrary() {
  const ids = Object.keys(readLibrary());
  if (!ids.length) {
    showToast('No saved books.');
    return;
  }
  if (!confirm(`Remove ${ids.length} saved book${ids.length === 1 ? '' : 's'} from this device? Your progress and bookmarks are kept.`))
    return;
  for (const id of ids) await removeFromLibrary(id, true);
  showToast('Saved books removed');
  renderContinueCard();
  renderRecentsList();
  updateStorageInfo();
}

/** Initialize saved books modal and management listeners. */
export function initLibrary() {
  libModal = document.createElement('div');
  libModal.className = 'fixed inset-0 z-[60] bg-[#0E0D0B]/80 backdrop-blur-xl hidden items-center justify-center p-4';
  libModal.setAttribute('role', 'dialog');
  libModal.setAttribute('aria-modal', 'true');
  libModal.setAttribute('aria-label', 'Saved books');
  libModal.innerHTML = `<div class="max-w-md w-full glass-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div class="flex justify-between items-center pb-3 border-b border-black/10 dark:border-white/10 shrink-0">
                <h2 class="text-base font-bold">Saved books</h2>
                <button id="closeLibBtn" aria-label="Close" class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="py-3 flex items-center justify-between gap-2 shrink-0">
                <div class="glass-pill p-1 rounded-2xl flex" role="group" aria-label="Sort">
                    <button data-sort="size" class="px-3 py-1.5 rounded-xl text-[11px] font-semibold">Largest</button>
                    <button data-sort="oldest" class="px-3 py-1.5 rounded-xl text-[11px] font-semibold">Not read lately</button>
                </div>
                <span id="libTotal" class="text-[11px] text-zinc-500 dark:text-zinc-400"></span>
            </div>
            <div id="libRows" class="overflow-y-auto flex-1 space-y-2"></div>
            <div class="pt-3 flex justify-between items-center shrink-0">
                <button id="libRemoveFinished" class="text-xs font-bold text-apple-blue hover:underline">Remove finished</button>
                <button id="libRemoveAll" class="text-xs font-bold text-rose-500 hover:underline">Remove all</button>
            </div></div>`;
  document.body.appendChild(libModal);

  libModal.querySelector('#closeLibBtn').addEventListener('click', closeLibraryManager);
  libModal.addEventListener('click', (e) => {
    if (e.target === libModal) closeLibraryManager();
  });

  libModal.querySelectorAll('[data-sort]').forEach((b) =>
    b.addEventListener('click', () => {
      libSort = b.dataset.sort;
      renderLibraryManager();
    })
  );

  libModal.querySelector('#libRemoveFinished').addEventListener('click', async () => {
    const h = readHistory();
    const ids = Object.keys(readLibrary()).filter((id) => h[id] && h[id].finished);
    if (!ids.length) {
      showToast('No finished books are kept on this device.');
      return;
    }
    if (!confirm(`Remove ${ids.length} finished book${ids.length === 1 ? '' : 's'} from this device? Your progress is kept.`)) return;
    for (const id of ids) await removeFromLibrary(id, true);
    afterLibraryChange();
  });

  libModal.querySelector('#libRemoveAll').addEventListener('click', async () => {
    await removeAllFromLibrary();
    renderLibraryManager();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLibraryManager();
  });
}

