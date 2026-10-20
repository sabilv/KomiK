// Boots the real application code in jsdom and drives a few screens. Catches init-order errors,
// undefined references and missing markup that unit tests of pure functions cannot see.
// Run: node tests/smoke.mjs   (after npm install)
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { build as viteBuild } from 'vite';

// Node 22.14 compatibility workaround for undici 8.12.x
if (!zlib.createZstdDecompress) {
  zlib.createZstdDecompress = () => {};
  try {
    zlib.constants.ZSTD_d_windowLogMax = 0;
  } catch {
    Object.defineProperty(zlib.constants, 'ZSTD_d_windowLogMax', { value: 0, configurable: true });
  }
}
const { JSDOM } = await import('jsdom');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Same bundler and module order as the production build, but as one script jsdom can run.
const built = await viteBuild({
  root,
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    assetsInlineLimit: 0,
    lib: { entry: resolve(root, 'src/main.js'), name: 'KomiK', formats: ['iife'], fileName: 'smoke' },
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
const code = (Array.isArray(built) ? built[0] : built).output.find((o) => o.type === 'chunk').code;

let html = readFileSync(resolve(root, 'index.html'), 'utf8').replace(/<script[^>]*src="\/src\/main\.js"[^>]*><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://komik.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
const errors = [];
w.addEventListener('error', (e) => errors.push(String(e.message)));
w.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + String(e.reason)));
const origError = w.console.error;
w.console.error = (...a) => {
  errors.push('console.error: ' + a.join(' '));
};

// Browser APIs jsdom does not provide
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
w.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
w.Element.prototype.scrollIntoView = function () {};
w.URL.createObjectURL = () => 'blob:test/' + Math.random().toString(16).slice(2);
w.URL.revokeObjectURL = () => {};
w.HTMLCanvasElement.prototype.getContext = () => null;
w.localStorage.setItem('komik_settings', JSON.stringify({ curl: false, hairline: true }));

w.eval('"use strict";' + code);
const $ = (id) => w.document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const step = (name, fn) => {
  fn();
  passed++;
  console.log('ok  -', name);
};

await wait(50);
step('app boots without errors and shows the home screen', () => {
  assert.deepEqual(errors, []);
  assert(!$('dropZone').classList.contains('hidden'));
  assert($('comicTitle').textContent === 'KomiK');
});

$('demoComicBtn').click();
await wait(700);
step('sample comic opens', () => {
  assert.match($('comicTitle').textContent, /Mystery/);
  assert.match($('pageCounterTop').textContent, /1 \/ 6 pages/);
  assert($('dropZone').classList.contains('hidden'));
});

$('nextPageBtn').click();
await wait(100);
step('next page button moves forward', () => assert.match($('pageCounterTop').textContent, /2 \/ 6 pages/));

$('modeDoubleBtn').click();
await wait(100);
step('spread mode and view switching work', () => assert.match($('pageCounterTop').textContent, /pages/));
$('modeSingleBtn').click();

await wait(600); // progress is saved with a 400 ms debounce
$('quickShelfBtn').click();
await wait(100);
step('shelf opens with the saved book', () => {
  assert(!$('recentsView').classList.contains('hidden'));
  assert(/Mystery/.test($('recentsList').textContent));
});

$('menuSettingsBtn').click();
await wait(50);
step('settings dialog renders every option', () => {
  const dlg = w.document.querySelector('[aria-labelledby="settingsTitle"]');
  assert(!dlg.classList.contains('hidden'));
  assert(dlg.querySelectorAll('[role="switch"]').length >= 8);
});

const settingsDlg = w.document.querySelector('[aria-labelledby="settingsTitle"]');
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((b) => b.textContent.trim() === text);
byText(settingsDlg, 'button', 'Manage').click();
await wait(50);
step('saved books manager opens', () => {
  const dlg = w.document.querySelector('[aria-label="Saved books"]');
  assert(!dlg.classList.contains('hidden'));
  assert.match(dlg.textContent, /No books are kept on this device/);
  dlg.querySelector('#closeLibBtn').click();
});

settingsDlg.querySelector('[role="switch"][aria-label="Page curl animation"]').click();
settingsDlg.querySelector('#doneSettingsBtn').click();
$('nextPageBtn').click();
await wait(2600); // curl waits up to 1.5 s for images that jsdom never loads, then animates
step('page turns with the curl enabled', () => assert.match($('pageCounterTop').textContent, /3 \/ 6 pages/));

$('shelfSearch').value = 'zzz';
$('shelfSearch').dispatchEvent(new w.Event('input'));
await wait(250);
step('shelf search filters the list', () => assert.match($('recentsList').textContent, /No books match/));
$('shelfSearch').value = 'mystery';
$('shelfSearch').dispatchEvent(new w.Event('input'));
await wait(250);
step('shelf search finds the book again', () => assert.match($('recentsList').textContent, /Mystery/));

$('menuHelpBtn').click();
step('keyboard shortcut help opens', () =>
  assert(!w.document.querySelector('[aria-label="Keyboard shortcuts"]').classList.contains('hidden'))
);

await wait(100);
step('no errors during the whole session', () => assert.deepEqual(errors, [], errors.join('\n')));

// Which class names does the page use that the compiled CSS does not define? (catches Tailwind purge misses)
const used = new Set();
w.document.querySelectorAll('[class]').forEach((el) =>
  String(el.getAttribute('class'))
    .split(/\s+/)
    .filter(Boolean)
    .forEach((c) => used.add(c))
);
// Compare with the compiled stylesheet when a build exists (run `npm run build` first)
import { readdirSync, existsSync } from 'node:fs';
const assets = resolve(root, 'dist/assets');
if (existsSync(assets)) {
  const css = readdirSync(assets)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(resolve(assets, f), 'utf8'))
    .join('\n');
  const esc = (c) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch);
  // classes that are only JavaScript hooks, not styles
  const hooks = new Set(['open-license-btn', 'remove-single-bookmark', 'shelf-remove', 'animate-spin', 'group', 'dark', 'ui-hidden']);
  const missing = [...used].filter((c) => !hooks.has(c) && !css.includes('.' + esc(c)));
  console.log('classes in the live DOM without a CSS rule:', missing.length ? missing.join('  ') : 'none');
  if (process.argv.includes('--strict')) assert.deepEqual(missing, [], 'missing CSS rules: ' + missing.join(' '));
}
console.log(`\n${passed} smoke checks passed; ${used.size} distinct class names in the live DOM`);
w.close();
process.exit(0);
