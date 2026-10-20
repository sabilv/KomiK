/** On-demand page decoding, caches and thumbnails. */
import { appState } from './state.js';

export const pageCache = new Map();

export const pendingPages = new Map();

export const thumbCache = new Map();

export const thumbJobs = new Map();

export const thumbWait = [];

export let thumbActive = 0;

export const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export function clearPageCaches() {
  pageCache.forEach((u) => URL.revokeObjectURL(u));
  thumbCache.forEach((u) => URL.revokeObjectURL(u));
  if (appState.rarWorker) {
    appState.rarWorker.terminate();
    appState.rarWorker = null;
  }
  pageCache.clear();
  thumbCache.clear();
  pendingPages.clear();
  thumbJobs.clear();
  thumbWait.length = 0;
  appState.loaders = [];
  appState.dims = [];
  appState.panelCache = new Map();
  appState.panels = [];
  appState.loadGen = (appState.loadGen || 0) + 1;
}

export function getPageUrl(i) {
  if (pageCache.has(i)) {
    const u = pageCache.get(i);
    pageCache.delete(i);
    pageCache.set(i, u);
    return Promise.resolve(u);
  }
  if (pendingPages.has(i)) return pendingPages.get(i);
  const gen = appState.loadGen;
  const pr = Promise.resolve()
    .then(() => appState.loaders[i]())
    .then((blob) => {
      if (gen !== appState.loadGen) return '';
      const u = URL.createObjectURL(blob);
      pageCache.set(i, u);
      const cap = appState.viewMode === 'webtoon' ? 30 : 8;
      while (pageCache.size > cap) {
        const k = pageCache.keys().next().value;
        URL.revokeObjectURL(pageCache.get(k));
        pageCache.delete(k);
      }
      return u;
    })
    .catch(() => '')
    .finally(() => pendingPages.delete(i));
  pendingPages.set(i, pr);
  return pr;
}

export async function makeThumb(i, gen) {
  try {
    const blob = await appState.loaders[i]();
    const viaWorker = await thumbInWorker(blob);
    if (viaWorker) {
      if (gen !== appState.loadGen) return '';
      const wu = URL.createObjectURL(viaWorker);
      thumbCache.set(i, wu);
      return wu;
    }
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 240 / bmp.width);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7));
    if (gen !== appState.loadGen) return '';
    const u = URL.createObjectURL(out);
    thumbCache.set(i, u);
    return u;
  } catch (e) {
    return getPageUrl(i);
  }
}

export function pumpThumbs() {
  while (thumbActive < 2 && thumbWait.length) {
    const job = thumbWait.shift();
    thumbActive++;
    makeThumb(job.i, job.gen)
      .then(job.res)
      .finally(() => {
        thumbActive--;
        thumbJobs.delete(job.i);
        pumpThumbs();
      });
  }
}

export function getThumbUrl(i) {
  if (thumbCache.has(i)) return Promise.resolve(thumbCache.get(i));
  if (thumbJobs.has(i)) return thumbJobs.get(i);
  const pr = new Promise((res) => thumbWait.push({ i, gen: appState.loadGen, res }));
  thumbJobs.set(i, pr);
  pumpThumbs();
  return pr;
}

export function bindPageImg(img, i, thumb) {
  img.dataset.page = i;
  img.addEventListener(
    'load',
    () => {
      if (img.naturalWidth) {
        appState.dims = appState.dims || [];
        appState.dims[i] = { w: img.naturalWidth, h: img.naturalHeight };
      }
    },
    { once: true }
  );
  (thumb ? getThumbUrl(i) : getPageUrl(i)).then((u) => {
    if (u && Number(img.dataset.page) === i) img.src = u;
  });
}

export function makeLazyObserver(root, margin) {
  const ob = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        if (!en.isIntersecting) return;
        ob.unobserve(en.target);
        bindPageImg(en.target, Number(en.target.dataset.page), en.target.dataset.thumb === '1');
      }),
    { root, rootMargin: margin }
  );
  return ob;
}

export function prefetchAround() {
  const c = appState.currentIndex,
    n = appState.pages.length;
  [c + 1, c + 2, c - 1].forEach((j) => {
    if (j >= 0 && j < n) getPageUrl(j);
  });
}

export function imgReady(img) {
  const dec = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  if (img.complete && img.naturalWidth > 0) return dec();
  return new Promise((res) => {
    img.addEventListener('load', () => dec().then(res), { once: true });
    img.addEventListener('error', () => res(), { once: true });
  });
}

export const decodeImages = (root) => Promise.all(Array.from(root.querySelectorAll('img')).map(imgReady));

export async function imgSize(blob) {
  try {
    const b = await createImageBitmap(blob);
    const d = { w: b.width, h: b.height };
    if (b.close) b.close();
    return d;
  } catch (e) {
    return { w: 800, h: 1150 };
  }
}

export let thumbWorker = null;

export const thumbPending = new Map();

export let thumbSeq = 0;

export function thumbInWorker(blob) {
  if (!window.Worker || typeof OffscreenCanvas === 'undefined') return Promise.resolve(null);
  if (!thumbWorker) {
    thumbWorker = new Worker(new URL('./workers/thumbnail.worker.js', import.meta.url), { type: 'module' });
    thumbWorker.onmessage = (e) => {
      const r = thumbPending.get(e.data.id);
      if (r) {
        thumbPending.delete(e.data.id);
        r(e.data.blob || null);
      }
    };
    thumbWorker.onerror = () => {
      thumbPending.forEach((r) => r(null));
      thumbPending.clear();
      thumbWorker = null;
    };
  }
  return new Promise((res) => {
    const id = ++thumbSeq;
    thumbPending.set(id, res);
    thumbWorker.postMessage({ id, blob });
  });
}

/** Load-time work, run by main.js in the original order. */
export const steps = [];
