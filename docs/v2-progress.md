# v2.0.0 progress

Plan: move KomiK from one hand-written HTML file to a small Vite project **without changing behaviour or stored data**.
Storage keys, the IndexedDB name (`komik`), OPFS file names and the manifest stay exactly as in v1.9.5.

Last updated: day 2.

| Area | Status | Notes |
|---|---|---|
| A. Foundation: Vite 5, compiled Tailwind 3.4, PostCSS, scripts, Prettier | Done | Same theme object as the old inline config; CSS order kept (preflight, custom CSS, utilities). |
| B. Split the code into modules | **Done (mechanical)** | 18 modules in `src/` (see below). The split was done by a script that keeps the exact original start-up order: functions and plain data are declared in each module, everything with side effects runs from `main.js` as ordered steps. Verified by the unit tests and the smoke test on the production bundler. A second pass can turn `steps` into proper per-module `init()` functions. |
| C. Own the dependencies | Done (trim pending) | JSZip, Font Awesome (solid + regular) and Plus Jakarta Sans are bundled; no request goes to a third party. The RAR extractor is a lazy chunk, loaded only when a `.cbr` is opened. Pending: drop the unused `.ttf` / `.woff` fallbacks (about 400 KB of files in `dist` that modern browsers never request). |
| D. Workers and service worker | Not started | Replace the three Blob workers (RAR, thumbnails, library writes) with real worker files, and generate a precache list from the build so the service worker precaches the hashed files. The interim offline check only looks for the app's own `.js` and `.css`. |
| E. Tests and CI | Mostly done | 20 unit tests now import the real modules (no more text extraction). Smoke test (jsdom, production bundler, strict mode) runs 12 checks: boot, sample comic, next page, spread, Shelf, Settings, saved-books manager, page turn with the curl, Shelf search, shortcut help, and fails on any error or any class without a CSS rule. `ci.yml` is written but has not run on GitHub yet. Pending: screenshot checks at 320 / 390 / 560 / 1024 px. |
| F. CSP, docs, release | Not started | Enforce CSP after the Diagnostics count is 0 (and remove the inline `style` attributes that still need `style-src 'unsafe-inline'`); update README, release history, `VERSION` in `public/sw.js`; tag and deploy. |

## Modules

| Module | Purpose |
|---|---|
| `main.js` | Imports the styles and every module, then runs all start-up steps in the original order. |
| `state.js`, `dom.js` | Shared state and settings (no DOM), and the element lookups. |
| `pure.js`, `paging.js` | Pure helpers and paging rules. These are what the unit tests import. |
| `theme.js`, `ui.js`, `settingsui.js` | Appearance, shared interface helpers and dialogs, Settings. |
| `files.js`, `pages.js`, `epub.js` | Opening files and archives, on-demand page decoding and thumbnails, EPUB export. |
| `reader.js`, `curl.js`, `guided.js` | Rendering, navigation and zoom; page curl and swipe; Guided View. |
| `progress.js`, `bookmarks.js`, `shelf.js`, `library.js` | Progress, bookmarks, Shelf, and books kept on the device. |
| `pwa.js` | Install, service worker, offline status, wake lock, diagnostics. |

## Findings so far
- Three old bugs found by the compiled-CSS check: two invalid Tailwind classes (`py-0.2`, `sm:w-88`; no visual change when removed) and `fa-sparkles` (Pro-only icon, so the Try Sample button never had an icon). The last one now uses `fa-wand-magic-sparkles`.
- Plus Jakarta Sans stops at weight 800, so `font-black` (900) was already rendered as 800 before.
- Production bundle: JS 195 KB (62 KB gzip), CSS 103 KB (25 KB gzip), plus the lazy RAR chunk.
- The sandbox used for development resets between sessions; keep the project in Git and re-run `npm ci`.

## Commands
```bash
npm install
npm run dev        # local server with hot reload
npm run build      # production build in dist/
npm test           # unit and release-consistency tests (no build needed)
npm run smoke      # boots the app in jsdom; run after a build to also check class coverage
npm run format     # Prettier
```
