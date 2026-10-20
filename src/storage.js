/**
 * KomiK Storage Engine (IndexedDB with synchronous in-memory cache).
 *
 * Database: 'komik'
 * Stores:
 *   - 'covers': Blob cover thumbnails
 *   - 'history': Reading progress and book metadata
 *   - 'bookmarks': Bookmarked page indices per book
 */

const DB_NAME = 'komik';
const DB_VERSION = 2;

let dbPromise = null;

// Synchronous bootstrap from localStorage so UI has data on the first tick without top-level await
let historyCache = {};
let bookmarksCache = {};
try {
  historyCache = JSON.parse(localStorage.getItem('comic_reader_history') || '{}');
} catch (e) {
  historyCache = {};
}
try {
  bookmarksCache = JSON.parse(localStorage.getItem('comic_reader_bookmarks') || '{}');
} catch (e) {
  bookmarksCache = {};
}

let isHydrated = false;

/**
 * Open the IndexedDB database, handling schema upgrades.
 * Preserves the existing v1 'covers' store and adds 'history' & 'bookmarks'.
 */
export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        return resolve(null);
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('covers')) {
            db.createObjectStore('covers');
          }
          if (!db.objectStoreNames.contains('history')) {
            db.createObjectStore('history');
          }
          if (!db.objectStoreNames.contains('bookmarks')) {
            db.createObjectStore('bookmarks');
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB open error:', req.error);
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/** Low-level async get from an object store */
export async function dbGet(storeName, key) {
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/** Low-level async put into an object store */
export async function dbPut(storeName, key, value) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/** Low-level async delete from an object store */
export async function dbDelete(storeName, key) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/** Low-level async get all records from an object store */
export async function dbGetAll(storeName) {
  try {
    const db = await openDB();
    if (!db) return {};
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      const result = {};
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          result[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => resolve({});
    });
  } catch (e) {
    return {};
  }
}

/** Low-level async clear an object store */
export async function dbClear(storeName) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

// -------------------------------------------------------------
// History Management (Async IndexedDB + Synchronous In-Memory Cache)
// -------------------------------------------------------------

/** Synchronous read of the in-memory history cache */
export function getHistoryCache() {
  return historyCache;
}

/** Update a single history record in cache and persist to IndexedDB */
export async function setHistoryItem(key, data) {
  historyCache[key] = data;
  try {
    localStorage.setItem('comic_reader_history', JSON.stringify(historyCache));
  } catch (e) {}
  await dbPut('history', key, data);
}

/** Replace the entire history dataset (e.g. during backup import) */
export async function replaceHistoryAll(newHistory) {
  historyCache = { ...newHistory };
  try {
    localStorage.setItem('comic_reader_history', JSON.stringify(historyCache));
  } catch (e) {}
  await dbClear('history');
  const db = await openDB();
  if (db) {
    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    for (const [k, v] of Object.entries(historyCache)) {
      store.put(v, k);
    }
  }
}

/** Remove a single history item */
export async function deleteHistoryItem(key) {
  delete historyCache[key];
  try {
    localStorage.setItem('comic_reader_history', JSON.stringify(historyCache));
  } catch (e) {}
  await dbDelete('history', key);
}

/** Remove all history records */
export async function clearHistoryAll() {
  historyCache = {};
  try {
    localStorage.removeItem('comic_reader_history');
  } catch (e) {}
  await dbClear('history');
}

// -------------------------------------------------------------
// Bookmarks Management (Async IndexedDB + Synchronous In-Memory Cache)
// -------------------------------------------------------------

/** Synchronous read of the in-memory bookmarks cache */
export function getBookmarksCache() {
  return bookmarksCache;
}

/** Update bookmarks for a single book in cache and persist to IndexedDB */
export async function setBookmarksItem(key, pageList) {
  bookmarksCache[key] = pageList;
  try {
    localStorage.setItem('comic_reader_bookmarks', JSON.stringify(bookmarksCache));
  } catch (e) {}
  await dbPut('bookmarks', key, pageList);
}

/** Replace the entire bookmarks dataset */
export async function replaceBookmarksAll(newBookmarks) {
  bookmarksCache = { ...newBookmarks };
  try {
    localStorage.setItem('comic_reader_bookmarks', JSON.stringify(bookmarksCache));
  } catch (e) {}
  await dbClear('bookmarks');
  const db = await openDB();
  if (db) {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    for (const [k, v] of Object.entries(bookmarksCache)) {
      store.put(v, k);
    }
  }
}

// -------------------------------------------------------------
// Hydration & One-Time Migration from LocalStorage
// -------------------------------------------------------------

/**
 * Hydrates in-memory caches from IndexedDB.
 * If IndexedDB is empty, automatically migrates existing records from localStorage into IndexedDB.
 */
export async function initStorageEngine(onHydrated) {
  if (isHydrated) return;

  try {
    const [storedHistory, storedBookmarks] = await Promise.all([dbGetAll('history'), dbGetAll('bookmarks')]);

    const hasStoredHistory = storedHistory && Object.keys(storedHistory).length > 0;
    const hasStoredBookmarks = storedBookmarks && Object.keys(storedBookmarks).length > 0;

    if (hasStoredHistory) {
      historyCache = storedHistory;
    } else if (Object.keys(historyCache).length > 0) {
      // Migrate initial cache into IndexedDB
      await replaceHistoryAll(historyCache);
    }

    if (hasStoredBookmarks) {
      bookmarksCache = storedBookmarks;
    } else if (Object.keys(bookmarksCache).length > 0) {
      // Migrate initial cache into IndexedDB
      await replaceBookmarksAll(bookmarksCache);
    }

    isHydrated = true;
    if (typeof onHydrated === 'function') {
      onHydrated();
    }
  } catch (err) {
    console.warn('Storage engine initialization warning:', err);
  }
}
