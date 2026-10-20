/** Element lookups for the page markup. Assigned in order at startup (see main.js). */

export let splashScreen;

export let dropZone;

export let fileInput;

export let browseFilesBtn;

export let openFileBtnTop;

export let closeComicBtn;

export let demoComicBtn;

export let loadingOverlay;

export let loadingText;

export let comicTitle;

export let pageCounterTop;

export let readingTimeTop;

export let readingEstimateBottom;

export let readingEstimateDivider;

export let topNavbar;

export let bottomNavbar;

export let viewportContainer;

export let pageDisplay;

export let webtoonDisplay;

export let prevPageBtn;

export let nextPageBtn;

export let pageSlider;

export let pageInput;

export let pageNumberPrev;

export let pageNumberTotal;

export let totalPagesText;

export let sliderPreviewBox;

export let sliderPreviewImg;

export let sliderPreviewNum;

export let zonePrev;

export let zoneNext;

export let modeSingleBtn;

export let modeDoubleBtn;

export let modeWebtoonBtn;

export let toggleRtlBtn;

export let themeModeBtn;

export let themeIcon;

export let themeLabel;

export let bookmarkBtn;

export let bookmarkIcon;

export let quickShelfBtn;

export let zoomInBtn;

export let zoomOutBtn;

export let zoomResetBtn;

export let zoomLevelText;

export let fitPageBtn;

export let fitWidthBtn;

export let zoomResetHud;

export let hudResetBtn;

export let hudZoomText;

export let thumbnailDrawer;

export let toggleDrawerBtn;

export let closeDrawerBtn;

export let thumbnailGrid;

export let tabPagesBtn;

export let tabBookmarksBtn;

export let tabRecentsBtn;

export let bookmarksView;

export let bookmarksList;

export let bookmarkBadgeCount;

export let clearBookmarksBtn;

export let recentsView;

export let recentsList;

export let clearHistoryBtn;

export let exportEpubBtn;

export let fullscreenBtn;

export let toastNotification;

export let toastMessage;

/** Initialize element lookups from DOM. */
export function initDOM() {
  splashScreen = document.getElementById('splashScreen');
  dropZone = document.getElementById('dropZone');
  fileInput = document.getElementById('fileInput');
  browseFilesBtn = document.getElementById('browseFilesBtn');
  openFileBtnTop = document.getElementById('openFileBtnTop');
  closeComicBtn = document.getElementById('closeComicBtn');
  demoComicBtn = document.getElementById('demoComicBtn');
  loadingOverlay = document.getElementById('loadingOverlay');
  loadingText = document.getElementById('loadingText');
  comicTitle = document.getElementById('comicTitle');
  pageCounterTop = document.getElementById('pageCounterTop');
  readingTimeTop = document.getElementById('readingTimeTop');
  readingEstimateBottom = document.getElementById('readingEstimateBottom');
  readingEstimateDivider = document.getElementById('readingEstimateDivider');
  topNavbar = document.getElementById('topNavbar');
  bottomNavbar = document.getElementById('bottomNavbar');
  viewportContainer = document.getElementById('viewportContainer');
  pageDisplay = document.getElementById('pageDisplay');
  webtoonDisplay = document.getElementById('webtoonDisplay');
  prevPageBtn = document.getElementById('prevPageBtn');
  nextPageBtn = document.getElementById('nextPageBtn');
  pageSlider = document.getElementById('pageSlider');
  pageInput = document.getElementById('pageInput');
  pageNumberPrev = document.getElementById('pageNumberPrev');
  pageNumberTotal = document.getElementById('pageNumberTotal');
  totalPagesText = document.getElementById('totalPagesText');
  sliderPreviewBox = document.getElementById('sliderPreviewBox');
  sliderPreviewImg = document.getElementById('sliderPreviewImg');
  sliderPreviewNum = document.getElementById('sliderPreviewNum');
  zonePrev = document.getElementById('zonePrev');
  zoneNext = document.getElementById('zoneNext');
  modeSingleBtn = document.getElementById('modeSingleBtn');
  modeDoubleBtn = document.getElementById('modeDoubleBtn');
  modeWebtoonBtn = document.getElementById('modeWebtoonBtn');
  toggleRtlBtn = document.getElementById('toggleRtlBtn');
  themeModeBtn = document.getElementById('themeModeBtn');
  themeIcon = document.getElementById('themeIcon');
  themeLabel = document.getElementById('themeLabel');
  bookmarkBtn = document.getElementById('bookmarkBtn');
  bookmarkIcon = document.getElementById('bookmarkIcon');
  quickShelfBtn = document.getElementById('quickShelfBtn');
  zoomInBtn = document.getElementById('zoomInBtn');
  zoomOutBtn = document.getElementById('zoomOutBtn');
  zoomResetBtn = document.getElementById('zoomResetBtn');
  zoomLevelText = document.getElementById('zoomLevelText');
  fitPageBtn = document.getElementById('fitPageBtn');
  fitWidthBtn = document.getElementById('fitWidthBtn');
  zoomResetHud = document.getElementById('zoomResetHud');
  hudResetBtn = document.getElementById('hudResetBtn');
  hudZoomText = document.getElementById('hudZoomText');
  thumbnailDrawer = document.getElementById('thumbnailDrawer');
  toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
  closeDrawerBtn = document.getElementById('closeDrawerBtn');
  thumbnailGrid = document.getElementById('thumbnailGrid');
  tabPagesBtn = document.getElementById('tabPagesBtn');
  tabBookmarksBtn = document.getElementById('tabBookmarksBtn');
  tabRecentsBtn = document.getElementById('tabRecentsBtn');
  bookmarksView = document.getElementById('bookmarksView');
  bookmarksList = document.getElementById('bookmarksList');
  bookmarkBadgeCount = document.getElementById('bookmarkBadgeCount');
  clearBookmarksBtn = document.getElementById('clearBookmarksBtn');
  recentsView = document.getElementById('recentsView');
  recentsList = document.getElementById('recentsList');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');
  exportEpubBtn = document.getElementById('exportEpubBtn');
  fullscreenBtn = document.getElementById('fullscreenBtn');
  toastNotification = document.getElementById('toastNotification');
  toastMessage = document.getElementById('toastMessage');
}
