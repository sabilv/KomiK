# 📱 KomiK Reader — Product Documentation & Roadmap

**Project:** KomiK Reader (Ultra-Sleek CBZ & CBR Comic Reader)
**Target Platform:** Web browsers (Desktop, iOS Safari PWA, Android Chrome)
**Architecture:** 100% client-side, zero-backend, single `index.html`
**Current Production Version:** `v1.9.5` — Polish & Verify
**Document owner:** Product Owner / Technical Architect · **Last updated:** 2026-10-16

---

## 1. Product Vision & Principles

> *Open a comic, read it beautifully, and trust that nothing leaves your device.*

| Principle | What it means in practice |
|---|---|
| **Private by design** | No upload, no account, no tracking. Files are processed in browser memory. |
| **Feels native** | Gestures, motion and layout should match iOS Books / Apple HIG expectations. |
| **Never lose my place** | Progress, bookmarks and settings survive reloads, backgrounding and re-opens. |
| **Honest claims** | The UI must only promise what works (offline, drag & drop, formats). |

**Primary persona:** mobile-first reader who owns `.cbz`/`.cbr` files and wants an app-like experience without installing anything.

---

## 2. System Architecture & Technical Strategy

* **Zero infrastructure:** unzip (`JSZip`), RAR (`node-unrar-js`, WebAssembly, bundled inline) and image decoding all happen locally.
* **PWA-minded:** iOS/Android standalone display meta tags. *(Manifest + service worker are scheduled for v2.0.0, which requires HTTPS hosting.)*
* **Adaptive glass UI shell:** backdrop-filter glass, specular borders, `prefers-color-scheme` auto theme (Auto / Dark / Light).
* **Protected reader canvas:** the viewport stays pure black in every theme to protect artwork contrast.
* **Hosting (current):** static files on Cloudflare Workers (`komik.sabilvaldano.workers.dev`): `index.html`, `sw.js`, `manifest.webmanifest`, PNG icons (180, 192, 512, maskable 512, favicon 32) and a `_headers` file. No server code, no user files leave the device. Browser data (progress, bookmarks, covers) is stored **per origin**, so changing the domain later means exporting and importing a backup.
* **Input layer (new in v1.4.0):** Pointer Events on the viewport drive swipe gestures for touch and mouse; pinch/zoom/pan keep their own touch handlers and take over when zoom > 100%.

---

## 3. Senior Developer Deep-Dive

### 3.1 In-Memory Archive Ingestion Pipeline
```
[ User File (.cbz / .cbr / images) ]
          │
   ┌──────┴───────┐
   ▼              ▼
[ JSZip ]    [ Unrar.js ]
   └──────┬───────┘
          ▼
[ Natural sort: Intl.Collator(numeric) ]
          ▼
[ Blob → URL.createObjectURL ]
          ▼
[ appState.pages / pageNames ]
```
* Natural sorting prevents `page10` appearing before `page2`.
* Pages are extracted lazily (see 3.7). `.cbr` runs through a bundled `node-unrar-js` WebAssembly worker (see 3.8).

### 3.2 Page Curl & Swipe Engine (v1.4.0)

**Model.** The corner `O` of the page is pulled to a point `P`. The fold is the perpendicular bisector of segment `O→P`.

```
n = unit(O − P)            M = (O + P) / 2
folded region  = page ∩ { (X − M)·n > 0 }
flat region    = viewport ∩ { (X − M)·n ≤ 0 }
flap           = folded region reflected across the fold
reflection     = matrix(1−2nx², −2nxny, −2nxny, 1−2ny², 2(M·n)nx, 2(M·n)ny)
```

**Layer stack (bottom → top):**

| # | Layer | Role |
|---|---|---|
| 1 | Under sheet | Target page, fully rendered |
| 2 | Under shadow | Gradient strip along the fold, on the revealed page |
| 3 | Flat sheet | Current page, `clip-path` = flat polygon |
| 4 | Flap | Mirrored copy of current page + pale paper overlay (the "back of the paper"), `clip-path` + reflection matrix, wrapped in `drop-shadow` |
| 5 | Flap shade | Cylinder-style highlight/shadow strip, clipped to the flap polygon |

**Progress parameter `p ∈ [0,1]`.** `P = O + dir · p · 2.25 · W` plus a sine-shaped vertical lift (`0.2 · H · sin(πp)`) so the fold is diagonal like Apple Books. Finger vertical movement adds a small tilt that fades out as `p → 1`.

**Gesture rules**
* Starts after 12 px of mostly horizontal movement; vertical drags are ignored.
* Corner (top/bottom) is chosen by where the touch started.
* Release: commit if `p > 0.35`, or flick velocity `> 0.5 px/ms`; otherwise animate back.
* A second finger (pinch) cancels the curl. Swipe is disabled when zoom > 100% and in Webtoon mode.
* Direction logic: `side = right` means next in LTR and previous in RTL (mirrored for left).
* Auto-curl (tap zones, Next/Prev, keyboard) runs the same engine over ~600 ms. Jumps > 2 pages use an opacity-only fade so zoom/pan is never overridden.
* `prefers-reduced-motion` skips the curl.
* Input is ignored while a curl is running; any re-render (fit/mode/RTL change) aborts it cleanly.

**Design trade-off.** "Previous" peels the *current* page away to reveal the previous one (rather than dragging the previous page in from the edge). Simpler and visually close; revisit if user feedback asks for the true book metaphor.

### 3.3 Viewport Modes
* **Single / Spread:** a Spread is treated as one sheet by the curl. Wide splash pages are detected on load.
* **Webtoon:** `IntersectionObserver` (threshold 0.5) updates `currentIndex` while scrolling.

### 3.4 Memory & iOS Lifecycle
* `URL.revokeObjectURL()` on close / book switch.
* `visibilitychange` + `pagehide` flush progress to `localStorage` before Safari kills the tab.
* Curl stage elements are created per turn and removed afterwards, so no extra long-lived DOM.

### 3.5 EPUB 3 Export
* Fixed-layout EPUB built in memory with JSZip (`container.xml`, `content.opf`, `toc.xhtml`, `toc.ncx`).
* Fixed in v1.4.2: per-page MIME, `pre-paginated`, UUID identifier, cover image, per-page viewport, RTL progression.

### 3.6 Storage Keys
* Progress / bookmarks key: content id `b<size>-<hash>` (size + FNV-style hash of first and last 64 KB; loose images hash name + size). Legacy `fileName__totalPages` keys are migrated on open. Covers live in IndexedDB (`komik` / `covers`).
* Theme preference: `komik_theme_preference`.

### 3.7 Lazy Page Engine (v1.4.2)
* `appState.loaders[i]` is an async function returning the page `Blob` (JSZip entry, RAR bytes or the original `File`). `appState.pages` only holds placeholders so `length` checks keep working.
* `getPageUrl(i)` creates a blob URL on demand, de-duplicates in-flight loads, and evicts the least-recently-used URL beyond the cap.
* `bindPageImg(img, i, thumb)` assigns `src` asynchronously and records natural size in `appState.dims` (used by Spread pairing).
* A generation counter (`loadGen`) discards results that finish after the book was closed or replaced.
* Webtoon and thumbnail grids use `IntersectionObserver` lazy binding with a 70 vh placeholder to limit layout shift.

### 3.8 RAR Worker & Shelf (v1.6.0)
* `parseRAR` spawns a Blob-URL worker from inline text (`#rarWorkerSrc`) and hands it the archive plus the inlined WASM (`#rarWasmB64`). The worker lists entries once and extracts a single file per `get` request, so memory holds one page at a time. Solid RAR archives may be slower on random access.
* Thumbnails use a second worker with `OffscreenCanvas`; browsers without it fall back to the main thread.
* `saveProgress` is debounced (400 ms) and flushed on `visibilitychange` / `pagehide`.
* Curl timing is sampled each animation; if more than 40 % of frames exceed 34 ms the engine drops the `drop-shadow` filter and remembers the choice (`komik_lowpower`).

### 3.9 Visual Identity: Press Green (v1.7.0)
| Token | Dark | Light |
|---|---|---|
| Canvas / reader | `#0E0D0B` | `#0E0D0B` (reader stays black), home `#F3F0E6` |
| Dock / card | `#1A1916` | `#FBF9F3` |
| Raised | `#25231F` | `#EAE5D6` |
| Accent | `#38C27B` (ink text, ~7.8:1) | `#007A3D` (paper text, ~5.4:1) |
| Bookmark (ochre) | `#E8B93A` | `#946A00` |
| Destructive | `#FF6B5E` | `#C2352B` |
* Green is both brand and success color, so status always pairs color with an icon or text. Destructive actions never use the accent.
* Contrast ratios are computed estimates; verify with a contrast checker before store or release sign-off.

### 3.10 Guided View Engine (v1.8.0)
* **Detection (`detectPanelsFromGray`):** background = median of the page border; "ink" = pixels differing from it by more than 28 levels. Recursive XY-cut: a row or column of the region counts as a gutter when it has at most 1.2 % ink; interior gutters at least 1.2 % of the page size split the region. A horizontal gutter always splits first (row-major reading order); vertical splits are reversed for RTL. Each result is tightened to its ink bounding box, padded 1.2 %, and specks under 2 % of the page are dropped. Fewer than two panels returns an empty list (the full page is shown).
* **Camera (`guidedFocus`):** zoom = largest scale that fits the panel in the viewport (clamped 1x-4x); pan centers the panel; the existing transform pipeline animates it (0.5 s).
* **Navigation:** taps, buttons, keys and horizontal swipes call `guidedStep`; at the first or last panel it moves to the adjacent page with a fade (no curl) and enters on the first or last panel.
* **Known limits:** borderless art, overlapping speech bubbles, full-page splashes and scanned pages with heavy noise can yield wrong or no panels; hence the beta label. Results are cached per page and direction.
* **Testing:** the detector and paging functions are pure and covered by `tests/run.mjs`.

### 3.11 Device Library, Install & Service Worker (v1.9.0)
* **Storage layout:** OPFS files `<bookId>.arc` (the original archive, format detected by magic bytes on open); index in `localStorage` key `komik_library` (`name`, `size`, `savedAt`); covers in IndexedDB; progress in `comic_reader_history`. A size check on open detects evicted or partial files.
* **Writes happen in a worker** because `createSyncAccessHandle` is the only OPFS write API available on all engines; reads use `getFile()` on the main thread. Saves are serialized and never block opening the book.
* **Service worker strategy:** page = network first (fresh code on every online load) with the cached copy offline; same-origin files = cache first from the versioned core cache; CDN hosts = stale-while-revalidate in a shared runtime cache. Cross-origin responses may be opaque; they are cached but their content cannot be inspected. Old `komik-core-*` caches are deleted on activation. Redirected responses are never cached for navigation.
* **Update flow:** a new `sw.js` installs and waits; the page shows the banner; Reload sends `SKIP_WAITING`; `controllerchange` reloads once. The first install does not trigger a reload.
* **Bumping a release:** change `VERSION` in `sw.js` together with the app version (the test suite enforces this), then deploy `sw.js` and `index.html` together.

### 3.12 Shelf Helpers & Diagnostics (v1.9.5)
* Pure functions (unit tested): `filterShelf` (token search over file name, series, `#issue`, plus the device filter), `findNextVolume` (same series ignoring case, smallest higher numeric issue, must be in the library), `libraryRows` (sort by size or by last read with never-read first), together with `groupShelf` from v1.9.0.
* `logIssue` keeps the last 20 events (`error`, `unhandledrejection`, `securitypolicyviolation`, library and service worker failures). `copyDiagnostics` reads storage, service worker and cache state at the moment of the request; it never includes book names or file contents.

---

## 4. Release History

> Versions `v1.3.6`, `v1.4.3`, `v1.5.x` and `v1.9.1`-`v1.9.4` were never released (the small release after v1.9.0 was numbered `v1.9.5`). The planned scope of the old v1.4.1, v1.5.0 and v1.6.0 was merged into `v1.6.0`.

### 🏗️ `v2.0.0` — Vite Build & Self-Hosted *(Current)*
* **Vite 5 build:** Tailwind CSS compiled at build time (no Play CDN), PostCSS, Prettier, `vite.config.js` with custom plugins.
* **All dependencies self-hosted:** Font Awesome (solid + regular), Plus Jakarta Sans, and JSZip bundled — zero third-party network requests after first install.
* **Module workers:** thumbnail, library and RAR extraction each run in a proper `Worker` (module URL), replacing the old Blob-URL approach; CSP `worker-src 'self'` now works without `blob:`.
* **Automated SW precaching:** `generate-precache` Vite plugin injects all hashed `dist/assets/` filenames into `dist/sw.js` and writes `dist/precache.json` at build time.
* **Font trimming:** `dropLegacyFonts` Vite plugin strips `.ttf`/`.woff` URL references; only `.woff2` files are emitted (>500 KB saved).
* **Code quality:** monolithic `index.html` script split into 18 ESM modules (`src/`); all `steps` arrays replaced with per-module `init()` functions; `main.js` calls them in explicit order.
* **Content Security Policy enforced:** `_headers` promoted from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`; CDN hosts removed; `script-src` no longer needs `unsafe-inline`.
* **Test suite:** 20 unit tests + 12 jsdom smoke checks + 4 viewport screenshot tests; all run in CI on every push.

### 🔧 `v1.9.5` — Polish & Verify *(shipped)*
* **Next volume offer:** on the last page, after a short pause, a banner offers the next issue of the same series when it is kept on this device (smallest higher issue number; opens with the existing resume logic).
* **Shelf search and filter:** search by title, series or issue number (all words must match; `#10` works); "On device" filter; group headers follow the filtered list.
* **Saved books manager (Settings → Saved books → Manage):** total size, sort by largest or by not read lately (never-read first), remove one, remove finished, remove all. Progress and bookmarks are kept.
* **Diagnostics for field testing:** Settings → Diagnostics → Copy produces a JSON report (browser, secure context, install state, service worker state, offline readiness, storage and library sizes, settings, last 20 errors or issues; no book names). Settings also shows a count of security-policy (CSP) reports. Failed book saves now show a message and are recorded.
* **Quality gate:** `tests/run.mjs` now has 20 tests (added search, next volume, saved-books ordering).
* **Why this helps the CSP and iOS items:** testers can read CSP violations and service worker or storage problems on a phone without developer tools.

### 📦 `v1.9.0` — Library & Install
* **Device library (OPFS):** opened `.cbz` / `.cbr` books are saved in the browser's private file system by a worker (`createSyncAccessHandle`, 4 MB chunks, partial files removed on failure), after a free-space check (needs file size + 50 MB) and a persistent-storage request. Setting "Keep opened books on this device" (default on). Shelf and the home card open saved books directly; missing or size-mismatched files fall back to the file picker. Remove one book (trash icon) or all (Settings); progress and bookmarks are kept.
* **Install as an app:** `manifest.webmanifest` (standalone, theme colors, any + maskable icons, file handlers for `.cbz` / `.cbr` on supported desktops); "Install app" in the More menu via `beforeinstallprompt`, or an Add to Home Screen instruction on iOS; note about separate storage in the installed iOS app.
* **Service worker (`sw.js`):** versioned core cache (`komik-core-<version>`), network-first for the page with cached fallback, cache-first for same-origin files, stale-while-revalidate for the four CDN hosts (Tailwind, Font Awesome, JSZip, Google Fonts), CDN files pre-cached at install and again from the page's own resource list. A "new version is ready" banner with Reload (skip-waiting only on user action). Settings reports **Offline: ready** only when the required files are actually in the cache.
* **Series grouping on the Shelf:** books with a ComicInfo `Series` are grouped in issue order with a "n of m finished" line; groups sit where their most recent book is; single-book series stay as plain cards. Setting "Group books by series". Series and number are stored with progress and in backups.
* **Quality gate:** `tests/run.mjs` now has 17 tests, including shelf grouping and release consistency (manifest and icons, service worker version equals app version, Release History lists the current version).
* **Not changed:** CSP stays in report-only mode (see open items); the "Offline" claim is still not advertised in the main UI until the airplane-mode test below has been done on real devices.

### 🧭 `v1.8.0` — Guided View & Reading Polish
* **Guided View (beta):** per-page panel detection on a downscaled grayscale copy (gutter-based, row-first reading order, RTL aware); animated camera between panels; end of page continues to the next page. Toggle from the More menu or with `G`; Single mode only; panel counter pill; falls back to the full page when no clear panels are found.
* **First-run hint:** a short toast plus a small page-peek curl the first time a book opens.
* **True-previous curl (optional):** going back drags the previous page over the current one (reverse playback of the curl). Setting: "Previous page like a book".
* **Spread:** "Cover page alone" toggle.
* **Viewport:** `100dvh` layout and `82dvh` page height; browser pinch zoom re-enabled (removed `user-scalable=no`); `touch-action: manipulation` on controls.
* **Wake Lock** while reading (setting, default on); `navigator.storage.persist()` requested after the first book opens; storage usage shown in Settings.
* **Keyboard shortcut overlay** (`?`).
* **Hosting:** `_headers` for Cloudflare (nosniff, no-referrer, frame denial, permissions policy, cache rules, CSP in report-only mode).
* **Quality gate:** `tests/run.mjs` (11 tests: paging for single / spread / RTL / wide pages, and the panel detector). Running it found a real bug before release: grids were read column by column; the detector now splits rows first.
* **Not included:** install-as-app (manifest) and service worker, series grouping on the shelf.

### 🩹 `v1.7.1` — iPhone Dock Spacing *(hotfix)*
* Fixed the empty black strip at the bottom on iPhone: the home-indicator safe area was counted twice (dock `bottom` offset and `pb-safe` padding).
* The dock now sits at half the inset plus 6 px, clear of the home indicator and closer to the screen edge.

### 🟢 `v1.7.0` — Press Green & Reading Comfort
* **Visual identity:** Press Green (warm neutrals, green ramp accent, ochre bookmark, red only for destructive); CSS tokens; Classic Blue kept as a theme option. Tailwind `zinc` remapped to a warm scale.
* **App icon:** K speech bubble (green bubble, ink K) with PNG exports (180 / 192 / 512, favicon 32) and an embedded 180 px `apple-touch-icon`.
* Comic pages are square-cornered; halftone limited to splash, home and the back of the curling page.
* **Settings panel:** page curl on/off, keep zoom between pages, remember view per book, progress line, tap zone width, swap tap zones.
* Per-book view memory (mode, fit, direction); `ComicInfo.xml` title, series, number and auto-RTL (CBZ and CBR).
* Progress hairline when controls are hidden; edge nudge at first and last page.
* Accessibility baseline (B-13): aria labels, focus rings, dialog roles with Esc and focus trap, inert drawer, live region for toasts, reduce-motion support.

### 🧭 `v1.6.1` — Responsive Dock *(hotfix)*
* **Bug:** after the `xs` breakpoint fix (B-06), labelled dock controls were wider than the dock and were clipped (Shelf, EPUB cut off) inside a hidden horizontal scroll.
* **Fix:** the dock sizes itself with container queries (labels from 560 px, Prev/Next text from 400 px). Core controls fit in 320 px; Export EPUB, Fit to width and About moved to a More menu; credits removed from the dock; touch targets 40-44 px; ARIA labels added.
* **Lesson:** any change to a global breakpoint needs a pass over every screen width before release.

### 📚 `v1.6.0` — Trust, Performance & Shelf
Consolidates the remaining scope of the planned v1.4.1, v1.5.0 and v1.6.0 into one single-file release, delivered in three gated stages.
* **Stage 1, Trust:** B-04 file names escaped in all `innerHTML` templates; "Offline" claim removed from the UI; B-11 estimator ignores re-renders, toast timers cleared, empty page box guarded.
* **Stage 2, Performance & formats:** magic-byte detection (zip / rar / image); **working CBR** via `node-unrar-js` (WebAssembly) bundled inline and run in a Web Worker with on-demand extraction; thumbnails generated in a worker; debounced progress writes and coalesced slider rendering; automatic lite curl mode on slow devices (B-16).
* **Stage 3, Shelf:** content-based book id (B-12) with migration of old keys; covers in IndexedDB; Continue reading card on home; Finished / Read again; JSON export and import of progress and bookmarks.
* Archives are not stored in the browser (needs v2.0.0); selecting the file again resumes at the saved page.

### 🧱 `v1.4.2` — Stability & Memory
* **B-05 lazy page engine:** archives keep only an index; pages decode on demand into an 8-page LRU (30 in Webtoon) with next-page preload; small generated thumbnails loaded only when visible.
* **B-06:** `xs` (420 px) breakpoint defined so mode and bookmark labels appear.
* **B-07 EPUB:** real MIME per page, `pre-paginated`, UUID identifier, cover image, per-page viewport size, RTL page progression.
* **B-08 Webtoon:** current page preserved on mode switch; tall strips count when they fill half the screen; lazy images with placeholders.
* **B-09 Spread:** wide pages shown alone; pairing and prev/next use measured page dimensions.
* **B-10:** file name committed only after a successful parse. Blob types now set correctly (also fixes SVG pages).

### 🔎 `v1.4.1` — Smarter Zoom & Drag-Drop
* **Zone rules:** side 25 % always turns pages; center double-tap zooms 2x at the tapped point and toggles back to Fit; single center tap toggles UI after a 260 ms wait.
* **Zoom range** 1x-4x; pan clamped so the page cannot leave the screen; zoomed edge-push (touch) turns the page, side taps paused while zoomed.
* **Desktop:** Ctrl + scroll / trackpad pinch zooms, plain scroll pans only when zoomed.
* **Drag & drop** of files anywhere on the window with a drop overlay (B-01).

### 🌀 `v1.4.0` — Page Curl & Swipe
* **Swipe to turn pages** (touch and mouse drag) with a live, finger-following curl.
* **Apple Books-style page curl:** diagonal fold, paper back with ghosted artwork, cast shadows.
* **Unified navigation animation:** taps, buttons and keys play the curl; far jumps fade.
* RTL manga and Spread aware; respects reduced motion. Replaced the old 3D hinge animation, which also removed its conflict with zoom/pan transforms.

> **Doc correction:** an earlier `v1.3.6` entry described a dual-layer `clip-path` polygon curl that was never shipped in `index.html`. It was superseded by the fold-reflection engine above.

### ⚡ `v1.3.5` — 3D Page Turn & Live Scrubber
* 3D hinge page turn, live scrubber thumbnail preview, reading pace + time-left estimator.

### 🎨 `v1.3.0` — Auto Theme & Splash
* Cold-launch splash, Auto/Dark/Light theme, frosted glass for light mode.

### 🔖 `v1.2.0` — Apple Tones, Bookmarks & Shelf
* Apple System Blue/Amber, bookmarks tab, shelf shortcut, removal of colour filters.

### 🛠️ `v1.1.0` — Unified Control Dock
* Bottom dock, iOS safe areas, license/changelog modal.

### 🐞 `v1.0.1`–`v1.0.2` — Gestures & iOS Compatibility
* `accept="*/*"` fix for iOS file picker, double-tap zoom, pinch, drag-pan, lifecycle flushing.

### 🎉 `v1.0.0` — Core Launch
* CBZ/CBR, Single/Spread/Webtoon, RTL, EPUB export.

---

## 5. Known Issues & Technical Debt Backlog

Severity: **P0** = breaks a promise in the UI, **P1** = visible quality gap, **P2** = polish/hygiene.

| ID | Sev | Item |
|---|---|---|
| B-01 | ✔ | Drag & drop added in v1.4.1. |
| B-02 | ✔ v1.6.0 | **CBR extraction likely broken** (`readRAR` is not the `unrar-js` API); need magic-byte detection (`PK` vs `Rar!`) instead of trusting extensions. |
| B-03 | ◐ v1.9.0 | Service worker, manifest and CDN caching shipped in v1.9.0 (offline readiness is shown in Settings); the "Offline" claim stays out of the main UI until device tests pass; self-hosting the CDN files remains for v2.0.0; Tailwind, FontAwesome, JSZip, fonts load from CDN. `apple-touch-icon` is SVG (iOS needs PNG). |
| B-04 | ✔ v1.6.0 | Archive/file names inserted via `innerHTML` (XSS from crafted CBZ). Escaping done in v1.6.0; SRI for CDN scripts is covered by self-hosting in v2.0.0. |
| B-05 | ✔ v1.4.2 | Whole archive extracted into RAM at open; large CBZ can crash mobile tabs. Thumbnails and slider preview use full-resolution images. Fixed for CBZ and loose images; RAR (`.cbr`) archives are still held fully in memory (see B-02). |
| B-06 | ✔ v1.4.2 | Button labels never show (`xs:` breakpoint not defined in Tailwind config). |
| B-07 | ✔ v1.4.2 | EPUB export invalid in places: all pages labelled JPG, `rendition:layout` should be `pre-paginated`, non-UUID identifier, no RTL progression, no cover. |
| B-08 | ✔ v1.4.2 | Webtoon resets to page 1 when switching mode; tall strips never reach the 0.5 threshold. |
| B-09 | ✔ v1.4.2 | Spread mode can skip a page after a landscape image is dropped from the pair. |
| B-10 | ✔ v1.4.2 | `fileName` is overwritten before parsing finishes, so a failed open can write progress under the wrong key. |
| B-11 | ✔ v1.6.0 | Reading-time estimator is polluted by fit/mode/RTL re-renders; toast timers overlap; empty page input gives `NaN`. |
| B-12 | ✔ v1.6.0 | Book identity should be a content hash, not `name + page count`. |
| B-13 | ✔ v1.7.0 | Accessibility: no `aria-label`s, no focus management in drawer/modal, tap zones are `div`s. |
| B-14 | ✔ v1.6.0 | Changelog once mentioned "Panel Snap", which does not exist (fixed in the docs; keep claims honest). |
| B-17 | P1 | Verify OPFS save/open and quota behaviour on iPhone Safari and the installed iOS app; verify service worker update flow with two deployed versions. v1.9.5 adds in-app diagnostics to make this testable on a phone. |
| B-15 | → v2.0.0 | Single 1500+ line file; Tailwind Play CDN is not production-grade. Move to Vite + compiled Tailwind + Web Worker for extraction. |
| B-16 | ✔ v1.6.0 | v1.4.0 curl uses `clip-path` + `drop-shadow` every frame; verify 60 FPS on mid-range Android and add a low-power fallback. |

---

## 6. Prioritisation Framework

Each candidate scored 1–5 on **Reach**, **Impact** and **Confidence**, divided by **Effort** (RICE-style, simplified).

| Candidate | Reach | Impact | Conf. | Effort | Score | Decision |
|---|---|---|---|---|---|---|
| Fix broken promises (B-01…B-04, B-06, B-10) | 5 | 4 | 5 | 2 | **50** | ✔ shipped v1.4.1-v1.6.0 |
| Lazy extraction + small thumbnails + preload (B-05) | 5 | 5 | 4 | 4 | **25** | ✔ shipped v1.4.2 |
| CBR fix + format detection (B-02) | 3 | 5 | 3 | 3 | **15** | ✔ shipped v1.6.0 |
| Persistent library + continue reading | 5 | 5 | 4 | 5 | **20** | ✔ shelf in v1.6.0; full archive storage → v2.0.0 |
| Real PWA (self-hosted deps, manifest, SW) | 4 | 4 | 4 | 3 | **21** | v2.0.0 |
| Settings panel (tap zones, motion, per-book memory) | 4 | 3 | 4 | 3 | **16** | ✔ shipped v1.7.0 |
| Guided View / panel snap | 3 | 4 | 2 | 5 | **5** | v1.8.0 (experimental gate) |
| OPDS / WebDAV | 2 | 4 | 3 | 5 | **5** | Later |
| AI upscale / OCR / TTS | 2 | 3 | 2 | 5 | **2** | Later |

---

## 7. Roadmap (re-sequenced)

```
v1.7.x ✔ ──> v1.8.0 ✔ ──────> v1.9.0 ─────────> v2.0.0 ───────> v2.1.0 ───────> v2.2.0+
Press Green   Guided View       Library &         Modernise       Remote Library   AI Reader
& Comfort     & Polish          Install (PWA)     (Vite, tests)
```

> **Decision (2026-10-08):** the site is hosted over HTTPS on Cloudflare, so HTTPS-only items no longer wait for v2.0.0. Wake Lock and storage persistence shipped in v1.8.0; install-as-app, service worker and OPFS archive storage move to v1.9.0; the build-tool modernisation stays in v2.0.0.
>
> **Earlier decision (2026-10-06):** the former v1.4.1, v1.5.0 and v1.6.0 were merged into one single-file **v1.6.0**. Everything that needs HTTPS hosting and a multi-file build (service worker, manifest, OPFS, self-hosted dependencies) moved to **v2.0.0**. The AI Reader moved from v2.0.0 to v2.2.0+.

### ✅ `v1.6.0` — Trust, Performance & Shelf *(shipped, see release history)*
**Gates to confirm on real devices:** CBZ of 300 MB opens on a mid-range phone without crashing; RAR opens and pages on demand; curl stays smooth or drops to lite mode; renaming a file keeps progress; backup export and import round-trips.

### ✅ `v1.7.0` — Press Green & Reading Comfort *(shipped, see release history)*
**Gates to confirm on real devices:** both themes at 320 / 390 / 560 / 1024+ px; contrast checked with a tool (not only estimated); icon on iPhone and Android home screens; swipe with each tap-zone setting; ComicInfo.xml with a manga RTL file; screen reader pass (VoiceOver) on dock, drawer and Settings.

### ✅ `v1.8.0` — Guided View & Reading Polish *(shipped, see release history)*
**Gates to confirm on real devices:** run `node tests/run.mjs index.html`; Guided View on at least 10 real pages (clean grid, borderless art, splash, manga RTL) and record the share of pages where the panels are right; wake lock on iPhone and Android; no regression in zoom, swipe and curl; both themes; confirm `_headers` is applied and check the browser console for Content-Security-Policy report-only messages before enforcing it.

### ✅ `v1.9.5` — Polish & Verify *(shipped, see release history)*
Small release between v1.9.0 and v2.0.0: next-volume offer, Shelf search and filter, saved-books manager, and diagnostics. The v1.9.0 device gates below still need real-device confirmation; use Settings → Diagnostics → Copy on each device and attach the output to any finding.

### ✅ `v1.9.0` — Library & Install *(shipped, see release history)*
**Gates to confirm on real devices:**
1. Save a book, close the tab, reopen: it opens from the Shelf with no file picking (Chrome desktop, Android Chrome, **iPhone Safari**, installed app).
2. Airplane mode after two online visits: the app opens, Settings says "Offline: ready", and a saved book is readable.
3. Deploy a second version: the Reload banner appears and reloading applies it; users never get stuck on the old build.
4. Install on iPhone (Add to Home Screen), Android Chrome and desktop Chrome/Edge; icon and maskable icon look right.
5. Low-storage behaviour: the "not enough space" message appears and nothing is half-written.
6. Series grouping with a real set of volumes that have `ComicInfo.xml`.

**Open items carried forward:**
* Enforce the Content-Security-Policy: use Settings → Diagnostics (policy report count) on the live site; when it stays at 0 across the main flows (open book, install, offline, library save, update banner), rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `_headers`.
* ~~In-app free-up-space list~~ shipped in v1.9.5.
* The persistent-storage prompt behaves differently across browsers; verify what Safari and Firefox grant.

### 🌐 `v2.0.0` — Modernise (major)
**Status (day 2):** Vite project with compiled Tailwind and bundled dependencies; code split into 18 modules with the start-up order preserved; 20 unit tests (importing the real modules) and a 12-check jsdom smoke test on the production bundler passing; CI workflow written. See `docs/v2-progress.md` for the area-by-area status.

**Goal:** a maintainable codebase with a clean offline story.
* Vite + modules + compiled Tailwind (B-15); self-hosted JSZip, FontAwesome and fonts, with SRI where applicable (B-03, B-04 SRI).
* Automated checks in CI: unit tests (already started in v1.8.0), screenshot checks at 320 / 390 / 560 / 1024+ px.
* Keep an optional single-file build for people who cannot host.
* **Metrics:** cold launch offline < 2 s; build and test run in under 2 minutes.

### ☁️ `v2.1.0` — Remote Library (OPDS & WebDAV)
* OPDS feeds (Komga, Kavita, Suwayomi), WebDAV browsing, chapter pre-fetch and cache.
* Needs HTTPS and CORS guidance; credentials stay on the device.

### 🧠 `v2.2.0+` — Next-Gen AI Reader
* WebAssembly upscaling, speech-bubble OCR + translation overlay, text-to-speech.
* Optional and on-device only; no cloud inference by default.


## 8. Out of Scope (for now)
* Accounts, server-side sync, social features.
* DRM'd formats and store integrations.
* Any feature that uploads user files.
* Storing full archives in the browser before v2.0.0 (quota and eviction risks on iOS).

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Curl animation janks on low-end phones | Lite curl mode (shipped v1.6.0), reduced-motion respected, fast fallback to fade. |
| Large archives crash mobile Safari | Lazy extraction + LRU before building the library. |
| CDN dependency undermines "private & offline" | Self-host assets in v2.0.0 (RAR worker is already inlined). |
| Single-file code becomes hard to change | Introduce Vite + modules in v2.0.0; add unit tests for paging logic (spread/RTL/wide pages) before Guided View lands in v1.8.0. |
| Browser data lives per origin; a domain change or the iOS Safari-vs-Home-Screen split hides progress | Backup export/import exists; show a note and restore prompt in v1.9.0; decide the final domain before the library ships. |
| A stale service worker keeps an old build | Shipped in v1.9.0: versioned caches, network-first page, update banner, `sw.js` served with `no-cache`. Verify with two deployed versions. |
| Saved books vanish (browser eviction, low space) | Persistent-storage request, size check on open with graceful fallback to the file picker, backup export for progress. |
| Feature claims drift from reality | Release checklist: every changelog bullet must be verifiable in a test run. |

## 10. Release Checklist (applies to every version)
1. Test on iOS Safari (PWA mode), Android Chrome, desktop Chrome and Firefox.
2. Test LTR, RTL, Spread and Webtoon with at least one CBZ, one CBR and loose images.
3. Check zoom ↔ page turn interaction, pinch cancelling a swipe, and backgrounding the app mid-read.
4. Confirm every changelog line maps to a visible behaviour.
5. Check both themes (Press Green and Classic Blue) in light and dark mode.
6. Check on a notched iPhone in Safari and in Home Screen mode (bottom and top safe areas).
7. Check the dock and header at 320, 390, 560 and 1024+ px wide (nothing clipped, no hidden horizontal scroll).
8. Run `node tests/run.mjs index.html` and make sure all tests pass.
9. Bump version strings (title, splash, home, modal, footer), `VERSION` in `sw.js`, and this document together.
10. Test install and an airplane-mode launch on one iPhone and one Android device, and copy Settings → Diagnostics on each (read the issues list and CSP count). Update **Release History** (section 4) in the same change and confirm the new version heading exists. Never mark an older entry as "Current" without moving the label.
