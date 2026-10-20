/** Settings dialog and the progress line. */
import { thumbnailDrawer, zoneNext, zonePrev } from './dom.js';
import { openLibraryManager } from './library.js';
import { copyDiagnostics, syncWakeLock, updateStorageInfo } from './pwa.js';
import { renderView } from './reader.js';
import { renderRecentsList } from './shelf.js';
import { SETTINGS_DEFAULTS, appState, saveSettings, settings } from './state.js';
import { licenseModal } from './ui.js';

export let hairline;

export function syncHairline() {
  const n = appState.pages.length;
  hairline.style.width = (n > 1 ? (appState.currentIndex / (n - 1)) * 100 : 0) + '%';
  hairline.style.left = appState.isRTL ? 'auto' : '0';
  hairline.style.right = appState.isRTL ? '0' : 'auto';
  hairline.classList.toggle('opacity-0', !(settings.hairline && !appState.uiVisible && n > 0));
}

export function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  zonePrev.style.width = zoneNext.style.width = settings.zoneWidth + '%';
  syncHairline();
  syncWakeLock();
}

export const settingRows = [
  {
    key: 'theme',
    type: 'seg',
    label: 'Color theme',
    opts: [
      ['press', 'Press Green'],
      ['classic', 'Classic Blue']
    ]
  },
  {
    key: 'curl',
    type: 'switch',
    label: 'Page curl animation',
    hint: 'Peel effect when turning pages. Also follows your device reduce-motion setting.'
  },
  {
    key: 'keepZoom',
    type: 'switch',
    label: 'Keep zoom between pages',
    hint: 'Stay zoomed in when the page changes. Push past the edge to turn the page.'
  },
  { key: 'perBook', type: 'switch', label: 'Remember view per book', hint: 'Reading mode, fit, and direction are saved for each book.' },
  { key: 'hairline', type: 'switch', label: 'Progress line', hint: 'Show a thin progress line when the controls are hidden.' },
  {
    key: 'zoneWidth',
    type: 'seg',
    label: 'Tap zone width',
    opts: [
      [20, 'Narrow'],
      [25, 'Standard'],
      [35, 'Wide']
    ]
  },
  { key: 'swapZones', type: 'switch', label: 'Swap tap zones', hint: 'The left tap goes forward. Useful for left-handed reading.' },
  {
    key: 'truePrev',
    type: 'switch',
    label: 'Previous page like a book',
    hint: 'Going back drags the previous page over the current one instead of peeling the current page away.'
  },
  {
    key: 'coverAlone',
    type: 'switch',
    label: 'Spread: cover page alone',
    hint: 'Show the first page by itself in Spread mode so pairs match printed double pages.'
  },
  {
    key: 'wakeLock',
    type: 'switch',
    label: 'Keep screen awake while reading',
    hint: 'Needs a secure (https) connection and a browser that supports it.'
  },
  {
    key: 'autoSave',
    type: 'switch',
    label: 'Keep opened books on this device',
    hint: 'Lets you reopen a book from the Shelf without choosing the file again. Uses storage space.'
  },
  {
    key: 'groupSeries',
    type: 'switch',
    label: 'Group books by series',
    hint: 'Uses the series name from ComicInfo.xml when a book has one.'
  },
  {
    type: 'action',
    label: 'Saved books',
    hint: 'See what is kept on this device, by size, and free up space. Progress and bookmarks stay.',
    btn: 'Manage',
    fn: () => openLibraryManager()
  },
  {
    type: 'action',
    label: 'Diagnostics',
    hint: 'Copy technical details (no book names) to share when something does not work.',
    btn: 'Copy',
    fn: () => copyDiagnostics()
  }
];

export let settingsModal;

export let settingsList;

export let settingsPrevFocus = null;

export function renderSettings(focusId) {
  settingsList.innerHTML = '';
  settingRows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'py-3 border-b border-black/10 dark:border-white/10';
    const head = document.createElement('div');
    head.className = 'flex items-center justify-between gap-3';
    const lab = document.createElement('div');
    lab.className = 'min-w-0';
    const t = document.createElement('p');
    t.className = 'text-sm font-semibold';
    t.textContent = r.label;
    lab.appendChild(t);
    if (r.hint) {
      const h = document.createElement('p');
      h.className = 'text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5';
      h.textContent = r.hint;
      lab.appendChild(h);
    }
    head.appendChild(lab);
    row.appendChild(head);
    if (r.type === 'switch') {
      const on = !!settings[r.key];
      const b = document.createElement('button');
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-label', r.label);
      b.dataset.f = r.key;
      b.className = 'relative w-12 h-7 rounded-full shrink-0 transition ' + (on ? 'bg-apple-blue' : 'bg-black/20 dark:bg-white/20');
      b.innerHTML = `<span class="absolute top-0.5 ${on ? 'left-[22px]' : 'left-0.5'} w-6 h-6 rounded-full bg-white shadow transition-all"></span>`;
      b.onclick = () => {
        settings[r.key] = !settings[r.key];
        saveSettings();
        applySettings();
        if (r.key === 'coverAlone' && appState.pages.length) renderView();
        if (r.key === 'groupSeries') renderRecentsList();
        renderSettings(r.key);
      };
      head.appendChild(b);
    } else if (r.type === 'action') {
      const b = document.createElement('button');
      b.className = 'px-3 py-2 glass-button text-xs font-bold rounded-xl shrink-0';
      b.textContent = r.btn;
      b.onclick = () => r.fn();
      head.appendChild(b);
    } else {
      const seg = document.createElement('div');
      seg.className = 'glass-pill p-1 rounded-2xl flex mt-2';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', r.label);
      r.opts.forEach(([v, name]) => {
        const on = String(settings[r.key]) === String(v);
        const b = document.createElement('button');
        b.dataset.f = r.key + ':' + v;
        b.setAttribute('aria-pressed', String(on));
        b.className =
          'flex-1 py-2 rounded-xl text-xs font-semibold transition ' +
          (on ? 'bg-apple-blue text-white' : 'text-zinc-600 dark:text-zinc-300');
        b.textContent = name;
        b.onclick = () => {
          settings[r.key] = v;
          saveSettings();
          applySettings();
          renderSettings(r.key + ':' + v);
        };
        seg.appendChild(b);
      });
      row.appendChild(seg);
    }
    settingsList.appendChild(row);
  });
  if (focusId) {
    const el = settingsList.querySelector(`[data-f="${focusId}"]`);
    if (el) el.focus();
  }
}

export function openSettings() {
  settingsPrevFocus = document.activeElement;
  updateStorageInfo();
  renderSettings();
  settingsModal.classList.remove('hidden');
  settingsModal.classList.add('flex');
  const f = settingsList.querySelector('button');
  if (f) f.focus();
}

export function closeSettings() {
  if (settingsModal.classList.contains('hidden')) return;
  settingsModal.classList.add('hidden');
  settingsModal.classList.remove('flex');
  if (settingsPrevFocus && settingsPrevFocus.focus) settingsPrevFocus.focus();
}

/** Initialize settings hairline, settings modal, observer, and defaults. */
export function initSettingsUI() {
  hairline = document.createElement('div');
  hairline.className = 'fixed bottom-0 h-[3px] bg-apple-blue z-20 pointer-events-none transition-opacity duration-300 opacity-0';
  hairline.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hairline);

  settingsModal = document.createElement('div');
  settingsModal.className = 'fixed inset-0 z-50 bg-[#0E0D0B]/80 backdrop-blur-xl hidden items-center justify-center p-4';
  settingsModal.setAttribute('role', 'dialog');
  settingsModal.setAttribute('aria-modal', 'true');
  settingsModal.setAttribute('aria-labelledby', 'settingsTitle');
  settingsModal.innerHTML = `<div class="max-w-md w-full glass-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div class="flex justify-between items-center pb-3 border-b border-black/10 dark:border-white/10 shrink-0">
                <h2 id="settingsTitle" class="text-base font-bold">Settings</h2>
                <button id="closeSettingsBtn" aria-label="Close settings" class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="settingsList" class="overflow-y-auto flex-1"></div>
            <p id="storageInfo" class="text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 shrink-0"></p>
            <div class="pt-3 flex justify-between items-center shrink-0">
                <button id="resetSettingsBtn" class="text-xs font-bold text-apple-blue hover:underline">Reset to defaults</button>
                <button id="doneSettingsBtn" class="px-5 py-2.5 glass-button text-xs font-bold rounded-xl">Done</button>
            </div></div>`;
  document.body.appendChild(settingsModal);

  settingsList = settingsModal.querySelector('#settingsList');

  settingsModal.querySelector('#closeSettingsBtn').addEventListener('click', closeSettings);
  settingsModal.querySelector('#doneSettingsBtn').addEventListener('click', closeSettings);
  settingsModal.querySelector('#resetSettingsBtn').addEventListener('click', () => {
    Object.assign(settings, SETTINGS_DEFAULTS);
    try {
      localStorage.removeItem('komik_hints');
    } catch (e) {}
    saveSettings();
    applySettings();
    renderSettings();
  });
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  const menuSettingsBtn = document.getElementById('menuSettingsBtn');
  if (menuSettingsBtn) menuSettingsBtn.addEventListener('click', openSettings);

  const homeSettingsBtn = document.getElementById('homeSettingsBtn');
  if (homeSettingsBtn) homeSettingsBtn.addEventListener('click', openSettings);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) licenseModal.classList.add('hidden');
    }
    if (e.key === 'Tab' && !settingsModal.classList.contains('hidden')) {
      const f = Array.from(settingsModal.querySelectorAll('button')).filter((b) => b.offsetParent !== null);
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  if (thumbnailDrawer) {
    thumbnailDrawer.inert = true;
    new MutationObserver(() => {
      thumbnailDrawer.inert = thumbnailDrawer.classList.contains('-translate-x-[110%]');
    }).observe(thumbnailDrawer, { attributes: true, attributeFilter: ['class'] });
  }

  applySettings();
}
