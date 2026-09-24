/* The Crossing — Minard-style migration of every album, interactive. */
(function () {
  'use strict';
  const A = window.Atlas;
  const V = { init, show, hide, focus };
  A.views.crossing = V;

  const W = 1600, H = 1090;
  const INK = '#f2f4f8', SOFT = '#a9b0c0', MUTE = '#6b7282', BG = '#07080c', ICE = '#9cc7ff';
  const x = d3.scaleLinear([1997.55, 2026.35], [150, 1570]);
  const K = 3.7;
  let root, svg, scroll, readEl, cursor, built = false, animated = false;
  const albums = A.albums;
  A.on('unlock', () => { if (svg) svg.selectAll('[data-pk]').text(function () { return A.note(this.dataset.pk); }); });

  function laneY(lon) {
    if (lon >= -5.2) return 190 + (3.4 - lon) * 11.6;
    if (lon > -72.5) return 290 + (-5.2 - lon) / 67.3 * 70;
    if (lon > -100) return 360 + (-72.5 - lon) * 8;
    if (lon > -117) return 580 + (-100 - lon) / 17 * 26;
    return 606 + (-117 - lon) * 8;
  }
  const PY = Object.fromEntries(Object.entries(A.D.places).map(([k, p]) => [k, laneY(p.lon)]));
  const sig = v => 1 / (1 + Math.exp(-v));
  function trunkY(t) {
    let n = 0, d = 0;
    for (const [a, b, p] of A.D.home) { const w = sig((t - a) / 0.05) * sig((b - t) / 0.05); n += w * PY[p]; d += w; }
    return n / d;
  }

  function init(el) {
    root = el;
    root.innerHTML = `
      <div class="atlas-bar">
        <span class="lbl">Highlight</span>
        <button class="chip-btn" data-f="all" aria-pressed="true">Everything</button>
        <button class="chip-btn" data-f="major" aria-pressed="false">Anchors &amp; turning points</button>
        <button class="chip-btn" data-f="obsessive" aria-pressed="false">Obsessive</button>
        <button class="chip-btn" data-f="away" aria-pressed="false">Memory away from home</button>
        <button class="chip-btn" data-f="cold" aria-pressed="false">Memories of cold</button>
        <button class="chip-btn" data-f="silent" aria-pressed="false">Nothing written yet</button>
        <button class="chip-btn" data-f="low" aria-pressed="false">Unsure of the date</button>
        <span class="spacer"></span>
        <button class="ctl" data-a="replay">↺ Draw it again</button>
      </div>
      <p class="cx-hint">Swipe sideways to travel through time →</p>
      <div class="cx-scroll"><svg class="cx-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="The Crossing: albums in rotation over time and place"></svg></div>
      <div class="cx-read"></div>`;
    svg = d3.select(root.querySelector('svg'));
    scroll = root.querySelector('.cx-scroll');
    readEl = root.querySelector('.cx-read');
    root.querySelector('.atlas-bar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'replay') return animate(true);
      if (!b.dataset.f) return;
      root.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      filter(b.dataset.f);
    });
    build();
  }

  const txt = (g, x0, y0, s, o = {}) => g.append('text').attr('x', x0).attr('y', y0).attr('class', o.cls || 'mono')
    .attr('font-size', o.size || 12).attr('fill', o.fill || MUTE).attr('text-anchor', o.anchor || 'start')
    .attr('letter-spacing', o.ls || null).attr('font-style', o.it ? 'italic' : null).text(s);

  function build() {
    const defs = svg.append('defs');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      .cx-svg .serif{font-family:'Instrument Serif',Georgia,serif}.cx-svg .mono{font-family:'JetBrains Mono',monospace}.cx-svg .sans{font-family:Inter,system-ui,sans-serif}
      .cx-svg .st,.cx-svg .bd,.cx-svg .te{transition:opacity .25s}
      .cx-svg.hl .st:not(.on),.cx-svg.hl .bd:not(.on),.cx-svg.hl .te:not(.on){opacity:.12}
      .cx-svg.flt:not(.hl) .st:not(.m),.cx-svg.flt:not(.hl) .bd:not(.m),.cx-svg.flt:not(.hl) .te:not(.m){opacity:.1}
      .cx-svg .st,.cx-svg .bd{cursor:pointer}`;
    svg.node().prepend(style);
    const wav = defs.append('pattern').attr('id', 'cxWaves').attr('width', 56).attr('height', 12).attr('patternUnits', 'userSpaceOnUse');
    wav.append('path').attr('d', 'M0 6 Q 14 1 28 6 T 56 6').attr('fill', 'none').attr('stroke', 'rgba(120,170,230,.12)');
    const dots = defs.append('pattern').attr('id', 'cxFold').attr('width', 8).attr('height', 8).attr('patternUnits', 'userSpaceOnUse');
    dots.append('circle').attr('cx', 2).attr('cy', 2).attr('r', .7).attr('fill', 'rgba(255,255,255,.07)');
    defs.append('filter').attr('id', 'cxSoft').attr('x', '-5%').attr('y', '-60%').attr('width', '110%').attr('height', '220%').append('feGaussianBlur').attr('stdDeviation', 1.4);
    const clip = defs.append('clipPath').attr('id', 'cxReveal').append('rect').attr('x', 0).attr('y', 0).attr('height', H).attr('width', W);

    // geography scaffolding
    const gl = svg.append('g');
    gl.append('rect').attr('x', 0).attr('y', 292).attr('width', W).attr('height', 66).attr('fill', 'url(#cxWaves)');
    gl.append('rect').attr('x', 0).attr('y', 582).attr('width', W).attr('height', 22).attr('fill', 'url(#cxFold)');
    txt(gl, 20, 322, 'ATLANTIC', { size: 10, ls: '.3em', fill: 'rgba(120,170,230,.5)' });
    txt(gl, 20, 336, 'OCEAN', { size: 10, ls: '.3em', fill: 'rgba(120,170,230,.5)' });
    txt(gl, 20, 596, 'THE WEST', { size: 9.5, ls: '.28em', fill: 'rgba(255,255,255,.25)' });
    txt(gl, 20, 206, 'FRANCE', { size: 10, ls: '.3em' });
    txt(gl, 20, 386, 'UNITED STATES', { size: 10, ls: '.26em' });
    for (const [k, label, strong] of [['Paris', 'Paris', 1], ['Douarnenez', 'Douarnenez', 0], ['New York', 'New York', 1], ['Atlanta', 'Atlanta', 1],
      ['Minneapolis', 'Minnesota', 1], ['Fargo', 'Fargo', 1], ['Santa Barbara', 'Santa Barbara', 0], ['Seattle', 'Seattle', 0]]) {
      gl.append('line').attr('x1', 146).attr('x2', W - 24).attr('y1', PY[k]).attr('y2', PY[k]).attr('stroke', 'rgba(255,255,255,.05)');
      txt(gl, 140, PY[k] + 4, label, { anchor: 'end', size: 12, fill: strong ? SOFT : MUTE });
    }
    txt(gl, 140, PY.Minneapolis + 16, 'Northfield · Mpls', { anchor: 'end', size: 9.5 });

    // time axis + named phases
    const ga = svg.append('g');
    for (let yr = 1998; yr <= 2026; yr++) {
      ga.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', 38).attr('y2', 45).attr('stroke', MUTE);
      if (yr < 2026) txt(ga, x(yr + .5), 32, `’${String(yr).slice(2)}`, { anchor: 'middle', size: 11.5, fill: yr % 5 === 0 ? INK : MUTE });
    }
    ga.append('line').attr('x1', x(1998)).attr('x2', x(2026)).attr('y1', 45).attr('y2', 45).attr('stroke', 'rgba(255,255,255,.16)');
    for (const p of A.D.phases) {
      const x0 = x(p.t0), x1 = x(Math.min(2026, p.t1));
      ga.append('line').attr('x1', x0 + 2).attr('x2', x1 - 2).attr('y1', 66).attr('y2', 66).attr('stroke', 'rgba(255,255,255,.2)');
      ga.append('line').attr('x1', x0 + 1).attr('x2', x0 + 1).attr('y1', 60).attr('y2', 72).attr('stroke', 'rgba(255,255,255,.35)');
      const lab = x1 - x0 > 150 ? p.name : x1 - x0 > 80 ? p.name.split(',')[0] : String(p.n);
      txt(ga, x0 + 6, 84, lab, { cls: 'serif', it: 1, size: 15, fill: SOFT });
    }

    // route
    const T = d3.range(1997.8, 2026.2, 0.02);
    const route = svg.append('path').attr('class', 'cx-route').attr('d', d3.line().x(t => x(t)).y(t => trunkY(t)).curve(d3.curveBasis)(T))
      .attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.32)').attr('stroke-width', 1.1);

    // strands: one per listening span
    const E = 0.07, ss = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
    const spans = [];
    for (const a of albums) a.spans.forEach((s, i) => spans.push({ key: `${a.id}-${i}`, a, s, i }));
    const rows = T.map(t => { const o = {}; for (const sp of spans) o[sp.key] = sp.a.w * Math.min(ss((t - (sp.s.t0 - E)) / (2 * E)), ss(((sp.s.t1 + E) - t) / (2 * E))); return o; });
    const stack = d3.stack().keys(spans.slice().sort((p, q) => p.s.t0 - q.s.t0).map(s => s.key)).order(d3.stackOrderInsideOut).offset(d3.stackOffsetSilhouette)(rows);
    const layer = new Map(stack.map(l => [l.key, l]));
    const bySpan = new Map(spans.map(s => [s.key, s]));
    const mid = (key, t) => { const i = Math.min(T.length - 1, Math.max(0, d3.bisectLeft(T, t))); const d = layer.get(key)[i]; return trunkY(T[i]) + (d[0] + d[1]) / 2 * K; };
    const env = (t, top) => { const i = d3.bisectLeft(T, t); return trunkY(T[i]) + (top ? d3.min(stack, l => l[i][0]) : d3.max(stack, l => l[i][1])) * K; };

    const reveal = svg.append('g').attr('clip-path', 'url(#cxReveal)');
    const gs = reveal.append('g');
    for (const l of stack) {
      const { a, s } = bySpan.get(l.key);
      const i0 = Math.max(0, d3.bisectLeft(T, s.t0 - 2 * E) - 1), i1 = Math.min(T.length - 1, d3.bisectLeft(T, s.t1 + 2 * E) + 1);
      const d = d3.area().x((_, j) => x(T[i0 + j])).y0((p, j) => trunkY(T[i0 + j]) + p[0] * K).y1((p, j) => trunkY(T[i0 + j]) + p[1] * K).curve(d3.curveBasis)(l.slice(i0, i1 + 1));
      const low = s.conf === 'low';
      gs.append('path').attr('class', 'st').attr('data-id', a.id).attr('d', d)
        .attr('fill', a.silent ? 'none' : A.tone(a)).attr('fill-opacity', low ? .36 : 1)
        .attr('stroke', a.silent ? '#6b7282' : low ? A.tone(a) : BG).attr('stroke-width', a.silent ? 1 : low ? 1 : .5)
        .attr('stroke-dasharray', a.silent || low ? '3 3' : null).attr('filter', low ? 'url(#cxSoft)' : null);
    }

    // tethers: memory anchored away from home
    const gt = reveal.append('g');
    const tlab = new Map();
    for (const a of albums) for (const an of a.anchors) {
      if (!an.away) continue;
      const sp = spans.find(s => s.a === a && an.t >= s.s.t0 - .01 && an.t < s.s.t1 + .01) || spans.find(s => s.a === a);
      const tx = x(an.t), y0 = mid(sp.key, an.t), y1 = PY[an.place];
      const g = gt.append('g').attr('class', 'te').attr('data-id', a.id);
      g.append('line').attr('x1', tx).attr('x2', tx).attr('y1', y0).attr('y2', y1).attr('stroke', A.tone(a)).attr('stroke-opacity', .8).attr('stroke-dasharray', '1.5 3');
      g.append('circle').attr('cx', tx).attr('cy', y1).attr('r', 3).attr('fill', BG).attr('stroke', A.tone(a)).attr('stroke-width', 1.2);
      if (!tlab.has(an.place)) tlab.set(an.place, []);
      tlab.get(an.place).push({ tx, y1, yr: Math.floor(an.t), up: y1 < y0 });
    }
    for (const [pin, arr] of tlab) {
      if (pin === 'Minneapolis' || pin === 'Outside Paris' || pin === 'Sologne' || pin === 'Paris') continue;
      const groups = [];
      for (const p of arr.sort((a, b) => a.tx - b.tx)) { const g = groups.at(-1); if (g && p.tx - g.at(-1).tx < 110) g.push(p); else groups.push([p]); }
      for (const g of groups) {
        const yrs = [...new Set(g.map(p => '’' + String(p.yr).slice(2)))].join(' ');
        const left = pin === 'Edina', p = left ? g[0] : g.at(-1);
        txt(gt, p.tx + (left ? -7 : 7), p.y1 + (p.up ? -7 : 14), `${A.placeLabel(pin)} ${yrs}`, { size: 11, fill: SOFT, anchor: left ? 'end' : 'start' });
      }
    }

    // beads
    const gb = reveal.append('g');
    const R = { 1: 9, 2: 4.6, 3: 2.8, 4: 2.4 };
    const seen = new Map();
    for (const sp of spans.slice().sort((p, q) => q.a.rank - p.a.rank)) {
      const { a, s, key } = sp;
      const k = s.t0.toFixed(2); const n = seen.get(k) || 0; seen.set(k, n + 1);
      const t = s.t0 + .09 + (n % 3) * .045, cx = x(t), cy = mid(key, t), r = sp.i ? Math.min(5, R[a.rank]) : R[a.rank] || 3;
      const col = A.tone(a), low = s.conf === 'low';
      const g = gb.append('g').attr('class', 'bd').attr('data-id', a.id).attr('data-x', cx);
      if (a.rank === 1 && a.cover && !sp.i) {
        defs.append('clipPath').attr('id', `cxk${a.id}`).append('circle').attr('cx', cx).attr('cy', cy).attr('r', r);
        g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r + 2.4).attr('fill', BG);
        g.append('image').attr('href', a.cover).attr('x', cx - r).attr('y', cy - r).attr('width', 2 * r).attr('height', 2 * r)
          .attr('clip-path', `url(#cxk${a.id})`).attr('preserveAspectRatio', 'xMidYMid slice');
        g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r + 1).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.6).attr('stroke-dasharray', low ? '2 2' : null);
      } else {
        g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r).attr('fill', a.silent ? BG : col)
          .attr('stroke', a.silent ? '#8a91a0' : BG).attr('stroke-width', 1).attr('stroke-dasharray', low || a.silent ? '2 2' : null);
      }
      if (!sp.i) Object.assign(a, { _cx: cx, _cy: cy, _cr: r });
    }
    // Push Barman's two summers, joined
    for (const a of albums.filter(a => a.spans.length > 1)) {
      const k0 = `${a.id}-0`, k1 = `${a.id}-1`;
      const x0 = x(a.spans[0].t1 - .05), x1 = x(a.spans[1].t0 + .05), y0 = mid(k0, a.spans[0].t1 - .12), y1 = mid(k1, a.spans[1].t0 + .12);
      reveal.append('path').attr('class', 'te').attr('data-id', a.id).attr('d', `M${x0},${y0} C${x0 + 60},${y0 - 40} ${x1 - 60},${y1 - 40} ${x1},${y1}`)
        .attr('fill', 'none').attr('stroke', A.tone(a)).attr('stroke-width', 1).attr('stroke-dasharray', '1 4');
    }

    // Minard's numbers
    const gnum = reveal.append('g');
    const conc = t => A.rotationAt(t).n;
    for (const [t, top, sfx] of [[2000.1, 1, ''], [2007.8, 1, ' ALBUMS IN ROTATION'], [2009.3, 1, ''], [2011.1, 1, ''], [2014.25, 1, ''], [2017.7, 1, ''], [2020.3, 1, ''], [2023.9, 0, '']]) {
      const n = conc(t);
      txt(gnum, x(t), top ? env(t, 1) - 9 : env(t, 0) + 18, n + sfx, { anchor: 'middle', size: n ? 12.5 : 14, fill: n ? INK : '#ffb4a8', ls: sfx ? '.12em' : null });
    }

    // chapter names on the route
    const gc = reveal.append('g');
    for (const [t, y, s] of [[2002.6, 176, 'PARIS'], [2010.2, 554, 'NORTHFIELD · CARLETON'], [2014.5, 404, 'NEW YORK'], [2018.1, 550, 'MINNEAPOLIS'], [2021.1, 592, 'FARGO'], [2023.2, 432, 'ATLANTA']]) {
      txt(gc, x(t), y, s, { anchor: 'middle', size: 12.5, ls: '.32em', fill: INK });
    }

    // verbatim notes: headings are public, the quoted words arrive with the unlock
    const gn = svg.append('g').attr('class', 'cx-notes');
    const redact = (g, x0, y0, anchor, w) => g.append('rect').attr('class', 'pk-bar')
      .attr('x', anchor === 'end' ? x0 - w : anchor === 'middle' ? x0 - w / 2 : x0).attr('y', y0 - 11).attr('width', w).attr('height', 12).attr('rx', 2);
    function note(id, dx, ly, head, key, anchor = 'start', size = 16) {
      const a = A.byId.get(id), above = ly < a._cy, lx = a._cx + dx;
      gn.append('path').attr('d', `M${a._cx},${a._cy + (above ? -a._cr - 2 : a._cr + 2)} V${above ? ly + 26 : ly - 14} H${lx + (anchor === 'end' ? 3 : -3)}`)
        .attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.3)').attr('stroke-width', .8);
      txt(gn, lx, ly, head, { size: 10, ls: '.12em', anchor });
      txt(gn, lx, ly + 19, A.note(key), { cls: 'serif', it: 1, size, fill: SOFT, anchor }).attr('data-pk', key);
      redact(gn, lx, ly + 19, anchor, 150);
    }
    note(71, 10, 106, 'ORIGIN POINT · THE BEATLES', 'cx71');
    note(73, 10, 314, 'SUPERTRAMP · 1998', 'cx73');
    note(8, 12, 314, 'LED ZEPPELIN · THE HINGE', 'cx8');
    note(61, -12, 634, 'THE DECEMBERISTS · FALL 2008', 'cx61', 'end', 15);
    note(24, -10, 574, 'JOANNA NEWSOM · YS', 'cx24', 'end', 15);
    note(88, 10, 106, 'DAFT PUNK · 2013', 'cx88');
    note(5, 10, 150, 'SUFJAN STEVENS · CARRIE & LOWELL', 'cx5');
    note(106, -10, 314, 'KHRUANGBIN · A LA SALA', 'cx106', 'end');
    note(103, -10, 382, 'HERMANOS GUTIÉRREZ', 'cx103', 'end');
    const pn = A.D.places.Paris, nf = A.D.places.Northfield, rad = d => d * Math.PI / 180;
    const dkm = 2 * 6371 * Math.asin(Math.sqrt(Math.sin(rad(nf.lat - pn.lat) / 2) ** 2 + Math.cos(rad(pn.lat)) * Math.cos(rad(nf.lat)) * Math.sin(rad(nf.lon - pn.lon) / 2) ** 2));
    ['FALL 2008', 'PARIS → NORTHFIELD', `${(Math.round(dkm / 10) * 10).toLocaleString('en-US')} KM`].forEach((l, i) => txt(gn, x(2008.95) + 12, 420 + i * 15, l, { size: 10, ls: '.12em', fill: SOFT }));
    txt(gn, x(2008.8), 166, 'EACH COLLEGE SUMMER: PARIS', { size: 10, ls: '.12em', fill: SOFT });

    // temperature
    const gT = reveal.append('g');
    const ty = d3.scaleLinear([-14, 10], [800, 700]);
    txt(gT, 150, 672, 'WINTER AT HOME BASE · MEAN °C · CLIMATE NORMALS, FOR CONTEXT · AFTER MINARD’S TEMPERATURE SCALE', { size: 10, ls: '.12em' });
    for (const v of [-10, 0, 10]) {
      gT.append('line').attr('x1', 146).attr('x2', W - 24).attr('y1', ty(v)).attr('y2', ty(v)).attr('stroke', v === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)').attr('stroke-dasharray', v === 0 ? '4 4' : null);
      txt(gT, 140, ty(v) + 4, (v > 0 ? '+' : '') + v + '°', { anchor: 'end', size: 11 });
    }
    const winters = d3.range(1999, 2026).map(Y => { const t = Y + .08, home = A.homeAt(t); return { t, v: A.D.places[home].climate[0], home }; });
    gT.append('path').attr('d', d3.line().x(d => x(d.t)).y(d => ty(d.v)).curve(d3.curveStepAfter)(winters.concat([{ t: 2026, v: winters.at(-1).v }])))
      .attr('fill', 'none').attr('stroke', INK).attr('stroke-width', 1.6);
    let prev = null;
    for (const d of winters) {
      gT.append('circle').attr('cx', x(d.t)).attr('cy', ty(d.v)).attr('r', 2.2).attr('fill', INK);
      if (!prev || prev.home !== d.home) txt(gT, x(d.t) + 6, ty(d.v) + (d.v < 0 ? 17 : -8), `${d.v > 0 ? '+' : ''}${d.v.toFixed(0)}°  ${A.placeLabel(d.home)}`, { size: 11, fill: SOFT });
      prev = d;
    }
    for (const a of albums.filter(a => a.cold && a._cx)) {
      const yT = ty(A.D.places[A.homeAt(a.t0 + .01)].climate[0]);
      const g = gT.append('g').attr('class', 'te').attr('data-id', a.id);
      g.append('line').attr('x1', a._cx).attr('x2', a._cx).attr('y1', a._cy + a._cr + 2).attr('y2', yT - 4).attr('stroke', ICE).attr('stroke-opacity', .55).attr('stroke-dasharray', '2 4');
      g.append('circle').attr('cx', a._cx).attr('cy', yT).attr('r', 3.4).attr('fill', BG).attr('stroke', ICE).attr('stroke-width', 1.1);
    }
    const air = A.byId.get(17);
    txt(gT, air._cx - 40, 832, A.note('cx17'), { cls: 'serif', it: 1, size: 18, fill: '#bcd8ff' }).attr('data-pk', 'cx17');
    redact(gT, air._cx - 40, 830, 'start', 250);
    txt(gT, air._cx - 40, 849, 'AIR, TALKIE WALKIE · DOTTED LINES: EVERY MEMORY THAT MENTIONS COLD, SNOW OR FREEZING', { size: 9.5, ls: '.1em' });

    // how it arrived
    const gm = reveal.append('g');
    txt(gm, 150, 884, 'HOW IT ARRIVED', { size: 10, ls: '.12em' });
    [['stereo', 'stereo'], ['car-stereo', 'car stereo'], ['ipod', 'iPod'], ['streaming', 'streaming'], ['youtube', 'YouTube'], [null, 'not recorded']].forEach(([k, lab], i) => {
      const y = 902 + i * 14;
      txt(gm, 140, y + 4, lab, { anchor: 'end', size: 10.5, fill: k ? SOFT : MUTE });
      gm.append('line').attr('x1', 146).attr('x2', W - 24).attr('y1', y).attr('y2', y).attr('stroke', 'rgba(255,255,255,.035)');
      for (const a of albums.filter(a => a.medium === k)) for (const s of a.spans)
        gm.append('line').attr('class', 'st').attr('data-id', a.id).attr('x1', x(s.t0)).attr('x2', x(Math.max(s.t1, s.t0 + .12))).attr('y1', y).attr('y2', y)
          .attr('stroke', k ? A.tone(a) : '#343945').attr('stroke-width', 5).attr('stroke-linecap', 'round');
    });

    // reading it
    const gk = svg.append('g').attr('transform', 'translate(150,1010)');
    ['Band width = albums in rotation, each weighted by how hard it was played. Every strand is one album. Full colour = anchors, turning points and the hinge.',
     'The band follows the home base. Dotted tethers drop to where a memory is anchored, when that was somewhere else. Hollow strands have nothing written yet.',
     'Blurred, dashed strands are dates Pierre is unsure of. The hairline is the route; it keeps going when the music stops.'
    ].forEach((s, i) => txt(gk, 0, i * 21, s, { cls: 'sans', size: 13, fill: SOFT }));

    // cursor readout
    cursor = svg.append('line').attr('y1', 50).attr('y2', 960).attr('stroke', 'rgba(255,255,255,.35)').attr('stroke-dasharray', '2 3').attr('opacity', 0).attr('pointer-events', 'none');
    svg.on('pointermove', ev => {
      const [mx] = d3.pointer(ev);
      const t = x.invert(mx);
      if (t < 1998 || t > 2026) { cursor.attr('opacity', 0); readEl.style.opacity = 0; return; }
      cursor.attr('x1', mx).attr('x2', mx).attr('opacity', 1);
      const r = A.rotationAt(t), ph = A.phaseAt(t);
      readEl.innerHTML = `${A.esc(A.seasonLabel(t))}, ${A.esc(A.placeLabel(A.homeAt(t)))}, <b>${r.n}</b> in rotation, ${A.esc(ph.name)}`;
      const box = root.getBoundingClientRect(), sb = svg.node().getBoundingClientRect();
      readEl.style.left = (ev.clientX - box.left) + 'px';
      readEl.style.top = (sb.top - box.top + 8) + 'px';
      readEl.style.opacity = 1;
    });
    svg.on('pointerleave', () => { cursor.attr('opacity', 0); readEl.style.opacity = 0; unhover(); });

    // hover + click
    svg.selectAll('.st,.bd').on('pointerenter', function (ev) { hoverId(+this.dataset.id, ev); })
      .on('pointermove', function (ev) { const a = A.byId.get(+this.dataset.id); A.tip(a, ev.clientX, ev.clientY); })
      .on('pointerleave', unhover)
      .on('click', function () { A.openPanel(+this.dataset.id); });

    built = true;
    route.attr('stroke-dasharray', null);
    V._route = route; V._clip = clip;
  }

  function hoverId(id, ev) {
    svg.classed('hl', true);
    svg.selectAll('.st,.bd,.te').classed('on', function () { return +this.dataset.id === id; });
    if (ev) A.tip(A.byId.get(id), ev.clientX, ev.clientY);
  }
  function unhover() { svg.classed('hl', false); svg.selectAll('.on').classed('on', false); A.tip(null); }

  const FILTERS = {
    major: a => A.major(a), obsessive: a => a.intensity === 'obsessive', away: a => a.anchors.some(x => x.away),
    cold: a => a.cold, silent: a => a.silent, low: a => a.spans.some(s => s.conf === 'low'),
  };
  function filter(f) {
    const fn = FILTERS[f];
    svg.classed('flt', !!fn);
    svg.selectAll('.st,.bd,.te').classed('m', function () { return fn ? fn(A.byId.get(+this.dataset.id)) : false; });
  }

  function animate(force) {
    if (A.reduced || (animated && !force)) return;
    animated = true;
    const clip = V._clip, route = V._route, len = route.node().getTotalLength();
    clip.interrupt().attr('width', 150).transition().duration(4200).ease(d3.easeCubicInOut).attr('width', W);
    route.interrupt().attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
      .transition().duration(4200).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0).on('end', () => route.attr('stroke-dasharray', null));
    svg.select('.cx-notes').interrupt().attr('opacity', 0).transition().delay(3400).duration(900).attr('opacity', 1);
  }

  function show() { if (built) animate(false); }
  function hide() { unhover(); }
  function focus(id) {
    const a = A.byId.get(+id); if (!a || !a._cx) return;
    const sw = svg.node().getBoundingClientRect().width / W;
    scroll.scrollTo({ left: Math.max(0, a._cx * sw - scroll.clientWidth / 2), behavior: A.reduced ? 'auto' : 'smooth' });
    root.scrollIntoView({ behavior: A.reduced ? 'auto' : 'smooth', block: 'start' });
    hoverId(a.id);
    setTimeout(unhover, 2600);
  }
})();
