/** Reading progress, book keys and the reading-time estimate. */
import { saveBookmarksToStorage } from './bookmarks.js';
import { readingEstimateBottom, readingEstimateDivider, readingTimeTop, recentsView } from './dom.js';
import { goToPage } from './reader.js';
import { renderRecentsList } from './shelf.js';
import { appState } from './state.js';
import { showToast } from './ui.js';

export function getBookKey(fileName = appState.fileName, totalPages = appState.pages.length) {
  if (!fileName) return null;
  if (appState.bookId && fileName === appState.fileName) return appState.bookId;
  return `${fileName}__${totalPages}`;
}

export function saveProgressNow() {
  if (!appState.fileName || appState.pages.length === 0) return;

  const key = getBookKey();
  if (!key) return;

  try {
    const history = JSON.parse(localStorage.getItem('comic_reader_history') || '{}');
    const prev = history[key] || {};
    history[key] = {
      fileName: appState.fileName,
      currentIndex: appState.currentIndex,
      totalPages: appState.pages.length,
      finished: !!prev.finished || appState.currentIndex >= appState.pages.length - 1,
      viewMode: appState.viewMode,
      fitMode: appState.fitMode,
      isRTL: appState.isRTL,
      series: (appState.meta && appState.meta.series) || '',
      number: (appState.meta && appState.meta.number) || '',
      lastRead: new Date().toISOString()
    };

    localStorage.setItem('comic_reader_history', JSON.stringify(history));

    if (!recentsView.classList.contains('hidden')) {
      renderRecentsList();
    }
  } catch (err) {
    console.warn('LocalStorage save warning:', err);
  }
}

export function restoreProgress(fileName) {
  const key = getBookKey(fileName, appState.pages.length);
  const history = JSON.parse(localStorage.getItem('comic_reader_history') || '{}');
  const saved = history[key] || history[`${fileName}__${appState.pages.length}`] || history[fileName];

  if (saved && saved.currentIndex > 0 && saved.currentIndex < appState.pages.length) {
    goToPage(saved.currentIndex, false);
    showToast(`Resumed at Page ${saved.currentIndex + 1} of ${saved.totalPages}`);
  }
}

export function updateReadingEstimator() {
  if (!appState.pages || appState.pages.length === 0) return;

  const now = Date.now();
  const elapsedSeconds = Math.round((now - appState.lastPageChangeTime) / 1000);

  if (appState.lastEstIndex !== appState.currentIndex && elapsedSeconds >= 3 && elapsedSeconds <= 180) {
    appState.pageReadDurations.push(elapsedSeconds);
    if (appState.pageReadDurations.length > 8) {
      appState.pageReadDurations.shift();
    }

    const sum = appState.pageReadDurations.reduce((a, b) => a + b, 0);
    appState.avgSecPerPage = Math.round(sum / appState.pageReadDurations.length);
  }

  if (appState.lastEstIndex !== appState.currentIndex) {
    appState.lastPageChangeTime = now;
    appState.lastEstIndex = appState.currentIndex;
  }

  const remainingPages = appState.pages.length - (appState.currentIndex + 1);
  if (remainingPages <= 0) {
    readingTimeTop.classList.add('hidden');
    readingEstimateBottom.classList.add('hidden');
    readingEstimateDivider.classList.add('hidden');
    return;
  }

  const estimatedMinutes = Math.ceil((remainingPages * appState.avgSecPerPage) / 60);
  const label = `~${estimatedMinutes}m left`;

  readingTimeTop.textContent = label;
  readingTimeTop.classList.remove('hidden');

  readingEstimateBottom.textContent = label;
  readingEstimateBottom.classList.remove('hidden');
  readingEstimateDivider.classList.remove('hidden');
}

export function readHistory() {
  try {
    return JSON.parse(localStorage.getItem('comic_reader_history') || '{}');
  } catch (e) {
    return {};
  }
}

export let saveT = 0;

export function saveProgress() {
  clearTimeout(saveT);
  saveT = setTimeout(saveProgressNow, 400);
}

export function migrateLegacyKeys(totalPages) {
  const id = appState.bookId;
  if (!id) return;
  const legacy = `${appState.fileName}__${totalPages}`;
  try {
    const h = readHistory();
    if (h[legacy] && !h[id]) {
      h[id] = h[legacy];
      delete h[legacy];
      localStorage.setItem('comic_reader_history', JSON.stringify(h));
    }
    if (appState.bookmarks[legacy] && !appState.bookmarks[id]) {
      appState.bookmarks[id] = appState.bookmarks[legacy];
      delete appState.bookmarks[legacy];
      saveBookmarksToStorage();
    }
  } catch (e) {}
}

/** Initialize progress saving lifecycle listeners. */
export function initProgress() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveProgressNow();
    }
  });

  window.addEventListener('pagehide', () => {
    saveProgressNow();
  });
}
