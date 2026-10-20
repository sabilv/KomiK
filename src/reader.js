/** Rendering, navigation, zoom and pan, and the reading modes. */
import { loadBookmarksFromStorage, renderBookmarksList, toggleBookmark, updateBookmarkButton } from './bookmarks.js';
import { abortCurl, curl, playCurl } from './curl.js';
import {
  closeComicBtn,
  comicTitle,
  dropZone,
  fitPageBtn,
  fitWidthBtn,
  fullscreenBtn,
  hudResetBtn,
  hudZoomText,
  modeDoubleBtn,
  modeSingleBtn,
  modeWebtoonBtn,
  nextPageBtn,
  pageCounterTop,
  pageDisplay,
  pageInput,
  pageNumberPrev,
  pageNumberTotal,
  pageSlider,
  prevPageBtn,
  sliderPreviewBox,
  sliderPreviewImg,
  sliderPreviewNum,
  thumbnailGrid,
  toggleRtlBtn,
  totalPagesText,
  viewportContainer,
  webtoonDisplay,
  zoneNext,
  zonePrev,
  zoomInBtn,
  zoomLevelText,
  zoomOutBtn,
  zoomResetBtn,
  zoomResetHud
} from './dom.js';
import { guidedOnPage, guidedStep, maybeShowHints, setGuided } from './guided.js';
import { bindPageImg, clearPageCaches, makeLazyObserver, prefetchAround } from './pages.js';
import { getNextIndex, getPrevIndex, viewIndices } from './paging.js';
import { getBookKey, migrateLegacyKeys, readHistory, restoreProgress, saveProgress, updateReadingEstimator } from './progress.js';
import { requestPersist, syncWakeLock } from './pwa.js';
import { syncHairline } from './settingsui.js';
import { ensureCover, maybeOfferNext } from './shelf.js';
import { appState, settings } from './state.js';
import { prefersReducedMotion, showToast, toggleDrawer, toggleUI } from './ui.js';

export let thumbLazy = null;

export let webtoonLazy = null;

export let webtoonRestoring = false;

export function loadPagesIntoApp(pages, pageNames) {
  if (appState.loadingName) {
    appState.fileName = appState.loadingName;
    appState.loadingName = null;
  }
  appState.bookId = appState.loadingId || null;
  appState.loadingId = null;
  appState.meta = appState.loadingMeta || null;
  appState.loadingMeta = null;
  clearPageCaches();

  appState.loaders = pages;
  appState.pages = pages.map(() => null);
  appState.pageNames = pageNames;
  appState.currentIndex = 0;
  appState.lastPageChangeTime = Date.now();
  appState.pageReadDurations = [];
  appState.lastEstIndex = 0;

  resetZoomAndPan(false);
  loadBookmarksFromStorage();
  migrateLegacyKeys(pages.length);

  comicTitle.textContent = metaTitle();
  pageSlider.max = pages.length;
  pageSlider.value = 1;
  pageInput.max = pages.length;
  pageInput.value = 1;
  pageNumberTotal.textContent = pages.length;
  totalPagesText.textContent = `/ ${pages.length}`;

  dropZone.classList.add('hidden');
  if (closeComicBtn) closeComicBtn.classList.remove('hidden');
  renderThumbnails();
  renderBookmarksList();
  updateBookmarkButton();
  applyBookPrefs();
  renderView('fade');
  ensureCover();
  maybeShowHints();
  requestPersist();
  syncWakeLock();

  if (appState.pendingResumeFileName === appState.fileName && appState.pendingResumeIndex !== null) {
    goToPage(appState.pendingResumeIndex, false);
    showToast(`Resumed "${appState.fileName}" at Page ${appState.pendingResumeIndex + 1}`);
    appState.pendingResumeFileName = null;
    appState.pendingResumeIndex = null;
  } else {
    restoreProgress(appState.fileName);
  }
}

export function renderView(direction = 'none') {
  if (curl.running && !curl.finishing) abortCurl();
  viewportContainer.style.touchAction = appState.viewMode === 'webtoon' ? 'pan-y' : 'none';
  if (appState.guided && appState.viewMode !== 'single') setGuided(false, true);
  if (appState.pages.length === 0) return;

  if (settings.keepZoom && appState.zoomLevel > 1.02) {
    appState.panX = 0;
    appState.panY = 0;
  } else resetZoomAndPan(false);
  updatePageCounter();
  updateBookmarkButton();
  updateReadingEstimator();
  saveProgress();

  if (appState.viewMode === 'webtoon') {
    pageDisplay.classList.add('hidden');
    webtoonDisplay.classList.remove('hidden');
    zonePrev.classList.add('hidden');
    zoneNext.classList.add('hidden');
    renderWebtoonView();
  } else {
    webtoonDisplay.classList.add('hidden');
    pageDisplay.classList.remove('hidden');
    zonePrev.classList.remove('hidden');
    zoneNext.classList.remove('hidden');
    renderSingleOrDoubleView(direction);
    if (appState.guided) guidedOnPage();
  }

  highlightActiveThumbnail();
}

export function renderSingleOrDoubleView(direction = 'next') {
  pageDisplay.innerHTML = '';

  const isDouble = appState.viewMode === 'double';
  const pageIndices = viewIndices(appState.currentIndex);

  const containerWrapper = document.createElement('div');
  containerWrapper.id = 'transformWrapper';

  // Apply Apple Books Realistic 3D Paper Flip Animation
  const animClass = direction === 'fade' ? 'page-fade' : '';
  containerWrapper.className = `flex items-center justify-center gap-3 max-w-full ${animClass}`;

  const imgClass =
    appState.fitMode === 'width'
      ? 'w-full max-w-5xl h-auto object-contain shadow-2xl pointer-events-none'
      : 'max-h-[82dvh] max-w-full object-contain shadow-2xl pointer-events-none';

  pageIndices.forEach((idx, arrayIdx) => {
    const img = document.createElement('img');
    bindPageImg(img, idx);
    img.alt = `Page ${idx + 1}`;
    img.className = imgClass;

    img.onload = () => {
      if (isDouble && pageIndices.length > 1 && img.naturalWidth > img.naturalHeight) {
        if (idx === appState.currentIndex)
          containerWrapper.querySelectorAll('img').forEach((o) => {
            if (o !== img) o.remove();
          });
        else img.remove();
      }
    };

    containerWrapper.appendChild(img);
  });

  pageDisplay.appendChild(containerWrapper);
  applyTransform(false);
  prefetchAround();
}

export let webtoonObserver = null;

export function renderWebtoonView() {
  webtoonDisplay.innerHTML = '';

  if (webtoonObserver) {
    webtoonObserver.disconnect();
  }

  if (webtoonLazy) webtoonLazy.disconnect();
  webtoonLazy = makeLazyObserver(webtoonDisplay, '150% 0px');
  webtoonObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          !webtoonRestoring &&
          (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= webtoonDisplay.clientHeight * 0.5)
        ) {
          const idx = parseInt(entry.target.getAttribute('data-index'), 10);
          if (!isNaN(idx) && idx !== appState.currentIndex) {
            appState.currentIndex = idx;
            updatePageCounter();
            updateBookmarkButton();
            updateReadingEstimator();
            saveProgress();
            highlightActiveThumbnail();
          }
        }
      });
    },
    {
      root: webtoonDisplay,
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
    }
  );

  appState.pages.forEach((url, idx) => {
    const img = document.createElement('img');
    img.dataset.page = idx;
    img.style.minHeight = '70vh';
    img.onload = () => {
      img.style.minHeight = '';
      if (webtoonRestoring) {
        const t = document.getElementById(`webtoon-page-${appState.currentIndex}`);
        if (t) t.scrollIntoView({ block: 'start' });
      }
    };
    webtoonLazy.observe(img);
    img.alt = `Page ${idx + 1}`;
    img.id = `webtoon-page-${idx}`;
    img.setAttribute('data-index', idx);
    img.className = `w-full max-w-3xl h-auto object-contain shadow-2xl my-2`;

    webtoonDisplay.appendChild(img);
    webtoonObserver.observe(img);
  });

  webtoonRestoring = true;
  const restoreEl = document.getElementById(`webtoon-page-${appState.currentIndex}`);
  if (restoreEl) restoreEl.scrollIntoView({ block: 'start' });
  setTimeout(() => {
    webtoonRestoring = false;
  }, 1500);
}

export function renderThumbnails() {
  thumbnailGrid.innerHTML = '';
  if (thumbLazy) thumbLazy.disconnect();
  thumbLazy = makeLazyObserver(thumbnailGrid, '200px 0px');
  appState.pages.forEach((url, idx) => {
    const thumbBtn = document.createElement('button');
    thumbBtn.className = `relative rounded-2xl overflow-hidden border-2 transition hover:border-apple-blue focus:outline-none bg-zinc-900 group aspect-[2/3] flex flex-col items-center justify-center ${
      idx === appState.currentIndex ? 'border-apple-blue ring-2 ring-apple-blue/40' : 'border-white/10'
    }`;
    thumbBtn.setAttribute('data-index', idx);
    thumbBtn.onclick = () => {
      goToPage(idx);
      if (window.innerWidth < 768) toggleDrawer(false);
    };

    const img = document.createElement('img');
    img.dataset.page = idx;
    img.dataset.thumb = '1';
    thumbLazy.observe(img);
    img.alt = `Thumbnail ${idx + 1}`;
    img.className = 'w-full h-full object-cover';
    img.loading = 'lazy';

    const label = document.createElement('span');
    label.className = 'absolute bottom-1.5 right-1.5 glass-pill text-[10px] text-zinc-200 px-2 py-0.5 font-mono font-bold';
    label.textContent = idx + 1;

    thumbBtn.appendChild(img);
    thumbBtn.appendChild(label);
    thumbnailGrid.appendChild(thumbBtn);
  });
}

export function highlightActiveThumbnail() {
  const thumbs = thumbnailGrid.querySelectorAll('button');
  thumbs.forEach((btn, idx) => {
    if (idx === appState.currentIndex) {
      btn.classList.add('border-apple-blue', 'ring-2', 'ring-apple-blue/40');
      btn.classList.remove('border-white/10');
      btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      btn.classList.remove('border-apple-blue', 'ring-2', 'ring-apple-blue/40');
      btn.classList.add('border-white/10');
    }
  });
}

export function updatePageCounter() {
  syncHairline();
  maybeOfferNext();
  const total = appState.pages.length;
  const currentDisplay = total > 0 ? appState.currentIndex + 1 : 0;

  pageCounterTop.textContent = total > 0 ? `${currentDisplay} / ${total} pages` : '0 / 0 pages';
  pageNumberPrev.textContent = currentDisplay;
  pageNumberTotal.textContent = total;
  totalPagesText.textContent = `/ ${total}`;

  pageSlider.value = currentDisplay || 1;
  pageInput.value = currentDisplay || 1;
}

export function goToPage(index, animate = true) {
  if (appState.pages.length === 0) return;
  if (curl.running) {
    if (animate) return;
    abortCurl();
  }
  const newIdx = Math.max(0, Math.min(index, appState.pages.length - 1));
  const prevIdx = appState.currentIndex;
  const direction = newIdx >= prevIdx ? 'next' : 'prev';

  appState.currentIndex = newIdx;

  if (appState.viewMode === 'webtoon') {
    const targetImg = document.getElementById(`webtoon-page-${newIdx}`);
    if (targetImg) targetImg.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updatePageCounter();
    updateBookmarkButton();
    updateReadingEstimator();
    saveProgress();
    highlightActiveThumbnail();
    return;
  }

  const skipCurl = appState.noCurlOnce;
  appState.noCurlOnce = false;
  if (animate && settings.curl && !skipCurl && newIdx !== prevIdx && Math.abs(newIdx - prevIdx) <= 2 && !prefersReducedMotion()) {
    appState.currentIndex = prevIdx; // commit happens when the curl finishes
    playCurl(newIdx, direction);
    return;
  }
  renderView(animate && newIdx !== prevIdx ? 'fade' : 'none');
}

export function nextPage() {
  if (guidedStep(1)) return;
  const i = getNextIndex();
  if (i !== null) goToPage(i);
  else bumpEdge(appState.isRTL ? 'left' : 'right');
}

export function prevPage() {
  if (guidedStep(-1)) return;
  const i = getPrevIndex();
  if (i !== null) goToPage(i);
  else bumpEdge(appState.isRTL ? 'right' : 'left');
}

export function updateSliderPreview(val) {
  if (!appState.pages || appState.pages.length === 0) return;

  const targetIdx = Math.max(0, Math.min(parseInt(val, 10) - 1, appState.pages.length - 1));
  bindPageImg(sliderPreviewImg, targetIdx, true);
  sliderPreviewNum.textContent = `Page ${targetIdx + 1}`;

  const sliderRect = pageSlider.getBoundingClientRect();
  const min = parseFloat(pageSlider.min) || 1;
  const max = parseFloat(pageSlider.max) || 1;
  const percent = (val - min) / (max - min || 1);
  const thumbX = sliderRect.left + percent * sliderRect.width;

  sliderPreviewBox.style.left = `${thumbX}px`;
  sliderPreviewBox.classList.remove('hidden');
  sliderPreviewBox.classList.add('flex');
}

export function hideSliderPreview() {
  sliderPreviewBox.classList.add('hidden');
  sliderPreviewBox.classList.remove('flex');
}

export let uiToggleTimer = 0;

export let lastTap = { t: 0, x: 0, y: 0 };

export function toggleZoomAt(cx, cy) {
  if (appState.zoomLevel > 1.1) {
    resetZoomAndPan(true);
    return;
  }
  const rect = viewportContainer.getBoundingClientRect();
  appState.zoomLevel = 2;
  appState.panX = -(cx - (rect.left + rect.width / 2));
  appState.panY = -(cy - (rect.top + rect.height / 2));
  applyTransform(true);
}

export function panLimits(wrapper) {
  const z = appState.zoomLevel;
  return {
    mx: Math.max(0, (wrapper.offsetWidth * z - viewportContainer.clientWidth) / 2),
    my: Math.max(0, (wrapper.offsetHeight * z - viewportContainer.clientHeight) / 2)
  };
}

export function clampPan(wrapper) {
  const { mx, my } = panLimits(wrapper);
  appState.panX = Math.max(-mx, Math.min(mx, appState.panX));
  appState.panY = Math.max(-my, Math.min(my, appState.panY));
}

export function edgeOvershoot() {
  const w = document.getElementById('transformWrapper');
  if (!w) return 0;
  const { mx } = panLimits(w);
  return appState.panX - Math.max(-mx, Math.min(mx, appState.panX));
}

export function turnFromEdge(over) {
  if (!settings.keepZoom) resetZoomAndPan(false);
  const logicalNext = over < 0 !== appState.isRTL;
  logicalNext ? nextPage() : prevPage();
}

export function applyTransform(animate = true) {
  const wrapper = document.getElementById('transformWrapper');
  if (!wrapper) return;
  clampPan(wrapper);

  if (animate) {
    wrapper.style.transition = `transform ${appState.camMs || 0.25}s cubic-bezier(0.16, 1, 0.3, 1)`;
  } else {
    wrapper.style.transition = 'none';
  }

  wrapper.style.transform = `translate3d(${appState.panX}px, ${appState.panY}px, 0px) scale(${appState.zoomLevel})`;

  const zoomPercent = `${Math.round(appState.zoomLevel * 100)}%`;
  zoomLevelText.textContent = zoomPercent;
  hudZoomText.textContent = zoomPercent;

  if (appState.zoomLevel > 1.02 || appState.panX !== 0 || appState.panY !== 0) {
    viewportContainer.style.cursor = appState.isDragging ? 'grabbing' : 'grab';
    zoomResetHud.classList.remove('hidden');
  } else {
    viewportContainer.style.cursor = 'default';
    zoomResetHud.classList.add('hidden');
  }
}

export function resetZoomAndPan(triggerRender = true) {
  appState.zoomLevel = 1.0;
  appState.panX = 0;
  appState.panY = 0;
  appState.isDragging = false;
  applyTransform(true);
}

export function setFitMode(mode) {
  appState.fitMode = mode;
  if (mode === 'page') {
    fitPageBtn.classList.add('bg-apple-blue', 'text-white');
    fitPageBtn.classList.remove('text-zinc-600', 'dark:text-zinc-300');
    fitWidthBtn.classList.remove('bg-apple-blue', 'text-white');
    fitWidthBtn.classList.add('text-zinc-600', 'dark:text-zinc-300');
  } else {
    fitWidthBtn.classList.add('bg-apple-blue', 'text-white');
    fitWidthBtn.classList.remove('text-zinc-600', 'dark:text-zinc-300');
    fitPageBtn.classList.remove('bg-apple-blue', 'text-white');
    fitPageBtn.classList.add('text-zinc-600', 'dark:text-zinc-300');
  }
  renderView();
}

export function adjustZoom(delta) {
  appState.zoomLevel = Math.min(Math.max(1, appState.zoomLevel + delta), 4.0);
  applyTransform(true);
}

export function setViewMode(mode) {
  appState.viewMode = mode;
  [modeSingleBtn, modeDoubleBtn, modeWebtoonBtn].forEach((btn) => {
    btn.classList.remove('bg-apple-blue', 'text-white');
    btn.classList.add('text-zinc-600', 'dark:text-zinc-300');
  });

  if (mode === 'single') modeSingleBtn.classList.add('bg-apple-blue', 'text-white');
  if (mode === 'double') modeDoubleBtn.classList.add('bg-apple-blue', 'text-white');
  if (mode === 'webtoon') modeWebtoonBtn.classList.add('bg-apple-blue', 'text-white');

  renderView();
}

export let sliderRaf = 0;

export let sliderTarget = 0;

export function scheduleSliderGo(i) {
  sliderTarget = i;
  if (!sliderRaf)
    sliderRaf = requestAnimationFrame(() => {
      sliderRaf = 0;
      goToPage(sliderTarget, false);
    });
}

export function bumpEdge(side) {
  if (prefersReducedMotion() || !pageDisplay.animate) return;
  const dx = side === 'right' ? -22 : 22;
  pageDisplay.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], {
    duration: 280,
    easing: 'ease-out'
  });
}

export function metaTitle() {
  const m = appState.meta;
  if (!m) return appState.fileName;
  return [m.series, m.number ? '#' + m.number : '', m.title].filter(Boolean).join(' ') || appState.fileName;
}

export function syncControls() {
  const on = ['bg-apple-blue', 'text-white'],
    off = ['text-zinc-600', 'dark:text-zinc-300'];
  const set = (b, active) => {
    on.forEach((c) => b.classList.toggle(c, active));
    off.forEach((c) => b.classList.toggle(c, !active));
  };
  [
    [modeSingleBtn, 'single'],
    [modeDoubleBtn, 'double'],
    [modeWebtoonBtn, 'webtoon']
  ].forEach(([b, m]) => set(b, appState.viewMode === m));
  [
    [fitPageBtn, 'page'],
    [fitWidthBtn, 'width']
  ].forEach(([b, m]) => set(b, appState.fitMode === m));
  toggleRtlBtn.classList.toggle('bg-apple-blue', appState.isRTL);
  toggleRtlBtn.classList.toggle('text-white', appState.isRTL);
  document.getElementById('rtlBtnText').textContent = appState.isRTL ? 'RTL' : 'LTR';
}

export function applyBookPrefs() {
  const key = getBookKey();
  const saved = key ? readHistory()[key] : null;
  if (settings.perBook && saved && saved.viewMode) {
    appState.viewMode = ['single', 'double', 'webtoon'].includes(saved.viewMode) ? saved.viewMode : 'single';
    appState.fitMode = saved.fitMode === 'width' ? 'width' : 'page';
    appState.isRTL = !!saved.isRTL;
  } else if (appState.meta && appState.meta.rtl) {
    appState.isRTL = true;
  }
  syncControls();
}

/** Initialize reader event listeners and keyboard shortcuts. */
export function initReader() {
  if (pageSlider) {
    pageSlider.addEventListener('input', (e) => {
      updateSliderPreview(e.target.value);
      scheduleSliderGo(parseInt(e.target.value, 10) - 1);
    });
    pageSlider.addEventListener('change', hideSliderPreview);
    pageSlider.addEventListener('mouseleave', hideSliderPreview);
    pageSlider.addEventListener('touchend', hideSliderPreview);
  }

  if (viewportContainer) {
    viewportContainer.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || appState.hasPanned) return;
      const rect = viewportContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const zoomed = appState.zoomLevel > 1.02 && !appState.guided;
      const zw = settings.zoneWidth / 100;
      if (!zoomed && !(x > rect.width * zw && x < rect.width * (1 - zw))) return;
      if (appState.viewMode === 'webtoon' || appState.guided) {
        toggleUI();
        return;
      }

      const now = Date.now();
      clearTimeout(uiToggleTimer);
      if (now - lastTap.t < 260 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
        lastTap.t = 0;
        toggleZoomAt(e.clientX, e.clientY);
        return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      uiToggleTimer = setTimeout(toggleUI, 260);
    });

    viewportContainer.addEventListener(
      'wheel',
      (e) => {
        if (appState.viewMode === 'webtoon') return;
        e.preventDefault();
        if (!e.ctrlKey) {
          if (appState.zoomLevel > 1.02) {
            appState.panX -= e.deltaX;
            appState.panY -= e.deltaY;
            applyTransform(false);
          }
          return;
        }
        const rect = viewportContainer.getBoundingClientRect();
        const mx = e.clientX - (rect.left + rect.width / 2);
        const my = e.clientY - (rect.top + rect.height / 2);
        const oldZoom = appState.zoomLevel;
        const step = Math.max(-30, Math.min(30, e.deltaY));
        const newZoom = Math.min(Math.max(1, oldZoom * Math.exp(-step * 0.01)), 4.0);
        if (newZoom === oldZoom) return;
        appState.panX = mx - (mx - appState.panX) * (newZoom / oldZoom);
        appState.panY = my - (my - appState.panY) * (newZoom / oldZoom);
        appState.zoomLevel = newZoom;
        applyTransform(false);
      },
      { passive: false }
    );

    viewportContainer.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;

      appState.isDragging = true;
      appState.hasPanned = false;
      appState.dragStart = { x: e.clientX, y: e.clientY };
      appState.panStart = { x: appState.panX, y: appState.panY };

      if (appState.zoomLevel > 1.02) {
        viewportContainer.style.cursor = 'grabbing';
      }
    });

    viewportContainer.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          appState.pinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        } else if (e.touches.length === 1) {
          appState.isDragging = true;
          appState.hasPanned = false;
          appState.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          appState.panStart = { x: appState.panX, y: appState.panY };
        }
      },
      { passive: true }
    );

    viewportContainer.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          if (appState.pinchDist > 0) {
            const factor = dist / appState.pinchDist;
            appState.zoomLevel = Math.min(Math.max(1, appState.zoomLevel * factor), 4.0);
            applyTransform(false);
          }
          appState.pinchDist = dist;
        } else if (e.touches.length === 1 && appState.isDragging && appState.zoomLevel > 1.0) {
          const dx = e.touches[0].clientX - appState.dragStart.x;
          const dy = e.touches[0].clientY - appState.dragStart.y;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) appState.hasPanned = true;

          appState.panX = appState.panStart.x + dx;
          appState.panY = appState.panStart.y + dy;
          const over = edgeOvershoot();
          if (!appState.edgeTurned && !appState.guided && Math.abs(over) > 80) {
            appState.edgeTurned = true;
            turnFromEdge(over);
            return;
          }
          applyTransform(false);
        }
      },
      { passive: true }
    );

    viewportContainer.addEventListener('touchend', () => {
      appState.pinchDist = 0;
      appState.isDragging = false;
      appState.edgeTurned = false;
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (!appState.isDragging) return;

    const dx = e.clientX - appState.dragStart.x;
    const dy = e.clientY - appState.dragStart.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      appState.hasPanned = true;
    }

    if (appState.zoomLevel > 1.0 || appState.fitMode === 'width') {
      appState.panX = appState.panStart.x + dx;
      appState.panY = appState.panStart.y + dy;
      applyTransform(false);
    }
  });

  window.addEventListener('mouseup', () => {
    if (appState.isDragging) {
      appState.isDragging = false;
      if (appState.zoomLevel > 1.02) {
        viewportContainer.style.cursor = 'grab';
      }
    }
  });

  if (zonePrev) {
    zonePrev.addEventListener('click', () => {
      if (appState.hasPanned || (appState.zoomLevel > 1.02 && !appState.guided)) return;
      appState.isRTL !== settings.swapZones ? nextPage() : prevPage();
    });
  }

  if (zoneNext) {
    zoneNext.addEventListener('click', () => {
      if (appState.hasPanned || (appState.zoomLevel > 1.02 && !appState.guided)) return;
      appState.isRTL !== settings.swapZones ? prevPage() : nextPage();
    });
  }

  if (fitPageBtn) fitPageBtn.addEventListener('click', () => setFitMode('page'));
  if (fitWidthBtn) fitWidthBtn.addEventListener('click', () => setFitMode('width'));
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => adjustZoom(0.2));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => adjustZoom(-0.2));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => resetZoomAndPan(true));
  if (hudResetBtn) hudResetBtn.addEventListener('click', () => resetZoomAndPan(true));

  if (modeSingleBtn) modeSingleBtn.addEventListener('click', () => setViewMode('single'));
  if (modeDoubleBtn) modeDoubleBtn.addEventListener('click', () => setViewMode('double'));
  if (modeWebtoonBtn) modeWebtoonBtn.addEventListener('click', () => setViewMode('webtoon'));

  if (prevPageBtn) prevPageBtn.addEventListener('click', prevPage);
  if (nextPageBtn) nextPageBtn.addEventListener('click', nextPage);

  if (pageInput) {
    pageInput.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isNaN(v)) updatePageCounter();
      else goToPage(v - 1);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
      case ' ':
        appState.isRTL ? prevPage() : nextPage();
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        appState.isRTL ? nextPage() : prevPage();
        break;
      case 'f':
      case 'F':
        if (fullscreenBtn) fullscreenBtn.click();
        break;
      case 't':
      case 'T':
        toggleDrawer();
        break;
      case 'b':
      case 'B':
        toggleBookmark();
        break;
      case '+':
      case '=':
        adjustZoom(0.2);
        break;
      case '-':
        adjustZoom(-0.2);
        break;
      case '0':
        resetZoomAndPan(true);
        break;
    }
  });
}
