/* All Roads: What We Know.
   The same roads through three lenses: how sure anyone is of where each one ran (sharp, soft or blurred), who built the few
   that carry a builder's name, and which ancient maps and itineraries list them. */
(function () {
  'use strict';
  const X = window.RD, NS = X.NS;
  let el, cv, c, dpr = 1, VW = 0, VH = 0, S = 1, T = d3.zoomIdentity, zoom = null, ui = {};
  let built = false, visible = false, raf = 0, dirty = true, moved = false, gesturing = false;
  let lo = null, hi = null, hiLoad = false;
  let lens = 'sure', only = -1, hoverSeg = -1, pinSeg = -1, hl = null, hlKey = '', sel = null;
  const layers = {};
  let layerKey = '';

  // ---------- eras, sources and builders ----------
  const ERAS = [
    { k: 0, name: 'Before Augustus', span: 'to 27 BCE', col: '#7fb2ff', to: -27 },
    { k: 1, name: 'Augustus to Domitian', span: '27 BCE to 96 CE', col: '#62dcb8', to: 96 },
    { k: 2, name: 'Nerva to Commodus', span: '96 to 192 CE', col: '#f2dc62', to: 192 },
    { k: 3, name: 'The third century', span: '193 to 284 CE', col: '#ff9b45', to: 284 },
    { k: 4, name: 'Diocletian and after', span: 'from 284 CE', col: '#ff5a64', to: 99999 },
  ];
  // the few builders the data names without dates, placed by the reigns everyone knows
  const UNDATED = { 'Julius Caesar': [-49, -44], 'Augustus': [-27, 14], 'Tetrarchy or later': [293, 400], 'Byzantine': [330, 500], 'Nabatean': [-300, 106] };
  const B = X.D.builders.map(([who, full, a, b, km], i) => {
    let lo2 = a, hi2 = b;
    if (lo2 == null && UNDATED[who]) [lo2, hi2] = UNDATED[who];
    const mid = lo2 == null ? null : (lo2 + hi2) / 2;
    const era = mid == null ? -1 : ERAS.findIndex(e => mid < e.to);
    return { i, who, full, lo: lo2, hi: hi2, mid, era, km, segs: [] };
  });
  const segB = Int32Array.from(X.D.sb);
  for (let s = 0; s < NS; s++) if (segB[s] >= 0) B[segB[s]].segs.push(s);
  // people, summed over every entry that names them
  const WHO = (() => {
    const m = new Map();
    for (const b of B) {
      const k = b.who.replace(/^Vespasianus$/, 'Vespasian').replace(/^Tetrarch$/, 'Tetrarchy').replace(/^Constantine the Great$/, 'Constantine');
      if (!m.has(k)) m.set(k, { who: k, km: 0, segs: [], entries: [], lo: Infinity, hi: -Infinity });
      const w = m.get(k); w.km += b.km; w.segs.push(...b.segs); w.entries.push(b);
      if (b.lo != null) { w.lo = Math.min(w.lo, b.lo); w.hi = Math.max(w.hi, b.hi); }
    }
    return [...m.values()].sort((a, b) => b.km - a.km);
  })();
  const whoOf = new Map(); WHO.forEach(w => w.entries.forEach(b => whoOf.set(b, w)));
  const builtKm = B.reduce((a, b) => a + b.km, 0);
  const TAGS = X.D.tags;
  const tagSegs = TAGS.map(() => []);
  for (let s = 0; s < NS; s++) for (const t of X.tagsOf(s)) tagSegs[t].push(s);
  const SOURCES = [
    ['Tabula Peutingeriana', 'A Roman road map that survives in a single medieval copy, a parchment scroll almost seven meters long.'],
    ['Itinerarium Antonini', 'A Roman list of routes and the stops along them, from the third century.'],
    ['Itinerarium Burdigalense', 'The route of a pilgrim who went from Bordeaux to Jerusalem in 333 CE and wrote down every stop.'],
    ['Ravenna Cosmography', 'A list of the world\u2019s places made in Ravenna around 700 CE.'],
    ['Procopius De Aedificiis', 'Procopius\u2019s book on the buildings of Justinian, from the sixth century.'],
    ['Stadiasmus Patarensis', 'A pillar at Patara, carved under Claudius, listing the roads of Lycia and their lengths.'],
  ];
  const isStad = t => t.startsWith('Stadiasmus Patarensis');
  // the Stadiasmus is split into its numbered routes in the data; here it is one source
  const srcSegs = SOURCES.map(([name]) => {
    const out = new Set();
    TAGS.forEach((t, i) => { if (t === name || (name === 'Stadiasmus Patarensis' && isStad(t))) tagSegs[i].forEach(s => out.add(s)); });
    return [...out];
  });
  const isSource = t => isStad(t) || SOURCES.some(([n]) => t === n);
  const ROADS = TAGS.map((t, i) => ({ t, i, segs: tagSegs[i], km: tagSegs[i].reduce((a, s) => a + X.segKm(s), 0) }))
    .filter(r => !isSource(r.t) && r.km > 25 && !/\?|^Limes/.test(r.t)).sort((a, b) => b.km - a.km).slice(0, 60);
  const certKm = [0, 0, 0]; let totKm = 0;
  for (let s = 0; s < NS; s++) { const k = X.segKm(s); certKm[X.certOf(s)] += k; totKm += k; }

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="k-bar">
        <div class="k-lenses" role="group" aria-label="Lens">
          <button class="chip-btn" data-l="sure" aria-pressed="true">How sure</button>
          <button class="chip-btn" data-l="built" aria-pressed="false">Who built it</button>
          <button class="chip-btn" data-l="listed" aria-pressed="false">On the old maps</button>
        </div>
        <span class="k-hint">Scroll or pinch to zoom. Point at a road for its record.</span>
      </div>
      <div class="k-wrap">
        <div class="k-main">
          <div class="k-stage">
            <canvas class="k-canvas" aria-label="Map of the Roman roads"></canvas>
            <div class="k-zoom"><button class="ctl" data-z="in" aria-label="Zoom in">+</button><button class="ctl" data-z="out" aria-label="Zoom out">&minus;</button><button class="ctl" data-z="fit">Whole empire</button></div>
            <div class="k-card" aria-live="polite"></div>
          </div>
          <div class="k-time"></div>
        </div>
        <aside class="k-side"></aside>
      </div>`;
    cv = el.querySelector('.k-canvas'); c = cv.getContext('2d');
    ui = { side: el.querySelector('.k-side'), time: el.querySelector('.k-time'), card: el.querySelector('.k-card') };
    zoom = d3.zoom().scaleExtent([.7, 120]).on('start', () => { gesturing = true; }).on('zoom', e => { T = e.transform; if (e.sourceEvent) moved = true; dirty = true; }).on('end', () => { gesturing = false; dirty = true; });
    d3.select(cv).call(zoom).on('dblclick.zoom', null);
    el.querySelector('.k-lenses').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) setLens(b.dataset.l); });
    el.querySelector('.k-zoom').addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      if (b.dataset.z === 'fit') { moved = false; d3.select(cv).transition().duration(700).call(zoom.transform, fitAll()); return; }
      moved = true; d3.select(cv).transition().duration(420).call(zoom.scaleBy, b.dataset.z === 'in' ? 2 : .5, [VW / 2, VH / 2]);
    });
    ui.side.addEventListener('click', onSide);
    ui.side.addEventListener('pointerover', e => { const r = e.target.closest('[data-hl]'); if (r && e.pointerType !== 'touch') preview(r.dataset.hl); });
    ui.side.addEventListener('pointerout', e => { const r = e.target.closest('[data-hl]'); if (r && !r.contains(e.relatedTarget)) preview(null); });
    ui.card.addEventListener('click', e => { if (e.target.closest('[data-a="close"]')) { pinSeg = -1; card(); dirty = true; } });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { moveQ = null; if (hoverSeg >= 0) { hoverSeg = -1; dirty = true; } X.tip(null); });
    // a tap sends no pointermove first, so the click finds its own road
    cv.addEventListener('click', e => { const s = pickAt(e.clientX, e.clientY); pinSeg = s >= 0 && s !== pinSeg ? s : -1; X.tip(null); card(); dirty = true; });
    document.addEventListener('keydown', e => { if (visible && e.key === 'Escape' && !(e.target.closest && e.target.closest('input'))) { pinSeg = -1; card(); dirty = true; } });
    new ResizeObserver(() => { if (visible) resize(); }).observe(cv);
    X.watchDpr(() => { if (visible) resize(); });
    addEventListener('rd-land', () => { layerKey = ''; dirty = true; });
    X.geometry('lo').then(g => { lo = g; layerKey = ''; dirty = true; });
    const p = X.params();
    if (['sure', 'built', 'listed'].includes(p.get('lens'))) lens = p.get('lens');
    if (p.get('by')) { const w = WHO.find(w => w.who === p.get('by')); if (w) { sel = { kind: 'who', key: w.who }; lens = 'built'; } }
    if (p.get('tag')) { const tg = p.get('tag'); if (SOURCES.some(([n]) => n === tg)) sel = { kind: 'src', key: tg }; else if (ROADS.some(r => r.t === tg)) sel = { kind: 'road', key: tg }; if (sel) lens = 'listed'; }
    if (!sel && lens === 'listed') sel = { kind: 'src', key: 'Tabula Peutingeriana' };
    setLens(lens, true);
    built = true;
  }

  // ---------- lenses ----------
  function setLens(l, quiet) {
    lens = l; only = -1;
    if (!quiet) sel = l === 'listed' ? { kind: 'src', key: 'Tabula Peutingeriana' } : null;
    el.querySelectorAll('[data-l]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === lens)));
    renderSide(); renderTime();
    setHighlight();
    urlSel();
    layerKey = ''; dirty = true;
  }
  function urlSel() {
    X.setParams({ lens: lens === 'sure' ? null : lens, by: sel && sel.kind === 'who' ? sel.key : null, tag: sel && (sel.kind === 'src' || sel.kind === 'road') ? sel.key : null });
  }
  function segsOf(s) {
    if (!s) return null;
    if (s.kind === 'who') { const w = WHO.find(w => w.who === s.key); return w ? w.segs : null; }
    if (s.kind === 'entry') return B[+s.key] ? B[+s.key].segs : null;
    if (s.kind === 'src') { const i = SOURCES.findIndex(([n]) => n === s.key); return i >= 0 ? srcSegs[i] : null; }
    if (s.kind === 'road') { const r = ROADS.find(r => r.t === s.key); return r ? r.segs : null; }
    if (s.kind === 'era') return B.filter(b => b.era === +s.key).flatMap(b => b.segs);
    return null;
  }
  function setHighlight(tmp) {
    const s = tmp || sel;
    hl = segsOf(s); hlKey = s ? s.kind + s.key : '';
    dirty = true;
  }
  function preview(key) {
    if (!key) { setHighlight(); return; }
    const [kind, ...rest] = key.split(':');
    setHighlight({ kind, key: rest.join(':') });
  }
  function onSide(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === 'cert') { only = only === +v ? -1 : +v; layerKey = ''; renderSide(); dirty = true; return; }
    if (act === 'pick') {
      const [kind, ...rest] = v.split(':'), key = rest.join(':');
      const same = sel && sel.kind === kind && sel.key === key;
      sel = same && lens !== 'listed' ? null : { kind, key };
      if (same && lens === 'listed' && kind === 'road') sel = { kind: 'src', key: 'Tabula Peutingeriana' };
      setHighlight(); renderSide(); renderTime(); urlSel();
      if (sel && (sel.kind === 'road' || sel.kind === 'who')) zoomTo(segsOf(sel));
      else { moved = false; d3.select(cv).transition().duration(X.reduced ? 0 : 700).call(zoom.transform, fitAll()); }
    }
  }
  function zoomTo(segs) {
    if (!segs || !segs.length || !lo) return;
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    const b = lo.box;
    for (const s of segs) { x0 = Math.min(x0, b[4 * s]); y0 = Math.min(y0, b[4 * s + 1]); x1 = Math.max(x1, b[4 * s + 2]); y1 = Math.max(y1, b[4 * s + 3]); }
    const pad = Math.max(x1 - x0, y1 - y0) * .18 + .012;
    moved = true;
    d3.select(cv).transition().duration(X.reduced ? 0 : 900).ease(d3.easeCubicInOut).call(zoom.transform, fitBox(x0 - pad, y0 - pad, x1 + pad, y1 + pad));
  }

  // ---------- side panel ----------
  const kmT = k => `${X.fmt(k)} km`;
  function renderSide() {
    let h = '';
    if (lens === 'sure') {
      const pc = i => certKm[i] / totKm * 100;
      const W = ['Certain', 'Conjectured', 'Hypothetical'];
      const D2 = [
        'Well documented, and drawn to within 50 m in the mountains and 200 m on the plains.',
        'Known to have existed, and drawn along its likeliest course.',
        'Known but never found on the ground, or a track that wandered, as in deserts and flood plains, or a road that may have existed.',
      ];
      h += `<p class="k-lede">Only ${X.fmt1(pc(0))}% of the road is certain.</p>
        <p class="k-sub">Every road here was used at some time in the Roman period. Where most of them ran is an informed guess. Sharp lines are certain, soft ones conjectured, and blurred ones hypothetical.</p>
        <div class="k-stack" aria-hidden="true">${[0, 1, 2].map(i => `<i style="flex:${certKm[i].toFixed(0)}" class="c${i}"></i>`).join('')}</div>
        <ul class="k-certs">${[0, 1, 2].map(i => `<li><button class="k-cert${only === i ? ' on' : ''}" data-act="cert" data-v="${i}" aria-pressed="${only === i}"><span class="k-sw c${i}"></span><b>${W[i]}</b><em>${X.fmt1(pc(i))}%</em><small>${kmT(certKm[i])}. ${D2[i]}</small></button></li>`).join('')}</ul>
        <p class="k-tipline">${only >= 0 ? 'Click it again to see every road.' : 'Click one to see only those roads.'}</p>`;
      const best = ROADS.map(r => ({ r, k: r.segs.reduce((a, s) => a + (X.certOf(s) === 0 ? X.segKm(s) : 0), 0) })).filter(x => x.k > 20).sort((a, b) => b.k - a.k).slice(0, 5);
      if (best.length) h += `<p class="k-h">The named roads best pinned down</p><ul class="k-list">${best.map(({ r, k }) => row(`road:${r.t}`, r.t, k, best[0].k, `${X.fmt(k / r.km * 100)}% of its ${kmT(r.km)} is certain`)).join('')}</ul>`;
    }
    if (lens === 'built') {
      const eraKm = ERAS.map(e => B.filter(b => b.era === e.k).reduce((a, b) => a + b.km, 0));
      h += `<p class="k-lede">${kmT(builtKm)} of road has a builder\u2019s name on it.</p>
        <p class="k-sub">That\u2019s ${X.fmt1(builtKm / totKm * 100)}% of the network, named by milestones, inscriptions and histories. The rest could have been laid by anyone, at any time in six centuries.</p>
        <ul class="k-eras">${ERAS.map((e, i) => `<li><button class="k-era${sel && sel.kind === 'era' && +sel.key === i ? ' on' : ''}" data-act="pick" data-v="era:${i}" data-hl="era:${i}" aria-pressed="${!!(sel && sel.kind === 'era' && +sel.key === i)}"><span class="k-sw" style="background:${e.col}"></span><b>${e.name}</b><em>${kmT(eraKm[i])}</em><small>${e.span}</small></button></li>`).join('')}</ul>
        <p class="k-h">The biggest builders</p>
        <ul class="k-list">${WHO.slice(0, 8).map(w => row(`who:${w.who}`, w.who, w.km, WHO[0].km, w.lo < Infinity ? years(w.lo, w.hi) : '', eraCol(w))).join('')}</ul>`;
      if (sel && sel.kind === 'entry' && B[+sel.key]) { const b = B[+sel.key], w = whoOf.get(b); h = `<p class="k-pick"><b>${X.esc(b.full)}</b><span>${kmT(b.km)} of road${w && w.entries.length > 1 ? `, of ${kmT(w.km)} in all under ${X.esc(w.who)}` : ''}.</span> <button class="k-clear" data-act="pick" data-v="entry:${b.i}">Clear</button></p>` + h; }
    }
    if (lens === 'listed') {
      const si = sel && sel.kind === 'src' ? SOURCES.findIndex(([n]) => n === sel.key) : -1;
      const rd = sel && sel.kind === 'road' ? ROADS.find(r => r.t === sel.key) : null;
      if (si >= 0) {
        const km = srcSegs[si].reduce((a, s) => a + X.segKm(s), 0);
        h += `<p class="k-lede">The ${SOURCES[si][0]} lists ${kmT(km)} of these roads.</p><p class="k-sub">${SOURCES[si][1]}</p>`;
      } else if (rd) {
        const cert = rd.segs.reduce((a, s) => a + (X.certOf(s) === 0 ? X.segKm(s) : 0), 0);
        const ends = roadEnds(rd.segs);
        h += `<p class="k-lede">${X.esc(rd.t)}, ${kmT(rd.km)}.</p><p class="k-sub">${ends ? `It runs from ${X.esc(ends[0])} to ${X.esc(ends[1])}. ` : ''}${cert > 0 ? `${X.fmt(Math.max(1, cert / rd.km * 100))}% of it is certain.` : 'None of it is certain.'}</p>`;
      }
      h += `<div class="k-srcs">${SOURCES.map(([n], i) => `<button class="chip-btn" data-act="pick" data-v="src:${n}" data-hl="src:${n}" aria-pressed="${si === i}">${n.replace('Itinerarium ', 'Itin. ').replace(' De Aedificiis', '')}</button>`).join('')}</div>
        <p class="k-h">Roads with names</p>
        <ul class="k-list k-scroll">${ROADS.map(r => row(`road:${r.t}`, r.t, r.km, ROADS[0].km, '', null, rd === r)).join('')}</ul>`;
    }
    ui.side.innerHTML = h;
  }
  function row(key, label, km, max, sub, col, on) {
    const isOn = on || (sel && `${sel.kind}:${sel.key}` === key);
    return `<li><button class="k-row${isOn ? ' on' : ''}" data-act="pick" data-v="${X.esc(key)}" data-hl="${X.esc(key)}" aria-pressed="${!!isOn}"><span class="k-nm">${X.esc(label)}</span><span class="k-bar-v"><i style="width:${Math.max(2, km / max * 100).toFixed(1)}%;${col ? `background:${col}` : ''}"></i></span><span class="k-km">${X.fmt(km)}</span>${sub ? `<small>${X.esc(sub)}</small>` : ''}</button></li>`;
  }
  const yr = y => y < 0 ? `${-y} BCE` : `${y} CE`;
  const years = (a, b) => a === b ? yr(a) : a < 0 && b < 0 ? `${-a} to ${-b} BCE` : a < 0 ? `${-a} BCE to ${b} CE` : `${a} to ${b} CE`;
  const eraCol = w => { const m = w.lo < Infinity ? (w.lo + w.hi) / 2 : null; const e = m == null ? -1 : ERAS.findIndex(e => m < e.to); return e >= 0 ? ERAS[e].col : null; };
  function roadEnds(segs) {
    // the two named places farthest apart on the road
    const ns = new Set(); for (const s of segs) { ns.add(X.SU[s]); ns.add(X.SV[s]); }
    const named = [...ns].filter(n => X.nameOf(n));
    if (named.length < 2) return null;
    let a = named[0], b = named[1], best = -1;
    for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
      const d = X.hav(X.nlon[named[i]], X.nlat[named[i]], X.nlon[named[j]], X.nlat[named[j]]);
      if (d > best) { best = d; a = named[i]; b = named[j]; }
    }
    if (X.nlon[a] > X.nlon[b]) [a, b] = [b, a];
    return [X.nameOf(a), X.nameOf(b)];
  }

  // ---------- the builders' timeline: one dot per record, as big as the road it names ----------
  function renderTime() {
    if (lens !== 'built') { ui.time.innerHTML = ''; ui.time.classList.remove('on'); return; }
    ui.time.classList.add('on');
    const W = Math.max(300, Math.round(ui.time.clientWidth || el.clientWidth - 40)), small = W < 640, H = small ? 260 : 240, m = { l: 14, r: 14, t: 30, b: 30 };
    const x = d3.scaleLinear().domain([-420, 520]).range([m.l, W - m.r]);
    const r = d3.scaleSqrt().domain([0, d3.max(B, b => b.km)]).range([1.5, small ? 10 : 16]);
    const mid = (H - m.b + m.t) / 2;
    const pts = B.filter(b => b.mid != null).map(b => ({ b, x: x(b.mid), y: mid, r: r(b.km) }));
    const sim = d3.forceSimulation(pts).force('x', d3.forceX(p => x(p.b.mid)).strength(.9)).force('y', d3.forceY(mid).strength(.07)).force('c', d3.forceCollide(p => p.r + .6)).stop();
    for (let i = 0; i < 240; i++) sim.tick();
    pts.forEach(p => { p.y = Math.max(m.t + p.r, Math.min(H - m.b - p.r, p.y)); });
    const ticks = small ? [-400, -200, 1, 200, 400] : [-400, -300, -200, -100, 1, 100, 200, 300, 400, 500];
    // name the biggest dots, one per builder, where they don't collide
    const lab = [], boxes = [];
    for (const p of pts.slice().sort((a, b) => b.b.km - a.b.km)) {
      if (lab.length >= (small ? 4 : 10)) break;
      const w = whoOf.get(p.b).who;
      if (lab.some(l => l.w === w)) continue;
      const tw = w.length * 6.4, bx = [p.x - tw / 2, p.y - p.r - 16, p.x + tw / 2, p.y - p.r - 3];
      if (bx[0] < 2 || bx[2] > W - 2 || bx[1] < 0 || boxes.some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3]))) continue;
      boxes.push(bx); lab.push({ p, w });
    }
    const selSet = sel ? new Set(sel.kind === 'who' ? (WHO.find(w => w.who === sel.key) || { entries: [] }).entries : sel.kind === 'entry' ? [B[+sel.key]] : sel.kind === 'era' ? B.filter(b => b.era === +sel.key) : []) : null;
    ui.time.innerHTML = `<p class="k-h">Every builder in the data, by when they built. Each dot is one record, as big as the road it names.</p>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Timeline of road builders">
        ${ticks.map(t => `<line class="k-tick" x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${m.t - 10}" y2="${H - m.b + 4}"/><text class="k-tt" x="${x(t).toFixed(1)}" y="${H - 9}" text-anchor="middle">${t === 1 ? '1 CE' : yr(t)}</text>`).join('')}
        ${pts.map((p, i) => { const e = ERAS[p.b.era] || ERAS[0], on = selSet && selSet.has(p.b); return `<circle class="k-dot${on ? ' on' : selSet && selSet.size ? ' off' : ''}" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${e.col}"/>`; }).join('')}
        ${lab.map(({ p, w }) => `<text class="k-dl" x="${p.x.toFixed(1)}" y="${(p.y - p.r - 5).toFixed(1)}" text-anchor="middle">${X.esc(w)}</text>`).join('')}
      </svg>`;
    const svg = ui.time.querySelector('svg');
    const at = e => { const d = e.target.closest('circle'); return d ? pts[+d.dataset.i] : null; };
    svg.addEventListener('pointermove', e => {
      const p = at(e); if (!p) { X.tip(null); return; }
      X.tip(`<b>${X.esc(p.b.full)}</b><small>${kmT(p.b.km)} of road</small>`, e.clientX, e.clientY);
      if (e.pointerType !== 'touch') setHighlight({ kind: 'entry', key: String(p.b.i) });
    });
    svg.addEventListener('pointerleave', () => { X.tip(null); setHighlight(); });
    svg.addEventListener('click', e => {
      const p = at(e); if (!p) return;
      const same = sel && sel.kind === 'entry' && +sel.key === p.b.i;
      sel = same ? null : { kind: 'entry', key: String(p.b.i) };
      setHighlight(); renderSide(); renderTime(); urlSel();
      if (!same) zoomTo(p.b.segs);
      X.tip(null);
    });
  }

  // ---------- pointer ----------
  function toUnitXY(cx, cy) { const r = cv.getBoundingClientRect(); return [((cx - r.left) - T.x) / (T.k * S), ((cy - r.top) - T.y) / (T.k * S)]; }
  function pickAt(cx, cy) {
    const G = T.k > 6 && hi ? hi : lo; if (!G) return -1;
    const [ux, uy] = toUnitXY(cx, cy);
    return X.nearestSeg(G, ux, uy, 9 / (T.k * S), s => lens !== 'sure' || only < 0 || X.certOf(s) === only);
  }
  let moveQ = null;
  function onMove(e) { if (!gesturing && e.pointerType !== 'touch') moveQ = e; }
  function doMove() {
    const e = moveQ; moveQ = null; if (!e) return;
    const s = pickAt(e.clientX, e.clientY);
    if (s !== hoverSeg) { hoverSeg = s; dirty = true; }
    cv.style.cursor = s >= 0 ? 'pointer' : '';
    X.tip(s >= 0 ? segHtml(s, true) : null, e.clientX, e.clientY);
  }
  function segHtml(s, short) {
    const w = X.roadWords(s), bits = [];
    bits.push(`${X.isMain(s) ? 'Main road' : 'Secondary road'}, ${X.CERT[X.certOf(s)]}, ${X.fmt1(X.segKm(s))} km`);
    if (segB[s] >= 0) bits.push(`Built under ${B[segB[s]].full}`);
    const tg = X.tagsOf(s).map(i => TAGS[i].replace(/^Stadiasmus Patarensis \d+$/, 'Stadiasmus Patarensis'));
    if (tg.length) bits.push(`On ${X.listWords([...new Set(tg)].slice(0, 3))}`);
    if (!short) { const d = X.descOf.get(s); if (d) bits.push(d); if (X.segSlope(s) >= 6) bits.push(`Average slope ${X.fmt1(X.segSlope(s))}\u00b0`); }
    return `<b>${X.esc(w || 'An unnamed road')}</b>${bits.map(b => `<small>${X.esc(b)}</small>`).join('')}`;
  }
  function card() {
    if (pinSeg < 0) { ui.card.classList.remove('on'); ui.card.innerHTML = ''; return; }
    ui.card.innerHTML = `<button class="r-x" data-a="close" aria-label="Close">&times;</button>${segHtml(pinSeg, false)}`;
    ui.card.classList.add('on');
  }

  // ---------- drawing ----------
  function fitBox(x0, y0, x1, y1) {
    const k = Math.min((VW - 24) / ((x1 - x0) * S), (VH - 24) / ((y1 - y0) * S));
    return d3.zoomIdentity.translate(VW / 2 - k * S * (x0 + x1) / 2, VH / 2 - k * S * (y0 + y1) / 2).scale(Math.max(.7, Math.min(120, k)));
  }
  const fitAll = () => fitBox(0, 0, 1, X.UH);
  function resize() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const oW = VW, oH = VH;
    dpr = Math.min(2, devicePixelRatio || 1);
    VW = Math.round(r.width); VH = Math.round(r.height);
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    S = VW;
    if (!moved) d3.select(cv).call(zoom.transform, fitAll());
    else if (oW && (oW !== VW || oH !== VH)) d3.select(cv).call(zoom.transform, X.recenter(T, oW, oH, VW, VH));
    layerKey = ''; dirty = true;
    if (lens === 'built') renderTime();
  }
  // Safari has no canvas filters; there the soft roads get a cheap blur from a few offset copies instead
  const canBlur = (() => { const t = document.createElement('canvas').getContext('2d'); if (!('filter' in t)) return false; t.filter = 'blur(1px)'; return t.filter === 'blur(1px)'; })();
  function soft(img, px) {
    if (canBlur) { c.filter = `blur(${px.toFixed(1)}px)`; c.drawImage(img, 0, 0); c.filter = 'none'; return; }
    c.globalAlpha *= .3;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) c.drawImage(img, dx * px * .7, dy * px * .7);
    c.globalAlpha /= .3;
  }
  function layer(name) {
    if (!layers[name]) layers[name] = document.createElement('canvas');
    const L = layers[name];
    if (L.width !== cv.width || L.height !== cv.height) { L.width = cv.width; L.height = cv.height; }
    const g = L.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.width, L.height); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
    return g;
  }
  function strokeSet(g, G, keep, K, style, width) {
    const vx0 = -T.x / K, vx1 = (VW - T.x) / K, vy0 = -T.y / K, vy1 = (VH - T.y) / K;
    g.beginPath();
    for (let s = 0; s < NS; s++) if (keep(s) && X.inView(G, s, vx0, vy0, vx1, vy1)) X.trace(g, G, s, T.x, T.y, K);
    g.strokeStyle = style; g.lineWidth = width; g.stroke();
  }
  const zoomW = () => Math.min(2.2, 1 + .28 * Math.log2(Math.max(1, T.k)));
  function drawLayers(G) {
    const L = X.landAt(T.k);
    const key = `${T.k}|${T.x}|${T.y}|${VW}|${VH}|${lens}|${only}|${L ? L.length : 0}|${G === hi}`;
    if (key === layerKey) return;
    layerKey = key;
    const K = T.k * S, zw = zoomW();
    const g = layer('base');
    if (L) { g.beginPath(); X.traceLand(g, L, T.x, T.y, K, VW, VH); g.fillStyle = '#0c0d0f'; g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = .6; g.stroke(); }
    const g0 = layer('a'), g1 = layer('b'), g2 = layer('c');
    if (lens === 'sure') {
      const on = i => only < 0 || only === i;
      if (!on(0) || !on(1) || !on(2)) strokeSet(g, G, s => !on(X.certOf(s)), K, 'rgba(255,255,255,.06)', .6);
      if (on(2)) strokeSet(g2, G, s => X.certOf(s) === 2, K, `rgba(255,236,214,${only === 2 ? .95 : .7})`, 1.6 * zw);
      if (on(1)) strokeSet(g1, G, s => X.certOf(s) === 1, K, `rgba(255,236,214,${only === 1 ? .78 : .5})`, .85 * zw);
      if (on(0)) strokeSet(g0, G, s => X.certOf(s) === 0, K, '#ffffff', (only === 0 ? 2.1 : 1.6) * zw);
    } else if (lens === 'built') {
      strokeSet(g, G, s => segB[s] < 0, K, 'rgba(255,255,255,.1)', .6);
      for (const e of ERAS) strokeSet(g0, G, s => segB[s] >= 0 && B[segB[s]].era === e.k, K, e.col, 1.6 * zw);
    } else {
      strokeSet(g, G, () => true, K, 'rgba(255,255,255,.13)', .6);
    }
  }
  function render() {
    const G = T.k > 6 && hi ? hi : lo;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    if (!G) return;
    drawLayers(G);
    c.drawImage(layers.base, 0, 0);
    const dim = hl && hl.length ? .28 : 1;
    if (lens === 'sure') {
      // the less certain the road, the softer it is drawn
      c.globalAlpha = dim; soft(layers.c, 2.4 * dpr);
      c.globalAlpha = dim * .9; soft(layers.b, .9 * dpr);
      c.globalAlpha = dim; c.drawImage(layers.b, 0, 0);
      c.drawImage(layers.a, 0, 0);
    } else if (lens === 'built') {
      c.globalAlpha = hl && hl.length ? .3 : 1; c.drawImage(layers.a, 0, 0);
    }
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const K = T.k * S, zw = zoomW();
    if (hl && hl.length) {
      const vx0 = -T.x / K, vx1 = (VW - T.x) / K, vy0 = -T.y / K, vy1 = (VH - T.y) / K;
      c.beginPath(); for (const s of hl) if (X.inView(G, s, vx0, vy0, vx1, vy1)) X.trace(c, G, s, T.x, T.y, K);
      c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = 4.6 * zw; c.stroke();
      c.strokeStyle = lens === 'listed' ? '#ff6a3d' : '#fff'; c.lineWidth = 2 * zw; c.stroke();
    }
    for (const s of [hoverSeg, pinSeg]) {
      if (s < 0) continue;
      c.beginPath(); X.trace(c, G, s, T.x, T.y, K);
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 6.5; c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 3.2; c.stroke();
    }
    // a few names, for bearings
    c.font = '600 11px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
    const boxes = [], cap = VW < 640 ? 7 : 14 + Math.round(Math.log2(Math.max(1, T.k)) * 10);
    let shown = 0;
    for (const f of X.FAMOUS) {
      if (shown >= cap) break;
      const x = T.x + K * X.PX[f.n], y = T.y + K * X.PY[f.n];
      if (x < 0 || y < 0 || x > VW || y > VH) continue;
      const w = c.measureText(f.label).width, right = x + 8 + w < VW - 4, bx = right ? x + 5 : x - 5 - w, box = [bx - 2, y - 7, bx + w + 2, y + 7];
      if (boxes.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      boxes.push(box); shown++;
      c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
      c.textAlign = 'left'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(f.label, bx, y); c.fillStyle = 'rgba(255,255,255,.72)'; c.fillText(f.label, bx, y);
    }
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    if (moveQ) doMove();
    if (T.k > 6 && !hi && !hiLoad) { hiLoad = true; X.geometry('hi').then(g => { hi = g; layerKey = ''; dirty = true; }); }
    if (!dirty) return;
    dirty = false;
    render();
  }
  function show() {
    visible = true;
    if (!VW) resize();
    if (lens === 'built') renderTime();
    if (!raf) raf = requestAnimationFrame(loop);
    dirty = true;
  }
  function hide() { visible = false; X.tip(null); }
  X.views.known = { init, show, hide, setLens, sync: () => urlSel(), state: () => ({ built, lens, only, sel, hl: hl ? hl.length : 0, lo: !!lo, k: T.k, blur: canBlur, pin: pinSeg, who: WHO.length, roads: ROADS.length }) };
})();
