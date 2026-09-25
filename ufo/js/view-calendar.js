/* Unidentified: The Calendar.
   The whole year as one clock. The days of the year run around the circle and the hours of the day run outward from the middle,
   so every cell is one hour of one calendar day, with every year stacked on top of each other. */
(function () {
  'use strict';
  const X = window.UFOX, D = X.D, N = X.N;
  const TAU = Math.PI * 2, Y0 = 1947, Y1 = 2023, NY = Y1 - Y0 + 1, NC = 366 * 24;
  const MDAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MOFF = []; { let s = 0; for (const n of MDAYS) { MOFF.push(s); s += n; } }
  // the quietest hour of the day sits in the middle, so the night is never cut in two
  const SEAM = (() => { let m = 0; for (let h = 1; h < 24; h++) if (D.hour[h] < D.hour[m]) m = h; return m; })();
  const FONT = '"Schibsted Grotesk", system-ui, sans-serif';
  const ERAS = [['All years', Y0, Y1], ['Before 1990', Y0, 1989], ['1990s', 1990, 1999], ['2000s', 2000, 2009], ['2010s', 2010, 2019], ['2020s', 2020, Y1]];

  // ---------- counts ----------
  const doyOf = new Uint16Array(N), hourOf = new Uint8Array(N), yearOf = new Uint16Array(N), perYear = new Uint16Array(NY * NC);
  for (let i = 0; i < N; i++) {
    const dt = X.dateOf(i), y = dt.getUTCFullYear(), d = MOFF[dt.getUTCMonth()] + dt.getUTCDate() - 1, h = Math.floor(X.tod[i] / 6);
    doyOf[i] = d; hourOf[i] = h; yearOf[i] = y;
    if (y >= Y0 && y <= Y1) perYear[(y - Y0) * NC + d * 24 + h]++;
  }
  const cellQuotes = new Map();
  for (const i of X.quoteOf.keys()) { const j = doyOf[i] * 24 + hourOf[i]; if (!cellQuotes.has(j)) cellQuotes.set(j, []); cellQuotes.get(j).push(i); }

  // ---------- the nights that stand out ----------
  function night(y, m, d) {
    const doy = MOFF[m] + d - 1, hours = new Uint32Array(24), states = new Map(), towns = new Map(), shapes = new Uint32Array(8);
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (yearOf[i] !== y || doyOf[i] !== doy) continue;
      n++; hours[hourOf[i]]++; shapes[X.shp[i]]++;
      const t = X.placeName(X.pid[i]), s = t.split(', ').pop();
      states.set(s, (states.get(s) || 0) + 1); towns.set(t, (towns.get(t) || 0) + 1);
    }
    let pk = 0; for (let h = 1; h < 24; h++) if (hours[h] > hours[pk]) pk = h;
    return { doy, n, hour: pk, st: s => states.get(s) || 0, town: t => towns.get(t) || 0, shape: k => shapes[X.SHAPES.indexOf(k)] || 0 };
  }
  const short = (m, d, y) => `${X.MONTHS[m].slice(0, 3)} ${d}, ${y}`;
  const EVENTS = [];
  function oneNight(y, m, d, title, long) {
    const r = night(y, m, d);
    EVENTS.push({ y, doy: r.doy, hour: r.hour, hours: [r.hour], title, sub: () => `${short(m, d, y)}: ${X.fmt(r.n)} reports`, long: () => long(r) });
  }
  function buildEvents() {
    EVENTS.push({ recurring: true, doy: 185, hour: 21, hours: [21, 22], title: 'July 4', sub: w => `${X.fmt(w.raw[185 * 24 + 21] + w.raw[185 * 24 + 22])} reports from 9 to 11pm`,
      long: w => { let n = 0; for (let h = 0; h < 24; h++) n += w.raw[185 * 24 + h]; return w.all ? `${X.fmt(D.fireworks[185])} of the ${X.fmt(n)} July 4 reports mention fireworks.` : `${X.fmt(n)} reports on July 4 ${w.label}.`; } });
    EVENTS.push({ recurring: true, doy: 0, hour: 0, hours: [0], title: 'New Year\u2019s', sub: w => `${X.fmt(w.raw[0])} reports in its first hour`,
      long: w => { let n = 0; for (let h = 0; h < 24; h++) n += w.raw[h]; return w.all ? `Just after midnight. ${X.fmt(D.fireworks[0])} of the ${X.fmt(n)} January 1 reports mention fireworks.` : `Just after midnight, ${w.label}.`; } });
    oneNight(1997, 2, 13, 'The Phoenix Lights', r => `${X.fmt(r.st('AZ'))} of the ${X.fmt(r.n)} reports that night came from Arizona. ${X.fmt(r.shape('triangle'))} of them describe a triangle and ${X.fmt(r.shape('formation'))} a formation.`);
    oneNight(1999, 10, 16, 'Midwest fireball', r => `Most came from Ohio, Michigan, Illinois and Indiana. ${X.fmt(r.shape('fireball'))} of them describe a fireball.`);
    oneNight(2004, 9, 31, 'Tinley Park lights', r => `${X.fmt(r.town('Tinley Park, IL'))} of the ${X.fmt(r.n)} reports that night came from Tinley Park, Illinois. Most describe red lights, often three of them.`);
    oneNight(2015, 10, 7, 'Navy missile launch', r => `${X.fmt(r.st('CA'))} of them came from California. NUFORC\u2019s note on 181 of them: a U.S. Navy missile launch.`);
    oneNight(2016, 6, 27, 'Rocket re-entry', r => `Most came from California and Utah. NUFORC\u2019s notes on 55 of them say space debris, a Chinese rocket coming back into the atmosphere.`);
    oneNight(2020, 2, 5, 'Starlink', r => `NUFORC\u2019s notes on 50 of the ${X.fmt(r.n)} suggest Starlink satellites. Witnesses describe lights in a straight line, evenly spaced.`);
  }

  // ---------- color ----------
  const STOP_T = [0, .2, .42, .6, .74, .86, .95, 1];
  const STOPS = ['#07090e', '#0d1830', '#1c3d6e', '#4d7fb5', '#a8c3e0', '#f0a72d', '#ffe0a0', '#ffffff'];
  const LUT = new Uint32Array(256);
  { const sc = d3.scaleLinear().domain(STOP_T).range(STOPS).interpolate(d3.interpolateRgb);
    for (let k = 0; k < 256; k++) { const q = d3.rgb(sc(k / 255)); LUT[k] = (255 << 24 | q.b << 16 | q.g << 8 | q.r) >>> 0; } }

  // ---------- state ----------
  let el, cv, c, dpr = 1, W = 0, H = 0, cx = 0, cy = 0, rIn = 0, rOut = 0, labelsOn = true, shown = false, raf = 0, lastT = 0;
  let era = 0, playing = false, playY = 0, playNext = 0;
  let win = null, target = null, vT = 1, vS = 1;
  const cells = new Float32Array(NC), lvl = new Uint32Array(NC);
  let visible = [], hover = null, boxes = [], intro = 1, introAt = 0, sparks = [], flashes = [], burstNext = 0, burstI = 0;
  const hcv = document.createElement('canvas'), hc = hcv.getContext('2d'), bcv = document.createElement('canvas'), bc = bcv.getContext('2d');
  let baseDirty = true, needs = true;
  let pmap = null, img = null, buf32 = null;

  const angOf = d => -Math.PI / 2 + d / 366 * TAU;
  const rAt = h => rIn + ((((h - SEAM) % 24) + 24) % 24) / 24 * (rOut - rIn);
  const hs = h => h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h}am` : `${h - 12}pm`;
  const hShort = h => h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`;
  const dayName = d => { let m = 0; while (m < 11 && d >= MOFF[m + 1]) m++; return `${X.MONTHS[m]} ${d - MOFF[m] + 1}`; };
  const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

  function setWindow(a, b, label, fixedMax, floor) {
    const raw = new Float32Array(NC);
    for (let y = a; y <= b; y++) { const o = (y - Y0) * NC; for (let j = 0; j < NC; j++) raw[j] += perYear[o + j]; }
    target = raw.slice();
    let leaps = 0; for (let y = a; y <= b; y++) if (isLeap(y)) leaps++;
    // Feb 29 comes around once every four years, so it is compared on a per-year basis
    for (let h = 0; h < 24; h++) target[59 * 24 + h] *= leaps ? (b - a + 1) / leaps : 0;
    let m = 0, tot = 0; for (let j = 0; j < NC; j++) { if (target[j] > m) m = target[j]; tot += raw[j]; }
    vT = fixedMax || Math.max(floor || 4, m);
    win = { a, b, raw, label, all: a === Y0 && b === Y1, total: tot, avg: target.reduce((s, v) => s + v, 0) / NC };
    const before = new Set(visible);
    visible = EVENTS.filter(ev => ev.recurring
      ? Math.log1p(target[ev.doy * 24 + ev.hour]) / Math.log1p(vT) >= .78
      : ev.y >= a && ev.y <= b);
    const now = performance.now() / 1000;
    for (const ev of visible) if (!before.has(ev)) ev.pulse = now;
    notes(); key(); readout(hover); needs = true;
  }

  // ---------- init ----------
  function init(root) {
    el = root;
    buildEvents();
    el.innerHTML = `
      <div class="cal-wrap">
        <div class="cal-side">
          <div class="cal-read" aria-live="polite"></div>
          <div class="cal-eras" role="group" aria-label="Years">${ERAS.map((e, i) => `<button class="chip-btn" data-e="${i}" aria-pressed="${i === 0}">${e[0]}</button>`).join('')}<button class="chip-btn cal-play" data-play aria-pressed="false"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg><span>Play the years</span></button></div>
          <div class="cal-key">
            <div class="cal-ramp" style="background:linear-gradient(90deg,${STOPS.map((s, i) => `${s} ${STOP_T[i] * 100}%`).join(',')})"></div>
            <div class="cal-ticks"></div>
            <p>Around the circle, the days of the year. Out from the middle, the hours of the day, from ${hs(SEAM)} to ${hs(SEAM)}. The dashed lines are sunset and sunrise, and the circles mark single nights that stand out.</p>
          </div>
          <div class="cal-notes"></div>
        </div>
        <div class="cal-stage"><canvas class="cal-canvas" aria-label="Reports by day of the year and hour of the day"></canvas></div>
      </div>`;
    cv = el.querySelector('.cal-canvas'); c = cv.getContext('2d');
    el.querySelector('.cal-eras').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-play')) return playing ? stopPlay(true) : startPlay();
      stopPlay(false); pickEra(+b.dataset.e);
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onMove);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = null; X.tip(null); readout(null); needs = true; } });
    new ResizeObserver(() => { if (shown) layout(); }).observe(el);
    pickEra(0, true);
  }

  function pickEra(i, instant) {
    era = i;
    el.querySelectorAll('[data-e]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.e === era)));
    const [name, a, b] = ERAS[i];
    setWindow(a, b, i === 0 ? 'all years combined' : i === 1 ? 'in the years before 1990' : `in the ${name}`);
    if (instant || X.reduced) { cells.set(target); vS = vT; render(); }
  }

  function startPlay() {
    playing = true; playY = Y0 + 2; playNext = 0; hover = null; X.tip(null);
    el.querySelectorAll('[data-e]').forEach(x => x.setAttribute('aria-pressed', 'false'));
    const b = el.querySelector('[data-play]'); b.setAttribute('aria-pressed', 'true'); b.querySelector('span').textContent = 'Stop';
  }
  function stopPlay(backToAll) {
    if (!playing) return;
    playing = false;
    const b = el.querySelector('[data-play]'); b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = 'Play the years';
    if (backToAll) pickEra(0);
  }
  function stepPlay(now) {
    if (now < playNext) return;
    if (playY > Y1 - 2) { stopPlay(true); return; }
    setWindow(playY - 2, playY + 2, `from ${playY - 2} to ${playY + 2}`, 0, 10);
    if (X.reduced) { cells.set(target); vS = vT; render(); }
    playY++; playNext = now + .3;
  }

  // ---------- geometry ----------
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = el.querySelector('.cal-stage').getBoundingClientRect();
    W = r.width; H = r.height; if (!W || !H) return;
    cv.width = bcv.width = Math.round(W * dpr); cv.height = bcv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    labelsOn = W >= 740;
    rOut = Math.max(110, labelsOn ? Math.min(H / 2 - 36, (W - 2 * 190) / 2) : Math.min(H / 2 - 30, W / 2 - 34));
    rIn = rOut * .2; cx = W / 2; cy = H / 2;
    buildMap(); render(); baseDirty = true; needs = true;
  }

  function buildMap() {
    const hd = Math.min(devicePixelRatio || 1, 1.5), w = Math.max(1, Math.round(W * hd)), h = Math.max(1, Math.round(H * hd));
    hcv.width = w; hcv.height = h;
    img = hc.createImageData(w, h); buf32 = new Uint32Array(img.data.buffer);
    pmap = new Int16Array(w * h).fill(-1);
    const ri = rIn * hd, ro = rOut * hd, ccx = cx * hd, ccy = cy * hd, span = ro - ri;
    const x0 = Math.max(0, Math.floor(ccx - ro)), x1 = Math.min(w, Math.ceil(ccx + ro)), y0 = Math.max(0, Math.floor(ccy - ro)), y1 = Math.min(h, Math.ceil(ccy + ro));
    for (let y = y0; y < y1; y++) {
      const dy = y + .5 - ccy;
      for (let x = x0; x < x1; x++) {
        const dx = x + .5 - ccx, rr = Math.sqrt(dx * dx + dy * dy);
        if (rr < ri || rr >= ro) continue;
        let th = Math.atan2(dy, dx) + Math.PI / 2; if (th < 0) th += TAU;
        const d = Math.min(365, (th / TAU * 366) | 0), hh = Math.min(23, ((rr - ri) / span * 24) | 0);
        pmap[y * w + x] = d * 24 + (SEAM + hh) % 24;
      }
    }
  }

  function render() {
    if (!pmap) return;
    const lg = Math.log1p(vS);
    for (let j = 0; j < NC; j++) { const t = Math.log1p(cells[j] > 0 ? cells[j] : 0) / lg; lvl[j] = LUT[t >= 1 ? 255 : (t * 255 + .5) | 0]; }
    for (let p = 0, n = pmap.length; p < n; p++) { const j = pmap[p]; buf32[p] = j < 0 ? 0 : lvl[j]; }
    hc.putImageData(img, 0, 0);
    baseDirty = true; needs = true;
  }

  // ---------- drawing ----------
  const ease = t => -(Math.cos(Math.PI * t) - 1) / 2;
  function sector(d, h, pad) {
    const hh = ((h - SEAM) % 24 + 24) % 24, r0 = rIn + hh / 24 * (rOut - rIn) - pad, r1 = rIn + (hh + 1) / 24 * (rOut - rIn) + pad;
    const a0 = angOf(d) - pad / r1, a1 = angOf(d + 1) + pad / r1;
    c.beginPath(); c.arc(cx, cy, r1, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath();
  }
  function cellCenter(d, h) {
    const hh = ((h - SEAM) % 24 + 24) % 24, rr = rIn + (hh + .5) / 24 * (rOut - rIn), a = angOf(d + .5);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, a];
  }
  function pill(text, x, y) {
    c.font = `600 11px ${FONT}`; const w = c.measureText(text).width + 12;
    c.fillStyle = 'rgba(0,0,0,.74)'; c.beginPath(); c.roundRect(x - w / 2, y - 9, w, 18, 9); c.fill();
    c.fillStyle = 'rgba(214,220,232,.95)'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + .5);
  }
  function sunLine(arr) {
    c.beginPath();
    for (let d = 0; d <= 366; d++) { const dd = d % 366, a = angOf(dd + .5), rr = rAt(arr[dd]), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (d) c.lineTo(x, y); else c.moveTo(x, y); }
    c.lineWidth = 3.2; c.strokeStyle = 'rgba(0,0,0,.5)'; c.setLineDash([]); c.stroke();
    c.lineWidth = 1.3; c.strokeStyle = 'rgba(255,241,201,.9)'; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
  }
  function outlined(text, x, y) {
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineJoin = 'round'; c.strokeText(text, x, y); c.fillText(text, x, y);
  }

  function draw(now) {
    if (!W || !pmap) return;
    const e = X.reduced ? 1 : ease(intro);
    if (e < 1) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); staticLayer(e); }
    else {
      if (baseDirty) { const main = c; c = bc; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); staticLayer(1); c = main; baseDirty = false; }
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(bcv, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    overlays(now, e);
  }

  function staticLayer(e) {
    const sweep = -Math.PI / 2 + e * TAU;
    c.save();
    if (e < 1) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, rOut + 4, -Math.PI / 2, sweep); c.closePath(); c.clip(); }
    c.imageSmoothingEnabled = true; c.drawImage(hcv, 0, 0, W, H);
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.2)';
    for (let h = 1; h < 24; h++) { c.beginPath(); c.arc(cx, cy, rIn + h / 24 * (rOut - rIn), 0, TAU); c.stroke(); }
    c.strokeStyle = '#000'; c.lineWidth = 1.5;
    for (let m = 0; m < 12; m++) { const a = angOf(MOFF[m]); c.beginPath(); c.moveTo(cx + Math.cos(a) * (rIn - 1), cy + Math.sin(a) * (rIn - 1)); c.lineTo(cx + Math.cos(a) * (rOut + 1), cy + Math.sin(a) * (rOut + 1)); c.stroke(); }
    if (D.sun) { sunLine(D.sun.sunset); sunLine(D.sun.sunrise); }
    c.restore();
    // the hand that sweeps the year in
    if (e < 1) {
      c.strokeStyle = 'rgba(255,241,201,.95)'; c.lineWidth = 2; c.shadowColor = 'rgba(255,241,201,.8)'; c.shadowBlur = 12;
      c.beginPath(); c.moveTo(cx + Math.cos(sweep) * rIn, cy + Math.sin(sweep) * rIn); c.lineTo(cx + Math.cos(sweep) * (rOut + 8), cy + Math.sin(sweep) * (rOut + 8)); c.stroke();
      c.shadowBlur = 0;
    }
    // months, inside the quiet ring just before 8am
    c.font = `600 11px ${FONT}`; c.fillStyle = 'rgba(214,220,232,.92)'; c.textBaseline = 'middle'; c.textAlign = 'center';
    const rm = rOut - (rOut - rIn) / 48 - 1;
    for (let m = 0; m < 12; m++) {
      const a = angOf(MOFF[m] + MDAYS[m] / 2);
      outlined(X.MONTHS[m].slice(0, 3), cx + Math.cos(a) * rm, cy + Math.sin(a) * rm);
    }
    // the hour axis, laid along early February where the evenings are quiet
    if (e >= 1 && rOut > 150) {
      const aa = angOf(40);
      for (const h of [SEAM, 12, 18, 0, 6]) { const rr = h === SEAM ? rIn + 10 : rAt(h); pill(hs(h), cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); }
      if (D.sun) {
        c.font = `600 11px ${FONT}`; c.fillStyle = '#fff1c9'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const ds = 112, as = angOf(ds + .5);
        const rs = rAt(D.sun.sunset[ds]) - 12, rr2 = rAt(D.sun.sunrise[ds]) - 12;
        outlined('sunset', cx + Math.cos(as) * rs, cy + Math.sin(as) * rs);
        outlined('sunrise', cx + Math.cos(as) * rr2, cy + Math.sin(as) * rr2);
      }
    }
  }

  function overlays(now, e) {
    // the cell under the pointer
    if (hover && hover.type === 'cell') {
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1;
      const a = angOf(hover.d + .5); c.beginPath(); c.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn); c.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut); c.stroke();
      const hh = ((hover.h - SEAM) % 24 + 24) % 24; c.beginPath(); c.arc(cx, cy, rIn + (hh + .5) / 24 * (rOut - rIn), 0, TAU); c.stroke();
      sector(hover.d, hover.h, 1.5); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();
    }
    if (e >= 1) drawEvents(now);
    if (!X.reduced) fireworks(now);
  }

  function drawEvents(now) {
    boxes = [];
    const list = visible.map(ev => { const [px, py, a] = cellCenter(ev.doy, ev.hour); return { ev, a, px, py, right: Math.cos(a) >= 0, ey: cy + Math.sin(a) * (rOut + 8) }; });
    for (const L of list) {
      const hot = hover && hover.type === 'event' && hover.ev === L.ev;
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(L.px, L.py, 9, 0, TAU); c.stroke();
      c.strokeStyle = hot ? '#fff1c9' : '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(L.px, L.py, 9, 0, TAU); c.stroke();
      if (L.ev.pulse && now - L.ev.pulse < 1.1) {
        const q = (now - L.ev.pulse) / 1.1; c.strokeStyle = `rgba(255,241,201,${.9 * (1 - q)})`; c.lineWidth = 1.5;
        c.beginPath(); c.arc(L.px, L.py, 10 + q * 26, 0, TAU); c.stroke();
      }
      if (!labelsOn) boxes.push({ ev: L.ev, x0: L.px - 14, x1: L.px + 14, y0: L.py - 14, y1: L.py + 14 });
    }
    if (!labelsOn) return;
    for (const side of [list.filter(L => L.right), list.filter(L => !L.right)]) {
      side.sort((p, q) => p.ey - q.ey);
      const gap = 38, lo = 16, hi = H - 26;
      for (let i = 0; i < side.length; i++) side[i].ly = Math.max(lo, i ? Math.max(side[i].ey, side[i - 1].ly + gap) : side[i].ey);
      for (let i = side.length - 1; i >= 0; i--) side[i].ly = Math.min(side[i].ly, i === side.length - 1 ? hi : side[i + 1].ly - gap);
    }
    for (const L of list) {
      const hot = hover && hover.type === 'event' && hover.ev === L.ev, lx = L.right ? cx + rOut + 30 : cx - rOut - 30;
      const ex = cx + Math.cos(L.a) * (rOut + 5), ey = cy + Math.sin(L.a) * (rOut + 5);
      c.strokeStyle = hot ? 'rgba(255,241,201,.9)' : 'rgba(255,255,255,.4)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(L.px + Math.cos(L.a) * 10, L.py + Math.sin(L.a) * 10); c.lineTo(ex, ey); c.lineTo(lx + (L.right ? -6 : 6), L.ly - 4); c.stroke();
      c.textAlign = L.right ? 'left' : 'right'; c.textBaseline = 'alphabetic';
      c.font = `650 13px ${FONT}`; c.fillStyle = hot ? '#fff1c9' : '#fff'; c.fillText(L.ev.title, lx, L.ly);
      const w1 = c.measureText(L.ev.title).width, sub = L.ev.sub(win);
      c.font = `500 12px ${FONT}`; c.fillStyle = 'rgba(169,176,192,.95)'; c.fillText(sub, lx, L.ly + 15);
      const w = Math.max(w1, c.measureText(sub).width);
      boxes.push({ ev: L.ev, x0: L.right ? lx - 6 : lx - w - 6, x1: L.right ? lx + w + 6 : lx + 6, y0: L.ly - 16, y1: L.ly + 20 });
    }
  }

  // ---------- fireworks, where the witnesses saw them ----------
  const SPARK = [X.COL_HEX[2], X.COL_HEX[3], X.COL_HEX[1], X.COL_HEX[5], X.COL_HEX[6], '#fff1c9'];
  function burst(ev, now) {
    const [bx, by] = cellCenter(ev.doy, ev.hour), col = SPARK[(Math.random() * SPARK.length) | 0], n = 30 + ((Math.random() * 18) | 0);
    for (let k = 0; k < n; k++) { const t = k / n * TAU + Math.random() * .25, sp = 26 + Math.random() * 30; sparks.push({ x: bx, y: by, vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, born: now, col: Math.random() < .2 ? '#fff' : col }); }
    flashes.push({ x: bx, y: by, born: now });
  }
  function fireworks(now) {
    sparks = sparks.filter(s => now - s.born < 1.5); flashes = flashes.filter(f => now - f.born < .35);
    if (!sparks.length && !flashes.length) return;
    c.globalCompositeOperation = 'lighter';
    for (const f of flashes) {
      const q = (now - f.born) / .35, g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 22);
      g.addColorStop(0, `rgba(255,241,201,${.7 * (1 - q)})`); g.addColorStop(1, 'rgba(255,241,201,0)');
      c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, 22, 0, TAU); c.fill();
    }
    for (const s of sparks) {
      const age = now - s.born, x = s.x + s.vx * age, y = s.y + s.vy * age + 16 * age * age;
      c.globalAlpha = Math.max(0, 1 - age / 1.5); c.fillStyle = s.col; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function loop(ts) {
    const now = ts / 1000, dt = lastT ? Math.min(.1, now - lastT) : 0; lastT = now;
    if (intro < 1) {
      if (!introAt) introAt = now;
      const e0 = ease(intro); intro = Math.min(1, (now - introAt) / 2.2); const e1 = ease(intro);
      for (const ev of visible) if (ev.recurring) { const f = (ev.doy + .5) / 366; if (e0 < f && e1 >= f) burst(ev, now); }
      if (intro >= 1) burstNext = now + 2.2;
    } else if (!X.reduced && !playing && now > burstNext) {
      const rec = visible.filter(v => v.recurring);
      if (rec.length) burst(rec[burstI++ % rec.length], now);
      burstNext = now + 2.6 + Math.random() * 1.4;
    }
    if (playing) stepPlay(now);
    const moving = intro < 1 || sparks.length || flashes.length || visible.some(v => v.pulse && now - v.pulse < 1.2);
    if (target) {
      const k = X.reduced ? 1 : Math.min(1, dt * 9); let dirty = false;
      for (let j = 0; j < NC; j++) { const dl = target[j] - cells[j]; if (dl > .02 || dl < -.02) { cells[j] += dl * k; dirty = true; } else if (dl !== 0) { cells[j] = target[j]; dirty = true; } }
      const dv = vT - vS; if (Math.abs(dv) > .05) { vS += dv * k; dirty = true; } else if (dv !== 0) { vS = vT; dirty = true; }
      if (dirty) render();
    }
    if (moving || needs) { draw(now); needs = false; }
    raf = requestAnimationFrame(loop);
  }

  // ---------- reading ----------
  function eventAt(d, h) { return visible.find(ev => ev.doy === d && (ev.recurring ? ev.hours.includes(h) : Math.abs(ev.hour - h) <= 1)); }
  function onMove(ev) {
    if (playing) return;
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    const b = boxes.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    if (b) { if (!hover || hover.ev !== b.ev) { hover = { type: 'event', ev: b.ev }; readout(hover); needs = true; } X.tip(null); return; }
    const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
    if (dist >= rIn && dist < rOut) {
      let th = Math.atan2(dy, dx) + Math.PI / 2; if (th < 0) th += TAU;
      const d = Math.min(365, (th / TAU * 366) | 0), h = (SEAM + Math.min(23, ((dist - rIn) / (rOut - rIn) * 24) | 0)) % 24;
      if (!hover || hover.type !== 'cell' || hover.d !== d || hover.h !== h) { hover = { type: 'cell', d, h }; readout(hover); needs = true; }
      const j = d * 24 + h, n = win.raw[j], evt = eventAt(d, h);
      X.tip(`<b>${dayName(d)}, ${hShort(h)}</b><small>${X.fmt(n)} ${n === 1 ? 'report' : 'reports'}, ${(target[j] / win.avg).toFixed(1)}x an average hour</small>${evt ? `<em>${X.esc(evt.title)}</em>` : ''}`, ev.clientX, ev.clientY);
    } else { if (hover) { hover = null; readout(null); needs = true; } X.tip(null); }
  }

  function quoteFor(j) {
    const list = cellQuotes.get(j); if (!list) return -1;
    for (const i of list) if (yearOf[i] >= win.a && yearOf[i] <= win.b) return i;
    return -1;
  }
  function readout(h) {
    const box = el.querySelector('.cal-read'); if (!win) return;
    if (playing) {
      const evs = visible.filter(v => !v.recurring);
      box.innerHTML = `<div class="cal-big">${(win.a + win.b) / 2}</div><p>The reports from <b>${win.a} to ${win.b}</b>, five years at a time. ${X.fmt(win.total)} in all.</p>${evs.map(v => `<p class="cal-ev"><b>${X.esc(v.title)}.</b> ${X.esc(v.long(win))}</p>`).join('')}`;
      return;
    }
    if (h && h.type === 'event') {
      const v = h.ev, j = v.doy * 24 + v.hour;
      box.innerHTML = `<div class="cal-big ev">${X.esc(v.title)}</div><p>${X.esc(v.sub(win))}.</p><p class="cal-ev">${X.esc(v.long(win))}</p>${quoteBlock(v.recurring ? quoteFor(j) : quoteOfNight(v))}`;
      return;
    }
    if (h && h.type === 'cell') {
      const j = h.d * 24 + h.h, n = win.raw[j], evt = eventAt(h.d, h.h);
      box.innerHTML = `<div class="cal-big">${dayName(h.d)}</div><div class="cal-hr">${hs(h.h)} to ${hs((h.h + 1) % 24)}</div><p><b>${X.fmt(n)}</b> ${n === 1 ? 'report' : 'reports'} between ${hs(h.h)} and ${hs((h.h + 1) % 24)}, ${win.label}. ${n ? `That is ${(target[j] / win.avg).toFixed(1)} times an average hour of the year.` : ''}</p>${evt ? `<p class="cal-ev"><b>${X.esc(evt.title)}.</b> ${X.esc(evt.long(win))}</p>` : ''}${quoteBlock(quoteFor(j))}`;
      return;
    }
    let top = 0; for (let j = 1; j < NC; j++) if (target[j] > target[top]) top = j;
    const d = top / 24 | 0, hh = top % 24;
    box.innerHTML = `<div class="cal-big">${dayName(d)}</div><div class="cal-hr">${hs(hh)} to ${hs((hh + 1) % 24)}</div><p>The busiest hour of the year, ${win.label}, with <b>${X.fmt(win.raw[top])} reports</b>. That is ${(target[top] / win.avg).toFixed(0)} times an average hour. ${matchMedia('(hover: none)').matches ? 'Tap' : 'Hover over'} any cell to read it.</p>`;
  }
  // a quote from that very night, within two hours of its busiest hour
  function quoteOfNight(v) {
    for (const k of [0, 1, -1, 2, -2]) {
      const list = cellQuotes.get(v.doy * 24 + (v.hour + k + 24) % 24); if (!list) continue;
      for (const i of list) if (yearOf[i] === v.y) return i;
    }
    return -1;
  }
  function quoteBlock(i) { return i < 0 ? '' : `<blockquote><q>${X.esc(X.quoteOf.get(i))}</q><span>${X.esc(X.placeName(X.pid[i]))}, ${X.clock(i)}, ${X.fullDate(i)}</span></blockquote>`; }

  function key() {
    const ticks = [0, 1, 10, 100, 1000].filter(v => v < vT * .75);
    el.querySelector('.cal-ticks').innerHTML = ticks.map(v => `<span style="left:${(Math.log1p(v) / Math.log1p(vT) * 100).toFixed(1)}%">${X.fmt(v)}</span>`).join('') + `<span class="max">${X.fmt(vT)}</span>`;
  }

  let ROUND_ALL = 0;
  function roundNote(r) {
    if (win.all) { ROUND_ALL = r; return `<p><b>The 1st and the 15th of every month run ${r.toFixed(1)} times higher than other days.</b> That is why they show up as rays. They are likely the dates people write down when they only remember the month.</p>`; }
    return `<p><b>The 1st and the 15th run ${r.toFixed(1)} times higher than other days ${win.label}</b>, against ${(ROUND_ALL || 1.9).toFixed(1)} times across all years.</p>`;
  }
  function notes() {
    const hrs = new Float64Array(24), raw = win.raw;
    for (let j = 0; j < NC; j++) hrs[j % 24] += raw[j];
    const tot = hrs.reduce((s, v) => s + v, 0) || 1;
    let pk = 0; for (let h = 0; h < 24; h++) if (hrs[h] > hrs[pk]) pk = h;
    const evening = [19, 20, 21, 22, 23].reduce((s, h) => s + hrs[h], 0) / tot;
    const day = d => { let s = 0; for (let h = 0; h < 24; h++) s += win.raw[d * 24 + h]; return d === 59 ? s * 4 : s; };
    let r1 = 0, n1 = 0, ro = 0, no = 0;
    for (let d = 0; d < 366; d++) { if (d === 185 || d === 0) continue; const dm = dayName(d).split(' ')[1]; if (dm === '1' || dm === '15') { r1 += day(d); n1++; } else { ro += day(d); no++; } }
    let avgDay = 0; for (let d = 0; d < 366; d++) avgDay += day(d); avgDay /= 366;
    const after = D.sun ? Math.round(D.sun.afterSunset * 2) / 2 : 2, words = { 1: 'an hour', 1.5: 'an hour and a half', 2: 'two hours', 2.5: 'two and a half hours', 3: 'three hours' };
    el.querySelector('.cal-notes').innerHTML = `
      <p><b>The ${hs(pk)} hour is the busiest.</b> ${Math.round(evening * 100)}% of reports come between 7pm and midnight, local time.</p>
      <p><b>The bright band follows the sunset.</b> The typical evening report comes about ${words[after] || after + ' hours'} after the sun goes down, so the band swings outward in summer, when it gets dark later.</p>
      ${roundNote((r1 / n1) / (ro / no))}
      ${win.all ? `<p><b>July 4 is the busiest day, at ${(day(185) / avgDay).toFixed(1)} times an average day.</b> ${X.fmt(D.fireworks[185])} of its ${X.fmt(day(185))} reports mention fireworks.</p>` : ''}`;
  }

  function show() { shown = true; layout(); intro = X.reduced ? 1 : 0; introAt = 0; lastT = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function hide() { shown = false; stopPlay(false); cancelAnimationFrame(raf); X.tip(null); }
  X.views.calendar = { init, show, hide };
})();



