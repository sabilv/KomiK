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

/** Load-time work, run by main.js in the original order. */
export const steps = [
  [
    1,
    () => {
      splashScreen = document.getElementById('splashScreen');
    }
  ],
  [
    2,
    () => {
      dropZone = document.getElementById('dropZone');
    }
  ],
  [
    3,
    () => {
      fileInput = document.getElementById('fileInput');
    }
  ],
  [
    4,
    () => {
      browseFilesBtn = document.getElementById('browseFilesBtn');
    }
  ],
  [
    5,
    () => {
      openFileBtnTop = document.getElementById('openFileBtnTop');
    }
  ],
  [
    6,
    () => {
      closeComicBtn = document.getElementById('closeComicBtn');
    }
  ],
  [
    7,
    () => {
      demoComicBtn = document.getElementById('demoComicBtn');
    }
  ],
  [
    8,
    () => {
      loadingOverlay = document.getElementById('loadingOverlay');
    }
  ],
  [
    9,
    () => {
      loadingText = document.getElementById('loadingText');
    }
  ],
  [
    10,
    () => {
      comicTitle = document.getElementById('comicTitle');
    }
  ],
  [
    11,
    () => {
      pageCounterTop = document.getElementById('pageCounterTop');
    }
  ],
  [
    12,
    () => {
      readingTimeTop = document.getElementById('readingTimeTop');
    }
  ],
  [
    13,
    () => {
      readingEstimateBottom = document.getElementById('readingEstimateBottom');
    }
  ],
  [
    14,
    () => {
      readingEstimateDivider = document.getElementById('readingEstimateDivider');
    }
  ],
  [
    15,
    () => {
      topNavbar = document.getElementById('topNavbar');
    }
  ],
  [
    16,
    () => {
      bottomNavbar = document.getElementById('bottomNavbar');
    }
  ],
  [
    17,
    () => {
      viewportContainer = document.getElementById('viewportContainer');
    }
  ],
  [
    18,
    () => {
      pageDisplay = document.getElementById('pageDisplay');
    }
  ],
  [
    19,
    () => {
      webtoonDisplay = document.getElementById('webtoonDisplay');
    }
  ],
  [
    20,
    () => {
      prevPageBtn = document.getElementById('prevPageBtn');
    }
  ],
  [
    21,
    () => {
      nextPageBtn = document.getElementById('nextPageBtn');
    }
  ],
  [
    22,
    () => {
      pageSlider = document.getElementById('pageSlider');
    }
  ],
  [
    23,
    () => {
      pageInput = document.getElementById('pageInput');
    }
  ],
  [
    24,
    () => {
      pageNumberPrev = document.getElementById('pageNumberPrev');
    }
  ],
  [
    25,
    () => {
      pageNumberTotal = document.getElementById('pageNumberTotal');
    }
  ],
  [
    26,
    () => {
      totalPagesText = document.getElementById('totalPagesText');
    }
  ],
  [
    27,
    () => {
      sliderPreviewBox = document.getElementById('sliderPreviewBox');
    }
  ],
  [
    28,
    () => {
      sliderPreviewImg = document.getElementById('sliderPreviewImg');
    }
  ],
  [
    29,
    () => {
      sliderPreviewNum = document.getElementById('sliderPreviewNum');
    }
  ],
  [
    30,
    () => {
      zonePrev = document.getElementById('zonePrev');
    }
  ],
  [
    31,
    () => {
      zoneNext = document.getElementById('zoneNext');
    }
  ],
  [
    32,
    () => {
      modeSingleBtn = document.getElementById('modeSingleBtn');
    }
  ],
  [
    33,
    () => {
      modeDoubleBtn = document.getElementById('modeDoubleBtn');
    }
  ],
  [
    34,
    () => {
      modeWebtoonBtn = document.getElementById('modeWebtoonBtn');
    }
  ],
  [
    35,
    () => {
      toggleRtlBtn = document.getElementById('toggleRtlBtn');
    }
  ],
  [
    36,
    () => {
      themeModeBtn = document.getElementById('themeModeBtn');
    }
  ],
  [
    37,
    () => {
      themeIcon = document.getElementById('themeIcon');
    }
  ],
  [
    38,
    () => {
      themeLabel = document.getElementById('themeLabel');
    }
  ],
  [
    39,
    () => {
      bookmarkBtn = document.getElementById('bookmarkBtn');
    }
  ],
  [
    40,
    () => {
      bookmarkIcon = document.getElementById('bookmarkIcon');
    }
  ],
  [
    41,
    () => {
      quickShelfBtn = document.getElementById('quickShelfBtn');
    }
  ],
  [
    42,
    () => {
      zoomInBtn = document.getElementById('zoomInBtn');
    }
  ],
  [
    43,
    () => {
      zoomOutBtn = document.getElementById('zoomOutBtn');
    }
  ],
  [
    44,
    () => {
      zoomResetBtn = document.getElementById('zoomResetBtn');
    }
  ],
  [
    45,
    () => {
      zoomLevelText = document.getElementById('zoomLevelText');
    }
  ],
  [
    46,
    () => {
      fitPageBtn = document.getElementById('fitPageBtn');
    }
  ],
  [
    47,
    () => {
      fitWidthBtn = document.getElementById('fitWidthBtn');
    }
  ],
  [
    48,
    () => {
      zoomResetHud = document.getElementById('zoomResetHud');
    }
  ],
  [
    49,
    () => {
      hudResetBtn = document.getElementById('hudResetBtn');
    }
  ],
  [
    50,
    () => {
      hudZoomText = document.getElementById('hudZoomText');
    }
  ],
  [
    51,
    () => {
      thumbnailDrawer = document.getElementById('thumbnailDrawer');
    }
  ],
  [
    52,
    () => {
      toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
    }
  ],
  [
    53,
    () => {
      closeDrawerBtn = document.getElementById('closeDrawerBtn');
    }
  ],
  [
    54,
    () => {
      thumbnailGrid = document.getElementById('thumbnailGrid');
    }
  ],
  [
    55,
    () => {
      tabPagesBtn = document.getElementById('tabPagesBtn');
    }
  ],
  [
    56,
    () => {
      tabBookmarksBtn = document.getElementById('tabBookmarksBtn');
    }
  ],
  [
    57,
    () => {
      tabRecentsBtn = document.getElementById('tabRecentsBtn');
    }
  ],
  [
    58,
    () => {
      bookmarksView = document.getElementById('bookmarksView');
    }
  ],
  [
    59,
    () => {
      bookmarksList = document.getElementById('bookmarksList');
    }
  ],
  [
    60,
    () => {
      bookmarkBadgeCount = document.getElementById('bookmarkBadgeCount');
    }
  ],
  [
    61,
    () => {
      clearBookmarksBtn = document.getElementById('clearBookmarksBtn');
    }
  ],
  [
    62,
    () => {
      recentsView = document.getElementById('recentsView');
    }
  ],
  [
    63,
    () => {
      recentsList = document.getElementById('recentsList');
    }
  ],
  [
    64,
    () => {
      clearHistoryBtn = document.getElementById('clearHistoryBtn');
    }
  ],
  [
    65,
    () => {
      exportEpubBtn = document.getElementById('exportEpubBtn');
    }
  ],
  [
    66,
    () => {
      fullscreenBtn = document.getElementById('fullscreenBtn');
    }
  ],
  [
    67,
    () => {
      toastNotification = document.getElementById('toastNotification');
    }
  ],
  [
    68,
    () => {
      toastMessage = document.getElementById('toastMessage');
    }
  ]
];
