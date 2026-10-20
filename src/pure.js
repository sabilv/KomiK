/** Pure helpers with no DOM or state: mime types, ids, panel detection, shelf grouping and search. */

export function mimeOf(name) {
  const ext = (name || '').substring((name || '').lastIndexOf('.')).toLowerCase();
  return (
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    }[ext] || ''
  );
}

export function newUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function clipPoly(poly, M, n, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = sign * ((a[0] - M.x) * n.x + (a[1] - M.y) * n.y);
    const db = sign * ((b[0] - M.x) * n.x + (b[1] - M.y) * n.y);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function filterShelf(history, lib, query, onlyDevice) {
  const tokens = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const out = {};
  for (const [k, v] of Object.entries(history)) {
    if (onlyDevice && !lib[k]) continue;
    const hay = `${v.fileName || ''} ${v.series || ''} ${v.number ? '#' + v.number : ''}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) out[k] = v;
  }
  return out;
}

export function findNextVolume(history, lib, cur) {
  const series = String(cur.series || '')
    .trim()
    .toLowerCase();
  const n = parseFloat(cur.number);
  if (!series || Number.isNaN(n)) return null;
  let best = null,
    bestN = Infinity;
  for (const [k, v] of Object.entries(history)) {
    if (
      k === cur.key ||
      !lib[k] ||
      String(v.series || '')
        .trim()
        .toLowerCase() !== series
    )
      continue;
    const vn = parseFloat(v.number);
    if (Number.isNaN(vn) || vn <= n || vn >= bestN) continue;
    best = k;
    bestN = vn;
  }
  return best;
}

export function libraryRows(lib, history, sort) {
  const rows = Object.entries(lib).map(([id, m]) => {
    const h = history[id] || {};
    return { id, name: m.name, size: m.size || 0, lastRead: h.lastRead ? new Date(h.lastRead).getTime() : 0, finished: !!h.finished };
  });
  rows.sort(sort === 'oldest' ? (a, b) => a.lastRead - b.lastRead || b.size - a.size : (a, b) => b.size - a.size);
  return rows;
}

export function groupShelf(history, group) {
  const order = Object.keys(history).sort((a, b) => new Date(history[b].lastRead) - new Date(history[a].lastRead));
  if (!group) return order.map((k) => ({ series: null, keys: [k] }));
  const out = [],
    idx = new Map();
  for (const k of order) {
    const name = String(history[k].series || '').trim();
    if (!name) {
      out.push({ series: null, keys: [k] });
      continue;
    }
    const id = name.toLowerCase();
    if (!idx.has(id)) {
      const g = { series: name, keys: [] };
      idx.set(id, g);
      out.push(g);
    }
    idx.get(id).keys.push(k);
  }
  const num = (k) => {
    const n = parseFloat(history[k].number);
    return Number.isNaN(n) ? Infinity : n;
  };
  out.forEach((g) => {
    if (g.series)
      g.keys.sort(
        (a, b) => num(a) - num(b) || String(history[a].fileName).localeCompare(String(history[b].fileName), undefined, { numeric: true })
      );
  });
  return out;
}

export function detectPanelsFromGray(g, W, H, rtl) {
  const border = [];
  for (let x = 0; x < W; x++) border.push(g[x], g[(H - 1) * W + x]);
  for (let y = 0; y < H; y++) border.push(g[y * W], g[y * W + W - 1]);
  border.sort((a, b) => a - b);
  const bg = border[border.length >> 1],
    T = 28;
  const ink = (x, y) => Math.abs(g[y * W + x] - bg) > T;
  const findGap = (prof, other, minThick) => {
    const thr = Math.max(1, other * 0.012);
    let best = null,
      st = -1;
    for (let i = 0; i <= prof.length; i++) {
      const empty = i < prof.length && prof[i] <= thr;
      if (empty && st < 0) st = i;
      if (!empty && st >= 0) {
        const len = i - st;
        if (st > 0 && i < prof.length && len >= minThick && (!best || len > best.len)) best = { start: st, len };
        st = -1;
      }
    }
    return best;
  };
  const out = [];
  const split = (x0, y0, x1, y1, depth) => {
    const w = x1 - x0,
      h = y1 - y0;
    if (depth < 6 && w >= W * 0.14 && h >= H * 0.1) {
      const rows = new Uint16Array(h),
        cols = new Uint16Array(w);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          if (ink(x, y)) {
            rows[y - y0]++;
            cols[x - x0]++;
          }
      const hg = findGap(rows, w, Math.max(2, H * 0.012)),
        vg = findGap(cols, h, Math.max(2, W * 0.012));
      // Rows first: a full-width horizontal gutter always splits before columns, so grids read row by row.
      if (hg) {
        split(x0, y0, x1, y0 + hg.start, depth + 1);
        split(x0, y0 + hg.start + hg.len, x1, y1, depth + 1);
        return;
      }
      if (vg) {
        const a = [x0, y0, x0 + vg.start, y1],
          b = [x0 + vg.start + vg.len, y0, x1, y1];
        const first = rtl ? b : a,
          second = rtl ? a : b;
        split(first[0], first[1], first[2], first[3], depth + 1);
        split(second[0], second[1], second[2], second[3], depth + 1);
        return;
      }
    }
    out.push([x0, y0, x1, y1]);
  };
  split(0, 0, W, H, 0);
  const res = [];
  for (const [x0, y0, x1, y1] of out) {
    let minX = x1,
      maxX = x0,
      minY = y1,
      maxY = y0,
      count = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (ink(x, y)) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    if (count < 1 || (maxX - minX + 1) * (maxY - minY + 1) < W * H * 0.02) continue;
    const px = W * 0.012,
      py = H * 0.012;
    res.push([
      Math.max(0, (minX - px) / W),
      Math.max(0, (minY - py) / H),
      Math.min(1, (maxX + 1 + px) / W),
      Math.min(1, (maxY + 1 + py) / H)
    ]);
  }
  return res.length >= 2 ? res : [];
}

export function parseComicInfo(xml) {
  try {
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    if (d.querySelector('parsererror')) return null;
    const g = (t) => {
      const n = d.getElementsByTagName(t)[0];
      return n ? n.textContent.trim().slice(0, 120) : '';
    };
    return { title: g('Title'), series: g('Series'), number: g('Number'), rtl: /righttoleft/i.test(g('Manga')) };
  } catch (e) {
    return null;
  }
}
