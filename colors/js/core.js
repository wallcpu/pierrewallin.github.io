/* Bluish Green: shared data, colour maths, the maps and their borders. */
(function () {
  'use strict';
  const D = window.COLORS;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FW = D.fw, FH = D.fh, SEAM = D.seam;

  // ---------- names ----------
  const NAMES = D.names.map(([name, users, n, hex, sd, nb, sims], i) => ({ i, name, users, n, hex, nb, sims }));
  const byName = new Map(NAMES.map(o => [o.name, o]));

  // ---------- colour ----------
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 60;
    const C = (1 - Math.abs(2 * l - 1)) * s, x = C * (1 - Math.abs(h % 2 - 1)), m = l - C / 2;
    const [r, g, b] = h < 1 ? [C, x, 0] : h < 2 ? [x, C, 0] : h < 3 ? [0, C, x] : h < 4 ? [0, x, C] : h < 5 ? [x, 0, C] : [C, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), C = mx - mn, l = (mx + mn) / 2;
    let h = 0;
    if (C) h = mx === r ? ((g - b) / C) % 6 : mx === g ? (b - r) / C + 2 : (r - g) / C + 4;
    const s = C === 0 ? 0 : C / (1 - Math.abs(2 * l - 1));
    return [(h * 60 + 360) % 360, s, l];
  }
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  function rgb2lab(r, g, b) {
    const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const R = f(r), G = f(g), B = f(b);
    const x = (R * .4124 + G * .3576 + B * .1805) / .95047, y = R * .2126 + G * .7152 + B * .0722, z = (R * .0193 + G * .1192 + B * .9505) / 1.08883;
    const t = v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
    return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))];
  }
  const lum = (r, g, b) => (.2126 * r + .7152 * g + .0722 * b) / 255;
  const inkOn = hex => { const [r, g, b] = hex2rgb(hex); return lum(r, g, b) > .55 ? '#000' : '#fff'; };
  // where a colour sits on the map: x from 0 to 1 across the turned hue wheel, y from 0 (light) to 1 (dark)
  const mapX = h => (((h - SEAM) % 360) + 360) % 360 / 360;
  const fieldColor = (gx, gy, band) => hsl2rgb(SEAM + gx / FW * 360, D.bands[band][2], 1 - gy / FH);

  // ---------- binary files ----------
  async function bin(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const ds = new DecompressionStream('gzip');
    return new Uint8Array(await new Response(r.body.pipeThrough(ds)).arrayBuffer());
  }
  let mapsP = null, cloudsP = null;
  function maps() {
    return mapsP || (mapsP = bin('colors/data/maps.bin.gz').then(b => {
      const n = FW * FH * 3, buf = b.buffer;
      const w_all = new Uint16Array(buf.slice(0, 2 * n)), s_all = b.slice(2 * n, 3 * n);
      const w_bas = new Uint16Array(buf.slice(3 * n, 5 * n)), s_bas = b.slice(5 * n, 6 * n);
      return { all: { w: w_all, s: s_all }, basic: { w: w_bas, s: s_bas } };
    }));
  }
  const clouds = () => cloudsP || (cloudsP = bin('colors/data/clouds.bin.gz'));

  // ---------- borders and labels, computed once per band and level ----------
  const geoCache = new Map();
  const TW = FW * 3;
  function geometry(M, band, level) {
    const key = band + '|' + level;
    if (geoCache.has(key)) return geoCache.get(key);
    const src = M[level].w, off = band * FH * FW;
    // the winner at every cell, with the few empty cells at the top and bottom filled from the nearest answered cell in their column
    const W = new Int32Array(FH * FW);
    for (let x = 0; x < FW; x++) {
      let last = -1;
      for (let y = 0; y < FH; y++) { const v = src[off + y * FW + x]; if (v !== 65535) { last = v; break; } }
      for (let y = 0; y < FH; y++) { const v = src[off + y * FW + x]; if (v !== 65535) last = v; W[y * FW + x] = last; }
    }
    const classes = [...new Set(W)].filter(v => v >= 0);
    const polys = [], labels = [];
    const vals = new Float64Array(TW * FH), blur = new Float64Array(TW * FH), dist = new Float32Array(TW * FH), seen = new Uint8Array(TW * FH);
    const contour = d3.contours().size([TW, FH]).thresholds([.5]);
    for (const k of classes) {
      for (let y = 0; y < FH; y++) for (let x = 0; x < TW; x++) vals[y * TW + x] = W[y * FW + (x % FW)] === k ? 1 : 0;
      // a light blur, so the borders come out as curves rather than steps
      for (let y = 0; y < FH; y++) for (let x = 0; x < TW; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= FH) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= TW) continue; const wgt = dx || dy ? 1 : 2; s += vals[yy * TW + xx] * wgt; n += wgt; } }
        blur[y * TW + x] = s / n;
      }
      const g = contour(blur)[0];
      polys.push({ k, coords: g.coordinates });
      // distance from every cell of this class to the nearest other cell (or the top and bottom edge)
      const INF = 1e9;
      for (let i = 0; i < TW * FH; i++) dist[i] = vals[i] ? INF : 0;
      for (let y = 0; y < FH; y++) for (let x = 0; x < TW; x++) {
        const i = y * TW + x; if (!dist[i]) continue;
        let d = Math.min(y + 1, FH - y);
        if (x > 0) d = Math.min(d, dist[i - 1] + 1);
        if (y > 0) { d = Math.min(d, dist[i - TW] + 1); if (x > 0) d = Math.min(d, dist[i - TW - 1] + 1.414); if (x < TW - 1) d = Math.min(d, dist[i - TW + 1] + 1.414); }
        dist[i] = d;
      }
      for (let y = FH - 1; y >= 0; y--) for (let x = TW - 1; x >= 0; x--) {
        const i = y * TW + x; if (!dist[i]) continue;
        let d = dist[i];
        if (x < TW - 1) d = Math.min(d, dist[i + 1] + 1);
        if (y < FH - 1) { d = Math.min(d, dist[i + TW] + 1); if (x < TW - 1) d = Math.min(d, dist[i + TW + 1] + 1.414); if (x > 0) d = Math.min(d, dist[i + TW - 1] + 1.414); }
        dist[i] = d;
      }
      // one label per region: at the cell furthest from its border, if that cell is in the middle copy of the wheel
      seen.fill(0);
      for (let s0 = 0; s0 < TW * FH; s0++) {
        if (!vals[s0] || seen[s0]) continue;
        const stack = [s0]; seen[s0] = 1; let best = s0;
        while (stack.length) {
          const i = stack.pop(); if (dist[i] > dist[best]) best = i;
          const x = i % TW, y = (i / TW) | 0;
          if (x > 0 && vals[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
          if (x < TW - 1 && vals[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
          if (y > 0 && vals[i - TW] && !seen[i - TW]) { seen[i - TW] = 1; stack.push(i - TW); }
          if (y < FH - 1 && vals[i + TW] && !seen[i + TW]) { seen[i + TW] = 1; stack.push(i + TW); }
        }
        const bx = best % TW, by = (best / TW) | 0;
        if (bx >= FW && bx < 2 * FW && dist[best] >= 1.4) labels.push({ k, x: bx - FW + .5, y: by + .5, d: dist[best] });
      }
    }
    const out = { W, polys, labels, classes };
    geoCache.set(key, out);
    return out;
  }
  // the colour field for one band, drawn once at three pixels a cell and stretched
  const fieldCache = [];
  function field(band) {
    if (fieldCache[band]) return fieldCache[band];
    const w = FW * 3, h = FH * 3, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [r, gg, b] = fieldColor((x + .5) / 3, (y + .5) / 3, band), i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (fieldCache[band] = cv);
  }

  // ---------- tooltip and URL ----------
  const tipEl = document.getElementById('uTip');
  let tipAt = 0;
  function tip(html, x, y) {
    if (!html) { tipEl.classList.remove('show'); return; }
    tipAt = performance.now();
    tipEl.innerHTML = html;
    const w = tipEl.offsetWidth || 260, h = tipEl.offsetHeight || 60;
    let left = x + 16, top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + h > innerHeight - 8) top = y - h - 16;
    tipEl.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    tipEl.classList.add('show');
  }
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && performance.now() - tipAt > 120) tip(null); }, true);
  addEventListener('scroll', () => { if (performance.now() - tipAt > 300) tip(null); }, { passive: true });
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }
  const swatch = (hex, cls = 'sw') => `<i class="${cls}" style="background:${hex}"></i>`;

  window.CO = { D, reduced, fmt, esc, FW, FH, SEAM, TW, NAMES, byName, hsl2rgb, rgb2hsl, hex2rgb, rgb2hex, rgb2lab, lum, inkOn, mapX, fieldColor, maps, clouds, geometry, field, tip, params, setParams, swatch, views: {} };
})();
