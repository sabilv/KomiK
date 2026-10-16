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
├── index.html                 # the whole app (HTML, CSS, JavaScript)
├── sw.js                      # service worker (offline cache, update prompt)
├── manifest.webmanifest       # install metadata
├── _headers                   # Cloudflare response headers (CSP is report-only)
├── icons/                     # PNG icons (180, 192, 512, maskable 512, favicon 32)
├── tests/run.mjs              # unit and release-consistency tests
├── komik_product_documentation_roadmap.md   # architecture, release history, roadmap
├── README.md
└── .gitignore
```

The hosted site is a **flat folder**: `manifest.webmanifest` and `sw.js` refer to the icons next to `index.html`, so the PNG files from `icons/` must be copied beside it when you deploy.

## Run locally

The service worker and install features need a secure context; `localhost` counts as one.

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static server works (for example `npx serve .`). Opening `index.html` straight from the file system also reads comics, but the service worker, install, and device library are unavailable there.

## Tests

Requires Node.js 18 or newer. No dependencies.

```bash
node tests/run.mjs index.html
```

The tests cover paging (single, spread, right-to-left, wide pages), panel detection for Guided View, shelf search and grouping, next-volume selection, saved-books ordering, and release consistency (manifest and icons, `sw.js` version equals the app version, and the release history lists the current version).

## Deploy

Create a flat folder and upload it to any static host (the live site uses Cloudflare):

```bash
mkdir -p dist
cp index.html sw.js manifest.webmanifest _headers icons/*.png dist/
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item index.html, sw.js, manifest.webmanifest, _headers, icons\*.png dist\
```

Always deploy `index.html` and `sw.js` together. Users with the app already installed see a "new version is ready" banner and apply it with Reload.

### Content Security Policy

`_headers` ships the policy as `Content-Security-Policy-Report-Only`. After testing on real devices, open Settings, then Diagnostics, and check that the security policy report count stays at 0. Then rename the header to `Content-Security-Policy` to enforce it.

## Releasing a new version

1. Change the version everywhere it appears in `index.html` (title, splash, home, license dialog) and add a changelog entry.
2. Change `VERSION` in `sw.js` to the same value.
3. Add the release to **Release History** in the product document and mark only the newest entry as Current.
4. Run `node tests/run.mjs index.html` and fix anything that fails.
5. Test install and an airplane-mode launch on one iPhone and one Android device, and copy Settings, then Diagnostics, from each.
6. Deploy `index.html` and `sw.js` together.

## Known limits

- Guided View can miss or merge panels on borderless art, overlapping speech bubbles, splash pages, and noisy scans.
- Solid RAR archives can be slow to jump around in. Converting to CBZ is faster.
- iOS keeps the Safari tab and the installed Home Screen app in separate storage, and may remove stored data under low space. Keep a JSON backup.
- Wake Lock, install, and the device library need HTTPS (or `localhost`).
- The Tailwind and font files still come from CDNs; they are cached for offline use but not self-hosted yet (planned for v2.0.0).

## Roadmap

See the product document for details. Next is **v2.0.0**: a Vite build with compiled Tailwind, self-hosted dependencies, and automated checks. After that: remote libraries (OPDS / WebDAV) and optional on-device AI features.

## License

MIT. The license text is available in the app (Home or More menu, then About and license).
