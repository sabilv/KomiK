# KomiK

A private, installable comic reader for `.cbz` and `.cbr` files that runs entirely in your browser.
No account, no upload: your comics are opened and stored on your own device.

**Current version:** v2.0.0 (see the release history in [the product document](komik_product_documentation_roadmap.md))

## Features

- **Formats:** CBZ / ZIP, CBR / RAR (WebAssembly extractor running in a worker), loose images. The format is detected from the file contents, not the extension.
- **Reading modes:** Single, Spread (with optional "cover page alone"), and vertical Webtoon. Right-to-left manga direction.
- **Page turning:** swipe or drag with an Apple Books-style page curl, tap zones, keyboard, scrubber with live preview. Optional "previous page like a book".
- **Zoom:** pinch, double-tap on the center, Ctrl + scroll on desktop, with pan limits.
- **Guided View (beta):** detects panels on each page and moves the camera panel by panel. Works best on pages with clear gutters.
- **Library:** keeps opened books on the device (browser private file system), covers, Continue reading, finished status, series grouping from `ComicInfo.xml`, search, and a saved-books manager to free up space.
- **Install and offline:** installable as an app, with a service worker that caches the app for offline use. Settings shows whether offline is actually ready.
- **Bookmarks, progress and per-book view settings** are saved on the device, with JSON backup export and import.
- **EPUB export:** fixed-layout EPUB 3 from any open book.
- **Themes:** Press Green (default) and Classic Blue, light and dark.
- **Accessibility:** labelled controls, focus rings, keyboard shortcuts (press `?`), reduce-motion support.

## Tech Stack

- **Core & Runtime:** Vanilla ES2022+ JavaScript (ESM, modular architecture, zero framework overhead), HTML5, and modern CSS3 (`100dvh`, CSS container queries, CSS custom properties, backdrop blur).
- **Build & Styling:** [Vite 8](https://vitejs.dev/) with [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/postcss`), Autoprefixer, PostCSS, and Prettier.
- **Archive Extraction & Processing:**
  - [JSZip](https://stuk.github.io/jszip/) for client-side `.cbz` / ZIP decompression in browser memory.
  - Custom WebAssembly (`unrar` WASM) running in a dedicated worker for `.cbr` / RAR archives.
- **Multi-Threading (Web Workers):**
  - `thumbnail.worker.js` — Offscreen canvas-based thumbnail generation and resizing.
  - `library.worker.js` — Chunked file writes into OPFS via `createSyncAccessHandle`.
  - `rar.worker.js` — Off-thread WASM archive extraction keeping the UI responsive.
- **Storage & PWA:**
  - **OPFS (Origin Private File System):** Direct, private on-device storage for opened comic books.
  - **IndexedDB & LocalStorage:** Reader state, reading progress, bookmarks, settings, and reading history.
  - **Service Worker (`sw.js`):** Offline cache-first strategy with automated build-time precaching of hashed bundle assets.
  - **Web App Manifest:** PWA installable on iOS, Android, and Desktop with custom icons and file association.
  - **Screen Wake Lock API:** Prevents screen dimming while reading.
- **Typography & Icons (100% Self-Hosted):**
  - [Plus Jakarta Sans](https://fontsource.org/fonts/plus-jakarta-sans) via Fontsource (WOFF2 subsets, legacy formats dropped for performance).
  - [Font Awesome 6 Free](https://fontawesome.com/) (solid and regular icon sets bundled locally).
- **Testing & Quality Assurance:**
  - Built-in Node.js test runner for unit tests (`tests/run.mjs`).
  - [JSDOM](https://github.com/jsdom/jsdom) smoke tests verifying live DOM interactions and strict CSS class coverage (`tests/smoke.mjs`).
  - Headless Chromium / Edge automated screenshot testing across 4 viewport breakpoints (`tests/screenshots.mjs`).
  - GitHub Actions CI matrix on push and pull requests.

## Privacy

Comic files and reading data never leave your device. All libraries and fonts are bundled — the app makes no third-party network requests after the service worker is installed. The browser keeps progress and books **per site address**: if you change the domain, export a backup first (Shelf, then Export).

## Project layout

```
.
├── index.html                 # page markup (Vite entry)
├── src/
│   ├── main.js                # imports everything and calls each init() function in order
│   ├── state.js, dom.js       # shared state and settings; element lookups
│   ├── pure.js, paging.js     # pure helpers and paging rules (unit tested)
│   ├── reader.js, curl.js, guided.js            # rendering and zoom; page curl and swipe; Guided View
│   ├── files.js, pages.js, epub.js              # opening files; page decoding and thumbnails; EPUB export
│   ├── progress.js, bookmarks.js, shelf.js, library.js
│   ├── theme.js, ui.js, settingsui.js, pwa.js
│   ├── workers/               # thumbnail.worker.js, library.worker.js, rar.worker.js
│   ├── style.css              # Tailwind layers + custom CSS
│   └── assets/                # RAR extractor WASM (loaded only when a .cbr is opened)
├── public/                    # copied as-is: sw.js, manifest.webmanifest, _headers, PNG icons
├── tests/                     # run.mjs (unit), smoke.mjs (jsdom), screenshots.mjs (headless)
├── docs/v2-progress.md        # status of the v2.0.0 work
├── komik_product_documentation_roadmap.md   # architecture, release history, roadmap
├── .github/workflows/ci.yml   # build + tests on every push
├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, .prettierrc.json
└── README.md, .gitignore
```

## Run locally

Requires Node.js 18 or newer (20+ recommended).

```bash
npm install
npm run dev
```

The service worker and install features need a secure context; `localhost` counts as one.

## Tests

```bash
npm test                              # unit and release-consistency tests (no build needed)
npm run build && npm run smoke        # boots the real bundle in jsdom, drives the main screens, checks CSS coverage
npm run build && npm run screenshots  # headless screenshot checks at 320/390/560/1024 px (Edge or Chrome required)
```

The unit tests cover paging (single, spread, right-to-left, wide pages), panel detection for Guided View, shelf search and grouping, next-volume selection, saved-books ordering, and release consistency (manifest and icons, `public/sw.js` version equals the app version, and the release history lists the current version). Run `npm run format` before committing.

## Deploy

```bash
npm run build
```

Upload the contents of `dist/` to any static host (the live site uses Cloudflare). Everything the app needs is in `dist/`, including fonts, icons, and workers; no third-party host is contacted.

Always deploy the whole `dist/` folder at once. Users with the app already installed see a "new version is ready" banner and apply it with Reload.

### Content Security Policy

`public/_headers` ships an enforced `Content-Security-Policy`. All scripts and styles are self-hosted, so no CDN allowlist is needed. The only remaining `'unsafe-inline'` is in `style-src`, required for `.style.property` assignments in JS (canvas-based page curl, zoom transforms, and progress bar width). If these are ever moved to CSS custom properties, `unsafe-inline` can be removed entirely.

## Releasing a new version

1. Change the version everywhere it appears in `index.html` (title, splash, home, changelog, license button) and add a changelog entry.
2. Change `VERSION` in `public/sw.js` to the same value.
3. Add the release to **Release History** in the product document and mark only the newest entry as Current.
4. Run `npm run build`, `npm test`, `npm run smoke`, and `npm run screenshots`, and fix anything that fails.
5. Test install and an airplane-mode launch on one iPhone and one Android device, and copy Settings → Diagnostics from each.
6. Deploy the whole `dist/` folder.

## Known limits

- Guided View can miss or merge panels on borderless art, overlapping speech bubbles, splash pages, and noisy scans.
- Solid RAR archives can be slow to jump around in. Converting to CBZ is faster.
- iOS keeps the Safari tab and the installed Home Screen app in separate storage, and may remove stored data under low space. Keep a JSON backup.
- Wake Lock, install, and the device library need HTTPS (or `localhost`).

## Roadmap

See the product document for details. Next: **v2.1.0** — remote libraries (OPDS / WebDAV). Further out: optional on-device AI features.

## License

MIT. The license text is available in the app (Home or More menu, then About and license).

