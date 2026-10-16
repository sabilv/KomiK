// Run: node tests/run.mjs [path/to/index.html]
// Tests the paging rules (single / spread / RTL / wide pages) and the Guided View panel detector.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const html = readFileSync(process.argv[2] || 'index.html', 'utf8');
const app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(x => x.includes('const appState'));
assert(app, 'app script not found');

function extractFn(name) {
  const i = app.indexOf(`function ${name}(`);
  assert(i >= 0, `${name} not found`);
  let depth = 0;
  for (let k = app.indexOf('{', i); k < app.length; k++) {
    if (app[k] === '{') depth++;
    else if (app[k] === '}' && --depth === 0) return app.slice(i, k + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}
const names = ['viewIndices', 'getNextIndex', 'getPrevIndex', 'detectPanelsFromGray', 'groupShelf', 'filterShelf', 'findNextVolume', 'libraryRows'];
const make = (appState, settings) => new Function('appState', 'settings', names.map(extractFn).join('\n') + `\nreturn { ${names.join(', ')} };`)(appState, settings);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  -', name); };
const state = (o) => ({ pages: new Array(o.n || 10).fill(null), currentIndex: 0, viewMode: 'single', isRTL: false, dims: [], ...o });

test('single mode: next/prev and boundaries', () => {
  const st = state({ n: 3 }), api = make(st, { coverAlone: true });
  assert.equal(api.getPrevIndex(), null);
  assert.equal(api.getNextIndex(), 1);
  st.currentIndex = 2;
  assert.equal(api.getNextIndex(), null);
  assert.equal(api.getPrevIndex(), 1);
});

test('spread: cover alone, then pairs', () => {
  const st = state({ n: 7, viewMode: 'double' }), api = make(st, { coverAlone: true });
  assert.deepEqual(api.viewIndices(0), [0]);
  assert.deepEqual(api.viewIndices(1), [1, 2]);
  assert.equal(api.getNextIndex(), 1);
  st.currentIndex = 1; assert.equal(api.getNextIndex(), 3);
  st.currentIndex = 3; assert.equal(api.getPrevIndex(), 1);
  st.currentIndex = 1; assert.equal(api.getPrevIndex(), 0);
  st.currentIndex = 5; assert.deepEqual(api.viewIndices(5), [5, 6]); assert.equal(api.getNextIndex(), null);
});

test('spread: cover not alone pairs from page 1', () => {
  const st = state({ n: 6, viewMode: 'double' }), api = make(st, { coverAlone: false });
  assert.deepEqual(api.viewIndices(0), [0, 1]);
  st.currentIndex = 2; assert.equal(api.getPrevIndex(), 0); assert.equal(api.getNextIndex(), 4);
});

test('spread: wide page is shown alone and never skipped', () => {
  const st = state({ n: 8, viewMode: 'double' }), api = make(st, { coverAlone: true });
  st.dims[4] = { w: 2000, h: 1200 };
  assert.deepEqual(api.viewIndices(3), [3]);
  st.currentIndex = 3; assert.equal(api.getNextIndex(), 4);
  assert.deepEqual(api.viewIndices(4), [4]);
  st.currentIndex = 4; assert.equal(api.getNextIndex(), 5);
  st.currentIndex = 5; assert.equal(api.getPrevIndex(), 4);
});

test('spread: RTL reverses the visual order only', () => {
  const st = state({ n: 6, viewMode: 'double', isRTL: true }), api = make(st, { coverAlone: true });
  assert.deepEqual(api.viewIndices(1), [2, 1]);
  st.currentIndex = 1; assert.equal(api.getNextIndex(), 3);
});

function page(W, H, boxes, bg = 255, ink = 90) {
  const g = new Uint8Array(W * H).fill(bg);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * W + x] = ink;
  return g;
}
const W = 360, H = 520;
const grid = [[20, 20, 170, 250], [190, 20, 340, 250], [20, 270, 170, 500], [190, 270, 340, 500]];
const center = r => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

test('panels: 2x2 grid in LTR reading order', () => {
  const api = make(state({}), {}), p = api.detectPanelsFromGray(page(W, H, grid), W, H, false);
  assert.equal(p.length, 4);
  const c = p.map(center);
  assert(c[0][0] < 0.5 && c[0][1] < 0.5 && c[1][0] > 0.5 && c[1][1] < 0.5 && c[2][0] < 0.5 && c[2][1] > 0.5 && c[3][0] > 0.5 && c[3][1] > 0.5);
});

test('panels: 2x2 grid in RTL starts top-right', () => {
  const api = make(state({}), {}), p = api.detectPanelsFromGray(page(W, H, grid), W, H, true);
  const c = p.map(center);
  assert(c[0][0] > 0.5 && c[0][1] < 0.5 && c[1][0] < 0.5 && c[1][1] < 0.5);
});

test('panels: three stacked strips', () => {
  const api = make(state({}), {}), boxes = [[20, 20, 340, 160], [20, 190, 340, 330], [20, 360, 340, 500]];
  assert.equal(api.detectPanelsFromGray(page(W, H, boxes), W, H, false).length, 3);
});

test('panels: tall left panel, two stacked on the right', () => {
  const api = make(state({}), {}), boxes = [[20, 20, 170, 500], [190, 20, 340, 250], [190, 270, 340, 500]];
  const p = api.detectPanelsFromGray(page(W, H, boxes), W, H, false), c = p.map(center);
  assert.equal(p.length, 3);
  assert(c[0][0] < 0.5 && c[1][0] > 0.5 && c[1][1] < 0.5 && c[2][0] > 0.5 && c[2][1] > 0.5);
});

test('panels: dark background pages work', () => {
  const api = make(state({}), {}), p = api.detectPanelsFromGray(page(W, H, grid, 10, 200), W, H, false);
  assert.equal(p.length, 4);
});

test('panels: full-bleed or blank pages return no panels (whole page shown)', () => {
  const api = make(state({}), {});
  assert.equal(api.detectPanelsFromGray(page(W, H, [[20, 20, 340, 500]]), W, H, false).length, 0);
  assert.equal(api.detectPanelsFromGray(page(W, H, []), W, H, false).length, 0);
});

const hist = (o) => Object.fromEntries(Object.entries(o).map(([k, [fileName, series, number, ts]]) => [k, { fileName, series, number, lastRead: new Date(ts).toISOString() }]));

test('shelf: groups a series in issue order, group sits at its most recent book', () => {
  const api = make(state({}), {});
  const h = hist({ a: ['Saga 10', 'Saga', '10', 3000], b: ['One-shot', '', '', 2000], c: ['Saga 2', 'saga', '2', 1000], d: ['Other 1', 'Other', '1', 500] });
  const g = api.groupShelf(h, true);
  assert.deepEqual(g.map(x => x.keys), [['c', 'a'], ['b'], ['d']]);
  assert.equal(g[0].series, 'Saga');
  assert.equal(g[1].series, null);
});

test('shelf: books without an issue number sort after numbered ones; natural name order', () => {
  const api = make(state({}), {});
  const h = hist({ x: ['Vol 10', 'S', '', 3], y: ['Vol 2', 'S', '', 2], z: ['Vol 1', 'S', '1', 1] });
  assert.deepEqual(api.groupShelf(h, true)[0].keys, ['z', 'y', 'x']);
});

test('shelf: grouping off keeps plain recency order', () => {
  const api = make(state({}), {});
  const h = hist({ a: ['A', 'S', '1', 1], b: ['B', 'S', '2', 2] });
  assert.deepEqual(api.groupShelf(h, false).map(x => x.keys[0]), ['b', 'a']);
});

test('shelf search: all words must match title, series or issue number; device filter', () => {
  const api = make(state({}), {});
  const h = hist({ a: ['Saga 10', 'Saga', '10', 3], b: ['Berserk Deluxe', '', '', 2], c: ['Saga 2', 'Saga', '2', 1] });
  assert.deepEqual(Object.keys(api.filterShelf(h, {}, 'saga', false)).sort(), ['a', 'c']);
  assert.deepEqual(Object.keys(api.filterShelf(h, {}, 'saga #10', false)), ['a']);
  assert.deepEqual(Object.keys(api.filterShelf(h, {}, 'BERSERK deluxe', false)), ['b']);
  assert.deepEqual(Object.keys(api.filterShelf(h, { c: {} }, '', true)), ['c']);
  assert.deepEqual(Object.keys(api.filterShelf(h, {}, 'zzz', false)), []);
});

test('next volume: smallest higher issue of the same series that is saved on device', () => {
  const api = make(state({}), {});
  const h = hist({ a: ['S1', 'Saga', '1', 1], b: ['S2', 'saga', '2', 1], c: ['S3', 'Saga', '3', 1], d: ['O2', 'Other', '2', 1], e: ['S2.5', 'Saga', '2.5', 1] });
  const lib = { b: {}, c: {}, d: {}, e: {} };
  assert.equal(api.findNextVolume(h, lib, { key: 'a', series: 'Saga', number: '1' }), 'b');
  assert.equal(api.findNextVolume(h, lib, { key: 'b', series: 'Saga', number: '2' }), 'e');
  assert.equal(api.findNextVolume(h, lib, { key: 'c', series: 'Saga', number: '3' }), null);
  assert.equal(api.findNextVolume(h, { c: {} }, { key: 'a', series: 'Saga', number: '1' }), 'c');
  assert.equal(api.findNextVolume(h, lib, { key: 'a', series: '', number: '1' }), null);
  assert.equal(api.findNextVolume(h, lib, { key: 'a', series: 'Saga', number: '' }), null);
});

test('saved books: largest first, or never-read and oldest first', () => {
  const api = make(state({}), {});
  const lib = { a: { name: 'A', size: 100 }, b: { name: 'B', size: 300 }, c: { name: 'C', size: 200 } };
  const h = { a: { lastRead: new Date(5000).toISOString(), finished: true }, b: { lastRead: new Date(9000).toISOString() } };
  assert.deepEqual(api.libraryRows(lib, h, 'size').map(r => r.id), ['b', 'c', 'a']);
  assert.deepEqual(api.libraryRows(lib, h, 'oldest').map(r => r.id), ['c', 'a', 'b']);
  assert.equal(api.libraryRows(lib, h, 'size').find(r => r.id === 'a').finished, true);
});

// Release consistency: hosting files and version strings must agree
const dir = dirname(resolve(process.argv[2] || 'index.html'));
const find = (f) => [join(dir, f), join(dir, 'icons', f)].find(existsSync);
const version = html.match(/<title>KomiK (v[\d.]+)/)[1];

test('release: manifest is valid and every icon file exists', () => {
  const man = JSON.parse(readFileSync(join(dir, 'manifest.webmanifest'), 'utf8'));
  assert(man.name && man.start_url && man.display === 'standalone');
  assert(man.icons.some(i => i.purpose === 'maskable') && man.icons.some(i => i.sizes === '512x512'));
  for (const i of man.icons) assert(find(i.src), `missing icon ${i.src}`);
});

test('release: service worker version matches the app and page links the manifest', () => {
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], version);
  assert(html.includes('rel="manifest" href="manifest.webmanifest"'));
  assert(html.includes("register('sw.js'"));
});

test('release: Release History section mentions the current version', () => {
  const doc = join(dir, 'komik_product_documentation_roadmap.md');
  if (!existsSync(doc)) return;
  const md = readFileSync(doc, 'utf8').split('## 4. Release History')[1].split('## 5.')[0];
  assert(md.includes('`' + version + '`'), `Release History is missing ${version}`);
  assert.equal((md.match(/\*\(Current/g) || []).length, 1);
});

console.log(`\n${passed} tests passed`);
