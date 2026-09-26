/* Bluish Green: The Map.
   Colour space laid flat: hue around (it wraps, so the map can be turned like a globe), light at the top and dark at the bottom.
   Each region is the name most people gave the colours inside it. */
(function () {
  'use strict';
  const X = window.CO, D = X.D, FW = X.FW, FH = X.FH;
  const BANDS = [['Vivid', 'Colors at full strength'], ['Soft', 'Colors halfway to gray'], ['Grayish', 'Colors with only a hint of hue']];
  let el, cv, c, dpr = 1, VW = 0, VH = 0, built = false, visible = false;
  let M = null, band = 0, level = 'all', agree = false, pan = FW - FW * 50 / 360, hover = null, pin = null, drag = null, raf = 0, spinFrom = null;
  let paths = null, pathsKey = '', veil = null, veilKey = '';

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="m-bar">
        <div class="m-group" role="group" aria-label="How colorful">${BANDS.map(([b, t], i) => `<button class="chip-btn" data-b="${i}" aria-pressed="${i === 0}" title="${t}">${b}</button>`).join('')}</div>
        <div class="m-group" role="group" aria-label="Which names">
          <button class="chip-btn" data-l="all" aria-pressed="true">Every name</button>
          <button class="chip-btn" data-l="basic" aria-pressed="false">Basic words</button>
        </div>
        <button class="ctl" data-agree aria-pressed="false">Where people agree</button>
      </div>
      <div class="m-wrap">
        <div class="m-stage">
          <canvas class="m-canvas" aria-label="A map of color space, divided into the names people gave each color"></canvas>
        </div>
        <aside class="m-read" aria-live="polite"></aside>
        <p class="m-cap">Light colors at the top, dark at the bottom, and the hue wheel runs across. Drag sideways to turn it.</p>
      </div>`;
    cv = el.querySelector('.m-canvas'); c = cv.getContext('2d');
    el.querySelector('.m-bar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.b) { band = +b.dataset.b; el.querySelectorAll('[data-b]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
      if (b.dataset.l) { level = b.dataset.l; el.querySelectorAll('[data-l]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
      if (b.hasAttribute('data-agree')) { agree = !agree; b.setAttribute('aria-pressed', String(agree)); }
      X.setParams({ band: band ? band : null, level: level === 'all' ? null : level });
      pin = null; request(); readout();
    });
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, pan, moved: false, id: e.pointerId }; spinFrom = null; });
    cv.addEventListener('pointermove', e => {
      if (drag && drag.id === e.pointerId && (e.buttons || e.pointerType === 'touch')) {
        const dx = e.clientX - drag.x;
        if (Math.abs(dx) > 4) { drag.moved = true; cv.setPointerCapture(e.pointerId); }
        if (drag.moved) { pan = drag.pan + dx / (VW / FW); request(); }
      }
      if (!drag || !drag.moved) { hover = at(e); readout(); request(); }
    });
    addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); });
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; hover = null; readout(); request(); });
    cv.addEventListener('click', e => {
      if (drag && drag.moved) return;
      const h = at(e); hover = h;
      pin = pin && h && pin.ci === h.ci ? null : h;
      readout(); request();
    });
    new ResizeObserver(() => { if (visible) resize(); }).observe(el.querySelector('.m-stage'));
    const p = X.params();
    if (p.get('band')) { band = Math.max(0, Math.min(2, +p.get('band') || 0)); el.querySelectorAll('[data-b]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.b === band))); }
    if (p.get('level') === 'basic') { level = 'basic'; el.querySelectorAll('[data-l]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.l === 'basic'))); }
    X.maps().then(m => { M = m; spinFrom = { t: performance.now(), from: pan - FW * .22, to: pan }; if (visible) { resize(); readout(); } });
    built = true;
  }

  // ---------- where the pointer is ----------
  function at(e) {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (mx < 0 || my < 0 || mx > VW || my > VH) return null;
    const cw = VW / FW, gx = (((mx / cw - pan) % FW) + FW) % FW, gy = Math.max(0, Math.min(FH - .001, my / (VH / FH)));
    const ci = Math.min(D.ch - 1, Math.floor(gy / FH * D.ch)) * D.cw + Math.min(D.cw - 1, Math.floor(gx / FW * D.cw));
    return { gx, gy, ci, mx, my };
  }
  const nameOf = k => level === 'all' ? D.voc[k] : D.basic[k];

  // ---------- drawing ----------
  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!visible || !M || !VW) return;
    if (spinFrom) {
      const t = Math.min(1, (now - spinFrom.t) / 1400), e = 1 - Math.pow(1 - t, 3);
      pan = spinFrom.from + (spinFrom.to - spinFrom.from) * e;
      if (t < 1 && !X.reduced) request(); else { pan = spinFrom.to; spinFrom = null; }
    }
    draw();
  }
  function buildPaths(G) {
    const key = `${band}|${level}|${VW}|${VH}`;
    if (key === pathsKey) return paths;
    const cw = VW / FW, ch = VH / FH;
    const all = new Path2D(), per = new Map();
    for (const p of G.polys) {
      const one = new Path2D();
      for (const poly of p.coords) for (const ring of poly) {
        ring.forEach(([x, y], i) => { const sx = x * cw, sy = y * ch; if (i) { one.lineTo(sx, sy); } else one.moveTo(sx, sy); });
        one.closePath();
      }
      all.addPath(one); per.set(p.k, one);
    }
    pathsKey = key;
    return (paths = { all, per });
  }
  function buildVeil() {
    const key = `${band}|${level}`;
    if (key === veilKey) return veil;
    const s = M[level].s, off = band * FH * FW;
    const vals = []; for (let i = 0; i < FH * FW; i++) if (s[off + i]) vals.push(s[off + i]);
    vals.sort((a, b) => a - b);
    const lo = vals[Math.floor(vals.length * .05)] || 1, hi = vals[Math.floor(vals.length * .95)] || 250;
    const k = document.createElement('canvas'); k.width = FW; k.height = FH;
    const g = k.getContext('2d'), img = g.createImageData(FW, FH);
    for (let i = 0; i < FW * FH; i++) {
      const v = s[off + i], t = v ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0;
      img.data[i * 4 + 3] = Math.round(235 * (1 - t));
    }
    g.putImageData(img, 0, 0);
    veilKey = key;
    return (veil = k);
  }
  function draw() {
    const G = X.geometry(M, band, level), P = buildPaths(G);
    const cw = VW / FW, ch = VH / FH, off = (((pan % FW) + FW) % FW) * cw;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const f = X.field(band);
    for (let k = -1; k <= 1; k++) c.drawImage(f, off + k * VW, 0, VW, VH);
    if (agree) { const v = buildVeil(); for (let k = -1; k <= 1; k++) c.drawImage(v, off + k * VW, 0, VW, VH); }
    // borders, and the region under the pointer
    c.save(); c.translate(off - VW, 0);
    c.lineJoin = 'round';
    c.strokeStyle = agree ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.42)'; c.lineWidth = 1.1; c.stroke(P.all);
    const h = pin || hover;
    if (h) {
      const k = G.W[Math.floor(h.gy) * FW + Math.floor(h.gx)], one = P.per.get(k);
      if (one) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fill(one, 'evenodd'); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(one); }
    }
    c.restore();
    // names: biggest regions first, each sized to fit its region, skipped if it would overlap a name already placed
    const cell = Math.min(cw, ch), narrow = VW < 640, placed = [];
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const order = G.labels.slice().sort((p, q) => q.d - p.d);
    for (const L of order) {
      const name = nameOf(L.k); if (!name) continue;
      // how far the region runs left and right of the label's row, for long thin regions near black and white
      const ry = Math.min(FH - 1, Math.floor(L.y)), rx = Math.floor(L.x);
      let run = 1;
      for (let s = 1; s < FW / 2 && G.W[ry * FW + ((rx - s + FW) % FW)] === L.k; s++) run++;
      for (let s = 1; s < FW / 2 && G.W[ry * FW + ((rx + s) % FW)] === L.k; s++) run++;
      const maxH = L.d * ch * 1.7, maxW = Math.max(2 * L.d * cell, run * cw * .8);
      let fs = Math.min(narrow ? 17 : 24, maxH, maxW / (.54 * name.length));
      if (fs < (narrow ? 9 : 10)) continue;
      c.font = `${fs > 15 ? 680 : 600} ${fs.toFixed(1)}px "Schibsted Grotesk", sans-serif`;
      const tw = c.measureText(name).width;
      let sx = ((off + L.x * cw) % VW + VW) % VW; const sy = L.y * ch;
      sx = Math.max(tw / 2 + 4, Math.min(VW - tw / 2 - 4, sx));
      const bx = [sx - tw / 2 - 3, sy - fs * .6, sx + tw / 2 + 3, sy + fs * .6];
      if (placed.some(p => bx[0] < p[2] && bx[2] > p[0] && bx[1] < p[3] && bx[1] < p[3] && bx[3] > p[1])) continue;
      // a name that has already been placed is repeated only for a big region well away from the first
      if (placed.some(p => p.name === name && (L.d < 3.5 || Math.abs((p[0] + p[2]) / 2 - sx) < VW / 3))) continue;
      bx.name = name;
      placed.push(bx);
      const [cr, cg, cb] = X.fieldColor(L.x, L.y, band), dark = X.lum(cr, cg, cb) > .52;
      c.fillStyle = agree ? 'rgba(255,255,255,.92)' : dark ? 'rgba(0,0,0,.82)' : 'rgba(255,255,255,.94)';
      c.fillText(name, sx, sy);
    }
    if (h) { const sx = ((((h.gx + pan) % FW) + FW) % FW) * cw; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(sx, h.gy * ch, 6, 0, Math.PI * 2); c.stroke(); }
  }

  // ---------- the readout ----------
  function readout() {
    const box = el.querySelector('.m-read'), h = pin || hover;
    if (!h || !M) {
      box.innerHTML = `<p class="m-lede">Each region is the name most people gave the colors inside it.</p>
        <p class="m-sub">The survey showed each person a run of random colors and asked them to type a name. Point anywhere to see every name a color got. ${level === 'all' ? '<b>Every name</b> shows the single most popular answer.' : '<b>Basic words</b> keeps only the last word, when it is one of the eleven basic color words, so light blue and navy blue both count as blue.'}</p>`;
      return;
    }
    const [r, g, b] = X.fieldColor(h.gx, h.gy, band), hex = X.rgb2hex(r, g, b);
    const row = D.hover[band][h.ci] || [0], tot = row[0];
    let list = '';
    for (let q = 1; q < row.length; q += 2) {
      const ni = row[q], n = row[q + 1], pct = n / tot * 100;
      list += `<li><i class="sw" style="background:${D.vocHex[ni]}"></i><span class="m-nm">${X.esc(D.voc[ni])}</span><span class="m-bar-v"><i style="width:${Math.min(100, pct * 2.2).toFixed(1)}%"></i></span><span class="m-pc">${pct < 1 ? '<1' : Math.round(pct)}%</span></li>`;
    }
    box.innerHTML = `<div class="m-chip" style="background:${hex}"><span style="color:${X.inkOn(hex)}">${hex}</span></div>
      <p class="m-n">${tot < 20 ? 'Too few answers here to say.' : `${X.fmt(tot)} answers for colors near this one`}</p>
      <ol class="m-list">${list}</ol>
      ${pin ? '<p class="m-kept">Kept. Tap or click the map again to let go.</p>' : ''}`;
  }

  function resize() {
    const st = el.querySelector('.m-stage').getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(st.width), h = Math.round(w < 640 ? w * .8 : Math.min(Math.max(380, innerHeight - 260), w * .52));
    if (!w) return;
    if (w !== VW || h !== VH || cv.width !== Math.round(w * dpr)) {
      VW = w; VH = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
      pathsKey = '';
    }
    request();
  }
  function show() { visible = true; resize(); readout(); }
  function hide() { visible = false; X.tip(null); }
  X.views.map = { init, show, hide, state: () => ({ built, band, level, agree, pan: +pan.toFixed(1), loaded: !!M, labels: M ? X.geometry(M, band, level).labels.length : 0 }) };
})();
