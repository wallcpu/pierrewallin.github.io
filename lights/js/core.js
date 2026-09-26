/* Night Coast: shared data, blink timing, colour, sound and text helpers. */
(function () {
  'use strict';
  const D = window.LIGHTS, N = D.n;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;

  // ---------- decode the columns ----------
  const C = D.c;
  const lat = new Float32Array(N), lon = new Float32Array(N), type = new Uint8Array(N), code = new Uint16Array(N);
  const range = new Uint8Array(N), height = new Uint16Array(N), flags = new Uint8Array(N), name = new Int32Array(N);
  let a = 0, b = 0;
  for (let i = 0; i < N; i++) {
    a += C.la[i]; b += C.lo[i];
    lat[i] = a / 1e4; lon[i] = b / 1e4;
    type[i] = C.ty[i]; code[i] = C.co[i]; range[i] = C.rg[i]; height[i] = C.ht[i]; flags[i] = C.fl[i]; name[i] = C.nm[i];
  }
  const major = i => flags[i] & 1;
  const system = i => (flags[i] >> 1) & 3;          // 1: red to port, 2: red to starboard
  const heritage = i => (flags[i] >> 3) & 1;
  const fog = new Map(D.fog.map(([i, f]) => [i, f]));

  // sectors: [light, start bearing from seaward, end bearing, colour, range, pattern]
  const SN = D.sec.li.length;
  const sLight = new Int32Array(SN), sA = new Float32Array(SN), sB = new Float32Array(SN), sCol = new Uint8Array(SN), sRange = new Uint8Array(SN), sPat = new Uint16Array(SN);
  { let p = 0; for (let k = 0; k < SN; k++) { p += D.sec.li[k]; sLight[k] = p; sA[k] = D.sec.a[k] / 10; sB[k] = D.sec.b[k] / 10; sCol[k] = D.sec.c[k]; sRange[k] = D.sec.r[k]; sPat[k] = D.sec.p[k]; } }
  const sectorsOf = new Map();
  for (let k = 0; k < SN; k++) { const i = sLight[k]; if (!sectorsOf.has(i)) sectorsOf.set(i, []); sectorsOf.get(i).push(k); }

  // ---------- colour: the lights' own colours, as they look at night ----------
  const COLORS = D.colors;
  const HEX = { white: '#fff3d6', red: '#ff4d3f', green: '#38ff8e', yellow: '#ffd43b', blue: '#57a8ff', orange: '#ff9a2e', violet: '#b884ff', amber: '#ffb31a' };
  const COL_HEX = COLORS.map(c => HEX[c] || '#ffffff');
  const COL_NAME = COLORS;

  // ---------- rhythm: every pattern as cumulative edges in seconds, lit first ----------
  const PAT = D.pats.map(p => {
    if (!p) return null;
    const segs = p[0].map(v => v / 10), alt = p[1];
    const edges = new Float32Array(segs.length); let t = 0;
    for (let k = 0; k < segs.length; k++) { t += segs[k]; edges[k] = t; }
    return { segs, edges, period: t, alt };
  });
  const CODE = D.codes.map(([text, pat, col, ch, grp, per]) => ({ text, pat, col, ch, grp, per }));
  // a fixed random phase per light, so neighbours do not flash in lockstep
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) { const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453; phase[i] = h - Math.floor(h); }
  // colour index if the pattern is lit at time t (seconds), else -1
  function litPat(pi, col, t, ph) {
    const P = PAT[pi];
    if (!P) return col;
    if (P.period <= 0) return col;
    let x = (t + ph * P.period) % P.period; if (x < 0) x += P.period;
    const e = P.edges;
    for (let k = 0; k < e.length; k++) if (x < e[k]) { if (k & 1) return -1; return P.alt ? P.alt[(k >> 1) % P.alt.length] : col; }
    return -1;
  }
  const isFixed = i => !PAT[CODE[code[i]].pat];
  // the lit test, flattened into typed arrays for the map's per-frame loop over every light
  const LP = new Int16Array(N), LC = new Uint8Array(N), LOFF = new Float32Array(N);
  for (let i = 0; i < N; i++) { const c = CODE[code[i]], P = PAT[c.pat]; LP[i] = P && P.period > 0 ? c.pat : -1; LC[i] = c.col; LOFF[i] = P ? phase[i] * P.period : 0; }
  function litFast(i, t) {
    const pi = LP[i]; if (pi < 0) return LC[i];
    const P = PAT[pi], e = P.edges;
    let x = (t + LOFF[i]) % P.period; if (x < 0) x += P.period;
    for (let k = 0; k < e.length; k++) if (x < e[k]) { if (k & 1) return -1; return P.alt ? P.alt[(k >> 1) % P.alt.length] : LC[i]; }
    return -1;
  }

  // ---------- words ----------
  const TYPE_WORD = {
    light_major: 'Lighthouse', lighthouse: 'Lighthouse', light_minor: 'Harbor light', light: 'Light', light_vessel: 'Lightship', light_float: 'Light float',
    buoy_lateral: 'Channel buoy', beacon_lateral: 'Channel beacon', buoy_cardinal: 'Cardinal buoy', beacon_cardinal: 'Cardinal beacon',
    buoy_special_purpose: 'Special buoy', beacon_special_purpose: 'Special beacon', buoy_safe_water: 'Safe water buoy', beacon_safe_water: 'Safe water beacon',
    buoy_isolated_danger: 'Danger buoy', beacon_isolated_danger: 'Danger beacon', buoy_installation: 'Offshore buoy', landmark: 'Landmark light', pile: 'Pile light',
    platform: 'Offshore platform', dock: 'Dock light', mooring: 'Mooring light', signal_station_warning: 'Signal station', notice: 'Notice light', pylon: 'Pylon light',
    bridge: 'Bridge light', wreck: 'Wreck light', building: 'Building light',
  };
  const typeWord = i => TYPE_WORD[D.types[type[i]]] || 'Light';
  const nameOf = i => name[i] >= 0 ? D.names[name[i]] : '';
  const codeText = i => CODE[code[i]].text;
  // an inline picture of one light's rhythm, for tooltips and cards
  function rhythmSvg(pi, col, w = 150, h = 10, secs) {
    const P = PAT[pi];
    if (!P) return `<svg class="rh" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="2" fill="${COL_HEX[col]}"/></svg>`;
    const span = secs || Math.max(P.period, Math.min(30, P.period * Math.ceil(10 / P.period)));
    let s = `<svg class="rh" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="2" fill="rgba(255,255,255,.07)"/>`;
    for (let t0 = 0; t0 < span; t0 += P.period) {
      let t = t0;
      P.segs.forEach((d, k) => {
        if (!(k & 1) && d > 0 && t < span) { const c2 = P.alt ? P.alt[(k >> 1) % P.alt.length] : col; s += `<rect x="${(t / span * w).toFixed(2)}" y="0" width="${Math.max(.8, Math.min(d, span - t) / span * w).toFixed(2)}" height="${h}" fill="${COL_HEX[c2]}"/>`; }
        t += d;
      });
    }
    return s + '</svg>';
  }
  function fogText(i) {
    const f = fog.get(i); if (!f) return '';
    const [cat, per] = f.split('|');
    return `Fog signal: ${cat.replace(/_/g, ' ')}${per ? `, every ${per} s` : ''}`;
  }

  // ---------- land ----------
  const landCache = {};
  const land = res => landCache[res] || (landCache[res] = fetch(`assets/vendor/world-land-${res}.json`).then(r => r.json()).then(t => topojson.feature(t, t.objects.land)));
  // land as rings in web mercator units (0 to 1 across and down), built once and drawn with plain lines:
  // far cheaper than projecting through d3 on every redraw, and immune to longitude wrapping at the date line
  const RADC = Math.PI / 180;
  const mercY = la => { la = Math.max(-85, Math.min(85, la)) * RADC; return (1 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / Math.PI) / 2; };
  function worldRings(fc) {
    const out = [];
    for (const f of (fc.features || [fc])) {
      const g = f.geometry || f;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const pg of polys) {
        let x0 = 9, y0 = 9, x1 = -9, y1 = -9; const rings = [];
        for (const ring of pg) {
          const a = new Float32Array(ring.length * 2);
          // a ring that crosses the date line jumps 360 degrees; unwrap it so it stays one shape
          let off = 0, prev = ring[0][0];
          for (let i = 0; i < ring.length; i++) {
            const lo = ring[i][0];
            if (i) { const d = lo - prev; if (d > 180) off -= 360; else if (d < -180) off += 360; }
            prev = lo;
            const x = (lo + off + 180) / 360, y = mercY(ring[i][1]);
            a[2 * i] = x; a[2 * i + 1] = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          rings.push(a);
        }
        out.push({ box: [x0, y0, x1, y1], rings });
        // and a copy on the other side of the date line, so it shows from either direction.
        // Natural Earth also splits islands at 180 degrees, so pieces that touch the line are copied too.
        const shift = x1 > 1.001 || (x0 > .98) ? -1 : x0 < -.001 || x1 < .02 ? 1 : 0;
        if (shift) out.push({ box: [x0 + shift, y0, x1 + shift, y1], rings: rings.map(r => { const b = r.slice(); for (let i = 0; i < b.length; i += 2) b[i] += shift; return b; }) });
      }
    }
    return out;
  }
  // traces the rings in view onto a path. Points closer than a pixel to the last one are skipped, and so are runs of points
  // that stay off one side of the screen: a straight line between their ends stays off screen too, so the fill inside is unchanged.
  function traceRings(g, polys, tx, ty, KS, VW, VH) {
    const vx0 = -tx / KS, vx1 = (VW - tx) / KS, vy0 = -ty / KS, vy1 = (VH - ty) / KS;
    const M = 4, X0 = -M, X1 = VW + M, Y0 = -M, Y1 = VH + M;
    const code = (x, y) => (x < X0 ? 1 : x > X1 ? 2 : 0) | (y < Y0 ? 4 : y > Y1 ? 8 : 0);
    let n = 0;
    for (const p of polys) {
      const b = p.box; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      for (const a of p.rings) {
        let ex = tx + KS * a[0], ey = ty + KS * a[1], ec = code(ex, ey);
        g.moveTo(ex, ey);
        let px = 0, py = 0, pend = false, run = 0;
        for (let i = 2; i < a.length; i += 2) {
          const x = tx + KS * a[i], y = ty + KS * a[i + 1], c = code(x, y);
          if (pend) {
            if (run & c) { run &= c; px = x; py = y; continue; }      // still off the same side as the last point drawn
            g.lineTo(px, py); n++; ex = px; ey = py; ec = code(px, py); pend = false;
          }
          if (ec & c) { pend = true; run = ec & c; px = x; py = y; continue; }
          if (Math.abs(x - ex) + Math.abs(y - ey) < .7) continue;
          g.lineTo(x, y); ex = x; ey = y; ec = c; n++;
        }
        if (pend) { g.lineTo(px, py); n++; }
        g.closePath();
      }
    }
    return n;
  }
  // the whole world's land drawn once into a bitmap, for the wide views where tracing every coast would be slow
  function landBitmap(polys, W) {
    const top = mercY(84), bot = mercY(-72), H = Math.ceil((bot - top) * W);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.beginPath(); traceRings(g, polys, 0, -top * W, W, W, H);
    g.fillStyle = '#0e1015'; g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.11)'; g.lineWidth = .6; g.stroke();
    return { cv, W, top };
  }
  // calls fn whenever the screen's pixel density changes, for example when a window moves to a sharper display
  function watchDpr(fn) {
    const arm = () => { const mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); mq.addEventListener('change', () => { fn(); arm(); }, { once: true }); };
    arm();
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

  // ---------- sound: each flash is a soft struck note, pitched by the colour of the light ----------
  let ac = null, bus = null;
  const NOTE = { white: 587.33, red: 293.66, green: 440.0, yellow: 659.25, blue: 523.25, orange: 392.0, violet: 783.99, amber: 369.99 };
  function audio() {
    if (!ac) {
      const K = window.AudioContext || window.webkitAudioContext; if (!K) return null;
      ac = new K();
      bus = ac.createGain(); bus.gain.value = .7;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 6;
      const d1 = ac.createDelay(2), d2 = ac.createDelay(2); d1.delayTime.value = .37; d2.delayTime.value = .53;
      const fb = ac.createGain(); fb.gain.value = .32; const wet = ac.createGain(); wet.gain.value = .36;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      bus.connect(comp); comp.connect(ac.destination);
      bus.connect(d1); d1.connect(lp); lp.connect(d2); d2.connect(fb); fb.connect(d1); lp.connect(wet); d2.connect(wet); wet.connect(comp);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const live = () => !!ac && ac.state === 'running';
  function ping(colIdx, dur = .3, pan = 0, vel = .12, detune = 0) {
    tone((NOTE[COLORS[colIdx]] || 440) * Math.pow(2, detune / 1200), dur, pan, vel);
  }
  function tone(f, dur = .3, pan = 0, vel = .12) {
    if (!live()) return;
    const t = ac.currentTime, len = Math.min(2.6, .35 + dur * 1.4);
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
    o.type = 'sine'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.001;
    g2.gain.value = .12; o2.connect(g2); g2.connect(g); o.connect(g);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    let out = g;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    out.connect(bus);
    o.start(t); o2.start(t); o.stop(t + len + .05); o2.stop(t + len + .05);
  }

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  window.LX = {
    D, N, reduced, fmt, esc, plural,
    lat, lon, type, code, range, height, flags, name, major, system, heritage, fog,
    SN, sLight, sA, sB, sCol, sRange, sPat, sectorsOf,
    COLORS, COL_HEX, COL_NAME, PAT, CODE, phase, litPat, lit: litFast, isFixed,
    typeWord, nameOf, codeText, rhythmSvg, fogText, land, worldRings, traceRings, landBitmap, mercY, watchDpr, tip, audio, ping, tone, live, params, setParams, views: {},
  };
})();
