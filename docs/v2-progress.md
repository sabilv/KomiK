# v2.0.0 progress

Plan: move KomiK from one hand-written HTML file to a small Vite project **without changing behaviour or stored data**.
Storage keys, the IndexedDB name (`komik`), OPFS file names and the manifest stay exactly as in v1.9.5.

Last updated: day 3.

| Area | Status | Notes |
|---|---|---|
| A. Foundation: Vite 5, compiled Tailwind 3.4, PostCSS, scripts, Prettier | Done | Same theme object as the old inline config; CSS order kept (preflight, custom CSS, utilities). |
| B. Split the code into modules | **Done** | 18 modules in `src/`. First pass: mechanical split keeping original start-up order via sorted `steps` arrays in `main.js`. Second pass (done): all `steps` arrays replaced with per-module `init()` functions; `main.js` now calls them in explicit order. Bug found during refactor: `initThemeModule()` was assigning `systemDarkModeQuery` after calling `initTheme()` — fixed by moving the assignment first. Verified: 20 unit tests + 12 smoke checks + 4 screenshot checks all pass. |
| C. Own the dependencies | **Done** | JSZip, Font Awesome (solid + regular) and Plus Jakarta Sans are bundled; no request goes to a third party. The RAR extractor is a lazy chunk, loaded only when a `.cbr` is opened. Unused `.ttf` / `.woff` legacy font fallbacks dropped via `dropLegacyFonts` plugin in `vite.config.js`; only `.woff2` files are emitted into `dist/`, trimming >500 KB from output assets. |
| D. Workers and service worker | **Done** | Replaced the three Blob-URL workers with dedicated worker files in `src/workers/` (`thumbnail.worker.js`, `library.worker.js`, `rar.worker.js`). Added `generate-precache` plugin in `vite.config.js` to automatically extract all emitted assets from `dist/assets/` and inject `PRECACHE_ASSETS` into `dist/sw.js` (and write `dist/precache.json`), ensuring all bundle JS, CSS, fonts, workers and WASM are precached on service worker install. |
| E. Tests and CI | **Done** | 20 unit tests import the real modules. Smoke test (jsdom, production bundler, strict mode) runs 12 checks and verifies zero unstyled DOM classes. Screenshot tests (`tests/screenshots.mjs`) capture 4 viewports (320 / 390 / 560 / 1024 px) via Edge/Chromium headless and assert non-empty PNGs. Fixed Node 22.14 / undici 8.12.3 compatibility in `tests/smoke.mjs`. `ci.yml` updated with `npm run screenshots` and `v2` branch. |
| F. CSP, docs, release | Not started | Enforce CSP after the Diagnostics count is 0 (and remove the inline `style` attributes that still need `style-src 'unsafe-inline'`); update README, release history, `VERSION` in `public/sw.js`; tag and deploy. |

## Modules

| Module | Purpose |
|---|---|
| `main.js` | Imports the styles and every module, then calls each `initXxx()` function in the correct order. |
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
- Dropped unused `.ttf` and `.woff` fallbacks: shaved >500 KB from `dist/assets/`, leaving only modern `.woff2` font files.
- Replaced Blob-URL workers with native modules in `src/workers/` (`thumbnail.worker.js`, `library.worker.js`, `rar.worker.js`), which clean up CSP rules.
- Service worker precaching is automated at build time via `generate-precache` in `vite.config.js`, injecting all hashed assets directly into `dist/sw.js`.
- Fixed Node 22.14 / undici 8.12.3 `zlib` decompress compatibility in `tests/smoke.mjs`.
- During Area B refactor: `initThemeModule()` called `initTheme()` → `applyTheme()` before `systemDarkModeQuery` was assigned — order bug surfaced immediately in smoke tests, fixed by assigning the media query first.
- Production bundle: JS ~191 KB (61 KB gzip), CSS ~84 KB (24 KB gzip), plus the lazy RAR chunk and compact `.woff2` fonts.
- The sandbox used for development resets between sessions; keep the project in Git and re-run `npm ci`.

## Commands
```bash
npm install
npm run dev         # local server with hot reload
npm run build       # production build in dist/
npm test            # unit and release-consistency tests (no build needed)
npm run smoke       # boots the app in jsdom; run after a build to also check class coverage
npm run screenshots # headless screenshot checks at 4 viewports (needs dist/)
npm run format      # Prettier
```

