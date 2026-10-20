/** Install, service worker, offline status, wake lock and diagnostics. */
import { libSupported, readLibrary } from './library.js';
import { readHistory } from './progress.js';
import { appState, settings } from './state.js';
import { showToast } from './ui.js';

export function logIssue(kind, detail) {
  appState.errors.push({ t: new Date().toISOString(), kind, detail: String((detail && detail.message) || detail).slice(0, 200) });
  if (appState.errors.length > 20) appState.errors.shift();
}

export async function copyDiagnostics() {
  const mb = (n) => Math.round((n / 1048576) * 10) / 10;
  let est = null,
    persisted = null,
    reg = null;
  try {
    est = await navigator.storage.estimate();
    persisted = await navigator.storage.persisted();
  } catch (e) {}
  try {
    reg = await navigator.serviceWorker.getRegistration();
  } catch (e) {}
  const lib = Object.values(readLibrary());
  const info = {
    app: document.title,
    time: new Date().toISOString(),
    userAgent: navigator.userAgent,
    secureContext: window.isSecureContext,
    installed: isStandalone(),
    serviceWorker: {
      supported: 'serviceWorker' in navigator,
      controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      active: !!(reg && reg.active),
      waiting: !!(reg && reg.waiting)
    },
    offline: await offlineStatus(),
    opfs: libSupported(),
    wakeLock: 'wakeLock' in navigator,
    storage: est ? { usedMB: mb(est.usage || 0), quotaMB: mb(est.quota || 0), persisted } : null,
    library: { books: lib.length, totalMB: mb(lib.reduce((a, b) => a + (b.size || 0), 0)) },
    settings,
    issues: appState.errors
  };
  const text = JSON.stringify(info, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Diagnostics copied. Paste it into your message.');
  } catch (e) {
    window.prompt('Copy these diagnostics:', text);
  }
}

export let deferredInstall = null;

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export let isIOS;

export function syncInstallItem() {
  document.getElementById('menuInstallBtn').classList.toggle('hidden', isStandalone() || !(deferredInstall || isIOS));
}

export let swUpdating = false;

export function showUpdateBanner(worker) {
  if (document.getElementById('updateBanner')) return;
  const b = document.createElement('div');
  b.id = 'updateBanner';
  b.setAttribute('role', 'status');
  b.className = 'fixed left-1/2 -translate-x-1/2 z-40 glass-card rounded-2xl px-4 py-3 flex items-center gap-3 text-xs font-semibold';
  b.style.top = 'calc(env(safe-area-inset-top, 0px) + 72px)';
  b.innerHTML =
    '<span>A new version is ready.</span><button class="px-3 py-1.5 rounded-xl bg-apple-blue text-white font-bold">Reload</button><button aria-label="Dismiss" class="text-zinc-400 px-1"><i class="fa-solid fa-xmark"></i></button>';
  const [reload, dismiss] = b.querySelectorAll('button');
  reload.onclick = () => {
    swUpdating = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
  dismiss.onclick = () => b.remove();
  document.body.appendChild(b);
}

export function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker
    .register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw)
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
          });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    })
    .catch((e) => {
      logIssue('serviceWorker', e);
    });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swUpdating) location.reload();
  });
  navigator.serviceWorker.ready
    .then((reg) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => /^https:\/\/(cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(u));
      if (reg.active) reg.active.postMessage({ type: 'CACHE_URLS', urls });
    })
    .catch(() => {});
}

export async function offlineStatus() {
  if (!('serviceWorker' in navigator) || !window.caches) return 'unsupported';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.active) return 'preparing';
    const urls = [];
    for (const name of await caches.keys()) (await (await caches.open(name)).keys()).forEach((r) => urls.push(r.url));
    return urls.some((u) => u === location.origin + '/') &&
      urls.some((u) => /\/assets\/[^/]+\.js/.test(u)) &&
      urls.some((u) => /\/assets\/[^/]+\.css/.test(u))
      ? 'ready'
      : 'preparing';
  } catch (e) {
    return 'preparing';
  }
}

export function standaloneNote() {
  try {
    if (!isStandalone() || !isIOS || localStorage.getItem('komik_sa_note') === '1' || Object.keys(readHistory()).length) return;
    localStorage.setItem('komik_sa_note', '1');
    setTimeout(
      () => showToast('Welcome! This app has its own storage. To bring your progress from Safari, use Shelf, then Import.', 8000),
      1200
    );
  } catch (e) {}
}

export let wakeSentinel = null;

export async function syncWakeLock() {
  try {
    const want = settings.wakeLock && appState.pages.length > 0 && document.visibilityState === 'visible';
    if (want && !wakeSentinel && 'wakeLock' in navigator) {
      wakeSentinel = await navigator.wakeLock.request('screen');
      wakeSentinel.addEventListener('release', () => {
        wakeSentinel = null;
      });
    } else if (!want && wakeSentinel) {
      await wakeSentinel.release();
      wakeSentinel = null;
    }
  } catch (e) {
    wakeSentinel = null;
  }
}

export function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {}
}

export async function updateStorageInfo() {
  const el = document.getElementById('storageInfo');
  if (!el) return;
  try {
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const mb = (n) => (n / 1048576).toFixed(1);
    const lib = Object.values(readLibrary());
    const off = await offlineStatus();
    const parts = [];
    if (est)
      parts.push(
        `Storage: ${mb(est.usage || 0)} MB used of ${mb(est.quota || 0)} MB (${persisted ? 'kept by the browser' : 'not guaranteed'}).`
      );
    parts.push(`Saved books: ${lib.length} (${mb(lib.reduce((a, b) => a + (b.size || 0), 0))} MB).`);
    parts.push(
      off === 'ready'
        ? 'Offline: ready.'
        : off === 'unsupported'
          ? 'Offline: not supported here.'
          : 'Offline: getting ready. Open the app online once more.'
    );
    parts.push(`Security policy reports: ${appState.errors.filter((x) => x.kind === 'csp').length}.`);
    el.textContent = parts.join(' ');
  } catch (e) {
    el.textContent = '';
  }
}

/** Wire up PWA features: error logging, install prompt, SW registration, wake lock. Called by main.js. */
export function initPWA() {
  window.addEventListener('error', (e) =>
    logIssue(
      'error',
      `${e.message} (${String(e.filename || '')
        .split('/')
        .pop()}:${e.lineno})`
    )
  );
  window.addEventListener('unhandledrejection', (e) => logIssue('promise', e.reason));
  document.addEventListener('securitypolicyviolation', (e) => logIssue('csp', `${e.violatedDirective} blocked ${e.blockedURI}`));

  isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    syncInstallItem();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    syncInstallItem();
    showToast('KomiK installed');
  });
  document.getElementById('menuInstallBtn').addEventListener('click', async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      try {
        await deferredInstall.userChoice;
      } catch (e) {}
      deferredInstall = null;
      syncInstallItem();
    } else {
      showToast(
        'Tap the Share button, then Add to Home Screen. The installed app keeps its own progress, so export a backup from the Shelf first if you want to carry it over.',
        9000
      );
    }
  });

  registerSW();
  syncInstallItem();
  standaloneNote();

  document.addEventListener('visibilitychange', syncWakeLock);
}
