/** Guided View (panel by panel) and first-run hints. */
import { peekHint } from './curl.js';
import { pageDisplay, viewportContainer } from './dom.js';
import { imgReady } from './pages.js';
import { getNextIndex, getPrevIndex } from './paging.js';
import { detectPanelsFromGray } from './pure.js';
import { applyTransform, bumpEdge, goToPage, resetZoomAndPan } from './reader.js';
import { appState } from './state.js';
import { showToast, toggleUI } from './ui.js';

export function detectPanels(img) {
  const k = Math.min(1, 360 / img.naturalWidth);
  const W = Math.max(8, Math.round(img.naturalWidth * k)),
    H = Math.max(8, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const g = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
  return detectPanelsFromGray(g, W, H, appState.isRTL);
}

export let guidedHud;

export function updateGuidedHud() {
  const n = appState.panels.length;
  guidedHud.textContent = n ? `Panel ${appState.panelIdx + 1} / ${n}` : 'Full page';
}

export function guidedFocus(animate) {
  const w = document.getElementById('transformWrapper');
  if (!w) return;
  const r = appState.panels.length ? appState.panels[appState.panelIdx] : [0, 0, 1, 1];
  const iw = w.offsetWidth,
    ih = w.offsetHeight;
  const vw = viewportContainer.clientWidth,
    vh = viewportContainer.clientHeight;
  const z = Math.max(1, Math.min(4, Math.min((vw - 32) / ((r[2] - r[0]) * iw), (vh - 32) / ((r[3] - r[1]) * ih))));
  appState.zoomLevel = z;
  appState.panX = -(((r[0] + r[2]) / 2 - 0.5) * iw) * z;
  appState.panY = -(((r[1] + r[3]) / 2 - 0.5) * ih) * z;
  appState.camMs = 0.5;
  applyTransform(animate);
  setTimeout(() => {
    appState.camMs = 0;
  }, 520);
}

export async function guidedOnPage() {
  const idx = appState.currentIndex,
    enter = appState.guidedEnter || 'first';
  appState.guidedEnter = null;
  appState.guidedBusy = true;
  appState.panels = [];
  try {
    const img = pageDisplay.querySelector('img');
    if (!img) return;
    await imgReady(img);
    if (!appState.guided || idx !== appState.currentIndex) return;
    const key = idx + ':' + appState.isRTL;
    let panels = appState.panelCache.get(key);
    if (!panels) {
      try {
        panels = detectPanels(img);
      } catch (e) {
        panels = [];
      }
      appState.panelCache.set(key, panels);
    }
    appState.panels = panels;
    appState.panelIdx = enter === 'last' ? Math.max(0, panels.length - 1) : 0;
    guidedFocus(true);
    updateGuidedHud();
  } finally {
    appState.guidedBusy = false;
  }
}

export function guidedStep(dir) {
  if (!appState.guided) return false;
  if (appState.guidedBusy) return true;
  const n = appState.panels.length,
    next = appState.panelIdx + dir;
  if (n && next >= 0 && next < n) {
    appState.panelIdx = next;
    guidedFocus(true);
    updateGuidedHud();
    return true;
  }
  const target = dir > 0 ? getNextIndex() : getPrevIndex();
  if (target === null) {
    bumpEdge(dir > 0 ? 'right' : 'left');
    return true;
  }
  appState.guidedEnter = dir > 0 ? 'first' : 'last';
  appState.noCurlOnce = true;
  goToPage(target);
  return true;
}

export function setGuided(on, silent) {
  if (on) {
    if (appState.pages.length === 0) {
      showToast('Open a comic first.');
      return;
    }
    if (appState.viewMode !== 'single') {
      showToast('Guided View works in Single page mode.');
      return;
    }
    appState.guided = true;
    appState.panels = [];
    if (appState.uiVisible) toggleUI();
    guidedHud.classList.remove('hidden');
    if (!silent) showToast('Guided View (beta): tap the sides or swipe to move panel by panel. Tap the center for controls.', 4500);
    guidedOnPage();
  } else {
    appState.guided = false;
    appState.guidedBusy = false;
    guidedHud.classList.add('hidden');
    resetZoomAndPan(true);
    if (!silent) showToast('Guided View off');
  }
}

export let gSwipe = null;

export function maybeShowHints() {
  try {
    if (localStorage.getItem('komik_hints') === '1') return;
    localStorage.setItem('komik_hints', '1');
  } catch (e) {
    return;
  }
  setTimeout(() => {
    showToast('Swipe or tap the edge to turn pages. Double-tap the center to zoom.', 5200);
    peekHint();
  }, 900);
}

/** Load-time work, run by main.js in the original order. */
export const steps = [
  [
    352,
    () => {
      guidedHud = document.createElement('div');
    }
  ],
  [
    353,
    () => {
      guidedHud.className =
        'hidden fixed left-1/2 -translate-x-1/2 z-20 glass-pill px-3 py-1 rounded-full text-xs font-bold pointer-events-none';
    }
  ],
  [
    354,
    () => {
      guidedHud.style.top = 'calc(env(safe-area-inset-top, 0px) + 8px)';
    }
  ],
  [
    355,
    () => {
      guidedHud.setAttribute('role', 'status');
    }
  ],
  [
    356,
    () => {
      guidedHud.setAttribute('aria-live', 'polite');
    }
  ],
  [
    357,
    () => {
      document.body.appendChild(guidedHud);
    }
  ],
  [
    364,
    () => {
      viewportContainer.addEventListener('pointerdown', (e) => {
        if (appState.guided && appState.zoomLevel > 1.02 && e.isPrimary && !e.target.closest('button, input'))
          gSwipe = { x: e.clientX, y: e.clientY, t: performance.now() };
      });
    }
  ],
  [
    365,
    () => {
      viewportContainer.addEventListener('pointerup', (e) => {
        const st = gSwipe;
        gSwipe = null;
        if (!st || !appState.guided) return;
        const dx = e.clientX - st.x,
          dy = e.clientY - st.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - st.t < 600) {
          appState.hasPanned = true;
          guidedStep(dx < 0 !== appState.isRTL ? 1 : -1);
        }
      });
    }
  ],
  [
    386,
    () => {
      document.getElementById('menuGuidedBtn').addEventListener('click', () => setGuided(!appState.guided));
    }
  ]
];
