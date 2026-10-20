# v2.0.0 & v2.5 Progress

Plan: move KomiK from one hand-written HTML file to a small Vite project **without changing behaviour or stored data**, followed by modernising the storage architecture with IndexedDB.

Last updated: day 3 (v2.5 in progress).

---

## v2.0.0 Status (Shipped & Merged to `main`)

| Area | Status | Notes |
|---|---|---|
| A. Foundation: Vite, compiled Tailwind, PostCSS, Prettier | **Done** | Custom theme tokens (zinc + apple palettes); CSS layers preserved. Upgraded to Tailwind v4 & Vite 8 with `@tailwindcss/postcss`. |
| B. Split the code into modules | **Done** | 18 modules in `src/`. All `steps` arrays converted into explicit `init()` functions; `main.js` calls them in sequence. |
| C. Own the dependencies | **Done** | JSZip, Font Awesome (solid + regular), and Plus Jakarta Sans bundled. Only `.woff2` fonts emitted (>500 KB saved). |
| D. Workers and service worker | **Done** | Dedicated worker files (`thumbnail.worker.js`, `library.worker.js`, `rar.worker.js`). Build-time SW precache generation. |
| E. Tests and CI | **Done** | 20 unit tests, 12-check strict smoke test (jsdom), 4-viewport headless screenshot checks, GitHub Actions CI workflow. |
| F. CSP, docs, release | **Done** | Enforced CSP in `_headers`; updated README, release history, and bumped `VERSION` in `sw.js` and `index.html` to `v2.0.0`. |

---

## v2.5 Multi-Tier Storage Engine (In Progress on branch `2.5`)

Goal: Replace `localStorage` string serialization for reading history and bookmarks with an IndexedDB storage engine while preserving zero-latency synchronous UI lookups.

| Milestone | Status | Notes |
|---|---|---|
| 1. Database Schema Upgrade | **Done** | Upgraded `'komik'` database from v1 (`covers`) to v2 (`covers`, `history`, `bookmarks`). |
| 2. Storage Engine (`src/storage.js`) | **Done** | Async CRUD helpers (`dbGet`, `dbPut`, `dbDelete`, `dbGetAll`, `dbClear`) combined with in-memory sync cache for instant UI reads. |
| 3. Automatic Migration | **Done** | Transparent one-time import from existing `localStorage` (`comic_reader_history` and `comic_reader_bookmarks`) into IndexedDB. |
| 4. Reading History Wiring (`src/progress.js`) | **Done** | `saveProgressNow()` and `readHistory()` persist to IndexedDB through the storage engine; `migrateLegacyKeys()` updated. |
| 5. Bookmarks Wiring (`src/bookmarks.js`) | **Done** | `loadBookmarksFromStorage()` and `saveBookmarksToStorage()` wired to IndexedDB cache & persistence. |
| 6. Shelf & Backup Wiring (`src/shelf.js`) | **Done** | `idb` wrapper uses `dbGet`/`dbPut`; `exportBackup()` and `importBackup()` operate on the new engine; `clearHistoryBtn` purges IndexedDB. |
| 7. Main Lifecycle Wiring (`src/main.js`) | **Done** | `initStorageEngine()` runs after DOM ready, refreshing shelf cards once IndexedDB hydration finishes. |
| 8. Full Test Verification | **Done** | 20 unit tests, 12 smoke checks, and 4 headless screenshot viewports passing. |

---

## Modules Overview

| Module | Purpose |
|---|---|
| `main.js` | Imports styles and modules; initializes storage engine and calls `initXxx()` functions in order. |
| `storage.js` | IndexedDB multi-tier storage engine with synchronous in-memory cache and automatic migration. |
| `state.js`, `dom.js` | Shared state, settings (no DOM), and element lookups. |
| `pure.js`, `paging.js` | Pure helpers and paging rules (unit tested). |
| `theme.js`, `ui.js`, `settingsui.js` | Appearance, shared interface helpers, dialogs, and Settings. |
| `files.js`, `pages.js`, `epub.js` | Opening files and archives, on-demand page decoding, EPUB export. |
| `reader.js`, `curl.js`, `guided.js` | Rendering, navigation, zoom, page curl, swipe, and Guided View. |
| `progress.js`, `bookmarks.js`, `shelf.js`, `library.js` | Progress, bookmarks, Shelf, and on-device OPFS books. |
| `pwa.js` | Install prompt, service worker, offline status, wake lock, diagnostics. |
| `workers/` | Dedicated workers: `thumbnail.worker.js`, `library.worker.js`, `rar.worker.js`. |

---

## Findings & Key Decisions
- **Tailwind v4 & Vite v8:** Seamlessly upgraded using `@tailwindcss/postcss`, linking the existing theme config via `@config "../tailwind.config.js"` and `@source` directives in `src/style.css`.
- **Multi-Tier Storage Architecture:** `localStorage` is kept only for synchronous boot settings (theme, low-power toggle, hints) to eliminate visual flicker. High-volume reading history and bookmarks are moved to IndexedDB to remove the 5 MB quota ceiling.
- **Synchronous Cache Strategy:** UI rendering remains 100% synchronous by bootstrapping from an in-memory cache, while persistence occurs asynchronously in IndexedDB.
- **Workers & CSP:** Native module workers replace Blob-URLs, permitting a strict CSP with `worker-src 'self'`.

---

## Commands
```bash
npm install
npm run dev         # local server with hot reload
npm run build       # production build in dist/
npm test            # unit and release-consistency tests (no build needed)
npm run smoke       # boots the app in jsdom; run after a build to verify DOM & CSS rules
npm run screenshots # headless screenshot checks at 320/390/560/1024 px (needs dist/)
npm run format      # Prettier code formatting
```
