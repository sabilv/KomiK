/** Shared application state and user settings. No DOM access, so tests can import it. */

export const appState = {
  pages: [],
  pageNames: [],
  currentIndex: 0,
  viewMode: 'single',
  fitMode: 'page',
  isRTL: false,
  themeMode: 'auto', // 'auto' | 'dark' | 'light'
  zoomLevel: 1.0,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  panStart: { x: 0, y: 0 },
  hasPanned: false,
  pinchDist: 0,
  fileName: '',
  uiVisible: true,
  bookmarks: {},
  pendingResumeFileName: null,
  pendingResumeIndex: null,
  // Reading Speed Tracking Metrics
  lastPageChangeTime: Date.now(),
  pageReadDurations: [],
  avgSecPerPage: 25 // Default starting estimation (25s per page)
};

export const SETTINGS_DEFAULTS = {
  theme: 'press',
  curl: true,
  keepZoom: false,
  perBook: true,
  hairline: true,
  zoneWidth: 25,
  swapZones: false,
  truePrev: false,
  coverAlone: true,
  wakeLock: true,
  autoSave: true,
  groupSeries: true
};

export const settings = Object.assign({}, SETTINGS_DEFAULTS);

export function saveSettings() {
  try {
    localStorage.setItem('komik_settings', JSON.stringify(settings));
  } catch (e) {}
}

/** Initialize application state and load settings from storage. */
export function initState() {
  appState.errors = [];
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem('komik_settings') || '{}'));
  } catch (e) {}
  settings.zoneWidth = [20, 25, 35].includes(Number(settings.zoneWidth)) ? Number(settings.zoneWidth) : 25;
  settings.theme = settings.theme === 'classic' ? 'classic' : 'press';

  const moreBtn = document.getElementById('moreBtn');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      const guidedSpan = document.getElementById('menuGuidedBtn')?.querySelector('span');
      if (guidedSpan) guidedSpan.textContent = appState.guided ? 'Guided view: On' : 'Guided view (beta)';
    });
  }
}

