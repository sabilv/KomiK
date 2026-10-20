/** Toasts, loading overlay, side panel, dialogs and other shared interface helpers. */
import {
  bottomNavbar,
  browseFilesBtn,
  closeDrawerBtn,
  fileInput,
  fullscreenBtn,
  loadingOverlay,
  loadingText,
  openFileBtnTop,
  quickShelfBtn,
  tabRecentsBtn,
  thumbnailDrawer,
  toastMessage,
  toastNotification,
  toggleDrawerBtn,
  toggleRtlBtn,
  topNavbar
} from './dom.js';
import { setGuided } from './guided.js';
import { renderView, setFitMode } from './reader.js';
import { syncHairline } from './settingsui.js';
import { appState } from './state.js';

export function showToast(message, duration = 3000) {
  toastMessage.textContent = message;
  toastNotification.classList.remove('hidden');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => {
    toastNotification.classList.add('hidden');
  }, duration);
}

export const triggerFilePicker = () => {
  fileInput.value = '';
  fileInput.click();
};

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function toggleUI() {
  appState.uiVisible = !appState.uiVisible;
  topNavbar.classList.toggle('ui-hidden', !appState.uiVisible);
  bottomNavbar.classList.toggle('ui-hidden', !appState.uiVisible);
  syncHairline();
}

export function toggleDrawer(forceState) {
  const isOpen = forceState !== undefined ? forceState : thumbnailDrawer.classList.contains('-translate-x-[110%]');
  if (isOpen) {
    thumbnailDrawer.classList.remove('-translate-x-[110%]');
  } else {
    thumbnailDrawer.classList.add('-translate-x-[110%]');
  }
}

export function showLoading(show, text = 'Loading...') {
  if (show) {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

export let licenseModal;

export let openLicenseBtns;

export let closeLicenseBtn;

export let dismissLicenseBtn;

export let modalTabLicense;

export let modalTabChangelog;

export let modalContentLicense;

export let modalContentChangelog;

export let moreBtn;

export let moreMenu;

export let menuFitBtn;

export function closeMore() {
  moreMenu.classList.add('hidden');
  moreBtn.setAttribute('aria-expanded', 'false');
}

export let helpModal;

export const keys = [
  ['Arrow keys, A / D, Space', 'Turn page (or next panel in Guided View)'],
  ['G', 'Guided View on or off'],
  ['B', 'Bookmark this page'],
  ['T', 'Open or close the page panel'],
  ['F', 'Fullscreen'],
  ['+ / - / 0', 'Zoom in, out, reset'],
  ['?', 'This help'],
  ['Esc', 'Close dialogs']
];

export const openHelp = () => {
  helpModal.classList.remove('hidden');
  helpModal.classList.add('flex');
  helpModal.querySelector('button').focus();
};

export const closeHelp = () => {
  helpModal.classList.add('hidden');
  helpModal.classList.remove('flex');
};

/** Load-time work, run by main.js in the original order. */
export const steps = [
  [
    76,
    () => {
      browseFilesBtn.addEventListener('click', triggerFilePicker);
    }
  ],
  [
    77,
    () => {
      openFileBtnTop.addEventListener('click', triggerFilePicker);
    }
  ],
  [
    94,
    () => {
      quickShelfBtn.addEventListener('click', () => {
        toggleDrawer(true);
        tabRecentsBtn.click();
      });
    }
  ],
  [
    214,
    () => {
      toggleRtlBtn.addEventListener('click', () => {
        appState.isRTL = !appState.isRTL;
        toggleRtlBtn.classList.toggle('bg-apple-blue', appState.isRTL);
        toggleRtlBtn.classList.toggle('text-white', appState.isRTL);

        const rtlBtnText = document.getElementById('rtlBtnText');
        if (rtlBtnText) {
          rtlBtnText.textContent = appState.isRTL ? 'RTL' : 'LTR';
        }

        showToast(appState.isRTL ? 'Manga Mode (Right-to-Left)' : 'Comic Mode (Left-to-Right)');
        renderView();
      });
    }
  ],
  [
    218,
    () => {
      toggleDrawerBtn.addEventListener('click', () => toggleDrawer());
    }
  ],
  [
    219,
    () => {
      closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));
    }
  ],
  [
    222,
    () => {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      });
    }
  ],
  [
    229,
    () => {
      licenseModal = document.getElementById('licenseModal');
    }
  ],
  [
    230,
    () => {
      openLicenseBtns = document.querySelectorAll('.open-license-btn');
    }
  ],
  [
    231,
    () => {
      closeLicenseBtn = document.getElementById('closeLicenseBtn');
    }
  ],
  [
    232,
    () => {
      dismissLicenseBtn = document.getElementById('dismissLicenseBtn');
    }
  ],
  [
    233,
    () => {
      modalTabLicense = document.getElementById('modalTabLicense');
    }
  ],
  [
    234,
    () => {
      modalTabChangelog = document.getElementById('modalTabChangelog');
    }
  ],
  [
    235,
    () => {
      modalContentLicense = document.getElementById('modalContentLicense');
    }
  ],
  [
    236,
    () => {
      modalContentChangelog = document.getElementById('modalContentChangelog');
    }
  ],
  [
    237,
    () => {
      openLicenseBtns.forEach((btn) => btn.addEventListener('click', () => licenseModal.classList.remove('hidden')));
    }
  ],
  [
    238,
    () => {
      if (closeLicenseBtn) closeLicenseBtn.addEventListener('click', () => licenseModal.classList.add('hidden'));
    }
  ],
  [
    239,
    () => {
      if (dismissLicenseBtn) dismissLicenseBtn.addEventListener('click', () => licenseModal.classList.add('hidden'));
    }
  ],
  [
    240,
    () => {
      if (licenseModal) {
        licenseModal.addEventListener('click', (e) => {
          if (e.target === licenseModal) licenseModal.classList.add('hidden');
        });
      }
    }
  ],
  [
    241,
    () => {
      if (modalTabLicense && modalTabChangelog) {
        modalTabLicense.addEventListener('click', () => {
          modalTabLicense.classList.add('text-apple-blue', 'border-b-2', 'border-apple-blue');
          modalTabLicense.classList.remove('text-zinc-400');
          modalTabChangelog.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
          modalTabChangelog.classList.add('text-zinc-400');
          modalContentLicense.classList.remove('hidden');
          modalContentChangelog.classList.add('hidden');
        });

        modalTabChangelog.addEventListener('click', () => {
          modalTabChangelog.classList.add('text-apple-blue', 'border-b-2', 'border-apple-blue');
          modalTabChangelog.classList.remove('text-zinc-400');
          modalTabLicense.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
          modalTabLicense.classList.add('text-zinc-400');
          modalContentChangelog.classList.remove('hidden');
          modalContentLicense.classList.add('hidden');
        });
      }
    }
  ],
  [
    276,
    () => {
      moreBtn = document.getElementById('moreBtn');
    }
  ],
  [
    277,
    () => {
      moreMenu = document.getElementById('moreMenu');
    }
  ],
  [
    278,
    () => {
      menuFitBtn = document.getElementById('menuFitBtn');
    }
  ],
  [
    280,
    () => {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = moreMenu.classList.toggle('hidden') === false;
        moreBtn.setAttribute('aria-expanded', String(open));
        menuFitBtn.querySelector('span').textContent = appState.fitMode === 'page' ? 'Fit to width' : 'Fit to page';
      });
    }
  ],
  [
    281,
    () => {
      menuFitBtn.addEventListener('click', () => setFitMode(appState.fitMode === 'page' ? 'width' : 'page'));
    }
  ],
  [
    282,
    () => {
      moreMenu.addEventListener('click', closeMore);
    }
  ],
  [
    283,
    () => {
      document.addEventListener('click', (e) => {
        if (!moreMenu.contains(e.target) && e.target !== moreBtn && !moreBtn.contains(e.target)) closeMore();
      });
    }
  ],
  [
    284,
    () => {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMore();
      });
    }
  ],
  [
    373,
    () => {
      helpModal = document.createElement('div');
    }
  ],
  [
    374,
    () => {
      helpModal.className = 'fixed inset-0 z-50 bg-[#0E0D0B]/80 backdrop-blur-xl hidden items-center justify-center p-4';
    }
  ],
  [
    375,
    () => {
      helpModal.setAttribute('role', 'dialog');
    }
  ],
  [
    376,
    () => {
      helpModal.setAttribute('aria-modal', 'true');
    }
  ],
  [
    377,
    () => {
      helpModal.setAttribute('aria-label', 'Keyboard shortcuts');
    }
  ],
  [
    379,
    () => {
      helpModal.innerHTML = `<div class="max-w-md w-full glass-card rounded-3xl p-6 shadow-2xl"><div class="flex justify-between items-center pb-3 border-b border-black/10 dark:border-white/10 mb-2"><h2 class="text-base font-bold">Keyboard shortcuts</h2><button id="closeHelpBtn" aria-label="Close" class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><i class="fa-solid fa-xmark"></i></button></div>${keys.map((k) => `<div class="flex justify-between gap-4 py-2 text-xs border-b border-black/5 dark:border-white/5"><span class="font-mono font-bold">${k[0]}</span><span class="text-zinc-500 dark:text-zinc-400 text-right">${k[1]}</span></div>`).join('')}</div>`;
    }
  ],
  [
    380,
    () => {
      document.body.appendChild(helpModal);
    }
  ],
  [
    383,
    () => {
      helpModal.querySelector('#closeHelpBtn').addEventListener('click', closeHelp);
    }
  ],
  [
    384,
    () => {
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) closeHelp();
      });
    }
  ],
  [
    385,
    () => {
      document.getElementById('menuHelpBtn').addEventListener('click', openHelp);
    }
  ],
  [
    388,
    () => {
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey) return;
        if (e.key === 'Escape') closeHelp();
        else if (e.key === 'g' || e.key === 'G') setGuided(!appState.guided);
        else if (e.key === '?') openHelp();
      });
    }
  ]
];
