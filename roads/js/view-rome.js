/* All Roads: From Rome.
   Walking time spreads out from one place along every road. Each road is drawn as wide as the number of places whose fastest way
   back runs along it, so the network becomes a tree of routes, pale near the start and deep red far away. "Map in days" moves every
   place to its travel time from the start, in its own direction, so distance on screen becomes days on foot. */
(function () {
  'use strict';
  const X = window.RD, NN = X.NN, NS = X.NS;
  let el, cv, c, dpr = 1, VW = 0, VH = 0, S = 1, T = d3.zoomIdentity, zoom = null, ui = {};
  let built = false, visible = false, raf = 0, dirty = true, gesturing = false, moved = false;
  let lo = null, hi = null, hiLoad = false;
  let src = X.ROME, R = null, F = null, maxF = 1, TE = null, NT = null, BK = null;
  let t = 0, playing = false, lastNow = 0, speed = 30, wasPlayed = false;
  let warp = 0, warpOn = false, anim = null, WX = null, WY = null, WNX = null, WNY = null, MX = null, MY = null, MNX = null, MNY = null, kap = 1;
  let hover = -1, pin = -1, hoverRoute = null, pinRoute = null;
  let baseCv = null, baseKey = '', spark = null, labelBoxes = [];
  const WBIN = [.55, .8, 1.15, 1.6, 2.2, 3, 4, 5.3, 7, 9.2, 12], CB = 16;

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="r-stage">
        <canvas class="r-canvas" aria-label="Map of the Roman roads, with walking time spreading out from one place"></canvas>
        <div class="r-read">
          <div class="r-from">From <b class="r-src">Rome</b></div>
          <div class="r-day"><span class="r-dn">Day 0</span><span class="r-at"></span></div>
          <div class="r-count"></div>
          <div class="r-key">
            <div class="r-ramp"><i></i><span class="r-k0">Day 0</span><span class="r-k1"></span></div>
            <p>Each road is as wide as the number of places whose fastest way to <span class="r-src2">Rome</span> runs along it.</p>
          </div>
        </div>
        <div class="r-card" aria-live="polite"></div>
        <div class="r-dock">
          <button class="ctl r-play" data-c="play" aria-label="Play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <input class="r-scrub" type="range" min="0" max="300" step="0.1" value="0" aria-label="Days on foot">
          <button class="ctl" data-c="warp" aria-pressed="false">Map in days</button>
          <div class="r-search"><input class="r-input" type="text" placeholder="Start from any place" aria-label="Start from any place" autocomplete="off" spellcheck="false"><ul class="r-drop" role="listbox"></ul></div>
          <span class="r-sep"></span>
          <button class="ctl" data-c="in" aria-label="Zoom in">+</button>
          <button class="ctl" data-c="out" aria-label="Zoom out">&minus;</button>
        </div>
      </div>
      <div class="r-facts"></div>
      <p class="r-note">Walking times assume about ${X.fmt(X.flatKmDay)} km a day on level ground, slower on slopes: Tobler\u2019s hiking function on each road\u2019s average slope, six hours of walking a day. The two ferries in the data, across the Bosporus and the Hellespont, count as road. Nothing here goes by sea.</p>`;
    cv = el.querySelector('.r-canvas'); c = cv.getContext('2d');
    ui = {
      src: el.querySelector('.r-src'), src2: el.querySelector('.r-src2'), dn: el.querySelector('.r-dn'), at: el.querySelector('.r-at'), count: el.querySelector('.r-count'),
      k1: el.querySelector('.r-k1'), card: el.querySelector('.r-card'), dock: el.querySelector('.r-dock'), scrub: el.querySelector('.r-scrub'),
      play: el.querySelector('.r-play'), warp: el.querySelector('[data-c="warp"]'), facts: el.querySelector('.r-facts'), read: el.querySelector('.r-read'),
    };
    zoom = d3.zoom().scaleExtent([.6, 90])
      .filter(e => !anim && (!e.button || e.type === 'wheel') && !(e.type === 'dblclick'))
      .on('start', () => { gesturing = true; }).on('zoom', e => { T = e.transform; if (e.sourceEvent) moved = true; dirty = true; }).on('end', () => { gesturing = false; dirty = true; });
    d3.select(cv).call(zoom).on('dblclick.zoom', null);
    ui.dock.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const a = b.dataset.c;
      if (a === 'play') { if (playing) pause(); else play(); }
      if (a === 'warp') setWarp(!warpOn, true);
      if (a === 'in' || a === 'out') { moved = true; d3.select(cv).transition().duration(450).call(zoom.scaleBy, a === 'in' ? 2 : .5, [VW / 2, VH / 2]); }
    });
    ui.scrub.addEventListener('input', () => { pause(); t = +ui.scrub.value; wasPlayed = true; dirty = true; readout(); });
    X.placeBox(el.querySelector('.r-input'), el.querySelector('.r-drop'), n => setSource(n, true));
    ui.card.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'start') setSource(pin, true);
      if (b.dataset.a === 'close') { pin = -1; pinRoute = null; card(); dirty = true; }
      if (b.dataset.a === 'trip') { const a = src, z = pin; X.go('trip', false, { from: a, to: z }); }
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { hover = -1; hoverRoute = null; X.tip(null); dirty = true; });
    // a tap sends no pointermove first, so the click finds its own place
    cv.addEventListener('click', e => {
      if (anim) return;
      const n = pickAt(e.clientX, e.clientY);
      if (n < 0 || n === pin) { pin = -1; pinRoute = null; }
      else { pin = n; pinRoute = R.dist[n] < Infinity ? X.route(R, n) : null; }
      X.setParams({ to: pin >= 0 ? X.urlName(pin) : null });
      X.tip(null); card(); dirty = true;
    });
    document.addEventListener('keydown', e => {
      if (!visible || e.defaultPrevented || (e.target.closest && e.target.closest('input, textarea, select, .u-tabs'))) return;
      if (e.key === 'Escape') { pin = -1; pinRoute = null; card(); dirty = true; }
      if (e.key === ' ' && X.spaceFree(e)) { e.preventDefault(); if (playing) pause(); else play(); }
    });
    new ResizeObserver(() => { if (visible) resize(); }).observe(cv);
    X.watchDpr(() => { if (visible) resize(); });
    // a soft round glow, stamped at the tip of every road the walkers are on
    spark = document.createElement('canvas'); spark.width = spark.height = 32;
    { const g = spark.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,215,.95)'); gr.addColorStop(.25, 'rgba(255,190,120,.45)'); gr.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
    addEventListener('rd-land', () => { baseKey = ''; dirty = true; });
    const p = X.params();
    const s0 = X.lookup(p.get('from')); if (s0 >= 0) src = s0;
    compute();
    const p0 = X.lookup(p.get('to'));
    if (p0 >= 0) { pin = p0; pinRoute = R.dist[p0] < Infinity ? X.route(R, p0) : null; }
    if (p.get('days') === '1') { warpOn = true; warp = 1; ui.warp.setAttribute('aria-pressed', 'true'); }
    X.geometry('lo').then(g => {
      lo = g;
      // the first fit ran before the roads arrived; frame the map in days again now that it has every road
      if (warpOn) { warpVerts(); if (VW && !moved) d3.select(cv).call(zoom.transform, warpTransform()); }
      baseKey = ''; dirty = true;
      if (visible && !wasPlayed) start();
    });
    built = true;
  }

  // ---------- the routes out of the source ----------
  function compute() {
    R = X.paths(src); F = X.flows(R);
    maxF = 1; for (let s = 0; s < NS; s++) if (F[s] > maxF) maxF = F[s];
    // tree roads: every reached place's last road on its way in, drawn from the parent's end
    const te = [];
    for (let k = 0; k < R.n; k++) {
      const v = R.order[k], s = R.prev[v]; if (s < 0) continue;
      const u = X.other(s, v);
      const w = .55 + 11.5 * Math.sqrt(F[s] / maxF);
      let wb = 0; for (let i = 1; i < WBIN.length; i++) if (Math.abs(WBIN[i] - w) < Math.abs(WBIN[wb] - w)) wb = i;
      te.push({ s, u, v, t0: R.dist[u], t1: R.dist[v], rev: X.SU[s] !== u, wb, cb: Math.min(CB - 1, Math.floor(R.dist[v] / R.max * CB)) });
    }
    te.sort((a, b) => a.t0 - b.t0);
    TE = te;
    // buckets by width and colour, each in the order the walkers reach them, so a frame can stop early
    BK = [];
    for (const e of te) { const k = e.wb * CB + e.cb; (BK[k] || (BK[k] = [])).push(e); }
    // the other roads, which no fastest route uses: they fill in from both ends
    const inTree = new Uint8Array(NS); for (const e of te) inTree[e.s] = 1;
    NT = [];
    for (let s = 0; s < NS; s++) {
      if (inTree[s]) continue;
      const du = R.dist[X.SU[s]], dv = R.dist[X.SV[s]]; if (!(du < Infinity) || !(dv < Infinity)) continue;
      NT.push({ s, du, dv, d: X.segDays[s], t0: Math.min(du, dv) });
    }
    NT.sort((a, b) => a.t0 - b.t0);
    speed = Math.max(8, R.max / 11.5);
    ui.scrub.max = String(Math.ceil(R.max * 10) / 10);
    const nm = X.nameOf(src) || X.describe(src);
    ui.src.textContent = nm; ui.src2.textContent = nm;
    ui.k1.textContent = `Day ${X.fmt(R.max)}`;
    warpNodes();
    if (lo && warpOn) warpVerts();
    facts();
  }
  function setSource(n, animate) {
    if (n < 0) return;
    src = n; pin = -1; pinRoute = null; hover = -1; hoverRoute = null;
    compute(); card();
    X.setParams({ from: src === X.ROME ? null : X.urlName(src), to: null });
    if (animate && !X.reduced) { t = 0; play(); } else { t = R.max; readout(); }
    if (warpOn) fitView(true, 1);
    dirty = true;
  }

  // ---------- map in days ----------
  // every place moved to its travel time from the start, in its own direction. The places need only the routes;
  // the points along every road need the road shapes too, so they wait for the geometry.
  function warpNodes() {
    const cx = X.PX[src], cy = X.PY[src];
    kap = .5 / Math.max(1, R.max);
    WNX = new Float32Array(NN); WNY = new Float32Array(NN); MNX = new Float32Array(NN); MNY = new Float32Array(NN);
    for (let n = 0; n < NN; n++) {
      const d = R.dist[n];
      if (!(d < Infinity)) { WNX[n] = NaN; WNY[n] = NaN; continue; }
      const dx = X.PX[n] - cx, dy = X.PY[n] - cy, L = Math.hypot(dx, dy), r = d * kap;
      WNX[n] = cx + (L > 1e-9 ? dx / L * r : 0); WNY[n] = cy + (L > 1e-9 ? dy / L * r : 0);
    }
  }
  function warpVerts() {
    const cx = X.PX[src], cy = X.PY[src], g = lo;
    WX = new Float32Array(g.n); WY = new Float32Array(g.n); MX = new Float32Array(g.n); MY = new Float32Array(g.n);
    for (let s = 0; s < NS; s++) {
      const du = R.dist[X.SU[s]], dv = R.dist[X.SV[s]], d = X.segDays[s];
      for (let j = g.off[s]; j < g.off[s + 1]; j++) {
        const f = g.frac[j], tt = Math.min(du + f * d, dv + (1 - f) * d);
        if (!(tt < Infinity)) { WX[j] = NaN; WY[j] = NaN; continue; }
        const dx = g.x[j] - cx, dy = g.y[j] - cy, L = Math.hypot(dx, dy), r = tt * kap;
        WX[j] = cx + (L > 1e-9 ? dx / L * r : 0); WY[j] = cy + (L > 1e-9 ? dy / L * r : 0);
      }
    }
  }
  function setWarp(on, animate) {
    if (!lo) return;
    warpOn = on; ui.warp.setAttribute('aria-pressed', String(on));
    X.setParams({ days: on ? '1' : null });
    if (on) warpVerts();
    fitView(animate, on ? 1 : 0);
  }
  // fits the whole reachable layout, then tweens the view and the warp together
  function fitView(animate, target) {
    const tr = target ? warpTransform() : geoTransform();
    if (!animate || X.reduced || !VW) { warp = target; d3.select(cv).call(zoom.transform, tr); dirty = true; return; }
    const t0 = T, w0 = warp, at = performance.now(), dur = 1300;
    const ix = d3.interpolate(t0.x, tr.x), iy = d3.interpolate(t0.y, tr.y), ik = d3.interpolate(t0.k, tr.k);
    anim = now => {
      const p = Math.min(1, (now - at) / dur), e = d3.easeCubicInOut(p);
      warp = w0 + (target - w0) * e;
      d3.select(cv).call(zoom.transform, d3.zoomIdentity.translate(ix(e), iy(e)).scale(ik(e)));
      if (p >= 1) { anim = null; warp = target; }
      dirty = true;
    };
    moved = false;
  }
  function frameBox(x0, y0, x1, y1) {
    const small = VW < 760;
    const dock = small ? 0 : (ui.dock.getBoundingClientRect().height || 60) + 24;
    const top = small ? 12 : 24, left = small ? 10 : Math.min(290, VW * .22), right = small ? 10 : 24;
    const aw = VW - left - right, ah = VH - dock - top - (small ? 12 : 8);
    const k = Math.min(aw / ((x1 - x0) * S), ah / ((y1 - y0) * S));
    return d3.zoomIdentity.translate(left + aw / 2 - k * S * (x0 + x1) / 2, top + ah / 2 - k * S * (y0 + y1) / 2).scale(k);
  }
  const geoTransform = () => frameBox(0, 0, 1, X.UH);
  function warpTransform() {
    const cx = X.PX[src], cy = X.PY[src], r = R.max * kap * 1.04;
    return frameBox(cx - r, cy - r, cx + r, cy + r);
  }

  // ---------- playback ----------
  function play() { if (t >= R.max - 1e-6) t = 0; playing = true; wasPlayed = true; lastNow = performance.now(); ui.play.setAttribute('aria-label', 'Pause'); ui.play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'; dirty = true; }
  function pause() { playing = false; ui.play.setAttribute('aria-label', 'Play'); ui.play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; }
  function start() {
    if (X.reduced) { t = R.max; readout(); dirty = true; return; }
    t = 0; play();
  }

  // ---------- pointer ----------
  function toUnitXY(cx, cy) { const r = cv.getBoundingClientRect(); return [((cx - r.left) - T.x) / (T.k * S), ((cy - r.top) - T.y) / (T.k * S)]; }
  function pickAt(cx, cy) {
    const [ux, uy] = toUnitXY(cx, cy), tol = 14 / (T.k * S);
    if (warp > 0) {
      const nx = warp >= 1 ? WNX : MNX, ny = warp >= 1 ? WNY : MNY;
      if (!nx) return -1;
      return X.nearestNode(ux, uy, tol, n => nx[n] === nx[n], nx, ny);
    }
    // named places win over bare forks nearby
    const named = X.nearestNode(ux, uy, tol, n => X.nameOf(n) != null);
    return named >= 0 ? named : X.nearestNode(ux, uy, tol * .6);
  }
  function onMove(e) {
    if (gesturing || anim || e.pointerType === 'touch') return;
    const n = pickAt(e.clientX, e.clientY);
    if (n !== hover) { hover = n; hoverRoute = n >= 0 && R.dist[n] < Infinity ? X.route(R, n) : null; dirty = true; }
    if (n < 0) { X.tip(null); cv.style.cursor = ''; return; }
    cv.style.cursor = 'pointer';
    X.tip(tipHtml(n), e.clientX, e.clientY);
  }
  function tipHtml(n) {
    const nm = X.describe(n), from = X.nameOf(src) || 'here';
    if (n === src) return `<b>${X.esc(nm)}</b><small>Every route on the map starts here.</small>`;
    if (!(R.dist[n] < Infinity)) return `<b>${X.esc(nm)}</b><small>No road from ${X.esc(from)} reaches it. The roads stop at the sea.</small>`;
    const rt = hoverRoute && hoverRoute.nodes[hoverRoute.nodes.length - 1] === n ? hoverRoute : X.route(R, n);
    return `<b>${X.esc(nm)}</b><small>${X.daysText(R.dist[n])} on foot from ${X.esc(from)}, ${X.fmt(rt.km)} km of road</small>`;
  }
  const STRAIT = { 'Byzantium ferry': 'the Bosporus', 'Abydos ferry': 'the Hellespont' };
  function card() {
    if (pin < 0) { ui.card.classList.remove('on'); ui.card.innerHTML = ''; return; }
    const nm = X.describe(pin), from = X.nameOf(src) || X.describe(src);
    const crow = X.hav(X.nlon[src], X.nlat[src], X.nlon[pin], X.nlat[pin]);
    let body;
    if (pin === src) body = `<p>Every route on the map starts here.</p>`;
    else if (!pinRoute) body = `<p>No road from ${X.esc(from)} reaches it. The roads stop at the sea.</p>`;
    else {
      const via = X.waypoints(pinRoute.nodes, 3).map(n => X.nameOf(n));
      const fer = [...new Set(pinRoute.segs.filter(X.isFerry).map(s => STRAIT[X.segName(s)] || 'a strait'))];
      body = `<p class="r-big">${X.daysText(pinRoute.days)}</p>
        <p>on foot from ${X.esc(from)}, ${X.fmt(pinRoute.km)} km of road${crow > 30 ? `, for a place ${X.fmt(crow)} km away as the crow flies` : ''}.</p>
        ${via.length ? `<p>By way of ${X.esc(X.listWords(via))}.</p>` : ''}
        ${fer.length ? `<p>With a ferry across ${X.esc(X.listWords(fer))}.</p>` : ''}`;
    }
    ui.card.innerHTML = `<button class="r-x" data-a="close" aria-label="Close">&times;</button><b class="r-cn">${X.esc(nm)}</b>${body}
      <div class="r-acts">${pin !== src ? `<button class="chip-btn" data-a="start">Start from here</button>` : ''}${pinRoute && pin !== src ? `<button class="chip-btn" data-a="trip">Walk this route</button>` : ''}</div>`;
    ui.card.classList.add('on');
  }

  // ---------- the facts under the map, worked out for whichever place is the start ----------
  const ISLES = [['Britain', -9, 49.8, 2.2, 61], ['Sicily', 12.2, 36.5, 15.8, 38.4], ['Sardinia', 8, 38.8, 9.95, 41.3], ['Corsica', 8.4, 41.3, 9.7, 43.1],
    ['Crete', 23.4, 34.8, 26.4, 35.8], ['Cyprus', 32, 34.5, 34.7, 35.8], ['Euboea', 22.8, 37.9, 24.7, 39.1]];
  function isleOf(cid) {
    for (let n = 0; n < NN; n++) if (X.comp[n] === cid) {
      for (const [nm, a, b, c2, d] of ISLES) if (X.nlon[n] >= a && X.nlon[n] <= c2 && X.nlat[n] >= b && X.nlat[n] <= d) return nm;
      return null;
    }
    return null;
  }
  function facts() {
    const from = X.nameOf(src) || X.describe(src), out = [];
    const far = R.far;
    if (far !== src) out.push(`<div class="r-fact"><b>${X.esc(X.nameOf(far) || X.describe(far))}</b><span>is the farthest you can walk from ${X.esc(from)}: ${X.daysText(R.max)} on foot.</span></div>`);
    // the famous place with the longest way round, for how close it is
    let best = null;
    for (const f of X.FAMOUS) {
      if (f.n === src || !(R.dist[f.n] < Infinity)) continue;
      const crow = X.hav(X.nlon[src], X.nlat[src], X.nlon[f.n], X.nlat[f.n]); if (crow < 250) continue;
      const ratio = R.dist[f.n] * X.flatKmDay / crow;
      if (!best || ratio > best.ratio) best = { n: f.n, crow, ratio };
    }
    if (best && best.ratio > 2.2) {
      const rt = X.route(R, best.n), via = X.waypoints(rt.nodes, 3).map(n => X.nameOf(n));
      out.push(`<div class="r-fact"><b>${X.esc(X.nameOf(best.n))}</b><span>is ${X.fmt(Math.round(best.crow / 10) * 10)} km from ${X.esc(from)} as the crow flies, and ${X.daysText(R.dist[best.n])} on foot${via.length ? `, by way of ${X.esc(X.listWords(via))}` : ''}.</span></div>`);
    }
    // half the places within
    const ds = []; for (let k = 0; k < R.n; k++) ds.push(R.dist[R.order[k]]);
    const half = ds[Math.floor(ds.length / 2)] || 0;
    out.push(`<div class="r-fact"><b>${X.daysText(half)}</b><span>on foot from ${X.esc(from)} reach half of the ${X.fmt(R.n)} towns and forks its roads connect to.</span></div>`);
    // what the roads cannot reach
    const mine = X.comp[src], cut = [];
    for (let cid = 0; cid < X.compSize.length; cid++) if (cid !== mine && X.compSize[cid] >= 20) { const nm = isleOf(cid); if (nm) cut.push(nm); }
    const home = isleOf(mine);
    if (home) out.push(`<div class="r-fact"><b>${X.esc(home)}</b><span>is as far as the roads go from ${X.esc(from)}. Everything else is across the water.</span></div>`);
    else if (cut.length) out.push(`<div class="r-fact"><b>${X.esc(cut.includes('Britain') ? 'Britain' : cut[0])}</b><span>and the islands can\u2019t be reached on foot from ${X.esc(from)}. The roads stop at the sea.</span></div>`);
    ui.facts.innerHTML = out.join('');
  }

  // ---------- drawing ----------
  function resize() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const oW = VW, oH = VH;
    dpr = Math.min(2, devicePixelRatio || 1);
    VW = Math.round(r.width); VH = Math.round(r.height);
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    const first = S === 1;
    S = VW;
    if (first || !moved) d3.select(cv).call(zoom.transform, warp >= 1 ? warpTransform() : geoTransform());
    else if (oW && (oW !== VW || oH !== VH)) d3.select(cv).call(zoom.transform, X.recenter(T, oW, oH, VW, VH));
    baseKey = ''; dirty = true;
  }
  const wpx = wb => WBIN[wb] * Math.min(2.2, 1 + .28 * Math.log2(Math.max(1, T.k)));
  function arraysFor(G) {
    if (warp <= 0 || G !== lo || !WX) return [G.x, G.y];
    if (warp >= 1) return [WX, WY];
    return [MX, MY];
  }
  function mixWarp() {
    if (!(warp > 0 && warp < 1) || !WX) return;
    const g = lo, a = 1 - warp, b = warp;
    // roads that no one can walk to fold away as the map turns into days
    for (let j = 0; j < g.n; j++) { const wx = WX[j]; if (wx === wx) { MX[j] = g.x[j] * a + wx * b; MY[j] = g.y[j] * a + WY[j] * b; } else { MX[j] = NaN; MY[j] = NaN; } }
    for (let n = 0; n < NN; n++) { const wx = WNX[n]; if (wx === wx) { MNX[n] = X.PX[n] * a + wx * b; MNY[n] = X.PY[n] * a + WNY[n] * b; } else { MNX[n] = NaN; MNY[n] = NaN; } }
  }
  function nodeXY(n) {
    if (warp <= 0) return [X.PX[n], X.PY[n]];
    if (warp >= 1) return [WNX[n], WNY[n]];
    return [MNX[n], MNY[n]];
  }
  function drawBase(G) {
    const L = X.landAt(T.k);
    const key = `${T.k}|${T.x}|${T.y}|${VW}|${VH}|${L ? L.length : 0}|${G === hi}`;
    if (key === baseKey && baseCv) return;
    if (!baseCv) baseCv = document.createElement('canvas');
    baseCv.width = cv.width; baseCv.height = cv.height;
    const g = baseCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const K = T.k * S;
    if (L) { g.beginPath(); X.traceLand(g, L, T.x, T.y, K, VW, VH); g.fillStyle = '#0c0d0f'; g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = .6; g.stroke(); }
    const vx0 = -T.x / K, vx1 = (VW - T.x) / K, vy0 = -T.y / K, vy1 = (VH - T.y) / K;
    g.beginPath();
    for (let s = 0; s < NS; s++) if (X.inView(G, s, vx0, vy0, vx1, vy1)) X.trace(g, G, s, T.x, T.y, K);
    g.strokeStyle = 'rgba(255,255,255,.085)'; g.lineWidth = .6; g.stroke();
    baseKey = key;
  }
  function render() {
    const G = T.k > 7 && hi && warp <= 0 ? hi : lo;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH);
    if (!G) return;
    const K = T.k * S, tx = T.x, ty = T.y;
    if (warp < 1) {
      drawBase(G);
      c.globalAlpha = 1 - warp; c.drawImage(baseCv, 0, 0, VW, VH); c.globalAlpha = 1;
    }
    mixWarp();
    const [AX, AY] = arraysFor(G);
    if (warp > 0) rings(K, tx, ty);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const vx0 = -tx / K, vx1 = (VW - tx) / K, vy0 = -ty / K, vy1 = (VH - ty) / K;
    const culled = warp <= 0;
    // roads no fastest route uses, filling in from both ends
    c.beginPath();
    for (const e of NT) {
      if (e.t0 > t) break;
      if (culled && !X.inView(G, e.s, vx0, vy0, vx1, vy1)) continue;
      const a = Math.max(0, Math.min(1, (t - e.du) / e.d)), b = Math.max(0, Math.min(1, (t - e.dv) / e.d));
      if (a + b >= 1) X.trace(c, G, e.s, tx, ty, K, AX, AY);
      else { if (a > 0) X.tracePart(c, G, e.s, tx, ty, K, false, a, AX, AY); if (b > 0) X.tracePart(c, G, e.s, tx, ty, K, true, b, AX, AY); }
    }
    c.strokeStyle = 'rgba(255,226,196,.2)'; c.lineWidth = .6; c.stroke();
    // the tree, thin and far first so the trunks sit on top
    const tips = [];
    for (let wb = 0; wb < WBIN.length; wb++) {
      const lw = wpx(wb);
      for (let cb = CB - 1; cb >= 0; cb--) {
        const B = BK[wb * CB + cb]; if (!B) continue;
        c.beginPath(); let any = false;
        for (const e of B) {
          if (e.t0 > t) break;
          if (culled && !X.inView(G, e.s, vx0 - .01, vy0 - .01, vx1 + .01, vy1 + .01)) continue;
          any = true;
          if (e.t1 <= t) X.trace(c, G, e.s, tx, ty, K, AX, AY);
          else { const f = e.t1 > e.t0 ? (t - e.t0) / (e.t1 - e.t0) : 1; const p = X.tracePart(c, G, e.s, tx, ty, K, e.rev, f, AX, AY); tips.push(p); }
        }
        if (any) { c.strokeStyle = X.rgb(X.ramp((cb + .5) / CB)); c.lineWidth = lw; c.stroke(); }
      }
    }
    // the walkers, at the tip of every road still being walked
    if (tips.length && t < R.max) {
      c.globalCompositeOperation = 'lighter';
      const sz = 12 + Math.min(10, T.k * 1.5);
      for (const [ux, uy] of tips) { const x = tx + K * ux, y = ty + K * uy; if (x > -20 && y > -20 && x < VW + 20 && y < VH + 20) c.drawImage(spark, x - sz / 2, y - sz / 2, sz, sz); }
      c.globalCompositeOperation = 'source-over';
    }
    const hr = pinRoute || hoverRoute;
    if (pinRoute) drawRoute(pinRoute, G, K, tx, ty, AX, AY, 1);
    if (hoverRoute && hoverRoute !== pinRoute) drawRoute(hoverRoute, G, K, tx, ty, AX, AY, pinRoute ? .55 : 1);
    labels(K, tx, ty, hr);
  }
  function drawRoute(rt, G, K, tx, ty, AX, AY, alpha) {
    c.beginPath();
    for (const s of rt.segs) X.trace(c, G, s, tx, ty, K, AX, AY);
    c.strokeStyle = `rgba(0,0,0,${.6 * alpha})`; c.lineWidth = 5.5; c.stroke();
    c.strokeStyle = `rgba(255,255,255,${alpha})`; c.lineWidth = 2.2; c.stroke();
    const n = rt.nodes[rt.nodes.length - 1], [ux, uy] = nodeXY(n);
    c.beginPath(); c.arc(tx + K * ux, ty + K * uy, 4.5, 0, 7); c.fillStyle = '#fff'; c.fill();
  }
  function rings(K, tx, ty) {
    const cx = tx + K * X.PX[src], cy = ty + K * X.PY[src];
    const steps = [5, 10, 15, 20, 30, 50, 60, 100];
    let step = steps[steps.length - 1]; for (const s of steps) if (R.max / s <= 7) { step = s; break; }
    c.save(); c.globalAlpha = Math.min(1, warp * 1.4);
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1; c.fillStyle = 'rgba(255,255,255,.42)'; c.font = '500 11px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'center';
    for (let d = step; d <= R.max + step * .2; d += step) {
      const r = d * kap * K * warp + (1 - warp) * 0;
      if (r < 18) continue;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      c.fillText(`${d} days`, cx, cy - r - 5);
    }
    c.restore();
  }
  function labels(K, tx, ty, hr) {
    const boxes = [];
    c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
    const put = (n, main, sub, force) => {
      const [ux, uy] = nodeXY(n); if (!(ux === ux)) return;
      const x = tx + K * ux, y = ty + K * uy;
      if (x < -40 || y < -20 || x > VW + 40 || y > VH + 20) return;
      c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif';
      const w1 = c.measureText(main).width; c.font = '500 11px "Schibsted Grotesk", system-ui, sans-serif';
      const w2 = sub ? c.measureText(sub).width + 5 : 0, w = w1 + w2;
      const right = x + 7 + w < VW - 6;
      const bx = right ? x + 6 : x - 6 - w, box = [bx - 2, y - 8, bx + w + 2, y + 8];
      if (!force && boxes.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) return;
      boxes.push(box);
      c.beginPath(); c.arc(x, y, force ? 3.2 : 2.2, 0, 7); c.fillStyle = '#fff'; c.fill();
      c.textAlign = 'left';
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)';
      c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; c.strokeText(main, bx, y); c.fillStyle = '#fff'; c.fillText(main, bx, y);
      if (sub) { c.font = '500 11px "Schibsted Grotesk", system-ui, sans-serif'; c.strokeText(sub, bx + w1 + 5, y); c.fillStyle = 'rgba(255,214,170,.9)'; c.fillText(sub, bx + w1 + 5, y); }
    };
    // the start first, then any route's end, then the famous places the walkers have reached
    put(src, X.nameOf(src) || 'Start', '', true);
    if (hr) { const n = hr.nodes[hr.nodes.length - 1]; put(n, X.describe(n).replace(/^A fork on the road from .*/, 'A fork'), X.fmt(hr.days), true); }
    const cap = VW < 640 ? 9 : 22 + Math.round(Math.log2(Math.max(1, T.k)) * 8);
    let shown = 0;
    for (const f of X.FAMOUS) {
      if (shown >= cap) break;
      if (f.n === src || !(R.dist[f.n] <= t)) continue;
      const before = boxes.length;
      put(f.n, f.label, X.fmt(R.dist[f.n]), false);
      if (boxes.length > before) shown++;
    }
    labelBoxes = boxes;
  }
  function readout() {
    ui.dn.textContent = `Day ${X.fmt(Math.min(t, R.max))}`;
    let last = null;
    for (const f of X.FAMOUS) if (f.n !== src && R.dist[f.n] <= t && (!last || R.dist[f.n] > R.dist[last.n])) last = f;
    ui.at.textContent = last && t < R.max ? last.t : '';
    let reached = 0; for (let k = 0; k < R.n; k++) { if (R.dist[R.order[k]] <= t) reached++; else break; }
    ui.count.textContent = `${X.fmt(reached)} of ${X.fmt(R.n)} places and forks reached`;
    ui.scrub.value = String(Math.min(t, R.max));
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    if (anim) anim(now);
    if (playing) {
      const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
      t += dt * speed;
      if (t >= R.max) { t = R.max; pause(); }
      readout(); dirty = true;
    }
    if (T.k > 7 && !hi && !hiLoad && warp <= 0) { hiLoad = true; X.geometry('hi').then(g => { hi = g; baseKey = ''; dirty = true; }); }
    if (!dirty) return;
    dirty = false;
    render();
  }

  function show() {
    visible = true;
    if (!VW) resize();
    if (lo && !wasPlayed) start();
    readout(); card();
    if (!raf) raf = requestAnimationFrame(loop);
    dirty = true;
  }
  function hide() { visible = false; pause(); X.tip(null); }
  X.views.rome = { init, show, hide, state: () => ({ built, src, t, max: R && R.max, warp, pin, playing, far: R && R.far, n: R && R.n, lo: !!lo, hi: !!hi }), setSource, setWarp, seek: d => { pause(); t = Math.max(0, Math.min(R.max, d)); readout(); dirty = true; },
    camera: tr => { moved = true; d3.select(cv).call(zoom.transform, tr); },
    sync: () => X.setParams({ from: src === X.ROME ? null : X.urlName(src), to: pin >= 0 ? X.urlName(pin) : null, days: warpOn ? '1' : null }) };
})();
