/* Night Coast: Red Right Returning.
   The world's channel marks follow one of two rulebooks. In region A a ship coming in from the sea keeps red to port;
   in region B, the Americas, Japan, Korea and the Philippines, red is kept to starboard. Each mark votes for its rulebook. */
(function () {
  'use strict';
  const X = window.LX, N = X.N;
  const RAD = Math.PI / 180;
  const PRESETS = [
    ['world', 'The whole world', null, 'World'],
    ['yellowsea', 'The Yellow Sea, where the rules meet', [117.5, 30.5, 128.2, 41], 'The Yellow Sea'],
    ['japan', 'Japan', [127.5, 30, 146.5, 46], 'Japan'],
    ['europe', 'Europe', [-11, 35, 31, 66], 'Europe'],
    ['northam', 'North America', [-128, 23, -62, 51], 'North America'],
    ['southam', 'South America', [-82, -55, -34, 13], 'South America'],
  ];
  let el, cv, c, dpr = 1, VW = 0, VH = 0, S = 1, T = d3.zoomIdentity, zoom, built = false, visible = false, raf = 0;
  let ids = [], wx, wy, sys, port, mode = 'rule', mix = 0, preset = 'world', land = null, landCv = null, landKey = '', landAt = 0, landT = null, hover = -1;
  const visI = [], visX = [], visY = [];
  let counts = { a: 0, b: 0, odd: 0 }, odd = null;

  function init(root) {
    el = root;
    for (let i = 0; i < N; i++) if (X.system(i)) ids.push(i);
    const n = ids.length;
    wx = new Float32Array(n); wy = new Float32Array(n); sys = new Uint8Array(n); port = new Uint8Array(n);
    ids.forEach((i, k) => {
      wx[k] = (X.lon[i] + 180) / 360; const la = Math.max(-84, Math.min(84, X.lat[i])) * RAD; wy[k] = (1 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / Math.PI) / 2;
      sys[k] = X.system(i);
      const col = X.CODE[X.code[i]].col;              // 1 red, 2 green
      port[k] = col === 1 ? (sys[k] === 1 ? 1 : 2) : col === 2 ? (sys[k] === 1 ? 2 : 1) : 0;   // 1 port-hand, 2 starboard-hand
      if (sys[k] === 1) counts.a++; else counts.b++;
    });
    // odd ones out: marks outnumbered at least four to one by marks of the other rule within about 50 km
    const cell = new Map(), key = k => Math.floor(X.lat[ids[k]] * 2) + ',' + Math.floor(X.lon[ids[k]] * 2);
    for (let k = 0; k < n; k++) { const q = key(k); const o = cell.get(q) || [0, 0]; o[sys[k] - 1]++; cell.set(q, o); }
    odd = new Uint8Array(n);
    for (let k = 0; k < n; k++) { const o = cell.get(key(k)); const mine = o[sys[k] - 1], other = o[2 - sys[k]]; if (other >= 4 && other >= mine * 4) { odd[k] = 1; counts.odd++; } }
    el.innerHTML = `
      <div class="r-top">
        <div class="r-lede">
          <p class="g-big">A channel is marked with red on one side and green on the other, and the side that gets the red depends on where in the world you are.</p>
          <p class="g-p">Coming in from the sea, a ship in <b>region A</b> keeps the red marks on its left, to port. In <b>region B</b>, the Americas, Japan, Korea and the Philippines, red stays on the right. American sailors learn it as red right returning. The shapes stay the same everywhere, cans to port and cones to starboard; only the colors swap. The world settled on the two regions in 1980. Every channel mark on this map votes for the rule it follows.</p>
          <div class="r-tally"><div><b class="r-a">${X.fmt(counts.a)}</b><span>marks keep red to port</span></div><div><b class="r-b">${X.fmt(counts.b)}</b><span>keep red to starboard</span></div></div>
        </div>
        <div class="r-figs">${fig('A', 'Red to port', 'Europe, Africa, most of Asia, Australia')}${fig('B', 'Red to starboard', 'The Americas, Japan, Korea, the Philippines')}</div>
      </div>
      <div class="r-stage">
        <canvas class="n-canvas" aria-label="World map of channel marks, colored by which side they keep red"></canvas>
        <div class="n-read r-read"><div class="n-where">The whole world</div><div class="n-count r-count"></div></div>
        <div class="n-dock">
          <div class="n-presets">${PRESETS.map(([k, label, , short]) => `<button class="chip-btn" data-p="${k}" aria-pressed="${k === 'world'}" title="${X.esc(label)}">${X.esc(short)}</button>`).join('')}</div>
          <div class="n-ctls">
            <div class="r-mode" role="group" aria-label="Color the marks by"><button class="ctl" data-m="rule" aria-pressed="true">Color by the rule</button><button class="ctl" data-m="light" aria-pressed="false">Color by the light</button></div>
            <button class="ctl" data-m="odd" aria-pressed="false">Only the odd ones out</button>
            <span class="n-sep"></span>
            <button class="ctl" data-c="in" aria-label="Zoom in">+</button><button class="ctl" data-c="out" aria-label="Zoom out">&minus;</button>
          </div>
        </div>
      </div>
      <p class="g-p r-foot">Colored by the rule, a mark is red where red is kept to port and green where green is. Colored by the light, each mark shows the color it actually flashes, and the two rulebooks disappear into one mix. ${X.fmt(counts.odd)} marks are outnumbered at least four to one by marks of the other rule within about 50 kilometers. Some are local exceptions and some are slips in the tagging. They are shown here as tagged.</p>`;
    cv = el.querySelector('.r-stage canvas'); c = cv.getContext('2d');
    zoom = d3.zoom().scaleExtent([.5, 800]).on('zoom', e => { T = e.transform; if (e.sourceEvent) moved = true; }).on('end', () => { landAt = 0; });
    d3.select(cv).call(zoom).on('dblclick.zoom', null);
    el.querySelector('.n-presets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p, true); });
    el.querySelector('.n-ctls').addEventListener('click', e => {
      const b = e.target.closest('[data-m],[data-c]'); if (!b) return;
      if (b.dataset.m === 'odd') { onlyOdd = !onlyOdd; b.setAttribute('aria-pressed', String(onlyOdd)); landKey = ''; return; }
      if (b.dataset.m) { mode = b.dataset.m; el.querySelectorAll('[data-m="rule"],[data-m="light"]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
      moved = true;
      d3.select(cv).transition().duration(450).call(zoom.scaleBy, b.dataset.c === 'in' ? 2 : .5, [VW / 2, VH / 2]);
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { hover = -1; X.tip(null); });
    // a tap sends no pointermove, so the click does its own search and shows the same card
    cv.addEventListener('click', e => { onMove(e); });
    new ResizeObserver(() => { if (visible) resize(); }).observe(cv);
    X.watchDpr(() => { if (visible) resize(); });
    X.land('50m').then(l => { land = X.worldRings(l); landKey = ''; });
    built = true;
  }
  let onlyOdd = false, moved = false;
  function fig(sys, title, where) {
    // a channel seen from above, the sea at the bottom. Cans mark the port side and cones the starboard side in both regions; only the colors swap.
    const P = sys === 'A' ? 'r' : 'g', Sb = sys === 'A' ? 'g' : 'r';
    const buoys = [0, 1, 2].map(k => {
      const y = 146 - k * 44;
      return `<rect class="rb rb-${P}" data-ph="${(k * .31 + (sys === 'A' ? .1 : .6)) % 1}" x="40" y="${y - 6}" width="12" height="12" rx="1.5"/>` +
        `<path class="rb rb-${Sb}" data-ph="${(k * .27 + (sys === 'A' ? .5 : .2)) % 1}" d="M114 ${y - 7} l7 13 h-14 z"/>`;
    }).join('');
    return `<figure class="r-fig"><svg viewBox="0 0 160 206" aria-hidden="true">
        <text x="80" y="10" text-anchor="middle" class="r-fig-t">harbor</text>
        <path d="M18 16 V186 M142 16 V186" stroke="rgba(255,255,255,.14)" fill="none"/>
        <path d="M80 164 V40" stroke="rgba(255,255,255,.22)" stroke-dasharray="2 5" fill="none"/>
        <path d="M74 44 l6 -10 l6 10" stroke="rgba(255,255,255,.4)" fill="none"/>
        <path d="M80 164 l-8 16 h16 z" fill="#f2f4f8"/>
        ${buoys}
        <text x="80" y="202" text-anchor="middle" class="r-fig-t">from the sea</text>
      </svg><figcaption><b>Region ${sys}</b><span>${title}</span><small>${where}</small></figcaption></figure>`;
  }
  function blinkFigs(t) {
    el.querySelectorAll('.rb').forEach(b => {
      const ph = +b.dataset.ph, on = ((t / 4 + ph) % 1) < .12;          // Fl 4s: a half second flash every four seconds
      b.classList.toggle('on', on);
    });
  }

  // ---------- map ----------
  const sx = x => T.x + T.k * S * x, sy = y => T.y + T.k * S * y;
  function fitTransform(b) {
    const x0 = (b[0] + 180) / 360, x1 = (b[2] + 180) / 360;
    const my = la => (1 - Math.log(Math.tan(Math.PI / 4 + la * RAD / 2)) / Math.PI) / 2;
    const y0 = my(b[3]), y1 = my(b[1]);
    const dock = el.querySelector('.r-stage .n-dock').getBoundingClientRect().height || 100;
    const availH = VH - dock - 20, left = VW < 760 ? 0 : 250;
    const k = Math.min((VW - left - 30) / ((x1 - x0) * S), availH / ((y1 - y0) * S));
    return d3.zoomIdentity.translate(left + (VW - left) / 2 - k * S * (x0 + x1) / 2, 10 + availH / 2 - k * S * (y0 + y1) / 2).scale(k);
  }
  function go(key, animate) {
    const p = PRESETS.find(q => q[0] === key) || PRESETS[0];
    preset = p[0]; moved = false;
    el.querySelectorAll('.r-stage [data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === preset)));
    el.querySelector('.r-read .n-where').textContent = p[1];
    const tr = fitTransform(p[2] || [-180, -56, 180, 74]);
    if (animate && !X.reduced) d3.select(cv).transition().duration(1200).ease(d3.easeCubicInOut).call(zoom.transform, tr);
    else d3.select(cv).call(zoom.transform, tr);
  }
  const canFilter = 'filter' in CanvasRenderingContext2D.prototype;
  // a small box blur for browsers whose canvas has no filter, run on the quarter-size wash only
  function boxBlur(g, w, h, r) {
    const img = g.getImageData(0, 0, w, h), a = img.data, tmp = new Float32Array(a.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) for (let ch = 0; ch < 4; ch++) {
        let s = 0; const row = y * w * 4;
        for (let x = -r; x <= r; x++) s += a[row + Math.max(0, Math.min(w - 1, x)) * 4 + ch];
        for (let x = 0; x < w; x++) { tmp[row + x * 4 + ch] = s / (2 * r + 1); s += a[row + Math.min(w - 1, x + r + 1) * 4 + ch] - a[row + Math.max(0, x - r) * 4 + ch]; }
      }
      for (let x = 0; x < w; x++) for (let ch = 0; ch < 4; ch++) {
        let s = 0;
        for (let y = -r; y <= r; y++) s += tmp[Math.max(0, Math.min(h - 1, y)) * w * 4 + x * 4 + ch];
        for (let y = 0; y < h; y++) { a[y * w * 4 + x * 4 + ch] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w * 4 + x * 4 + ch] - tmp[Math.max(0, y - r) * w * 4 + x * 4 + ch]; }
      }
    }
    g.putImageData(img, 0, 0);
  }
  function drawLand(now) {
    const key = `${T.k}|${T.x}|${T.y}|${!!land}|${VW}|${VH}|${mode}|${onlyOdd}`;
    if (key !== landKey && (now - landAt > 160 || !landCv)) {
      if (!landCv) landCv = document.createElement('canvas');
      landCv.width = cv.width; landCv.height = cv.height;
      const g = landCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const KS = T.k * S;
      if (land) {
        if (KS <= 2048 * 1.3) {
          if (!bmp) bmp = X.landBitmap(land, 2048);
          g.drawImage(bmp.cv, T.x, T.y + KS * bmp.top, KS, KS * bmp.cv.height / 2048);
        } else {
          g.beginPath(); X.traceRings(g, land, T.x, T.y, KS, VW, VH);
          g.fillStyle = '#0e1015'; g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = .6; g.stroke();
        }
      }
      // a soft wash under the marks, so each coast reads as the colour of its rule
      const q = 4, fw = Math.ceil(VW / q), fh = Math.ceil(VH / q);
      const f = fieldCv || (fieldCv = document.createElement('canvas')); f.width = fw; f.height = fh;
      const fg = f.getContext('2d'); fg.clearRect(0, 0, fw, fh); fg.globalCompositeOperation = 'lighter';
      const sz = Math.max(1.5, Math.min(4, 1 + Math.log2(Math.max(1, T.k)) * .5));
      for (const want of mode === 'light' ? [] : [1, 2]) {
        const [r, gg, b] = want === 1 ? RED : GREEN;
        fg.fillStyle = `rgba(${r},${gg},${b},.22)`; fg.beginPath();
        for (let k = 0; k < ids.length; k++) {
          if ((onlyOdd && !odd[k]) || sys[k] !== want) continue;
          const px = (T.x + KS * wx[k]) / q, py = (T.y + KS * wy[k]) / q;
          if (px < -4 || px > fw + 4 || py < -4 || py > fh + 4) continue;
          fg.rect(px - sz / 2, py - sz / 2, sz, sz);
        }
        fg.fill();
      }
      if (!canFilter && mode !== 'light') boxBlur(fg, fw, fh, 2);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
      if (canFilter) g.filter = `blur(${Math.round(5 * dpr)}px)`;
      g.globalAlpha = .9;
      g.drawImage(f, 0, 0, fw, fh, 0, 0, cv.width, cv.height);
      if (canFilter) g.filter = 'none';
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      landT = T; landAt = now; landKey = key;
    }
    if (landCv && landT) {
      const r = T.k / landT.k;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(landCv, (T.x - landT.x * r) * dpr, (T.y - landT.y * r) * dpr, landCv.width * r, landCv.height * r);
    }
  }
  let fieldCv = null, bmp = null;
  const RED = [255, 77, 63], GREEN = [56, 255, 142], WHITE = [255, 243, 214];
  const buckets = Array.from({ length: 12 }, () => []);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !VW) return;
    const t = now / 1000;
    mix += ((mode === 'light' ? 1 : 0) - mix) * .08;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    drawLand(now);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const KS = T.k * S, zoomed = Math.log2(Math.max(1, T.k));
    const x0 = (-T.x - 10) / KS, x1 = (VW - T.x + 10) / KS, y0 = (-T.y - 10) / KS, y1 = (VH - T.y + 10) / KS;
    const sz = Math.min(4.4, 2 + zoomed * .45);
    // twelve buckets: rule colour (red, green) x light colour (red, green, other) x lit or dark; the mix blends rule into light
    for (const arr of buckets) arr.length = 0;
    visI.length = 0; visX.length = 0; visY.length = 0;
    let a = 0, b = 0, o = 0;
    for (let k = 0; k < ids.length; k++) {
      const X0 = wx[k], Y0 = wy[k];
      if (X0 < x0 || X0 > x1 || Y0 < y0 || Y0 > y1) continue;
      if (onlyOdd && !odd[k]) continue;
      const i = ids[k], px = T.x + KS * X0, py = T.y + KS * Y0;
      visI.push(k); visX.push(px); visY.push(py);
      if (sys[k] === 1) a++; else b++; if (odd[k]) o++;
      const lc = X.CODE[X.code[i]].col;
      buckets[((sys[k] - 1) * 3 + (lc === 1 ? 0 : lc === 2 ? 1 : 2)) * 2 + (X.lit(i, t) >= 0 ? 1 : 0)].push(px, py);
    }
    c.globalCompositeOperation = mix > .5 ? 'source-over' : 'lighter';
    buckets.forEach((arr, q) => {
      if (!arr.length) return;
      const on = q & 1, lightIdx = (q >> 1) % 3, rule = (q >> 1) >= 3 ? GREEN : RED, light = [RED, GREEN, WHITE][lightIdx];
      const r = Math.round(rule[0] + (light[0] - rule[0]) * mix), g = Math.round(rule[1] + (light[1] - rule[1]) * mix), bl = Math.round(rule[2] + (light[2] - rule[2]) * mix);
      const s = on ? sz : sz * .7;
      c.fillStyle = `rgba(${r},${g},${bl},${on ? .95 : .38})`;
      c.beginPath();
      for (let p = 0; p < arr.length; p += 2) c.rect(arr[p] - s / 2, arr[p + 1] - s / 2, s, s);
      c.fill();
      if (on && zoomed > 1.5) {
        c.fillStyle = `rgba(${r},${g},${bl},.09)`; c.beginPath();
        const h = s * 3;
        for (let p = 0; p < arr.length; p += 2) c.rect(arr[p] - h / 2, arr[p + 1] - h / 2, h, h);
        c.fill();
      }
    });
    c.globalCompositeOperation = 'source-over';
    if (onlyOdd) {
      c.lineWidth = 1;
      for (let q = 0; q < visI.length; q++) { const k = visI[q]; c.strokeStyle = sys[k] === 1 ? 'rgba(255,77,63,.8)' : 'rgba(56,255,142,.8)'; c.beginPath(); c.arc(visX[q], visY[q], 7, 0, Math.PI * 2); c.stroke(); }
    }
    if (hover >= 0) { const k = hover; c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.arc(sx(wx[k]), sy(wy[k]), 8, 0, Math.PI * 2); c.stroke(); }
    if (now - lastCount > 400) {
      lastCount = now;
      el.querySelector('.r-count').innerHTML = `<b>${X.fmt(a)}</b> keep red to port, <b>${X.fmt(b)}</b> keep red to starboard` + (o ? `, <b>${X.fmt(o)}</b> odd ones out` : '');
    }
    blinkFigs(t);
  }
  let lastCount = 0;
  const coarse = matchMedia('(pointer: coarse)').matches;
  function onMove(e) {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const rad = coarse ? 20 : 10;
    let best = -1, bd = rad * rad;
    for (let q = 0; q < visI.length; q++) { const dx = visX[q] - mx, dy = visY[q] - my, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = visI[q]; } }
    hover = best;
    if (best < 0) { X.tip(null); return; }
    const i = ids[best], c0 = X.CODE[X.code[i]];
    const side = port[best] === 1 ? 'Port-hand mark' : port[best] === 2 ? 'Starboard-hand mark' : 'Channel mark';
    X.tip(`<b>${X.esc(X.nameOf(i) || X.typeWord(i))}</b><small>${X.esc(X.typeWord(i))}. ${side}, region ${sys[best] === 1 ? 'A' : 'B'}</small><span class="rh-row"><code>${X.esc(c0.text)}</code>${X.rhythmSvg(c0.pat, c0.col, 120, 8)}</span>` + (odd[best] ? '<em>Outnumbered four to one by nearby marks of the other rule</em>' : ''), e.clientX, e.clientY);
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh || (nw === VW && nh === VH && cv.width === Math.round(nw * dpr))) return;
    const first = !VW;
    // if the reader has moved the map, a resize keeps the same place and scale instead of snapping back
    const keep = !first && moved ? { KS: T.k * S, cx: (VW / 2 - T.x) / (T.k * S), cy: (VH / 2 - T.y) / (T.k * S) } : null;
    VW = nw; VH = nh; S = VW;
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    landT = null; landKey = '';
    zoom.extent([[0, 0], [VW, VH]]).translateExtent([[-VW * .5, -VW * .5], [VW * 1.5, VW * 1.5]]);
    zoom.scaleExtent([Math.min(.9, fitTransform([-180, -56, 180, 74]).k * .98), 800]);
    if (keep) { d3.select(cv).call(zoom.transform, d3.zoomIdentity.translate(VW / 2 - keep.KS * keep.cx, VH / 2 - keep.KS * keep.cy).scale(keep.KS / S)); moved = true; }
    else go(preset, false);
  }
  function show() { visible = true; resize(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function hide() { visible = false; cancelAnimationFrame(raf); X.tip(null); }
  X.views.rules = { init, show, hide, state: () => ({ built, marks: ids.length, counts, mode, preset, visible: visI.length }) };
})();
