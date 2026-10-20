import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const __dirname = import.meta.dirname;

function dropLegacyFonts() {
  return {
    name: 'drop-legacy-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('.css')) {
        return {
          code: code.replace(/,\s*url\([^)]+\.(?:ttf|woff)\)\s*format\([^)]+\)/g, ''),
          map: null
        };
      }
    }
  };
}

function precachePlugin() {
  return {
    name: 'generate-precache',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      const assetsDir = resolve(outDir, 'assets');
      if (!existsSync(assetsDir)) return;
      const files = readdirSync(assetsDir).map((f) => `assets/${f}`);
      writeFileSync(resolve(outDir, 'precache.json'), JSON.stringify(files, null, 2));

      const swPath = resolve(outDir, 'sw.js');
      if (existsSync(swPath)) {
        let sw = readFileSync(swPath, 'utf8');
        sw = sw.replace('const PRECACHE_ASSETS = [];', `const PRECACHE_ASSETS = ${JSON.stringify(files)};`);
        writeFileSync(swPath, sw);
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [dropLegacyFonts(), precachePlugin()],
  build: { target: 'es2020', outDir: 'dist', emptyOutDir: true },
  server: { port: 5173 }
});
