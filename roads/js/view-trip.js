/* All Roads: A Journey.
   The fastest walking route between any two places, drawn with a mark at the end of every day on foot, a walker who goes the
   whole way, and a strip below the map that shows the slope, the certainty of every stretch and where each day ends. */
(function () {
  'use strict';
  const X = window.RD, NS = X.NS;
  const MILE = 1.4786;   // km in a Roman mile, a thousand paces
  let el, cv, c, dpr = 1, VW = 0, VH = 0, S = 1, T = d3.zoomIdentity, zoom = null, ui = {};
  let built = false, visible = false, raf = 0, dirty = true, moved = false, gesturing = false;
  let lo = null, hi = null, hiLoad = false, baseCv = null, baseKey = '';
  let from = -1, to = -1, R = null, rt = null, cum = null, cumKm = null, revs = null, nights = [], stops = [];
  let walk = 0, walking = false, lastNow = 0, walkDur = 8, hoverAt = -1, pathCache = null;
  const PRESETS = [
    ['Rome', 'Brundisium', 'Rome to Brundisium', 'The road to the harbor for Greece.'],
    ['Burdigala', 'Jerusalem', 'Bordeaux to Jerusalem', 'A pilgrim made this trip in 333 CE and listed every stop.'],
    ['Londinium', 'Eburacum', 'London to York', 'North from Londinium to the legion at Eburacum.'],
    ['Gades', 'Rome', 'Cádiz to Rome', 'From the far west of the empire to its capital.'],
    ['Tingi', 'Gades', 'Across the strait', 'Tingi and Gades face each other across the Strait of Gibraltar.'],
    ['Coptos', 'Berenike', 'The Red Sea road', 'Across the desert from the Nile to the port of Berenike.'],
    ['Antioch', 'Alexandria', 'Antioch to Alexandria', 'Between two of the great cities of the East.'],
  ];

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="t-bar">
        <div class="t-pick">
          <label class="t-f"><span class="lbl">From</span><div class="p-search"><input class="p-input" data-w="from" type="text" autocomplete="off" spellcheck="false" aria-label="Walk from"><ul class="p-drop" role="listbox"></ul></div></label>
          <button class="ctl t-swap" aria-label="Swap the two places" title="Swap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg></button>
          <label class="t-f"><span class="lbl">To</span><div class="p-search"><input class="p-input" data-w="to" type="text" autocomplete="off" spellcheck="false" aria-label="Walk to"><ul class="p-drop" role="listbox"></ul></div></label>
        </div>
        <div class="t-presets">${PRESETS.map(([a, b, label, why], i) => `<button class="chip-btn" data-p="${i}" title="${X.esc(why)}">${X.esc(label)}</button>`).join('')}</div>
      </div>
      <div class="t-wrap">
        <div class="t-main">
          <div class="t-stage">
            <canvas class="t-canvas" aria-label="Map of the route"></canvas>
            <div class="t-hud"><span class="t-day">Day 0</span><span class="t-here"></span></div>
            <div class="t-ctl"><button class="ctl t-go" aria-label="Walk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Walk it</span></button><span class="t-hint">Click the map to go somewhere else.</span></div>
          </div>
          <div class="t-prof"></div>
        </div>
        <aside class="t-side"></aside>
      </div>`;
    cv = el.querySelector('.t-canvas'); c = cv.getContext('2d');
    ui = { side: el.querySelector('.t-side'), prof: el.querySelector('.t-prof'), day: el.querySelector('.t-day'), here: el.querySelector('.t-here'), go: el.querySelector('.t-go'),
      from: el.querySelector('[data-w="from"]'), to: el.querySelector('[data-w="to"]') };
    zoom = d3.zoom().scaleExtent([.7, 150]).on('start', () => { gesturing = true; }).on('zoom', e => { T = e.transform; if (e.sourceEvent) moved = true; dirty = true; }).on('end', () => { gesturing = false; dirty = true; });
    d3.select(cv).call(zoom).on('dblclick.zoom', null);
    X.placeBox(ui.from, ui.from.nextElementSibling, n => set(n, to, true));
    X.placeBox(ui.to, ui.to.nextElementSibling, n => set(from, n, true));
    el.querySelector('.t-swap').addEventListener('click', () => set(to, from, true));
    el.querySelector('.t-presets').addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      const [a, z] = PRESETS[+b.dataset.p];
      set(X.lookup(a), X.lookup(z), true, true);
    });
    ui.go.addEventListener('click', () => { if (walking) stop(); else startWalk(); });
    cv.addEventListener('click', e => {
      const [ux, uy] = toUnitXY(e.clientX, e.clientY);
      const n = X.nearestNode(ux, uy, 16 / (T.k * S), m => X.nameOf(m) != null);
      if (n >= 0 && n !== from) set(from, n, true);
    });
    cv.addEventListener('pointermove', e => {
      if (gesturing || e.pointerType === 'touch') return;
      const [ux, uy] = toUnitXY(e.clientX, e.clientY);
      const n = X.nearestNode(ux, uy, 12 / (T.k * S), m => X.nameOf(m) != null);
      cv.style.cursor = n >= 0 ? 'pointer' : '';
      X.tip(n >= 0 ? `<b>${X.esc(X.nameOf(n))}</b><small>${n === from ? 'You start here.' : n === to ? 'You end here.' : 'Click to walk here instead.'}</small>` : null, e.clientX, e.clientY);
    });
    cv.addEventListener('pointerleave', () => X.tip(null));
    ui.side.addEventListener('click', e => { const li = e.target.closest('[data-d]'); if (li) { stop(); walk = Math.min(rt.days, +li.dataset.d); update(); } });
    document.addEventListener('keydown', e => {
      if (!visible || e.defaultPrevented || (e.target.closest && e.target.closest('input, textarea, select, .u-tabs'))) return;
      if (e.key === ' ' && X.spaceFree(e)) { e.preventDefault(); if (walking) stop(); else startWalk(); }
    });
    new ResizeObserver(() => { if (visible) resize(); }).observe(cv);
    X.watchDpr(() => { if (visible) resize(); });
    addEventListener('rd-land', () => { baseKey = ''; dirty = true; });
    X.geometry('lo').then(g => { lo = g; baseKey = ''; pathCache = null; dirty = true; });
    const p = X.params();
    const a = X.lookup(p.get('from')), z = X.lookup(p.get('to'));
    set(a >= 0 ? a : X.lookup('Rome'), z >= 0 ? z : X.lookup('Brundisium'), false, true);
    built = true;
  }

  // ---------- the route ----------
  function set(a, z, animate, url) {
    if (a < 0 || z < 0) return;
    stop();
    from = a; to = z;
    ui.from.placeholder = X.nameOf(from) || X.describe(from);
    ui.to.placeholder = X.nameOf(to) || X.describe(to);
    el.querySelectorAll('[data-p]').forEach(b => { const [pa, pz] = PRESETS[+b.dataset.p]; b.setAttribute('aria-pressed', String(X.lookup(pa) === from && X.lookup(pz) === to)); });
    R = X.paths(from);
    rt = from === to ? null : X.route(R, to);
    walk = 0; pathCache = null;
    if (rt) {
      const n = rt.segs.length;
      cum = new Float64Array(n + 1); cumKm = new Float64Array(n + 1); revs = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const s = rt.segs[i];
        cum[i + 1] = cum[i] + X.segDays[s]; cumKm[i + 1] = cumKm[i] + X.segKm(s);
        revs[i] = X.SU[s] !== rt.nodes[i] ? 1 : 0;
      }
      // where each day's walking ends, and the place to sleep: the last named place passed that day
      nights = []; stops = [];
      const total = rt.days;
      let lastNamed = from, k = 0;
      for (let d = 1; d < total; d++) {
        while (k < n && cum[k + 1] <= d) { k++; if (X.nameOf(rt.nodes[k])) lastNamed = rt.nodes[k]; }
        nights.push({ d, i: k, f: X.segDays[rt.segs[k]] > 0 ? (d - cum[k]) / X.segDays[rt.segs[k]] : 0, km: cumKm[k] + (d - cum[k]) / Math.max(1e-9, X.segDays[rt.segs[k]]) * X.segKm(rt.segs[k]), near: lastNamed, seg: rt.segs[k] });
      }
      stops = nights;
      walkDur = Math.max(4, Math.min(16, 3 + total * .05));
    }
    X.setParams({ from: X.urlName(from), to: X.urlName(to) });
    side(); profile();
    if (VW) frame(animate);
    dirty = true;
  }
  function frame(animate) {
    const tr = rt ? routeTransform() : fitNodes([from, to]);
    moved = false;
    if (animate && !X.reduced) d3.select(cv).transition().duration(1100).ease(d3.easeCubicInOut).call(zoom.transform, tr);
    else d3.select(cv).call(zoom.transform, tr);
  }
  function routeTransform() {
    const G = lo;
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    if (G) for (const s of rt.segs) { const b = G.box; add(b[4 * s], b[4 * s + 1]); add(b[4 * s + 2], b[4 * s + 3]); }
    else for (const n of rt.nodes) add(X.PX[n], X.PY[n]);
    return fitBox(x0, y0, x1, y1);
  }
  function fitNodes(ns) {
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    for (const n of ns) { x0 = Math.min(x0, X.PX[n]); x1 = Math.max(x1, X.PX[n]); y0 = Math.min(y0, X.PY[n]); y1 = Math.max(y1, X.PY[n]); }
    const pad = .05; return fitBox(x0 - pad, y0 - pad, x1 + pad, y1 + pad);
  }
  function fitBox(x0, y0, x1, y1) {
    const w = Math.max(.012, x1 - x0), h = Math.max(.012, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const padT = 58, padB = 64, padX = 36;
    const k = Math.min((VW - 2 * padX) / (w * S), (VH - padT - padB) / (h * S));
    return d3.zoomIdentity.translate(VW / 2 - k * S * cx, padT + (VH - padT - padB) / 2 - k * S * cy).scale(Math.max(.7, Math.min(150, k)));
  }

  // ---------- the panel beside the map ----------
  function side() {
    const a = X.nameOf(from) || X.describe(from), z = X.nameOf(to) || X.describe(to);
    if (from === to) { ui.side.innerHTML = `<p class="t-lede">Pick two different places.</p>`; return; }
    if (!rt) {
      ui.side.innerHTML = `<p class="t-lede">No road joins ${X.esc(a)} and ${X.esc(z)}.</p><p class="t-sub">The roads stop at the sea. Britain and the islands have roads of their own that never meet the rest.</p>`;
      return;
    }
    const crow = X.hav(X.nlon[from], X.nlat[from], X.nlon[to], X.nlat[to]);
    const ck = [0, 0, 0]; let steep = -1;
    for (const s of rt.segs) { ck[X.certOf(s)] += X.segKm(s); if (X.segKm(s) > 3 && (steep < 0 || X.segSlope(s) > X.segSlope(steep))) steep = s; }
    const via = X.waypoints(rt.nodes, 4).map(n => X.nameOf(n));
    const STRAIT = { 'Byzantium ferry': 'the Bosporus', 'Abydos ferry': 'the Hellespont' };
    const fer = [...new Set(rt.segs.filter(X.isFerry).map(s => STRAIT[X.segName(s)] || 'a strait'))];
    const pcw = i => { const v = ck[i] / rt.km * 100; return v === 0 ? 'none' : v < 1 ? 'under 1%' : v > 99 && v < 100 ? 'over 99%' : `${X.fmt(v)}%`; };
    const certLine = ck[0] === 0 && ck[2] === 0 ? 'None of the way is certain. All of it is conjectured.'
      : `${pcw(0)[0].toUpperCase() + pcw(0).slice(1)} of the way is certain, ${pcw(1)} conjectured and ${pcw(2)} hypothetical.`;
    // the named roads the route follows, longest first
    const named = new Map();
    for (const s of rt.segs) for (const t of X.tagsOf(s)) { const nm = X.D.tags[t]; if (/^(Via|Strata|Hodos)\b|Street$|Way$|Road$/.test(nm)) named.set(nm, (named.get(nm) || 0) + X.segKm(s)); }
    const alongs = [...named].filter(([, k]) => k >= 20).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, k]) => `the ${nm} for ${X.fmt(k)} km`);
    let list = '';
    const every = rt.days > 120 ? 5 : 1;
    let prevNear = -1;
    for (const nt of nights) {
      if (nt.d % every && nt.d !== 1) continue;
      const nm = nt.near !== prevNear || every > 1 ? X.nameOf(nt.near) || X.describe(nt.near) : null;
      const where = nm ? `near ${nm}` : `on the road from ${X.roadWords(nt.seg)}`;
      prevNear = nt.near;
      list += `<li data-d="${nt.d}"><b>Day ${nt.d}</b><span>${X.esc(where)}</span><em>${X.fmt(nt.km)} km</em></li>`;
    }
    list += `<li data-d="${rt.days}" class="end"><b>Day ${Math.ceil(rt.days)}</b><span>${X.esc(z)}</span><em>${X.fmt(rt.km)} km</em></li>`;
    ui.side.innerHTML = `
      <p class="t-big">${X.daysText(rt.days)}</p>
      <p class="t-lede">on foot from ${X.esc(a)} to ${X.esc(z)}</p>
      <p class="t-sub">${X.fmt(rt.km)} km of road, or ${X.fmt(rt.km / MILE)} Roman miles${crow > 20 ? `, between places ${X.fmt(crow)} km apart as the crow flies` : ''}.${via.length ? ` By way of ${X.esc(X.listWords(via))}.` : ''}${fer.length ? ` With a ferry across ${X.esc(X.listWords(fer))}.` : ''}</p>
      ${alongs.length ? `<p class="t-sub">It follows ${X.esc(X.listWords(alongs))}.</p>` : ''}
      <div class="k-stack t-stack" aria-hidden="true">${[0, 1, 2].map(i => `<i style="flex:${ck[i].toFixed(1)}" class="c${i}"></i>`).join('')}</div>
      <p class="t-sub">${certLine}${steep >= 0 && X.segSlope(steep) >= 3 ? ` The steepest stretch is ${X.esc(X.roadWords(steep))}, ${X.fmt1(X.segSlope(steep))}\u00b0 on average.` : ''}</p>
      <p class="k-h">${every > 1 ? 'Every fifth night' : 'Each night'}</p>
      <ol class="t-list">${list}</ol>
      <p class="t-fine">The fastest way on foot by this model, not a record of anyone\u2019s trip.</p>`;
  }

  // ---------- the strip under the map ----------
  function profile() {
    if (!rt) { ui.prof.innerHTML = ''; return; }
    const W = Math.max(300, Math.round(ui.prof.clientWidth || 800)), small = W < 640, H = small ? 150 : 170;
    const m = { l: 6, r: 6, t: 30, b: 34 };
    const x = d3.scaleLinear().domain([0, rt.km]).range([m.l, W - m.r]);
    const smax = Math.max(6, d3.max(rt.segs, s => X.segSlope(s)));
    const y = d3.scaleLinear().domain([0, smax]).range([H - m.b - 14, m.t]);
    let area = '', band = '';
    rt.segs.forEach((s, i) => {
      const x0 = x(cumKm[i]), x1 = Math.max(x0 + .6, x(cumKm[i + 1])), yy = y(X.segSlope(s));
      area += `<rect x="${x0.toFixed(2)}" y="${yy.toFixed(1)}" width="${(x1 - x0).toFixed(2)}" height="${(H - m.b - 14 - yy).toFixed(1)}"/>`;
      band += `<rect class="c${X.certOf(s)}" x="${x0.toFixed(2)}" y="${H - m.b - 10}" width="${(x1 - x0).toFixed(2)}" height="6"/>`;
    });
    // label every n-th night, with n picked so the labels stay about 56 px apart at this width
    const pxDay = (W - m.l - m.r) / Math.max(1, rt.days);
    const every = [1, 2, 5, 10, 20, 25, 50, 100, 200].find(n => n * pxDay >= 56) || 400;
    const ticks = nights.map(nt => `<line class="t-night${nt.d % every ? '' : ' big'}" x1="${x(nt.km).toFixed(1)}" x2="${x(nt.km).toFixed(1)}" y1="${H - m.b - 1}" y2="${H - m.b + (nt.d % every ? 4 : 7)}"/>${nt.d % every ? '' : `<text class="t-tl" x="${x(nt.km).toFixed(1)}" y="${H - 8}" text-anchor="middle">Day ${nt.d}</text>`}`).join('');
    const way = X.waypoints(rt.nodes, small ? 3 : 6);
    const pos = new Map(rt.nodes.map((n, i) => [n, i]));
    const names = [[from, 0], ...way.map(n => [n, cumKm[pos.get(n)]]), [to, rt.km]];
    let lastX = -1e9;
    const lab = names.map(([n, km], i) => {
      const xx = x(km), t = X.shortName(n) || X.describe(n), anchor = i === 0 ? 'start' : i === names.length - 1 ? 'end' : 'middle';
      const w = t.length * 6.3, left = anchor === 'start' ? xx : anchor === 'end' ? xx - w : xx - w / 2;
      if (left < lastX + 8 && i !== names.length - 1) return '';
      lastX = left + w;
      return `<line class="t-wp" x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${m.t - 6}" y2="${H - m.b - 14}"/><text class="t-wl" x="${xx.toFixed(1)}" y="${m.t - 12}" text-anchor="${anchor}">${X.esc(t)}</text>`;
    }).join('');
    ui.prof.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Slope and certainty along the route">
        <g class="t-area">${area}</g><g class="t-band">${band}</g>${ticks}${lab}
        <text class="t-ax" x="${W - m.r}" y="${y(smax) + 11}" text-anchor="end">average slope, up to ${X.fmt1(smax)}\u00b0</text>
        <line class="t-head" x1="0" x2="0" y1="${m.t - 6}" y2="${H - m.b}"/>
        <rect class="t-hit" x="0" y="0" width="${W}" height="${H}"/>
      </svg>
      <p class="t-key"><span><i class="c0"></i>Certain</span><span><i class="c1"></i>Conjectured</span><span><i class="c2"></i>Hypothetical</span><span><i class="t-nk"></i>A night</span></p>`;
    const svg = ui.prof.querySelector('svg'), head = svg.querySelector('.t-head');
    ui.prof._x = x; ui.prof._head = head;
    const at = e => { const r = svg.getBoundingClientRect(); return x.invert((e.clientX - r.left) / r.width * W); };
    const kmToDay = km => { let i = 0; while (i < rt.segs.length - 1 && cumKm[i + 1] < km) i++; const f = X.segKm(rt.segs[i]) > 0 ? (km - cumKm[i]) / X.segKm(rt.segs[i]) : 0; return cum[i] + Math.max(0, Math.min(1, f)) * X.segDays[rt.segs[i]]; };
    svg.addEventListener('pointermove', e => {
      const km = Math.max(0, Math.min(rt.km, at(e)));
      hoverAt = kmToDay(km);
      const i = segAt(hoverAt), s = rt.segs[i];
      X.tip(`<b>Day ${Math.floor(hoverAt) + 1}, ${X.fmt(km)} km</b><small>${X.esc(X.roadWords(s))}, ${X.CERT[X.certOf(s)]}, ${X.fmt1(X.segSlope(s))}\u00b0 average slope</small>`, e.clientX, e.clientY);
      dirty = true;
    });
    svg.addEventListener('pointerleave', () => { hoverAt = -1; X.tip(null); dirty = true; });
    svg.addEventListener('click', e => { stop(); walk = kmToDay(Math.max(0, Math.min(rt.km, at(e)))); update(); });
  }

  // ---------- walking ----------
  function segAt(t) {
    let lo2 = 0, hi2 = rt.segs.length - 1;
    while (lo2 < hi2) { const mid = (lo2 + hi2 + 1) >> 1; if (cum[mid] <= t) lo2 = mid; else hi2 = mid - 1; }
    return lo2;
  }
  function posAt(t, G) {
    const i = segAt(t), s = rt.segs[i], d = X.segDays[s];
    const f = d > 0 ? Math.max(0, Math.min(1, (t - cum[i]) / d)) : 1;
    return { i, f, p: X.pointAt(G, s, !!revs[i], f) };
  }
  function startWalk() {
    if (!rt) return;
    if (walk >= rt.days - 1e-6) walk = 0;
    walking = true; lastNow = performance.now();
    ui.go.querySelector('span').textContent = 'Stop';
    ui.go.querySelector('svg').innerHTML = '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  }
  function stop() {
    walking = false;
    if (ui.go) { ui.go.querySelector('span').textContent = walk > 0 && rt && walk < rt.days ? 'Keep walking' : 'Walk it'; ui.go.querySelector('svg').innerHTML = '<path d="M8 5v14l11-7z"/>'; }
  }
  function update() {
    if (!rt) { ui.day.textContent = ''; ui.here.textContent = ''; return; }
    const d = Math.min(walk, rt.days);
    ui.day.textContent = d <= 0 ? '' : d >= rt.days ? `Day ${Math.ceil(rt.days)}, arrived` : `Day ${Math.floor(d) + 1}`;
    const i = segAt(d);
    let near = null; for (let k = i; k >= 0; k--) if (X.nameOf(rt.nodes[k])) { near = rt.nodes[k]; break; }
    ui.here.textContent = d >= rt.days ? X.nameOf(to) || '' : d > 0 && near != null ? `past ${X.nameOf(near)}` : '';
    if (ui.prof._x) { const km = cumKm[i] + (X.segDays[rt.segs[i]] > 0 ? Math.min(1, (d - cum[i]) / X.segDays[rt.segs[i]]) : 1) * X.segKm(rt.segs[i]); const xx = ui.prof._x(km).toFixed(1); ui.prof._head.setAttribute('x1', xx); ui.prof._head.setAttribute('x2', xx); }
    // keep the current night in view in the list, without moving the page
    const li = [...ui.side.querySelectorAll('[data-d]')];
    let cur = null; for (const e of li) if (+e.dataset.d <= d + 1e-6) cur = e;
    li.forEach(e => e.classList.toggle('on', e === cur));
    const ol = ui.side.querySelector('.t-list');
    if (cur && ol && walking) { const top = cur.offsetTop - ol.offsetTop, h = ol.clientHeight; if (top < ol.scrollTop || top > ol.scrollTop + h - 30) ol.scrollTop = top - h / 3; }
    dirty = true;
  }

  // ---------- drawing ----------
  function toUnitXY(cx, cy) { const r = cv.getBoundingClientRect(); return [((cx - r.left) - T.x) / (T.k * S), ((cy - r.top) - T.y) / (T.k * S)]; }
  function resize() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const oW = VW, oH = VH;
    dpr = Math.min(2, devicePixelRatio || 1);
    VW = Math.round(r.width); VH = Math.round(r.height);
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    const first = S === 1; S = VW;
    if (first || !moved) frame(false);
    else if (oW && (oW !== VW || oH !== VH)) d3.select(cv).call(zoom.transform, X.recenter(T, oW, oH, VW, VH));
    baseKey = ''; dirty = true;
    profile(); update();
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
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = .6; g.stroke();
    baseKey = key;
  }
  function render() {
    const G = T.k > 6 && hi ? hi : lo;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH);
    if (!G) return;
    drawBase(G);
    c.drawImage(baseCv, 0, 0, VW, VH);
    const K = T.k * S, tx = T.x, ty = T.y;
    const dot = (ux, uy, r, fill) => { c.beginPath(); c.arc(tx + K * ux, ty + K * uy, r, 0, 7); c.fillStyle = fill; c.fill(); };
    if (rt) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      // the whole route, then the part walked so far in the colour of the walker
      c.beginPath(); for (const s of rt.segs) X.trace(c, G, s, tx, ty, K);
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.88)'; c.lineWidth = 2.2; c.stroke();
      const w = Math.min(walk, rt.days);
      if (w > 0) {
        const { i, f } = posAt(w, G);
        c.beginPath();
        for (let k = 0; k < i; k++) X.trace(c, G, rt.segs[k], tx, ty, K);
        X.tracePart(c, G, rt.segs[i], tx, ty, K, !!revs[i], f);
        c.strokeStyle = '#ff9a52'; c.lineWidth = 3.4; c.stroke();
      }
      // a mark where every day ends: they bunch up where the going is slow
      const r = nights.length > 150 ? 1.6 : nights.length > 60 ? 2.1 : 2.8;
      for (const nt of nights) {
        const [ux, uy] = X.pointAt(G, nt.seg, !!revs[nt.i], nt.f);
        dot(ux, uy, r + 1.2, 'rgba(0,0,0,.8)'); dot(ux, uy, r, nt.d <= w ? '#ff9a52' : '#ffffff');
      }
      if (hoverAt >= 0) { const { p } = posAt(hoverAt, G); dot(p[0], p[1], 7, 'rgba(255,255,255,.25)'); dot(p[0], p[1], 3.5, '#fff'); }
      if (w > 0 && w < rt.days) {
        const { p } = posAt(w, G), x = tx + K * p[0], y = ty + K * p[1];
        const gr = c.createRadialGradient(x, y, 0, x, y, 18); gr.addColorStop(0, 'rgba(255,200,140,.9)'); gr.addColorStop(1, 'rgba(255,140,70,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill();
        dot(p[0], p[1], 4.2, '#fff');
      }
    }
    // the two ends and the places passed on the way
    c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
    const boxes = [];
    const put = (n, strong) => {
      const x = tx + K * X.PX[n], y = ty + K * X.PY[n], t = X.shortName(n) || X.describe(n);
      if (x < -30 || y < -20 || x > VW + 30 || y > VH + 20) return;
      c.font = `${strong ? 700 : 600} ${strong ? 13 : 11.5}px "Schibsted Grotesk", system-ui, sans-serif`;
      const w = c.measureText(t).width, right = x + 9 + w < VW - 6, bx = right ? x + 8 : x - 8 - w, box = [bx - 2, y - 8, bx + w + 2, y + 8];
      if (!strong && boxes.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) return;
      boxes.push(box);
      if (strong) { c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fillStyle = '#000'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
      c.textAlign = 'left'; c.lineWidth = 3.2; c.strokeStyle = 'rgba(0,0,0,.9)'; c.strokeText(t, bx, y); c.fillStyle = strong ? '#fff' : 'rgba(255,255,255,.75)'; c.fillText(t, bx, y);
    };
    put(from, true); put(to, true);
    if (rt) for (const n of X.waypoints(rt.nodes, VW < 640 ? 3 : 7)) put(n, false);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    if (walking && rt) {
      const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
      walk += dt * rt.days / walkDur;
      if (walk >= rt.days) { walk = rt.days; stop(); }
      update();
    }
    if (T.k > 6 && !hi && !hiLoad) { hiLoad = true; X.geometry('hi').then(g => { hi = g; baseKey = ''; dirty = true; }); }
    if (!dirty) return;
    dirty = false;
    render();
  }
  function show(opts) {
    visible = true;
    if (opts && opts.from != null && opts.to != null) set(opts.from, opts.to, false);
    if (!VW) resize();
    update();
    if (!raf) raf = requestAnimationFrame(loop);
    dirty = true;
    if (opts && rt && !X.reduced) startWalk();
  }
  function hide() { visible = false; stop(); X.tip(null); }
  X.views.trip = { init, show, hide, set, sync: () => { if (from >= 0 && to >= 0) X.setParams({ from: X.urlName(from), to: X.urlName(to) }); }, state: () => ({ built, from, to, days: rt && rt.days, km: rt && rt.km, nights: nights.length, walk, walking, lo: !!lo }) };
})();
