/** Opening files: format detection, CBZ / CBR / image parsing, drag and drop, sample comic. */
import JSZip from 'jszip';
import { abortCurl } from './curl.js';
import {
  closeComicBtn,
  comicTitle,
  demoComicBtn,
  dropZone,
  fileInput,
  pageCounterTop,
  pageDisplay,
  pageInput,
  pageNumberPrev,
  pageNumberTotal,
  pageSlider,
  readingEstimateBottom,
  readingEstimateDivider,
  readingTimeTop,
  thumbnailDrawer,
  thumbnailGrid,
  totalPagesText,
  webtoonDisplay
} from './dom.js';
import { setGuided } from './guided.js';
import { saveToLibrary } from './library.js';
import { clearPageCaches } from './pages.js';
import { mimeOf, parseComicInfo } from './pure.js';
import { syncWakeLock } from './pwa.js';
import { loadPagesIntoApp } from './reader.js';
import { syncHairline } from './settingsui.js';
import { renderContinueCard } from './shelf.js';
import { appState } from './state.js';
import { showLoading, showToast, toggleDrawer } from './ui.js';

export function closeCurrentComic() {
  abortCurl();
  clearPageCaches();
  appState.pages = [];
  appState.pageNames = [];
  appState.currentIndex = 0;
  appState.fileName = '';
  appState.bookId = null;
  renderContinueCard();
  syncHairline();
  if (appState.guided) setGuided(false, true);
  syncWakeLock();

  comicTitle.textContent = 'KomiK';
  pageCounterTop.textContent = '0 / 0 pages';
  pageNumberPrev.textContent = '0';
  pageNumberTotal.textContent = '0';
  totalPagesText.textContent = '/ 0';

  readingTimeTop.classList.add('hidden');
  readingEstimateBottom.classList.add('hidden');
  readingEstimateDivider.classList.add('hidden');

  pageSlider.min = 1;
  pageSlider.max = 1;
  pageSlider.value = 1;
  pageInput.value = 1;

  pageDisplay.innerHTML = '';
  webtoonDisplay.innerHTML = '';
  thumbnailGrid.innerHTML = '';

  dropZone.classList.remove('hidden');
  if (closeComicBtn) closeComicBtn.classList.add('hidden');

  if (!thumbnailDrawer.classList.contains('-translate-x-[110%]')) {
    toggleDrawer(false);
  }
  showToast('Book closed');
}

export async function sniffArchive(file) {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5 || b[2] === 7)) return 'zip';
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 && b[4] === 0x1a && b[5] === 0x07) return 'rar';
  const n = file.name.toLowerCase();
  if (n.endsWith('.cbz') || n.endsWith('.zip')) return 'zip';
  if (n.endsWith('.cbr') || n.endsWith('.rar')) return 'rar';
  return 'other';
}

export async function handleFilesSelect(files, opts = {}) {
  if (!files || files.length === 0) return;
  showLoading(true, 'Reading file contents...');
  appState.loadingMeta = null;
  try {
    if (files.length === 1) {
      const file = files[0];
      appState.loadingName = file.name;
      appState.loadingId = opts.id || (await computeBookId([file]));
      const kind = await sniffArchive(file);
      if (kind === 'zip') await parseCBZ(file);
      else if (kind === 'rar') await parseRAR(file);
      else if (file.type.startsWith('image/')) await parseImagesList([file]);
      else throw new Error('Unsupported file format. Please open a .cbz, .cbr or .zip archive.');
      if (!opts.fromLibrary && (kind === 'zip' || kind === 'rar')) saveToLibrary(file, appState.bookId);
    } else {
      const arr = Array.from(files);
      appState.loadingName = 'Loose Images Collection';
      appState.loadingId = await computeBookId(arr);
      await parseImagesList(arr);
    }
  } catch (err) {
    console.error('Error reading comic file:', err);
    showToast('Failed to open: ' + err.message);
  } finally {
    showLoading(false);
  }
}

export async function parseCBZ(file) {
  showLoading(true, 'Reading archive index...');
  const zip = await new JSZip().loadAsync(file);
  try {
    const ci = zip.file(/(^|\/)ComicInfo\.xml$/i)[0];
    if (ci) appState.loadingMeta = parseComicInfo(await ci.async('string'));
  } catch (e) {}
  const entries = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && !path.includes('__MACOSX') && mimeOf(path)) entries.push(entry);
  });
  if (entries.length === 0) throw new Error('No valid image files found inside the CBZ archive.');
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  entries.sort((a, b) => collator.compare(a.name, b.name));
  loadPagesIntoApp(
    entries.map((en) => async () => new Blob([await en.async('arraybuffer')], { type: mimeOf(en.name) })),
    entries.map((en) => en.name)
  );
}

export async function parseRAR(file) {
  showLoading(true, 'Reading RAR archive...');
  const [{ default: rarSrc }, { default: rarB64 }] = await Promise.all([
    import('./assets/rar-worker.txt?raw'),
    import('./assets/unrar-wasm-b64.txt?raw')
  ]);
  const w = new Worker(URL.createObjectURL(new Blob([rarSrc], { type: 'text/javascript' })));
  const pending = new Map();
  let seq = 0;
  const call = (msg, tr) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      w.postMessage({ ...msg, id }, tr || []);
    });
  w.onmessage = (e) => {
    const q = pending.get(e.data.id);
    if (!q) return;
    pending.delete(e.data.id);
    e.data.error ? q.rej(new Error(e.data.error)) : q.res(e.data);
  };
  w.onerror = () => {
    pending.forEach((q) => q.rej(new Error('RAR worker failed')));
    pending.clear();
  };
  try {
    const wasm = Uint8Array.from(atob(rarB64.trim()), (c) => c.charCodeAt(0)).buffer;
    const data = await file.arrayBuffer();
    const { names } = await call({ cmd: 'open', wasm, data }, [wasm, data]);
    try {
      const ci = names.find((n) => /(^|\/)ComicInfo\.xml$/i.test(n));
      if (ci) appState.loadingMeta = parseComicInfo(new TextDecoder().decode((await call({ cmd: 'get', name: ci })).data));
    } catch (e) {}
    const list = names.filter((n) => mimeOf(n) && !n.includes('__MACOSX'));
    if (list.length === 0) throw new Error('No comic images found in CBR archive.');
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    list.sort((a, b) => collator.compare(a, b));
    loadPagesIntoApp(
      list.map((n) => async () => new Blob([(await call({ cmd: 'get', name: n })).data], { type: mimeOf(n) })),
      list
    );
    appState.rarWorker = w;
  } catch (err) {
    w.terminate();
    throw err;
  }
}

export async function parseImagesList(filesList) {
  const validExtensions = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  const filteredFiles = filesList.filter((f) => validExtensions.includes(f.type) || f.type.startsWith('image/'));

  if (filteredFiles.length === 0) {
    throw new Error('No valid image files selected.');
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  filteredFiles.sort((a, b) => collator.compare(a.name, b.name));

  loadPagesIntoApp(
    filteredFiles.map((f) => async () => f),
    filteredFiles.map((f) => f.name)
  );
}

export function generateDemoComic() {
  showLoading(true, 'Generating Sample Comic...');
  setTimeout(() => {
    const demoPages = [];
    const demoNames = [];
    const totalDemoPages = 6;

    const CLASSIC_TEMPLATES = [
      {
        title: 'THE MYSTERY OF THE GOLD KEY',
        chapter: 'CHAPTER 1: THE DISCOVERY',
        bg: '#09090b',
        border: '#27272a',
        accent: '#38C27B',
        quote: 'In the dusty archives of Greenfield Library...'
      },
      {
        title: 'CHAPTER 2: THE MAP ROOM',
        chapter: 'UNCOVERING SECRET TRAILS',
        bg: '#18181b',
        border: '#3f3f46',
        accent: '#E8B93A',
        quote: 'The old parchment held secrets centuries hidden.'
      },
      {
        title: 'CHAPTER 3: THE MIDNIGHT CLUE',
        chapter: 'SHADOWS IN THE ALLEY',
        bg: '#09090b',
        border: '#27272a',
        accent: '#38C27B',
        quote: 'Footsteps echoed against the cobblestone street...'
      },
      {
        title: 'CHAPTER 4: THE HIDDEN VAULT',
        chapter: 'BEHIND THE BOOKSHELF',
        bg: '#18181b',
        border: '#38C27B',
        accent: '#00A859',
        quote: 'A subtle turn of the brass dial unlocked the door.'
      },
      {
        title: 'CHAPTER 5: THE LOST TREASURE',
        chapter: 'TRUTH REVEALED',
        bg: '#09090b',
        border: '#27272a',
        accent: '#38C27B',
        quote: 'Inside lay the missing manuscripts of antiquity!'
      },
      {
        title: 'TO BE CONTINUED',
        chapter: 'THANK YOU FOR READING',
        bg: '#18181b',
        border: '#38C27B',
        accent: '#38C27B',
        quote: 'Export to EPUB or load your own .CBZ file anytime!'
      }
    ];

    for (let i = 0; i < totalDemoPages; i++) {
      const tmpl = CLASSIC_TEMPLATES[i];
      const textColor = '#f4f4f5';
      const panelFill = '#18181b';

      const svgString = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1150" viewBox="0 0 800 1150">
                        <rect width="800" height="1150" fill="${tmpl.bg}"/>
                        <rect x="25" y="25" width="750" height="1100" fill="none" stroke="${tmpl.border}" stroke-width="4"/>
                        <rect x="35" y="35" width="730" height="1080" fill="none" stroke="${tmpl.accent}" stroke-width="2"/>
                        <rect x="50" y="60" width="700" height="100" fill="${panelFill}" stroke="${tmpl.border}" stroke-width="3" rx="16"/>
                        <text x="400" y="110" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="28" fill="${tmpl.accent}" text-anchor="middle" letter-spacing="1">${tmpl.title}</text>
                        <text x="400" y="140" font-family="'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="14" fill="${textColor}" text-anchor="middle">${tmpl.chapter}</text>
                        <rect x="50" y="180" width="340" height="420" fill="${panelFill}" stroke="${tmpl.border}" stroke-width="3" rx="16"/>
                        <circle cx="220" cy="350" r="100" fill="none" stroke="${tmpl.accent}" stroke-width="3" stroke-dasharray="12 6"/>
                        <text x="220" y="355" font-family="sans-serif" font-weight="800" font-size="16" fill="${textColor}" text-anchor="middle">PANEL 1</text>
                        <rect x="410" y="180" width="340" height="420" fill="${panelFill}" stroke="${tmpl.border}" stroke-width="3" rx="16"/>
                        <polygon points="580,240 680,440 480,440" fill="none" stroke="${tmpl.accent}" stroke-width="3"/>
                        <text x="580" y="355" font-family="sans-serif" font-weight="800" font-size="16" fill="${textColor}" text-anchor="middle">PANEL 2</text>
                        <rect x="440" y="210" width="280" height="70" rx="15" fill="#27272a" stroke="#38C27B" stroke-width="2"/>
                        <text x="580" y="250" font-family="sans-serif" font-weight="700" font-size="14" fill="#f4f4f5" text-anchor="middle">"${tmpl.quote}"</text>
                        <rect x="50" y="620" width="700" height="400" fill="${panelFill}" stroke="${tmpl.border}" stroke-width="3" rx="16"/>
                        <rect x="80" y="650" width="640" height="340" fill="none" stroke="${tmpl.accent}" stroke-width="2" stroke-dasharray="8 8" rx="12"/>
                        <text x="400" y="800" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="32" fill="${textColor}" text-anchor="middle">FEATURED COMIC SCENE</text>
                        <text x="400" y="840" font-family="sans-serif" font-weight="600" font-size="16" fill="${tmpl.accent}" text-anchor="middle">PAGE ${i + 1} OF ${totalDemoPages}</text>
                        <text x="400" y="1080" font-family="sans-serif" font-weight="700" font-size="14" fill="${textColor}" text-anchor="middle">- ${i + 1} -</text>
                    </svg>`;

      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      demoPages.push(async () => blob);
      demoNames.push(`Page_${i + 1}.svg`);
    }

    appState.loadingName = 'The Mystery of the Gold Key (Sample)';
    appState.loadingId = 'demo-sample';
    appState.loadingMeta = null;
    loadPagesIntoApp(demoPages, demoNames);
    showLoading(false);
  }, 300);
}

export let dropOverlay;

export let dragDepth = 0;

export const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

export const setDropOverlay = (on) => {
  dropOverlay.classList.toggle('hidden', !on);
  dropOverlay.classList.toggle('flex', on);
};

export async function computeBookId(files) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  const feed = (arr) => {
    for (let i = 0; i < arr.length; i++) {
      h1 = Math.imul(h1 ^ arr[i], 2654435761);
      h2 = Math.imul(h2 ^ arr[i], 1597334677);
    }
  };
  let total = 0;
  const CH = 65536;
  for (const f of files) {
    total += f.size;
    feed(new TextEncoder().encode(files.length > 1 ? f.name + ':' + f.size : String(f.size)));
    if (files.length === 1) {
      feed(new Uint8Array(await f.slice(0, CH).arrayBuffer()));
      feed(new Uint8Array(await f.slice(Math.max(0, f.size - CH)).arrayBuffer()));
    }
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'b' + total.toString(36) + '-' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** Load-time work, run by main.js in the original order. */
export const steps = [
  [
    78,
    () => {
      if (closeComicBtn) closeComicBtn.addEventListener('click', closeCurrentComic);
    }
  ],
  [
    79,
    () => {
      fileInput.addEventListener('change', (e) => handleFilesSelect(e.target.files));
    }
  ],
  [
    81,
    () => {
      demoComicBtn.addEventListener('click', () => generateDemoComic());
    }
  ],
  [
    242,
    () => {
      dropOverlay = document.createElement('div');
    }
  ],
  [
    243,
    () => {
      dropOverlay.className = 'fixed inset-0 z-[90] hidden items-center justify-center bg-zinc-950/70 backdrop-blur-sm pointer-events-none';
    }
  ],
  [
    244,
    () => {
      dropOverlay.innerHTML =
        '<div class="glass-card rounded-3xl px-8 py-6 text-sm font-bold flex items-center space-x-3 border-2 border-dashed border-apple-blue"><i class="fa-solid fa-file-arrow-down text-apple-blue text-xl"></i><span>Drop to open comic</span></div>';
    }
  ],
  [
    245,
    () => {
      document.body.appendChild(dropOverlay);
    }
  ],
  [
    249,
    () => {
      window.addEventListener('dragenter', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth++;
        setDropOverlay(true);
      });
    }
  ],
  [
    250,
    () => {
      window.addEventListener('dragover', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
    }
  ],
  [
    251,
    () => {
      window.addEventListener('dragleave', (e) => {
        if (!hasFiles(e)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setDropOverlay(false);
      });
    }
  ],
  [
    252,
    () => {
      window.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth = 0;
        setDropOverlay(false);
        if (e.dataTransfer.files.length) handleFilesSelect(e.dataTransfer.files);
      });
    }
  ],
  [
    333,
    () => {
      if ('launchQueue' in window) {
        launchQueue.setConsumer(async (params) => {
          if (!params.files || !params.files.length) return;
          handleFilesSelect(await Promise.all(params.files.map((h) => h.getFile())));
        });
      }
    }
  ]
];
