# KomiK

A private, installable comic reader for `.cbz` and `.cbr` files that runs entirely in your browser.
No account, no upload: your comics are opened and stored on your own device.

**Current version:** v1.9.5 (see the release history in [the product document](komik_product_documentation_roadmap.md))

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

## Privacy

Comic files and reading data never leave your device. The app downloads its own libraries and fonts (Tailwind, Font Awesome, JSZip, Google Fonts) from public CDNs on first load and caches them afterwards. The browser keeps progress and books **per site address**: if you change the domain, export a backup first (Shelf, then Export).

## Project layout

```
.
├── index.html                 # page markup (Vite entry)
├── src/
│   ├── main.js                # imports everything and runs the start-up steps in order
│   ├── state.js, dom.js       # shared state and settings; element lookups
│   ├── pure.js, paging.js     # pure helpers and paging rules (unit tested)
│   ├── reader.js, curl.js, guided.js            # rendering and zoom; page curl and swipe; Guided View
│   ├── files.js, pages.js, epub.js              # opening files; page decoding and thumbnails; EPUB export
│   ├── progress.js, bookmarks.js, shelf.js, library.js
│   ├── theme.js, ui.js, settingsui.js, pwa.js
│   ├── style.css              # Tailwind layers + custom CSS
│   └── assets/                # RAR extractor (loaded only when a .cbr is opened)
├── public/                    # copied as-is: sw.js, manifest.webmanifest, _headers, PNG icons
├── tests/                     # unit tests (run.mjs) and browser-less smoke test (smoke.mjs)
├── docs/v2-progress.md        # status of the v2.0.0 work
├── komik_product_documentation_roadmap.md   # architecture, release history, roadmap
├── .github/workflows/ci.yml   # build + tests on every push
├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, .prettierrc.json
└── README.md, .gitignore
```

## Run locally

Requires Node.js 18 or newer (20 recommended).

```bash
npm install
npm run dev
```

The service worker and install features need a secure context; `localhost` counts as one.

## Tests

```bash
npm test                  # unit and release-consistency tests (no build needed)
npm run build && npm run smoke   # boots the real bundle in jsdom, drives the main screens, checks CSS coverage
```

The unit tests cover paging (single, spread, right-to-left, wide pages), panel detection for Guided View, shelf search and grouping, next-volume selection, saved-books ordering, and release consistency (manifest and icons, `public/sw.js` version equals the app version, and the release history lists the current version). Screenshot checks at several widths are planned for v2.0.0. Run `npm run format` before committing.

## Deploy

```bash
npm run build
```

Upload the contents of `dist/` to any static host (the live site uses Cloudflare). Everything the app needs is in `dist/`, including fonts and icons; no third-party host is contacted.

Always deploy the whole `dist/` folder at once. Users with the app already installed see a "new version is ready" banner and apply it with Reload.

### Content Security Policy

`public/_headers` ships the policy as `Content-Security-Policy-Report-Only`. After testing on real devices, open Settings, then Diagnostics, and check that the security policy report count stays at 0. Then rename the header to `Content-Security-Policy` to enforce it.

## Releasing a new version

1. Change the version everywhere it appears in `index.html` and `src/main.js` (title, splash, home, license dialog) and add a changelog entry.
2. Change `VERSION` in `public/sw.js` to the same value.
3. Add the release to **Release History** in the product document and mark only the newest entry as Current.
4. Run `npm run build`, `npm test` and `npm run smoke`, and fix anything that fails.
5. Test install and an airplane-mode launch on one iPhone and one Android device, and copy Settings, then Diagnostics, from each.
6. Deploy the whole `dist/` folder.

## Known limits

- Guided View can miss or merge panels on borderless art, overlapping speech bubbles, splash pages, and noisy scans.
- Solid RAR archives can be slow to jump around in. Converting to CBZ is faster.
- iOS keeps the Safari tab and the installed Home Screen app in separate storage, and may remove stored data under low space. Keep a JSON backup.
- Wake Lock, install, and the device library need HTTPS (or `localhost`).

## Roadmap

See the product document for details. Next is **v2.0.0**: a Vite build with compiled Tailwind, self-hosted dependencies, and automated checks. After that: remote libraries (OPDS / WebDAV) and optional on-device AI features.

## License

MIT. The license text is available in the app (Home or More menu, then About and license).
