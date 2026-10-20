/** Page bookmarks. */
import {
  bookmarkBadgeCount,
  bookmarkBtn,
  bookmarkIcon,
  bookmarksList,
  bookmarksView,
  clearBookmarksBtn,
  recentsView,
  tabBookmarksBtn,
  tabPagesBtn,
  tabRecentsBtn,
  thumbnailGrid
} from './dom.js';
import { BLANK_IMG, bindPageImg, thumbCache } from './pages.js';
import { getBookKey } from './progress.js';
import { escapeHtml } from './pure.js';
import { goToPage } from './reader.js';
import { appState } from './state.js';
import { showToast, toggleDrawer } from './ui.js';

export function loadBookmarksFromStorage() {
  try {
    appState.bookmarks = JSON.parse(localStorage.getItem('comic_reader_bookmarks') || '{}');
  } catch (e) {
    appState.bookmarks = {};
  }
}

export function saveBookmarksToStorage() {
  try {
    localStorage.setItem('comic_reader_bookmarks', JSON.stringify(appState.bookmarks));
  } catch (e) {
    console.warn('Bookmark storage warning:', e);
  }
}

export function isCurrentPageBookmarked() {
  const key = getBookKey();
  if (!key || !appState.bookmarks[key]) return false;
  return appState.bookmarks[key].includes(appState.currentIndex);
}

export function toggleBookmark() {
  if (!appState.fileName || appState.pages.length === 0) {
    showToast('Open a comic first to bookmark pages.');
    return;
  }

  const key = getBookKey();
  if (!key) return;

  if (!appState.bookmarks[key]) {
    appState.bookmarks[key] = [];
  }

  const pageIdx = appState.currentIndex;
  const existingIndex = appState.bookmarks[key].indexOf(pageIdx);

  if (existingIndex >= 0) {
    appState.bookmarks[key].splice(existingIndex, 1);
    showToast(`Bookmark removed for Page ${pageIdx + 1}`);
  } else {
    appState.bookmarks[key].push(pageIdx);
    appState.bookmarks[key].sort((a, b) => a - b);
    showToast(`Page ${pageIdx + 1} bookmarked!`);
  }

  saveBookmarksToStorage();
  updateBookmarkButton();
  renderBookmarksList();
}

export function updateBookmarkButton() {
  const bookmarked = isCurrentPageBookmarked();
  if (bookmarked) {
    bookmarkIcon.className = 'fa-solid fa-bookmark text-sm text-apple-amber';
    bookmarkBtn.classList.add('bg-apple-amber/20', 'border-apple-amber/40');
  } else {
    bookmarkIcon.className = 'fa-regular fa-bookmark text-sm text-apple-amber';
    bookmarkBtn.classList.remove('bg-apple-amber/20', 'border-apple-amber/40');
  }

  const key = getBookKey();
  const count = key && appState.bookmarks[key] ? appState.bookmarks[key].length : 0;
  if (count > 0) {
    bookmarkBadgeCount.textContent = count;
    bookmarkBadgeCount.classList.remove('hidden');
  } else {
    bookmarkBadgeCount.classList.add('hidden');
  }
}

export function renderBookmarksList() {
  bookmarksList.innerHTML = '';
  const key = getBookKey();
  const list = key && appState.bookmarks[key] ? appState.bookmarks[key] : [];

  if (list.length === 0) {
    bookmarksList.innerHTML =
      '<p class="text-xs text-zinc-500 text-center py-8">No bookmarked pages yet.<br>Tap "Bookmark" on the bottom bar to save pages.</p>';
    return;
  }

  list.forEach((pageIdx) => {
    const card = document.createElement('div');
    card.className =
      'p-2.5 rounded-2xl glass-card border flex items-center justify-between hover:border-apple-blue transition cursor-pointer group';

    const thumbUrl = thumbCache.get(pageIdx) || BLANK_IMG;

    card.innerHTML = `
                    <div class="flex items-center space-x-3 min-w-0">
                        <img src="${thumbUrl}" class="w-10 h-14 object-cover rounded-lg border border-black/10 dark:border-white/10 shrink-0" alt="Page ${pageIdx + 1}">
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-apple-blue transition">Page ${pageIdx + 1}</span>
                            <span class="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">${escapeHtml(appState.pageNames[pageIdx] || 'Saved Spread')}</span>
                        </div>
                    </div>
                    <button aria-label="Remove Bookmark" class="remove-single-bookmark p-2 text-zinc-400 hover:text-rose-500 transition" title="Remove Bookmark">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                `;

    bindPageImg(card.querySelector('img'), pageIdx, true);
    card.onclick = (e) => {
      if (e.target.closest('.remove-single-bookmark')) {
        e.stopPropagation();
        const idxInArray = appState.bookmarks[key].indexOf(pageIdx);
        if (idxInArray >= 0) {
          appState.bookmarks[key].splice(idxInArray, 1);
          saveBookmarksToStorage();
          updateBookmarkButton();
          renderBookmarksList();
        }
        return;
      }

      goToPage(pageIdx);
      if (window.innerWidth < 768) toggleDrawer(false);
    };

    bookmarksList.appendChild(card);
  });
}

/** Initialize bookmark buttons, tabs, and load saved bookmarks. */
export function initBookmarks() {
  if (bookmarkBtn) bookmarkBtn.addEventListener('click', toggleBookmark);

  if (clearBookmarksBtn) {
    clearBookmarksBtn.addEventListener('click', () => {
      const key = getBookKey();
      if (key && appState.bookmarks[key]) {
        delete appState.bookmarks[key];
        saveBookmarksToStorage();
        updateBookmarkButton();
        renderBookmarksList();
        showToast('All bookmarks cleared for this book');
      }
    });
  }

  if (tabBookmarksBtn) {
    tabBookmarksBtn.addEventListener('click', () => {
      tabBookmarksBtn.classList.add('text-apple-blue', 'border-b-2', 'border-apple-blue');
      tabBookmarksBtn.classList.remove('text-zinc-400', 'text-zinc-500');
      if (tabPagesBtn) {
        tabPagesBtn.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabPagesBtn.classList.add('text-zinc-400');
      }
      if (tabRecentsBtn) {
        tabRecentsBtn.classList.remove('text-apple-blue', 'border-b-2', 'border-apple-blue');
        tabRecentsBtn.classList.add('text-zinc-400');
      }

      if (thumbnailGrid) thumbnailGrid.classList.add('hidden');
      if (bookmarksView) {
        bookmarksView.classList.remove('hidden');
        bookmarksView.classList.add('flex');
      }
      if (recentsView) {
        recentsView.classList.add('hidden');
        recentsView.classList.remove('flex');
      }

      renderBookmarksList();
    });
  }

  loadBookmarksFromStorage();
}

