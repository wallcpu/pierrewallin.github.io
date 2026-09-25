/* Unidentified: shared core. Decodes the reports and exposes window.UFOX. */
(function () {
  'use strict';
  const D = window.UFO;
  const N = D.n;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SHAPES = D.shapes;
  const COLORS = D.colors;
  const PLURAL = { saucer: 'saucers', cigar: 'cigars', triangle: 'triangles', sphere: 'spheres', light: 'lights', fireball: 'fireballs', formation: 'formations', other: 'other shapes' };
  // what each shape covers in the raw NUFORC field
  const COVERS = { saucer: 'disk, oval, egg', cigar: 'cigar, cylinder', triangle: 'triangle, chevron, diamond, cone', sphere: 'circle, sphere, orb', light: 'light, flash, star', fireball: 'fireball, teardrop', formation: 'formation', other: 'other, changing, unknown, blank' };
  const SHAPE_HEX = ['#dfe4ec', '#c9a86a', '#ff5b52', '#6fb8ff', '#fff1c9', '#ff8a1f', '#62e3a1', '#5b6272'];
  const COL_HEX = ['#bcd6ff', '#f6f7ff', '#ff9a3c', '#ff4d4d', '#5cf28d', '#5aa9ff', '#ffe45c', '#c5ccd6', '#8f97a8', '#cf96ff', '#ffc94d'];

  // ---------- decode ----------
  const day = new Int32Array(N), tod = new Uint8Array(N), pid = new Uint16Array(N);
  const shp = new Uint8Array(N), col = new Uint8Array(N), dur = new Uint8Array(N), tf = new Float64Array(N);
  const Y0 = 1940, Y1 = 2026, BASE = Date.UTC(1900, 0, 1);
  const ys = [];
  for (let y = Y0; y <= Y1; y++) ys.push(Math.round((Date.UTC(y, 0, 1) - BASE) / 864e5));
  let acc = 0, yi = 0;
  for (let i = 0; i < N; i++) {
    acc += D.d[i]; day[i] = acc; tod[i] = D.t[i]; pid[i] = D.p[i];
    const k = D.k[i]; shp[i] = k % 8; col[i] = Math.floor(k / 8) % 11; dur[i] = Math.floor(k / 88);
    while (yi < ys.length - 2 && ys[yi + 1] <= acc) yi++;
    tf[i] = Y0 + yi + (acc - ys[yi] + tod[i] / 144) / (ys[yi + 1] - ys[yi]);
  }
  const T0 = D.years[0], T1 = tf[N - 1] + 0.02;
  const quoteOf = new Map(D.quotes);

  // first report at or after year-fraction t
  function indexAt(t) {
    let lo = 0, hi = N;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tf[m] < t) lo = m + 1; else hi = m; }
    return lo;
  }

  // ---------- labels ----------
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateOf = i => new Date(BASE + day[i] * 864e5);
  const monthYear = i => { const d = dateOf(i); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const fullDate = i => { const d = dateOf(i); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const clock = i => { const h = Math.floor(tod[i] / 6), m = (tod[i] % 6) * 10; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  const monthOfT = t => MONTHS[Math.min(11, Math.floor((t - Math.floor(t)) * 12))];
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const placeName = p => D.places[p][2];

  // ---------- shape glyphs, drawn into any 2d context at (x, y) with radius r ----------
  function glyph(c, s, x, y, r) {
    c.beginPath();
    switch (SHAPES[s]) {
      case 'saucer':
        c.ellipse(x, y + r * .08, r, r * .3, 0, 0, Math.PI * 2);
        c.moveTo(x + r * .45, y);
        c.ellipse(x, y - r * .02, r * .45, r * .42, 0, Math.PI, Math.PI * 2);
        break;
      case 'cigar':
        c.ellipse(x, y, r, r * .26, -0.35, 0, Math.PI * 2);
        break;
      case 'triangle':
        c.moveTo(x, y - r * .9); c.lineTo(x + r * .95, y + r * .65); c.lineTo(x - r * .95, y + r * .65); c.closePath();
        break;
      case 'sphere':
        c.arc(x, y, r * .62, 0, Math.PI * 2);
        break;
      case 'light':
        c.moveTo(x, y - r); c.lineTo(x + r * .18, y - r * .18); c.lineTo(x + r, y); c.lineTo(x + r * .18, y + r * .18);
        c.lineTo(x, y + r); c.lineTo(x - r * .18, y + r * .18); c.lineTo(x - r, y); c.lineTo(x - r * .18, y - r * .18); c.closePath();
        break;
      case 'fireball':
        c.arc(x + r * .3, y - r * .3, r * .48, 0, Math.PI * 2);
        c.moveTo(x - r * .02, y - r * .62); c.lineTo(x - r, y + r); c.lineTo(x + r * .62, y + r * .02); c.closePath();
        break;
      case 'formation':
        for (const [dx, dy] of [[-.8, .45], [-.28, .05], [.28, -.3], [.8, -.62]]) { c.moveTo(x + dx * r + r * .2, y + dy * r); c.arc(x + dx * r, y + dy * r, r * .2, 0, Math.PI * 2); }
        break;
      default:
        c.moveTo(x, y - r * .7); c.lineTo(x + r * .7, y); c.lineTo(x, y + r * .7); c.lineTo(x - r * .7, y); c.closePath();
    }
    c.fill();
  }

  // small glowing sprites per (shape, colour), rendered once
  const sprites = new Map();
  function sprite(s, cIdx, size) {
    const key = s * 100 + cIdx + size * 10000;
    let cv = sprites.get(key);
    if (cv) return cv;
    const dpr = Math.min(devicePixelRatio || 1, 2), S = Math.ceil(size * 4 * dpr);
    cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const hex = COL_HEX[cIdx];
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, hex + '66'); g.addColorStop(.35, hex + '22'); g.addColorStop(1, hex + '00');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.fillStyle = hex; c.shadowColor = hex; c.shadowBlur = size * dpr * .8;
    glyph(c, s, S / 2, S / 2, size * dpr);
    sprites.set(key, cv);
    return cv;
  }

  // ---------- tooltip ----------
  const tipEl = document.getElementById('uTip');
  function tip(html, x, y) {
    if (!html) { tipEl.classList.remove('show'); return; }
    tipEl.innerHTML = html;
    const w = tipEl.offsetWidth || 260, h = tipEl.offsetHeight || 60;
    let left = x + 16, top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + h > innerHeight - 8) top = y - h - 16;
    tipEl.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    tipEl.classList.add('show');
  }

  // ---------- sound: a small theremin ----------
  // each shape has a note in a whole-tone scale, and west-to-east becomes left-to-right
  const NOTE = [370.0, 415.3, 466.2, 523.3, 587.3, 659.3, 740.0, 329.6];
  let ac = null, bus = null;
  function audio() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      bus = ac.createGain(); bus.gain.value = .8;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 6;
      const delay = ac.createDelay(1); delay.delayTime.value = .31;
      const fb = ac.createGain(); fb.gain.value = .38;
      const wet = ac.createGain(); wet.gain.value = .32;
      bus.connect(comp); comp.connect(ac.destination);
      bus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function note(s, pan, vel) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime, f = NOTE[s] * (1 + (Math.random() - .5) * .006), len = .55 + Math.random() * .35;
    const o = ac.createOscillator(); o.type = 'sine';
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.2 + Math.random() * 1.6;
    const lg = ac.createGain(); lg.gain.value = f * .014; lfo.connect(lg); lg.connect(o.frequency);
    o.frequency.setValueAtTime(f * .93, t); o.frequency.exponentialRampToValueAtTime(f, t + .14);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus); } else g.connect(bus);
    o.start(t); lfo.start(t); o.stop(t + len + .05); lfo.stop(t + len + .05);
  }

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  window.UFOX = {
    D, N, reduced, SHAPES, COLORS, PLURAL, COVERS, SHAPE_HEX, COL_HEX,
    day, tod, pid, shp, col, dur, tf, T0, T1, quoteOf, indexAt,
    MONTHS, dateOf, monthYear, fullDate, clock, monthOfT, fmt, esc, placeName,
    glyph, sprite, tip, audio, note, params, setParams, views: {},
  };
})();
