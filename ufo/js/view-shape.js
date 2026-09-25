/* Unidentified: The Average UFO.
   For every year, each shape is layered at its share of that year's reports (each year averaged with the years either side),
   so the craft you see is literally the average of what people described. */
(function () {
  'use strict';
  const X = window.UFOX, D = X.D, Y0 = D.years[0], Y1 = D.years[1];
  const SY = D.shapeYear, CY = D.colorYear, NY = SY.length;
  const NAMED = [0, 1, 2, 3, 4, 5, 6];
  const COLN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // shares per year, smoothed over three years
  const share = [], cshare = [], raw = [];
  for (let y = 0; y < NY; y++) {
    const w = [0, 0, 0, 0, 0, 0, 0, 0], cw = new Array(11).fill(0);
    for (let d = -1; d <= 1; d++) { const r = SY[y + d], q = CY[y + d]; if (!r) continue; const f = d === 0 ? 2 : 1; for (let s = 0; s < 8; s++) w[s] += r[s] * f; for (let k = 0; k < 11; k++) cw[k] += q[k] * f; }
    const tot = NAMED.reduce((a, s) => a + w[s], 0) || 1, ct = COLN.reduce((a, k) => a + cw[k], 0) || 1;
    share.push(NAMED.map(s => w[s] / tot)); cshare.push(COLN.map(k => cw[k] / ct));
    raw.push(SY[y].reduce((a, b) => a + b, 0));
  }

  let el, big, bc, grid, stream, sc, yearSel = 1952 - Y0, pinned = 1952 - Y0, raf = 0, playing = false, playT = 0, shown = false, lastNow = 0;
  const cells = [];

  // ---------- each shape as an outline: its distance from the centre at 180 angles ----------
  const NA = 180;
  const inPoly = (x, y, P) => { let a = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) a = !a; } return a; };
  const inEll = (x, y, cx, cy, a, b, rot = 0) => { const c = Math.cos(-rot), s = Math.sin(-rot), dx = x - cx, dy = y - cy, u = dx * c - dy * s, v = dx * s + dy * c; return (u * u) / (a * a) + (v * v) / (b * b) <= 1; };
  const STAR = []; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? .2 : 1; STAR.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const INSIDE = [
    (x, y) => inEll(x, y, 0, .08, 1, .3) || (y <= .06 && inEll(x, y, 0, -.02, .45, .42)),
    (x, y) => inEll(x, y, 0, 0, 1, .26, -.35),
    (x, y) => inPoly(x, y, [[0, -.9], [.95, .65], [-.95, .65]]),
    (x, y) => x * x + y * y <= .62 * .62,
    (x, y) => inPoly(x, y, STAR),
    (x, y) => inEll(x, y, .3, -.3, .48, .48) || inPoly(x, y, [[-.02, -.62], [-1, 1], [.62, .02]]),
    (x, y) => [[-.8, .45], [-.28, .05], [.28, -.3], [.8, -.62]].some(([dx, dy]) => inEll(x, y, dx, dy, .2, .2)) || (Math.abs((y + .62 * x) / Math.hypot(1, .62)) < .03 && Math.abs(x) < .8),
  ];
  const OUT = INSIDE.map(f => {
    const r = new Float32Array(NA);
    for (let a = 0; a < NA; a++) {
      const th = a / NA * Math.PI * 2, cx = Math.cos(th), cy = Math.sin(th);
      let v = 0; for (let s = 1.25; s > 0; s -= .005) if (f(cx * s, cy * s)) { v = s; break; }
      r[a] = v;
    }
    return r;
  });
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // the average outline and the average named colour for year y
  const avgCache = new Map();
  function average(y) {
    if (avgCache.has(y)) return avgCache.get(y);
    const r = new Float32Array(NA), w = share[y];
    for (let a = 0; a < NA; a++) { let v = 0; for (let j = 0; j < 7; j++) v += w[j] * OUT[j][a]; r[a] = v; }
    // smooth a little so single-shape spikes read as features, not noise
    const sm = new Float32Array(NA);
    for (let a = 0; a < NA; a++) sm[a] = (r[(a + NA - 1) % NA] + 2 * r[a] + r[(a + 1) % NA]) / 4;
    let R = 0, G = 0, B = 0, tot = 0;
    COLN.forEach((k, j) => { if (k === 8) return; const [cr, cg, cb] = hexRgb(X.COL_HEX[k]), v = cshare[y][j]; R += cr * v; G += cg * v; B += cb * v; tot += v; });
    const hsl = d3.hsl(d3.rgb(R / tot, G / tot, B / tot));
    hsl.s = Math.min(1, hsl.s * 2.2 + .12); hsl.l = Math.max(.58, Math.min(.74, hsl.l));
    const out = { r: sm, col: hsl.formatHex(), rim: d3.hsl(hsl.h, hsl.s, .9).formatHex() };
    avgCache.set(y, out); return out;
  }
  function outline(c, r, cx, cy, size) {
    c.beginPath();
    for (let a = 0; a <= NA; a++) { const i = a % NA, th = i / NA * Math.PI * 2, rr = r[i] * size; if (a === 0) c.moveTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); else c.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); }
    c.closePath();
  }

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="avg-wrap">
        <div class="avg-hero">
          <canvas class="avg-big" aria-label="The average UFO for the selected year"></canvas>
          <div class="avg-read">
            <div class="avg-year"></div>
            <p class="avg-mix"></p>
            <div class="avg-bars"></div>
          </div>
          <div class="avg-ctls">
            <button class="ctl" data-a="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play 1947 to 2023</span></button>
            <span class="hint"><kbd>&larr;</kbd> <kbd>&rarr;</kbd></span>
          </div>
        </div>
        <div class="avg-book">
          <p class="avg-book-h">One average for every year</p>
          <div class="avg-grid" role="listbox" aria-label="Pick a year"></div>
        </div>
      </div>
      <div class="avg-streams">
        <canvas class="avg-stream" aria-label="The share of each shape and each color named in reports, 1947 to 2023"></canvas>
      </div>
      <p class="avg-note">Each year is averaged with the years on either side, because the early years have few reports. Reports that name no shape, or call it other, changing or unknown, are left out. Shapes are grouped: saucers include disks, ovals and eggs; spheres include circles and orbs; triangles include chevrons, diamonds and cones.</p>`;
    big = el.querySelector('.avg-big'); bc = big.getContext('2d');
    grid = el.querySelector('.avg-grid');
    stream = el.querySelector('.avg-stream'); sc = stream.getContext('2d');
    for (let y = 0; y < NY; y++) {
      const b = document.createElement('button');
      b.className = 'avg-cell'; b.setAttribute('role', 'option'); b.dataset.y = y;
      b.innerHTML = `<canvas width="120" height="96"></canvas><span>${Y0 + y}</span>`;
      b.setAttribute('aria-label', `${Y0 + y}: ${mixText(y)}`);
      grid.appendChild(b); cells.push(b);
    }
    grid.addEventListener('click', e => { const b = e.target.closest('.avg-cell'); if (b) { stop(); pinned = +b.dataset.y; select(pinned); } });
    grid.addEventListener('pointerover', e => { const b = e.target.closest('.avg-cell'); if (b && !playing && e.pointerType === 'mouse') select(+b.dataset.y, true); });
    grid.addEventListener('pointerleave', () => { if (!playing && yearSel !== pinned) select(pinned, true); });
    el.querySelector('[data-a=play]').addEventListener('click', () => (playing ? stop() : play()));
    streamEvents();
    addEventListener('keydown', e => {
      if (!el.classList.contains('on') || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || document.querySelector('.cmdk.open')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stop(); pinned = Math.max(0, Math.min(NY - 1, yearSel + (e.key === 'ArrowRight' ? 1 : -1))); select(pinned); }
    });
    new ResizeObserver(() => { if (shown) layout(); }).observe(el);
  }

  // ---------- the composite: the ingredients as faint outlines, the average as one lit craft ----------
  function composite(c, y, cx, cy, size, wobble = 0, ghosts = false) {
    const A = average(y), R = size * .5;
    if (ghosts) {
      c.save(); c.lineWidth = 1.2;
      NAMED.forEach((s, j) => {
        const a = share[y][j]; if (a < .02) return;
        c.strokeStyle = X.SHAPE_HEX[s]; c.globalAlpha = Math.min(.55, a * 1.5);
        outline(c, OUT[j], cx + Math.sin(wobble * .7 + j) * 2, cy + Math.cos(wobble * .6 + j * 2) * 2, R); c.stroke();
      });
      c.restore();
    }
    c.save();
    outline(c, A.r, cx, cy, R);
    c.shadowColor = A.col; c.shadowBlur = size * .12;
    const g = c.createRadialGradient(cx - R * .2, cy - R * .25, R * .05, cx, cy, R * .9);
    g.addColorStop(0, A.rim); g.addColorStop(.55, A.col); g.addColorStop(1, d3.color(A.col).darker(.9).formatHex());
    c.fillStyle = g; c.fill();
    c.shadowBlur = 0; c.lineWidth = Math.max(1, size * .006); c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
    c.restore();
  }

  function drawCells() {
    cells.forEach((b, y) => {
      const cv = b.querySelector('canvas'), c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      composite(c, y, cv.width / 2, cv.height / 2 + 2, 100);
    });
  }

  let BW = 0, BH = 0, dpr = 1, SW = 0, SH = 0;
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = big.getBoundingClientRect(); BW = r.width; BH = r.height;
    big.width = Math.round(BW * dpr); big.height = Math.round(BH * dpr);
    const s = stream.getBoundingClientRect(); SW = s.width; SH = s.height;
    stream.width = Math.round(SW * dpr); stream.height = Math.round(SH * dpr);
    drawStream(); drawBig(performance.now() / 1000);
  }

  function drawBig(now) {
    if (!BW) return;
    bc.setTransform(dpr, 0, 0, dpr, 0, 0); bc.clearRect(0, 0, BW, BH);
    const size = Math.min(BW * .95, BH * 1.05), cx = BW / 2, cy = BH * .46 + Math.sin(now * 1.4) * BH * .018;
    // the beam
    const g = bc.createLinearGradient(0, cy, 0, BH);
    g.addColorStop(0, 'rgba(210,225,255,.10)'); g.addColorStop(1, 'rgba(210,225,255,0)');
    bc.fillStyle = g; bc.beginPath(); bc.moveTo(cx - size * .09, cy + size * .04); bc.lineTo(cx + size * .09, cy + size * .04); bc.lineTo(cx + size * .3, BH); bc.lineTo(cx - size * .3, BH); bc.closePath(); bc.fill();
    composite(bc, Math.round(yearSel), cx, cy, size * .82, now, true);
  }

  function loop(now) {
    now /= 1000;
    if (playing) {
      playT += (now - (lastNow || now)) * 4.2;
      const y = Math.min(NY - 1, Math.floor(playT));
      if (y !== yearSel) select(y, true);
      if (playT >= NY - 1 + .9) stop();
    }
    lastNow = now;
    drawBig(now);
    raf = requestAnimationFrame(loop);
  }
  function play() { playing = true; playT = yearSel >= NY - 1 ? 0 : yearSel; lastNow = 0; el.querySelector('[data-a=play]').innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg><span>Pause</span>'; }
  function stop() { if (!playing) return; playing = false; pinned = yearSel; el.querySelector('[data-a=play]').innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play 1947 to 2023</span>'; }

  // ---------- readout ----------
  function top3(y) { return NAMED.map((s, j) => [s, share[y][j]]).sort((a, b) => b[1] - a[1]); }
  function mixText(y) { return top3(y).slice(0, 3).map(([s, v]) => `${Math.round(v * 100)}% ${X.PLURAL[X.SHAPES[s]]}`).join(', '); }
  function topColor(y) { const cs = cshare[y].map((v, j) => [COLN[j], v]).sort((a, b) => b[1] - a[1]); return cs[0]; }
  function select(y, quiet) {
    yearSel = y;
    cells.forEach((b, i) => b.setAttribute('aria-selected', String(i === y)));
    const t = top3(y), [ck, cv] = topColor(y);
    el.querySelector('.avg-year').textContent = Y0 + y;
    el.querySelector('.avg-mix').innerHTML = `<b>${X.fmt(raw[y])}</b> reports. The average UFO is ${Math.round(t[0][1] * 100)}% ${X.SHAPES[t[0][0]]}, ${Math.round(t[1][1] * 100)}% ${X.SHAPES[t[1][0]]} and ${Math.round(t[2][1] * 100)}% ${X.SHAPES[t[2][0]]}. The color named most is <span class="swatch" style="--c:${X.COL_HEX[ck]}"></span>${X.COLORS[ck]}.`;
    el.querySelector('.avg-bars').innerHTML = NAMED.map((s, j) => `<span style="--w:${(share[y][j] * 100).toFixed(1)}%;--c:${X.SHAPE_HEX[s]}" title="${X.PLURAL[X.SHAPES[s]]} ${Math.round(share[y][j] * 100)}%"></span>`).join('');
    drawStream();
    if (!quiet) cells[y].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------- the two streams: shapes on top, colors below ----------
  const PAD_L = 92, PAD_R = 14;
  const xOf = y => PAD_L + (y / (NY - 1)) * (SW - PAD_L - PAD_R);
  function band(top, h, rows, cols) {
    for (let j = 0; j < cols.length; j++) {
      sc.beginPath();
      for (let y = 0; y < NY; y++) { let acc = 0; for (let q = 0; q < j; q++) acc += rows[y][q]; sc.lineTo(xOf(y), top + acc * h); }
      for (let y = NY - 1; y >= 0; y--) { let acc = 0; for (let q = 0; q <= j; q++) acc += rows[y][q]; sc.lineTo(xOf(y), top + acc * h); }
      sc.closePath(); sc.fillStyle = cols[j]; sc.fill();
    }
  }
  function drawStream() {
    if (!SW) return;
    sc.setTransform(dpr, 0, 0, dpr, 0, 0); sc.clearRect(0, 0, SW, SH);
    const h1 = SH * .52, h2 = SH * .26, top2 = h1 + 26;
    band(0, h1, share, NAMED.map(s => X.SHAPE_HEX[s]));
    band(top2, h2, cshare, COLN.map(k => X.COL_HEX[k]));
    sc.font = '500 12.5px "Schibsted Grotesk", system-ui, sans-serif'; sc.fillStyle = 'rgba(169,176,192,.9)'; sc.textAlign = 'left';
    sc.fillText('Shapes', 0, 14); sc.fillText('Colors', 0, top2 + 14);
    sc.font = '500 11.5px "Schibsted Grotesk", system-ui, sans-serif'; sc.fillStyle = 'rgba(169,176,192,.7)'; sc.textAlign = 'center';
    for (let yr = 1950; yr <= 2020; yr += 10) { const x = xOf(yr - Y0); sc.fillText(String(yr), x, SH - 4); sc.fillRect(x - .5, top2 + h2 + 3, 1, 4); }
    // labels inside the shape stream where each band is widest
    sc.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; sc.textAlign = 'center';
    NAMED.forEach((s, j) => {
      let by = 0, bv = 0; for (let y = 3; y < NY - 3; y++) if (share[y][j] > bv) { bv = share[y][j]; by = y; }
      if (bv * h1 < 15) return;
      let acc = 0; for (let q = 0; q < j; q++) acc += share[by][q];
      sc.fillStyle = 'rgba(7,8,12,.82)'; sc.fillText(X.PLURAL[X.SHAPES[s]], xOf(by), acc * h1 + bv * h1 / 2 + 4);
    });
    const x = xOf(yearSel);
    sc.fillStyle = '#fff'; sc.fillRect(x - 1, 0, 2, top2 + h2);
    sc.beginPath(); sc.arc(x, top2 + h2 + 8, 3.5, 0, Math.PI * 2); sc.fill();
  }
  function streamEvents() {
    let drag = false;
    const yAt = ev => { const r = stream.getBoundingClientRect(); return Math.max(0, Math.min(NY - 1, Math.round((ev.clientX - r.left - PAD_L) / (r.width - PAD_L - PAD_R) * (NY - 1)))); };
    stream.addEventListener('pointerdown', ev => { drag = true; stream.setPointerCapture(ev.pointerId); stop(); pinned = yAt(ev); select(pinned, true); });
    stream.addEventListener('pointermove', ev => {
      const y = yAt(ev);
      if (drag) { pinned = y; select(y, true); }
      const r = stream.getBoundingClientRect(), py = ev.clientY - r.top, h1 = SH * .52, top2 = h1 + 26;
      let label = '';
      if (py <= h1) { let acc = 0; for (let j = 0; j < NAMED.length; j++) { acc += share[y][j]; if ((py / h1) <= acc) { label = `${Math.round(share[y][j] * 100)}% of named shapes are ${X.PLURAL[X.SHAPES[NAMED[j]]]}`; break; } } }
      else if (py >= top2) { let acc = 0; for (let j = 0; j < COLN.length; j++) { acc += cshare[y][j]; if (((py - top2) / (SH * .26)) <= acc) { label = `${Math.round(cshare[y][j] * 100)}% of named colors are ${X.COLORS[COLN[j]]}`; break; } } }
      X.tip(`<b>${Y0 + y}</b><small>${label || X.fmt(raw[y]) + ' reports'}</small>`, ev.clientX, ev.clientY);
    });
    stream.addEventListener('pointerup', () => { drag = false; });
    stream.addEventListener('pointerleave', () => { drag = false; X.tip(null); });
  }

  function show() {
    shown = true; layout(); drawCells(); select(yearSel, true);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function hide() { shown = false; stop(); cancelAnimationFrame(raf); X.tip(null); }
  X.views.shape = { init, show, hide };
})();
