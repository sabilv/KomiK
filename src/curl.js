/** Page curl engine and swipe gestures. */
import { pageDisplay, viewportContainer } from './dom.js';
import { bindPageImg, decodeImages } from './pages.js';
import { getNextIndex, getPrevIndex, viewIndices } from './paging.js';
import { clamp01, clipPoly, delay, easeInOutCubic, easeOutCubic } from './pure.js';
import { bumpEdge, goToPage, renderView } from './reader.js';
import { appState, settings } from './state.js';
import { prefersReducedMotion } from './ui.js';

export let curlStage;

export const curl = {
  running: false,
  finishing: false,
  sid: 0,
  raf: 0,
  side: 'right',
  corner: 'bottom',
  targetIndex: 0,
  rect: null,
  vw: 0,
  vh: 0,
  fy: 0,
  el: {}
};

export let swipe = null;

export const activePointers = new Set();

export function makeSheet(index) {
  const sheet = document.createElement('div');
  sheet.className = 'curl-sheet';
  const row = document.createElement('div');
  row.className = 'flex items-center justify-center gap-3 max-w-full p-2';
  const imgClass =
    appState.fitMode === 'width'
      ? 'w-full max-w-5xl h-auto object-contain shadow-2xl pointer-events-none'
      : 'max-h-[82dvh] max-w-full object-contain shadow-2xl pointer-events-none';
  viewIndices(index).forEach((i) => {
    const img = new Image();
    bindPageImg(img, i);
    img.className = imgClass;
    img.draggable = false;
    row.appendChild(img);
  });
  sheet.appendChild(row);
  return sheet;
}

export function curlLayer(cls) {
  const d = document.createElement('div');
  d.className = cls;
  d.style.width = curl.vw + 'px';
  d.style.height = curl.vh + 'px';
  return d;
}

export function setClip(el, pts) {
  const v = 'polygon(' + pts.map((p) => p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px').join(',') + ')';
  el.style.clipPath = v;
  el.style.webkitClipPath = v;
}

export function placeStrip(strip, M, u, width, L) {
  strip.style.width = width + 'px';
  strip.style.height = L + 'px';
  strip.style.transform = `translate(${M.x}px, ${M.y}px) rotate(${Math.atan2(u.y, u.x)}rad) translate(0px, ${-L / 2}px)`;
}

export async function beginCurl(targetIndex, side, corner, reverse) {
  const sid = ++curl.sid;
  curl.reverse = !!reverse;
  curl.running = true;
  curl.finishing = false;
  curl.targetIndex = targetIndex;
  curl.side = side;
  curl.corner = corner;
  curl.fy = 0;
  curl.vw = viewportContainer.clientWidth;
  curl.vh = viewportContainer.clientHeight;

  const underIdx = curl.reverse ? appState.currentIndex : targetIndex;
  const topIdx = curl.reverse ? targetIndex : appState.currentIndex;
  const under = makeSheet(underIdx);
  const underShadow = document.createElement('div');
  underShadow.className = 'curl-strip curl-under-shadow';
  const flatClip = curlLayer('curl-layer');
  const flatSheet = makeSheet(topIdx);
  flatClip.appendChild(flatSheet);
  const flapWrap = curlLayer('curl-layer curl-flapwrap');
  const flap = curlLayer('curl-layer curl-flap');
  const flapSheet = makeSheet(topIdx);
  const paper = document.createElement('div');
  paper.className = 'curl-paper';
  flap.append(flapSheet, paper);
  flapWrap.appendChild(flap);
  const flapShade = curlLayer('curl-layer');
  const flapStrip = document.createElement('div');
  flapStrip.className = 'curl-strip curl-flap-shade';
  flapShade.appendChild(flapStrip);

  curlStage.innerHTML = '';
  curlStage.style.visibility = 'hidden';
  if (appState.lowPower === undefined) appState.lowPower = localStorage.getItem('komik_lowpower') === '1';
  curlStage.classList.toggle('lite', !!appState.lowPower);
  curlStage.style.display = 'block';
  curlStage.append(under, underShadow, flatClip, flapWrap, flapShade);
  curl.el = { underShadow, flatClip, flapWrap, flap, flapShade, flapStrip };

  await Promise.race([decodeImages(curlStage), delay(1500)]);
  if (curl.sid !== sid) return false;

  const sr = curlStage.getBoundingClientRect();
  let l = Infinity,
    t = Infinity,
    r = -Infinity,
    b = -Infinity;
  flatSheet.querySelectorAll('img').forEach((img) => {
    const q = img.getBoundingClientRect();
    if (q.width < 1) return;
    l = Math.min(l, q.left - sr.left);
    t = Math.min(t, q.top - sr.top);
    r = Math.max(r, q.right - sr.left);
    b = Math.max(b, q.bottom - sr.top);
  });
  curl.rect = isFinite(l) ? { l, t, r, b } : { l: 0, t: 0, r: curl.vw, b: curl.vh };

  renderCurl(curl.reverse ? 1 : 0);
  curlStage.style.visibility = 'visible';
  pageDisplay.style.visibility = 'hidden';
  return true;
}

export function renderCurl(p) {
  const el = curl.el,
    rect = curl.rect,
    vw = curl.vw,
    vh = curl.vh;
  p = clamp01(p);
  const W = rect.r - rect.l,
    H = rect.b - rect.t;
  const dir = curl.side === 'right' ? -1 : 1;
  const lift = (curl.corner === 'bottom' ? -1 : 1) * Math.sin(Math.PI * p) * H * 0.2;
  const O = { x: curl.side === 'right' ? rect.r : rect.l, y: curl.corner === 'bottom' ? rect.b : rect.t };
  const P = { x: O.x + dir * p * 2.25 * W, y: O.y + lift + curl.fy * (1 - p) };
  const ox = O.x - P.x,
    oy = O.y - P.y;
  const len = Math.hypot(ox, oy);

  if (len < 1) {
    el.flatClip.style.display = 'block';
    el.flatClip.style.clipPath = 'none';
    el.flatClip.style.webkitClipPath = 'none';
    el.flapWrap.style.display = el.flapShade.style.display = el.underShadow.style.display = 'none';
    return;
  }

  const n = { x: ox / len, y: oy / len };
  const M = { x: (O.x + P.x) / 2, y: (O.y + P.y) / 2 };
  const folded = clipPoly(
    [
      [rect.l, rect.t],
      [rect.r, rect.t],
      [rect.r, rect.b],
      [rect.l, rect.b]
    ],
    M,
    n,
    1
  );
  const flat = clipPoly(
    [
      [0, 0],
      [vw, 0],
      [vw, vh],
      [0, vh]
    ],
    M,
    n,
    -1
  );
  const k = M.x * n.x + M.y * n.y;
  const flapPoly = folded.map((pt) => {
    const d = pt[0] * n.x + pt[1] * n.y - k;
    return [pt[0] - 2 * d * n.x, pt[1] - 2 * d * n.y];
  });
  const L = Math.hypot(vw, vh) * 2;
  const fade = clamp01(p * 10) * (1 - clamp01((p - 0.85) / 0.15));

  if (flat.length >= 3) {
    el.flatClip.style.display = 'block';
    setClip(el.flatClip, flat);
  } else el.flatClip.style.display = 'none';

  if (folded.length >= 3) {
    el.flapWrap.style.display = el.flapShade.style.display = el.underShadow.style.display = 'block';
    setClip(el.flap, folded);
    el.flap.style.transform = `matrix(${1 - 2 * n.x * n.x}, ${-2 * n.x * n.y}, ${-2 * n.x * n.y}, ${1 - 2 * n.y * n.y}, ${2 * k * n.x}, ${2 * k * n.y})`;
    el.flapWrap.style.opacity = 1 - clamp01((p - 0.88) / 0.12);
    setClip(el.flapShade, flapPoly);
    el.flapShade.style.opacity = fade;
    placeStrip(el.flapStrip, M, { x: -n.x, y: -n.y }, 90, L);
    placeStrip(el.underShadow, M, n, 90, L);
    el.underShadow.style.opacity = fade;
  } else {
    el.flapWrap.style.display = el.flapShade.style.display = el.underShadow.style.display = 'none';
  }
}

export function animateCurl(from, to, duration, ease, onDone) {
  cancelAnimationFrame(curl.raf);
  const fy0 = curl.fy,
    t0 = performance.now();
  let last = t0,
    frames = 0,
    slow = 0;
  const step = (now) => {
    const dt = now - last;
    last = now;
    frames++;
    if (dt > 34) slow++;
    const t = clamp01((now - t0) / duration),
      e = ease(t);
    curl.fy = fy0 * (1 - e);
    renderCurl(from + (to - from) * e);
    if (t < 1) curl.raf = requestAnimationFrame(step);
    else {
      if (frames >= 6 && slow / frames > 0.4 && !appState.lowPower) {
        appState.lowPower = true;
        try {
          localStorage.setItem('komik_lowpower', '1');
        } catch (err) {}
        curlStage.classList.add('lite');
      }
      if (onDone) onDone();
    }
  };
  curl.raf = requestAnimationFrame(step);
}

export function hideStage() {
  curlStage.style.display = 'none';
  curlStage.innerHTML = '';
  pageDisplay.style.visibility = '';
  curl.running = false;
  curl.finishing = false;
}

export function abortCurl() {
  curl.sid++;
  cancelAnimationFrame(curl.raf);
  swipe = null;
  hideStage();
}

export async function finishCurl(commit) {
  const sid = curl.sid;
  cancelAnimationFrame(curl.raf);
  if (!commit) {
    hideStage();
    return;
  }
  curl.finishing = true;
  appState.currentIndex = curl.targetIndex;
  renderView('none');
  await Promise.race([decodeImages(pageDisplay), delay(500)]);
  await new Promise((r) => requestAnimationFrame(() => r()));
  if (curl.sid === sid) hideStage();
}

export async function playCurl(targetIndex, direction) {
  if (curl.running) return;
  const side = (direction === 'next') !== appState.isRTL ? 'right' : 'left';
  try {
    const rev = direction === 'prev' && settings.truePrev;
    const ok = await beginCurl(targetIndex, side, 'bottom', rev);
    if (!ok) return;
    animateCurl(rev ? 1 : 0, rev ? 0 : 1, 600, easeInOutCubic, () => finishCurl(true));
  } catch (err) {
    console.warn('Curl failed, falling back:', err);
    abortCurl();
    appState.currentIndex = targetIndex;
    renderView('fade');
  }
}

export function cancelSwipe() {
  const s = swipe;
  swipe = null;
  if (!s) return;
  if (s.mode === 'dragging') animateCurl(cv(s.p), cv(0), 200, easeInOutCubic, () => finishCurl(false));
  else if (s.mode === 'starting') abortCurl();
}

export function startSwipeCurl(e, dx, dy) {
  const s = swipe;
  const side = dx < 0 ? 'right' : 'left';
  const logicalNext = (side === 'right') !== appState.isRTL;
  const target = logicalNext ? getNextIndex() : getPrevIndex();
  appState.hasPanned = true;
  if (target === null) {
    s.mode = 'blocked';
    bumpEdge(side);
    return;
  }
  if (!settings.curl || prefersReducedMotion()) {
    s.mode = 'blocked';
    goToPage(target, true);
    return;
  }

  s.mode = 'starting';
  s.side = side;
  s.dx0 = Math.abs(dx);
  s.dy0 = dy;
  s.p = 0;
  const mid = viewportContainer.getBoundingClientRect().top + viewportContainer.clientHeight / 2;
  try {
    viewportContainer.setPointerCapture(e.pointerId);
  } catch (err) {}

  beginCurl(target, side, s.y0 < mid ? 'top' : 'bottom', !logicalNext && settings.truePrev)
    .then((ok) => {
      if (!ok || swipe !== s) return;
      s.mode = 'dragging';
      updateSwipeCurl();
      if (s.released) releaseSwipe();
    })
    .catch(() => abortCurl());
}

export function updateSwipeCurl() {
  const s = swipe;
  if (!s || s.mode !== 'dragging') return;
  const W = curl.rect.r - curl.rect.l,
    H = curl.rect.b - curl.rect.t;
  const raw = s.side === 'right' ? s.x0 - s.cx : s.cx - s.x0;
  s.p = clamp01((raw - s.dx0 * 0.6) / (0.85 * W));
  curl.fy = Math.max(-H * 0.25, Math.min(H * 0.25, s.cy - s.y0 - s.dy0));
  renderCurl(cv(s.p));
  s.samples.push({ t: performance.now(), v: raw });
  if (s.samples.length > 8) s.samples.shift();
}

export function releaseSwipe() {
  const s = swipe;
  if (!s) return;
  swipe = null;
  if (s.mode !== 'dragging' && s.mode !== 'starting') return;

  const now = performance.now();
  const recent = s.samples.filter((x) => now - x.t <= 100);
  let v = 0;
  if (recent.length >= 2) {
    const a = recent[0],
      b = recent[recent.length - 1];
    if (b.t > a.t) v = (b.v - a.v) / (b.t - a.t); // px/ms toward finishing the turn
  }
  const commit = (s.p > 0.35 && v > -0.4) || (v > 0.5 && s.p > 0.03);
  if (commit) animateCurl(cv(s.p), cv(1), 160 + 360 * (1 - s.p), easeOutCubic, () => finishCurl(true));
  else animateCurl(cv(s.p), cv(0), 140 + 260 * s.p, easeInOutCubic, () => finishCurl(false));
}

export const endPointer = (e) => {
  activePointers.delete(e.pointerId);
  if (!swipe || e.pointerId !== swipe.id) return;
  if (swipe.mode === 'starting') {
    swipe.released = true;
    return;
  }
  releaseSwipe();
};

export const cv = (t) => (curl.reverse ? 1 - t : t);

export async function peekHint() {
  if (curl.running || !settings.curl || prefersReducedMotion() || appState.viewMode === 'webtoon' || appState.guided) return;
  const t = getNextIndex();
  if (t === null) return;
  try {
    const ok = await beginCurl(t, appState.isRTL ? 'left' : 'right', 'bottom', false);
    if (!ok) return;
    animateCurl(0, 0.13, 420, easeInOutCubic, () =>
      setTimeout(() => animateCurl(0.13, 0, 380, easeInOutCubic, () => finishCurl(false)), 350)
    );
  } catch (e) {
    abortCurl();
  }
}

/** Initialize page curl stage and viewport pointer listeners. */
export function initCurl() {
  curlStage = document.createElement('div');
  curlStage.id = 'curlStage';
  if (viewportContainer) {
    viewportContainer.appendChild(curlStage);

    viewportContainer.addEventListener('pointerdown', (e) => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) {
        cancelSwipe();
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button, input')) return;
      if (appState.pages.length === 0 || appState.viewMode === 'webtoon') return;
      if (appState.zoomLevel > 1.02 || curl.running) return;
      swipe = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        cx: e.clientX,
        cy: e.clientY,
        mode: 'pending',
        samples: [],
        p: 0,
        released: false
      };
    });

    viewportContainer.addEventListener('pointermove', (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        swipe = null;
        return;
      }
      swipe.cx = e.clientX;
      swipe.cy = e.clientY;
      if (swipe.mode === 'pending') {
        const dx = e.clientX - swipe.x0,
          dy = e.clientY - swipe.y0;
        if (Math.hypot(dx, dy) < 12) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) {
          swipe = null;
          return;
        }
        startSwipeCurl(e, dx, dy);
        return;
      }
      updateSwipeCurl();
    });

    viewportContainer.addEventListener('pointerup', endPointer);
    viewportContainer.addEventListener('pointercancel', endPointer);
  }
}
