/* Unidentified: The Sky.
   Every report replays over the map in the shape and colour the witness gave, then burns into a long exposure.
   Busy years get more of the running time. Each shape has its own theremin note; west to east plays left to right. */
(function () {
  'use strict';
  const X = window.UFOX, D = X.D, N = X.N, Y0 = D.years[0];
  const DUR = 180;                                          // seconds for the whole replay at 1x
  const LIFE = [0.9, 1.25, 1.7, 2.3, 2.9, 3.6, 1.4];        // how long a report glows, by its reported duration
  const SPEEDS = [1, 2, 4, 0.5];
  const P = D.places.length;

  let el, cv, c, baseCv, bc, expCv, ec, dpr = 1, W = 0, H = 0, k = 1, ox = 0, oy = 0, us = null;
  const psx = new Float32Array(P).fill(NaN), psy = new Float32Array(P).fill(NaN);
  const pax = new Float32Array(P).fill(NaN), pay = new Float32Array(P).fill(NaN);
  const pCount = new Uint32Array(P), pFirst = new Int32Array(P).fill(-1), pShape = new Uint32Array(P * 8), pQuote = new Map();
  const jx = new Float32Array(N), jy = new Float32Array(N);
  let quad = null, hoverP = -1;

  let playing = false, started = false, ended = false, wall = 0, t = X.T0, cur = N, speedI = 0, sound = true, exposure = true, filter = -1;
  let qAnchor = null, last = 0, raf = 0, budget = 0, quoteUntil = 0, noteUntil = 0, ringI = -1, ringUntil = 0, msI = 0;
  const liveI = new Int32Array(1 << 15), liveB = new Float64Array(1 << 15); let lh = 0, lt = 0;
  const MASK = (1 << 15) - 1;
  let ui = {};

  // ---------- per-place aggregates and a little jitter so a town's reports don't stack on one pixel ----------
  for (let i = 0; i < N; i++) {
    const p = X.pid[i];
    pCount[p]++; pShape[p * 8 + X.shp[i]]++;
    if (pFirst[p] < 0) pFirst[p] = i;
    if (X.quoteOf.has(i) && !pQuote.has(p)) pQuote.set(p, i);
    const h = Math.sin(i * 12.9898) * 43758.5453, a = (h - Math.floor(h)) * Math.PI * 2, r = Math.sqrt(((h * 7) % 1 + 1) % 1) * 1.6;
    jx[i] = Math.cos(a) * r; jy[i] = Math.sin(a) * r;
  }
  const proj = d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
  for (let p = 0; p < P; p++) { const xy = proj([D.places[p][0], D.places[p][1]]); if (xy) { pax[p] = xy[0]; pay[p] = xy[1]; } }

  // ---------- time warp: busier months get more wall-clock time ----------
  const months = Math.ceil((X.T1 - X.T0) * 12) + 1, mCount = new Float64Array(months);
  for (let i = 0; i < N; i++) mCount[Math.min(months - 1, Math.floor((X.tf[i] - X.T0) * 12))]++;
  const cum = new Float64Array(months + 1);
  for (let m = 0; m < months; m++) cum[m + 1] = cum[m] + 0.3 + Math.pow(mCount[m], 0.55);
  const scaleW = DUR / cum[months];
  function wallToT(w) {
    const target = w / scaleW; let lo = 0, hi = months - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid - 1; }
    const f = (target - cum[lo]) / (cum[lo + 1] - cum[lo]);
    return X.T0 + (lo + Math.max(0, Math.min(1, f))) / 12;
  }
  function tToWall(tt) { const x = (tt - X.T0) * 12, m = Math.max(0, Math.min(months - 1, Math.floor(x))); return (cum[m] + Math.max(0, Math.min(1, x - m)) * (cum[m + 1] - cum[m])) * scaleW; }

  // ---------- yearly numbers and the notes the data supports ----------
  const SY = D.shapeYear, CY = D.colorYear, yrs = SY.length;
  const yc = y => (y < Y0 || y >= Y0 + yrs) ? 0 : SY[y - Y0].reduce((a, b) => a + b, 0);
  const named = y => yc(y) - SY[y - Y0][7];
  const topShape = y => { const r = SY[y - Y0]; let b = 0; for (let s = 1; s < 7; s++) if (r[s] > r[b]) b = s; return b; };
  const pct = x => Math.round(x * 100);
  const cumYear = new Float64Array(yrs + 1);
  for (let y = 0; y < yrs; y++) cumYear[y + 1] = cumYear[y] + yc(Y0 + y);
  const dateT = (y, mo, d) => { const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return y + (Date.UTC(y, mo - 1, d) - a) / (b - a); };
  const MS = [];
  {
    MS.push({ t: X.tf[0] - 0.001, text: `${X.fullDate(0)}, ${X.placeName(X.pid[0])}: the first report in the data.` });
    let s = 0, n = 0; for (let y = 1950; y <= 1959; y++) { s += SY[y - Y0][0]; n += named(y); }
    MS.push({ t: 1950.0, text: `In the 1950s, ${pct(s / n)}% of the reports that name a shape describe a saucer.` });
    let best = 0, by = 0; for (let y = 1947; y <= 2023; y++) if (yc(y) >= 100) { const sh = SY[y - Y0][2] / named(y); if (sh > best) { best = sh; by = y; } }
    MS.push({ t: by, text: `${by}: ${pct(best)}% of the reports that name a shape describe a triangle, more than in any other year.` });
    MS.push({ t: 1995.0, text: `Reports nearly triple in a year, from ${X.fmt(yc(1994))} in 1994 to ${X.fmt(yc(1995))} in 1995.` });
    MS.push({ t: dateT(1997, 3, 13), text: `March 13, 1997: ${D.phoenix} reports from Arizona in one night. They become known as the Phoenix Lights.` });
    const J4 = 185, avg = D.calendar.reduce((a, b) => a + b, 0) / 366;
    MS.push({ t: dateT(2010, 7, 4), text: `Every Fourth of July the map flares. It is the busiest day of the year, with ${(D.calendar[J4] / avg).toFixed(1)} times the reports of an average day.` });
    let ob = 0, oy2 = 0; for (let y = 1990; y <= 2023; y++) { const r = CY[y - Y0], tot = r.slice(1).reduce((a, b) => a + b, 0); if (tot > 500 && r[2] / tot > ob) { ob = r[2] / tot; oy2 = y; } }
    MS.push({ t: oy2 + 0.001, text: `${oy2}: orange is the color of the year. It is named in ${pct(ob)}% of the reports that give a color.` });
    let py = 1947; for (let y = 1947; y <= 2023; y++) if (yc(y) > yc(py)) py = y;
    MS.push({ t: py + 0.5, text: `${py} is the busiest year on record, with ${X.fmt(yc(py))} reports.` });
    const w = D.words.starlink, before = w.slice(0, 2019 - Y0).reduce((a, b) => a + b, 0);
    MS.push({ t: 2019.45, text: `"Starlink" appears in ${w[2019 - Y0]} reports in 2019 and ${w[2020 - Y0]} in 2020. Before 2019 it appears in ${before}.` });
    MS.push({ t: X.T1 - 0.03, text: `The data ends in ${X.monthYear(N - 1)}.` });
    MS.sort((a, b) => a.t - b.t);
  }

  // ---------- DOM ----------
  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="sky-stage">
        <canvas class="sky-canvas" aria-label="Map of the United States with UFO reports appearing over time"></canvas>
        <div class="sky-read" aria-live="off">
          <div class="sky-year">1947-2023</div>
          <div class="sky-month">One long exposure</div>
          <div class="sky-count"></div>
          <p class="sky-ms"></p>
          <div class="sky-legend"><b>Each light is one report,</b> drawn in the shape and color the witness gave. Longer sightings glow longer. Each shape has its own note, and west to east plays left to right.</div>
        </div>
        <div class="sky-quote" aria-live="polite"></div>
        <div class="sky-start">
          <button class="sky-play" aria-label="Play 76 years"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg></button>
          <b>Watch 76 years</b><small>About three minutes, sound on</small>
          <button class="quiet">or watch without sound</button>
        </div>
        <div class="sky-end"><b>Seventy-six years of looking up.</b><span>Every point of light is a report. Brighter means more of them.</span></div>
      <div class="sky-dock">
        <div class="sky-strip"><canvas></canvas></div>
        <div class="sky-ctls">
          <button class="ctl" data-c="play" aria-label="Play or pause"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play</span></button>
          <button class="ctl" data-c="speed">1&times;</button>
          <button class="ctl" data-c="sound" aria-pressed="true">Sound on</button>
          <button class="ctl" data-c="exposure" aria-pressed="true">Long exposure</button>
          <button class="ctl" data-c="restart">From 1947</button>
          <span class="sky-sep"></span>
          <span class="lbl">Show</span>
          <button class="chip-btn" data-f="-1" aria-pressed="true">Everything</button>
          ${[0, 1, 2, 3, 4, 5, 6].map(s => `<button class="chip-btn" data-f="${s}" aria-pressed="false"><i style="background:${X.SHAPE_HEX[s]}"></i>${X.PLURAL[X.SHAPES[s]]}</button>`).join('')}
        </div>
      </div>
      </div>`;
    cv = el.querySelector('.sky-canvas'); c = cv.getContext('2d');
    baseCv = document.createElement('canvas'); bc = baseCv.getContext('2d');
    expCv = document.createElement('canvas'); ec = expCv.getContext('2d');
    ui = {
      year: el.querySelector('.sky-year'), month: el.querySelector('.sky-month'), count: el.querySelector('.sky-count'), ms: el.querySelector('.sky-ms'),
      quote: el.querySelector('.sky-quote'), start: el.querySelector('.sky-start'), end: el.querySelector('.sky-end'),
      strip: el.querySelector('.sky-strip'), stripCv: el.querySelector('.sky-strip canvas'),
      play: el.querySelector('[data-c=play]'), speed: el.querySelector('[data-c=speed]'), sound: el.querySelector('[data-c=sound]'), exposure: el.querySelector('[data-c=exposure]'),
    };
    ui.sc = ui.stripCv.getContext('2d');

    ui.start.querySelector('.sky-play').addEventListener('click', () => begin(true));
    ui.start.querySelector('.quiet').addEventListener('click', () => begin(false));
    el.querySelector('.sky-ctls').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f !== undefined) return setFilter(+b.dataset.f);
      const a = b.dataset.c;
      if (a === 'play') { if (!started) begin(sound); else if (playing) pause(); else play(); }
      if (a === 'speed') { speedI = (speedI + 1) % SPEEDS.length; b.textContent = SPEEDS[speedI] === .5 ? '\u00BD\u00D7' : SPEEDS[speedI] + '\u00D7'; }
      if (a === 'sound') { sound = !sound; b.setAttribute('aria-pressed', sound); b.textContent = sound ? 'Sound on' : 'Sound off'; if (sound) X.audio(); }
      if (a === 'exposure') { exposure = !exposure; b.setAttribute('aria-pressed', exposure); frame(true); }
      if (a === 'restart') begin(sound);
    });

    cv.addEventListener('pointermove', onHover);
    cv.addEventListener('pointerleave', () => { hoverP = -1; X.tip(null); if (!playing) frame(true); });
    stripEvents();
    addEventListener('keydown', onKey);

    fetch('assets/vendor/us-states-albers-10m.json').then(r => r.json()).then(j => { us = j; resize(); });
    new ResizeObserver(() => resize()).observe(el.querySelector('.sky-stage'));
  }

  // ---------- geometry ----------
  function resize() {
    const stage = el.querySelector('.sky-stage');
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    if (!W || !H) return;
    for (const cvs of [cv, baseCv, expCv]) { cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr); }
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const narrow = W < 700, dockH = el.querySelector('.sky-dock').offsetHeight || 130;
    const top = narrow ? 178 : 24, bottom = dockH + (narrow ? 124 : 8);
    ui.quote.style.bottom = (dockH + 16) + 'px';
    k = Math.min((W * (narrow ? .98 : .8)) / 975, (H - top - bottom) / 610);
    ox = narrow ? (W - 975 * k) / 2 : Math.max((W - 975 * k) / 2 + W * .03, 300 + 57 * k); oy = top + (H - top - bottom - 610 * k) / 2;
    if (!narrow && ox + 975 * k > W - 12) { k = (W - 12 - 300) / (975 + 57); ox = 300 + 57 * k; oy = top + (H - top - bottom - 610 * k) / 2; }
    for (let p = 0; p < P; p++) { psx[p] = ox + pax[p] * k; psy[p] = oy + pay[p] * k; }
    quad = d3.quadtree().x(p => psx[p]).y(p => psy[p]).addAll(d3.range(P).filter(p => pCount[p] && !isNaN(psx[p])));
    drawBase(); rebuildExposure(); drawStrip(); frame(true);
  }

  function drawBase() {
    bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, baseCv.width, baseCv.height);
    if (!us) return;
    bc.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    const path = d3.geoPath(null, bc);
    const nation = us.objects.nation ? topojson.feature(us, us.objects.nation) : topojson.merge(us, us.objects.states.geometries);
    bc.beginPath(); path(nation); bc.fillStyle = 'rgba(150,170,220,.035)'; bc.fill();
    bc.lineWidth = .7 / k; bc.strokeStyle = 'rgba(190,205,240,.22)'; bc.stroke();
    bc.beginPath(); path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)); bc.lineWidth = .45 / k; bc.strokeStyle = 'rgba(190,205,240,.1)'; bc.stroke();
  }

  const EXP = X.COL_HEX.map(h => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return `rgba(${r},${g},${b},.13)`; });
  function burn(i) {
    const p = X.pid[i]; if (isNaN(psx[p])) return;
    ec.fillStyle = EXP[X.col[i]];
    ec.fillRect((psx[p] + jx[i]) * dpr - dpr * .75, (psy[p] + jy[i]) * dpr - dpr * .75, dpr * 1.5, dpr * 1.5);
  }
  function rebuildExposure() {
    ec.setTransform(1, 0, 0, 1, 0, 0); ec.globalCompositeOperation = 'source-over'; ec.clearRect(0, 0, expCv.width, expCv.height);
    ec.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cur; i++) if (filter < 0 || X.shp[i] === filter) burn(i);
  }

  // ---------- playback ----------
  function begin(withSound) {
    sound = withSound; ui.sound.setAttribute('aria-pressed', sound); ui.sound.textContent = sound ? 'Sound on' : 'Sound off';
    if (sound) X.audio();
    started = true; ended = false; wall = 0; t = X.T0; cur = 0; msI = 0; lh = lt = 0; ringI = -1;
    ui.start.classList.add('gone'); ui.end.classList.remove('show'); ui.ms.textContent = ''; ui.ms.classList.remove('show'); showQuote(-1);
    el.querySelector('.sky-stage').scrollIntoView({ behavior: X.reduced ? 'auto' : 'smooth', block: 'start' });
    rebuildExposure(); play();
  }
  function play() {
    if (ended) return begin(sound);
    playing = true; setPlayIcon(); last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function pause() { playing = false; setPlayIcon(); cancelAnimationFrame(raf); frame(true); }
  function setPlayIcon() {
    ui.play.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg><span>Pause</span>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play</span>';
  }
  function seek(tt) {
    started = true; ended = false; ui.start.classList.add('gone'); ui.end.classList.remove('show');
    t = Math.max(X.T0, Math.min(X.T1, tt)); wall = tToWall(t); cur = X.indexAt(t); lh = lt = 0; ringI = -1;
    msI = MS.findIndex(m => m.t > t); if (msI < 0) msI = MS.length;
    ui.ms.classList.remove('show'); showQuote(-1);
    rebuildExposure(); frame(true);
  }

  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    wall += dt * SPEEDS[speedI];
    t = wallToT(wall);
    const upto = t >= X.T1 ? N : X.indexAt(t);
    const nowS = now / 1000;
    budget = Math.min(6, budget + dt * 13);
    const fresh = upto - cur;
    for (let i = cur; i < upto; i++) {
      if (filter >= 0 && X.shp[i] !== filter) continue;
      burn(i);
      liveI[lh & MASK] = i; liveB[lh & MASK] = nowS; lh++;
      if (lh - lt > MASK) lt = lh - MASK;
      if (sound && budget >= 1 && (fresh < 8 || Math.random() < 6 / fresh)) {
        const p = X.pid[i]; X.note(X.shp[i], (psx[p] / W) * 2 - 1, .05 + Math.random() * .04); budget -= 1;
      }
      if (X.quoteOf.has(i) && nowS > quoteUntil) showQuote(i, nowS);
    }
    cur = upto;
    while (msI < MS.length && MS[msI].t <= t) { showNote(MS[msI].text, nowS); msI++; }
    if (nowS > noteUntil && ui.ms.classList.contains('show')) ui.ms.classList.remove('show');
    if (nowS > quoteUntil + .2 && ui.quote.classList.contains('show')) ui.quote.classList.remove('show');
    frame(false, nowS);
    if (t >= X.T1) { finish(); return; }
    if (playing) raf = requestAnimationFrame(loop);
  }
  function finish() {
    playing = false; ended = true; setPlayIcon(); cur = N;
    ui.end.classList.add('show'); showQuote(-1);
    frame(true);
  }

  function showQuote(i, nowS) {
    if (i < 0) { ui.quote.classList.remove('show'); ringI = -1; return; }
    const p = X.pid[i];
    ui.quote.innerHTML = `<q>${X.esc(X.quoteOf.get(i))}</q><span>${X.esc(X.placeName(p))}, ${X.clock(i)}, ${X.fullDate(i)}</span>`;
    ui.quote.classList.add('show');
    quoteUntil = nowS + 4.2; ringI = i; ringUntil = nowS + 4.2;
    const qb = ui.quote.getBoundingClientRect(), sb = el.querySelector('.sky-stage').getBoundingClientRect();
    qAnchor = W >= 900 ? [qb.right - sb.left + 12, qb.top - sb.top + 13] : null;
  }
  function showNote(text, nowS) { ui.ms.textContent = text; ui.ms.classList.add('show'); noteUntil = nowS + 7; }

  // ---------- drawing ----------
  function frame(still, nowS = performance.now() / 1000) {
    if (!W) return;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(baseCv, 0, 0);
    if (exposure || !started || ended) { c.globalAlpha = started && !ended ? .9 : 1; c.drawImage(expCv, 0, 0); c.globalAlpha = 1; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // live reports
    if (started && !still) {
      c.globalCompositeOperation = 'lighter';
      for (let q = lt; q < lh; q++) {
        const i = liveI[q & MASK], age = nowS - liveB[q & MASK], life = LIFE[X.dur[i]];
        if (age > life) { if (q === lt) lt++; continue; }
        const p = X.pid[i], x = psx[p] + jx[i], y = psy[p] + jy[i];
        const a = age < .1 ? age / .1 : 1 - (age - .1) / (life - .1);
        const pop = 1 + .8 * Math.max(0, 1 - age / .3);
        const size = Math.max(4, k * 5.2) * pop;
        c.globalAlpha = Math.max(0, a);
        const spr = X.sprite(X.shp[i], X.col[i], 6);
        c.drawImage(spr, x - size * 2, y - size * 2, size * 4, size * 4);
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    // the report that is being quoted
    if (ringI >= 0 && nowS < ringUntil) {
      const p = X.pid[ringI], x = psx[p], y = psy[p], a = Math.min(1, (ringUntil - nowS) / .6);
      c.strokeStyle = `rgba(255,255,255,${.75 * a})`; c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y, 9 + 3 * Math.sin(nowS * 5), 0, Math.PI * 2); c.stroke();
      if (qAnchor) {
        const [ax, ay] = qAnchor, dx = x - ax, dy = y - ay, dd = Math.hypot(dx, dy) || 1, ex = x - dx / dd * 12, ey = y - dy / dd * 12;
        c.strokeStyle = `rgba(255,255,255,${.32 * a})`; c.lineWidth = 1;
        c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax + dx * .55, ay, ex, ey); c.stroke();
      }
    }
    if (hoverP >= 0) {
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(psx[hoverP], psy[hoverP], 7, 0, Math.PI * 2); c.stroke();
    }
    readout();
    drawPlayhead();
  }

  let lastRead = '';
  function readout() {
    let y, mo, cnt;
    if (!started || ended) { y = '1947-2023'; mo = ended ? 'The whole record' : 'One long exposure'; cnt = `<b>${X.fmt(filter < 0 ? N : shapeTotal(filter))}</b> ${filter < 0 ? 'reports' : X.PLURAL[X.SHAPES[filter]]}`; }
    else {
      const yy = Math.min(2023, Math.floor(t)); y = String(yy); mo = X.monthOfT(t);
      cnt = `<b>${X.fmt(cur)}</b> reports so far<br>${X.fmt(yc(yy))} in ${yy}, mostly ${X.PLURAL[X.SHAPES[topShape(yy)]]}`;
    }
    const key = y + mo + cnt;
    if (key === lastRead) return; lastRead = key;
    ui.year.textContent = y; ui.month.textContent = mo; ui.count.innerHTML = cnt;
    ui.year.classList.toggle('range', !started || ended);
  }
  const shapeTotals = new Uint32Array(8); for (let i = 0; i < N; i++) shapeTotals[X.shp[i]]++;
  const shapeTotal = s => shapeTotals[s];

  // ---------- timeline strip ----------
  let sW = 0, sH = 0;
  const sx = tt => 8 + (tt - X.T0) / (X.T1 - X.T0) * (sW - 16);
  function drawStrip() {
    const cvs = ui.stripCv, r = ui.strip.getBoundingClientRect();
    sW = r.width; sH = r.height; if (!sW) return;
    cvs.width = Math.round(sW * dpr); cvs.height = Math.round(sH * dpr);
    drawPlayhead();
  }
  const mMax = Math.max(...mCount);
  function drawPlayhead() {
    const s = ui.sc; if (!sW) return;
    s.setTransform(dpr, 0, 0, dpr, 0, 0); s.clearRect(0, 0, sW, sH);
    const base = sH - 18, top = 16, bw = Math.max(1, (sW - 16) / months);
    const played = started && !ended ? t : X.T1;
    for (let m = 0; m < months; m++) {
      const v = mCount[m]; if (!v) continue;
      const tt = X.T0 + m / 12, h = Math.sqrt(v / mMax) * (base - top);
      s.fillStyle = tt <= played ? 'rgba(214,226,255,.72)' : 'rgba(214,226,255,.16)';
      s.fillRect(sx(tt), base - h, bw + .3, h);
    }
    s.font = '500 11px "Schibsted Grotesk", system-ui, sans-serif'; s.textAlign = 'center'; s.fillStyle = 'rgba(169,176,192,.75)';
    for (let y = 1950; y <= 2020; y += 10) { const x = sx(y); s.fillRect(x, base + 2, 1, 4); s.fillText(String(y), x, base + 16); }
    for (const m of MS) { const x = sx(m.t); s.fillStyle = m.t <= played ? '#fff' : 'rgba(255,255,255,.35)'; s.beginPath(); s.arc(x, 6, 2.6, 0, Math.PI * 2); s.fill(); }
    if (started && !ended) { const x = sx(t); s.fillStyle = '#fff'; s.fillRect(x - .75, 2, 1.5, base - 2); }
  }
  function stripEvents() {
    const strip = ui.strip;
    let drag = false;
    const toT = ev => { const r = strip.getBoundingClientRect(); return X.T0 + (ev.clientX - r.left - 8) / (r.width - 16) * (X.T1 - X.T0); };
    strip.addEventListener('pointerdown', ev => { drag = true; strip.setPointerCapture(ev.pointerId); const wasPlaying = playing; if (playing) pause(); seek(toT(ev)); strip.dataset.resume = wasPlaying ? '1' : ''; });
    strip.addEventListener('pointermove', ev => {
      const tt = toT(ev);
      if (drag) { seek(tt); return; }
      const r = strip.getBoundingClientRect(), x = ev.clientX - r.left;
      const m = MS.find(q => Math.abs(sx(q.t) - x) < 7 && ev.clientY - r.top < 16);
      if (m) X.tip(`<b>${Math.floor(m.t)}</b><small>${X.esc(m.text)}</small>`, ev.clientX, ev.clientY);
      else { const y = Math.floor(Math.max(X.T0, Math.min(2023, tt))); X.tip(`<b>${y}</b><small>${X.fmt(yc(y))} reports, mostly ${X.PLURAL[X.SHAPES[topShape(y)]]}</small><em>Click or drag to jump</em>`, ev.clientX, ev.clientY); }
    });
    strip.addEventListener('pointerup', () => { drag = false; if (strip.dataset.resume) play(); });
    strip.addEventListener('pointerleave', () => X.tip(null));
  }

  // ---------- hover a town ----------
  function onHover(ev) {
    if (!quad) return;
    const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let p = quad.find(mx, my, 12);
    if (p !== undefined && started && !ended && pFirst[p] >= cur) p = undefined;
    if (p === undefined) { if (hoverP >= 0) { hoverP = -1; X.tip(null); if (!playing) frame(true); } return; }
    hoverP = p;
    let best = 0; for (let s = 1; s < 7; s++) if (pShape[p * 8 + s] > pShape[p * 8 + best]) best = s;
    const q = pQuote.get(p);
    X.tip(`<b>${X.esc(X.placeName(p))}</b><small>${X.fmt(pCount[p])} ${pCount[p] === 1 ? 'report' : 'reports'}, most often ${X.PLURAL[X.SHAPES[best]]}</small><em>First reported ${X.monthYear(pFirst[p])}</em>${q !== undefined ? `<q>${X.esc(X.quoteOf.get(q))}</q>` : ''}`, ev.clientX, ev.clientY);
    if (!playing) frame(true);
  }

  function setFilter(s) {
    filter = s;
    el.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.f === s)));
    lh = lt = 0; rebuildExposure(); lastRead = ''; frame(true);
  }

  function onKey(e) {
    if (!el || !el.classList.contains('on') || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || document.querySelector('.cmdk.open')) return;
    if (e.code === 'Space') { e.preventDefault(); if (!started) begin(sound); else if (playing) pause(); else play(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); seek((started && !ended ? t : X.T0) + (e.key === 'ArrowRight' ? 1 : -1)); }
  }

  function show() { resize(); }
  function hide() { if (playing) pause(); X.tip(null); }
  X.views.sky = { init, show, hide };
})();
