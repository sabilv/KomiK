import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distHtml = resolve(root, 'dist/index.html');

if (!existsSync(distHtml)) {
  console.error('dist/index.html does not exist. Run "npm run build" first.');
  process.exit(1);
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  for (const name of ['google-chrome', 'chromium', 'msedge', 'chrome']) {
    try {
      execFileSync(name, ['--version'], { stdio: 'ignore' });
      return name;
    } catch {}
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.log('No chromium-based browser found; skipping screenshot check.');
  process.exit(0);
}

const url = pathToFileURL(distHtml).href;
const outDir = resolve(root, 'tests/screenshots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const targets = [
  { width: 320, height: 600 },
  { width: 390, height: 844 },
  { width: 560, height: 900 },
  { width: 1024, height: 768 }
];

console.log(`Taking screenshot checks with ${browser}...`);
for (const t of targets) {
  const outFile = resolve(outDir, `screenshot-${t.width}.png`);
  try {
    execFileSync(
      browser,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        `--window-size=${t.width},${t.height}`,
        `--screenshot=${outFile}`,
        url
      ],
      { stdio: 'pipe', timeout: 20000 }
    );
    assert(existsSync(outFile) && statSync(outFile).size > 1000, `Screenshot for ${t.width}px is empty or missing`);
    console.log(`ok  - screenshot at ${t.width}px captured (${statSync(outFile).size} bytes)`);
  } catch (err) {
    console.error(`Failed screenshot at ${t.width}px:`, err.message);
    process.exit(1);
  }
}

console.log(`\nAll ${targets.length} screenshot checks passed!`);
