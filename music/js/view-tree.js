/* The Listening Tree — lineage of taste, interactive. Time runs up; limbs are discovery channels. */
(function () {
  'use strict';
  const A = window.Atlas;
  const V = { init, show, hide, focus };
  A.views.tree = V;

  const W = 1600, H = 1210, STEM = 800;
  const INK = '#f2f4f8', SOFT = '#a9b0c0', MUTE = '#6b7282', BG = '#07080c', BONE = '#cbbfae';
  const yT = d3.scaleLinear([1997.6, 2026.3], [1070, 84]);
  const albums = A.albums;
  let root, svg, gz, zoom, clipRect, yearIn, yearOut, built = false, grown = false;
  A.on('unlock', () => {
    if (!svg) return;
    svg.selectAll('[data-pk]').text(function () { return A.note(this.dataset.pk); });
    svg.selectAll('[data-pks]').each(function () { const s = A.note(this.dataset.pks); if (s) this.textContent = `${this.dataset.n} albums · ${s}`; });
  });

  const LIMB = {
    family:     { x: STEM, lean: 0,   label: 'FAMILY', sub: 'family · last one arrives summer 2008', pk: 'trsub:family' },
    classic:    { x: 955,  lean: 11,  label: 'THE CLASSIC-ROCK DIVE', sub: 'via Led Zeppelin' },
    live:       { x: 930,  lean: 7,   label: 'LIVE', sub: 'festival · concert · Bonnaroo' },
    friends:    { x: 1150, lean: 8,   label: 'FRIENDS · PEERS · ROOMMATES', sub: 'friends · dorm', pk: 'trsub:friends' },
    self:       { x: 560,  lean: -7,  label: 'SELF-DIRECTED', sub: 'self · exploration · catalog · release · record store' },
    screens:    { x: 335,  lean: -7,  label: 'FILM · TV · THE CULTURE', sub: 'movie · tv · soundtrack · cultural moment · YouTube' },
    unrecorded: { x: 105,  lean: 0,   label: 'NOT RECORDED', sub: 'no discovery channel yet' },
  };
  const colX = (k, t) => LIMB[k].x + LIMB[k].lean * (t - 2008);
  const limbOf = a => (a.channel === 'classic-rock-dive' ? 'classic' : a.group);
  const RR = { 1: 12.5, 2: 8.6, 3: 6.2, 4: 5.2 };
  const txt = (g, x0, y0, s, o = {}) => g.append('text').attr('x', x0).attr('y', y0).attr('class', o.cls || 'mono')
    .attr('font-size', o.size || 11).attr('fill', o.fill || MUTE).attr('text-anchor', o.anchor || 'start')
    .attr('letter-spacing', o.ls || null).attr('font-style', o.it ? 'italic' : null).attr('opacity', o.op ?? null).text(s);

  function init(el) {
    root = el;
    root.innerHTML = `
      <div class="atlas-bar">
        <button class="ctl" data-a="grow">▶ Grow it again</button>
        <label class="tr-year"><span class="lbl">Up to</span><input type="range" min="1998" max="2026" step="0.25" value="2026" aria-label="Show the tree up to year"><output>2025</output></label>
        <span class="spacer"></span>
        <span class="lbl">Limb</span>
        ${Object.entries(LIMB).map(([k, L]) => `<button class="chip-btn" data-l="${k}" aria-pressed="false">${L.label.split(' · ')[0].toLowerCase().replace('the ', '')}</button>`).join('')}
        <span class="zoom"><button class="ctl" data-z="in" aria-label="Zoom in">＋</button><button class="ctl" data-z="out" aria-label="Zoom out">－</button><button class="ctl" data-z="reset">Fit</button></span>
      </div>
      <div class="tr-wrap"><svg class="tr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="The Listening Tree: albums grouped by how they were discovered"></svg></div>`;
    svg = d3.select(root.querySelector('svg'));
    yearIn = root.querySelector('input[type=range]'); yearOut = root.querySelector('output');
    root.querySelector('.atlas-bar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'grow') return grow(true);
      if (b.dataset.z) return zoomBy(b.dataset.z);
      if (b.dataset.l) {
        const on = b.getAttribute('aria-pressed') !== 'true';
        root.querySelectorAll('[data-l]').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', String(on));
        highlightLimb(on ? b.dataset.l : null);
      }
    });
    yearIn.addEventListener('input', () => setYear(+yearIn.value, false));
    build();
  }

  function build() {
    const defs = svg.append('defs');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      .tr-svg .serif{font-family:'Instrument Serif',Georgia,serif}.tr-svg .mono{font-family:'JetBrains Mono',monospace}.tr-svg .sans{font-family:Inter,system-ui,sans-serif}
      .tr-svg .lf{cursor:pointer;transition:opacity .25s}.tr-svg .th,.tr-svg .tw{transition:opacity .25s}
      .tr-svg.hl .lf:not(.on){opacity:.14}.tr-svg.hl .th:not(.on){opacity:.05}.tr-svg.hl .tw:not(.on){opacity:.15}
      .tr-svg .lf.future{opacity:0;pointer-events:none}.tr-svg .th.future,.tr-svg .tw.future,.tr-svg .lbl.future{opacity:0}.tr-svg .lbl{transition:opacity .3s}`;
    svg.node().prepend(style);
    clipRect = defs.append('clipPath').attr('id', 'trGrow').append('rect').attr('x', -2000).attr('width', W + 4000).attr('y', -2000).attr('height', H + 4000);

    gz = svg.append('g');
    // strata: the seven chapters
    const gS = gz.append('g');
    A.D.phases.forEach((p, i) => {
      const y0 = yT(Math.min(p.t1, 2026.3)), y1 = yT(p.t0);
      gS.append('rect').attr('x', -2000).attr('y', y0).attr('width', W + 4000).attr('height', y1 - y0).attr('fill', i % 2 ? 'rgba(255,255,255,.022)' : 'rgba(255,255,255,0)');
      gS.append('line').attr('x1', -2000).attr('x2', W + 2000).attr('y1', y1).attr('y2', y1).attr('stroke', 'rgba(255,255,255,.06)');
      txt(gS, W - 28, y1 - 11, p.name.toUpperCase(), { anchor: 'end', size: 11, ls: '.26em', fill: SOFT, op: .8 });
      txt(gS, W - 28, y1 - 26, `${Math.floor(p.t0)}–${p.t1 > 2025.5 ? 'now' : String(Math.floor(p.t1 - .01)).slice(2)}`, { anchor: 'end', size: 9.5 });
    });
    for (let yr = 2000; yr <= 2025; yr += 5) { txt(gS, 24, yT(yr) + 4, yr, { size: 10.5 }); gS.append('line').attr('x1', 60).attr('x2', 68).attr('y1', yT(yr)).attr('y2', yT(yr)).attr('stroke', MUTE); }

    // leaves: y is time, x packs around the limb
    const rnd = d3.randomLcg(11);
    const nodes = [];
    for (const a of albums) {
      const k = limbOf(a);
      nodes.push({ a, key: `${a.id}`, echo: false, r: RR[a.rank] || 6.2, x: colX(k, a.t0) + (rnd() - .5) * 30, y: yT(a.t0 + .12), ty: yT(a.t0 + .12), tx: colX(k, a.t0) });
      a.spans.slice(1).forEach((s, i) => nodes.push({ a, key: `${a.id}-${i + 1}`, echo: true, r: 5.5, x: colX(k, s.t0) + (rnd() - .5) * 30, y: yT(s.t0 + .12), ty: yT(s.t0 + .12), tx: colX(k, s.t0), t: s.t0 }));
    }
    const sim = d3.forceSimulation(nodes)
      .force('x', d3.forceX(d => d.tx).strength(d => ({ unrecorded: .1, self: .016, friends: .02 })[limbOf(d.a)] ?? .045))
      .force('y', d3.forceY(d => d.ty).strength(.62))
      .force('c', d3.forceCollide(d => d.r + 2.4).iterations(5)).stop();
    for (let i = 0; i < 700; i++) sim.tick();
    const leafOf = new Map(nodes.filter(n => !n.echo).map(n => [n.a.id, n]));

    // limbs as tapered ribbons
    const gL = gz.append('g').attr('class', 'limbs');
    const LP = {};
    const zep = leafOf.get(8);
    for (const k of ['family', 'classic', 'screens', 'self', 'friends', 'live']) {
      const leaves = nodes.filter(n => limbOf(n.a) === k);
      const ts = leaves.map(n => n.echo ? n.t : n.a.t0);
      const tFork = k === 'family' ? 1997.9 : k === 'classic' ? zep.a.t0 + .12 : d3.min(ts) - .15;
      const tTop = d3.max(ts) + .12;
      const fx = k === 'classic' ? zep.x : STEM, fy = k === 'classic' ? zep.y : yT(tFork);
      const tB = Math.min(tTop, tFork + (k === 'family' ? .01 : k === 'classic' ? 1.4 : 2.2));
      const bx = colX(k, tB), by = yT(tB);
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, v = 1 - u, c1x = fx + (bx - fx) * .6, c1y = fy - (fy - by) * .08, c2x = bx, c2y = by + (fy - by) * .5;
        pts.push([v * v * v * fx + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * bx, v * v * v * fy + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * by]);
      }
      for (let t = tB + .1; t <= tTop; t += .1) pts.push([colX(k, t) + Math.sin(t * 3.1 + k.length) * 1.4, yT(t)]);
      LP[k] = pts;
      const wd = pts.map(p => 1.1 + 1.55 * Math.sqrt(leaves.filter(n => n.y < p[1] + 2).length) * (k === 'family' ? 1.3 : 1));
      const L = [], Rr = [];
      pts.forEach((p, i) => {
        const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        let dx = q[0] - o[0], dy = q[1] - o[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        L.push([p[0] - dy * wd[i] / 2, p[1] + dx * wd[i] / 2]); Rr.push([p[0] + dy * wd[i] / 2, p[1] - dx * wd[i] / 2]);
      });
      gL.append('path').attr('class', 'tw').attr('data-l', k).attr('d', 'M' + L.map(p => p.join(',')).join('L') + 'L' + Rr.reverse().map(p => p.join(',')).join('L') + 'Z')
        .attr('fill', BONE).attr('fill-opacity', .62);
    }
    gz.append('line').attr('x1', STEM).attr('x2', STEM).attr('y1', yT(2008.8)).attr('y2', yT(2026.1)).attr('stroke', BONE).attr('stroke-opacity', .2).attr('stroke-dasharray', '2 5');

    // twigs
    const gW = gz.append('g');
    for (const n of nodes) {
      const k = limbOf(n.a); if (k === 'unrecorded') continue;
      let best = LP[k][0], bd = Infinity;
      for (const p of LP[k]) { const d = (p[0] - n.x) ** 2 + (p[1] - (n.y + 14)) ** 2; if (d < bd) { bd = d; best = p; } }
      gW.append('path').attr('class', 'tw').attr('data-id', n.a.id).attr('data-t', n.echo ? n.t : n.a.t0)
        .attr('d', `M${best[0]},${best[1]} Q${(best[0] + n.x) / 2},${best[1] + 2} ${n.x},${n.y + n.r}`)
        .attr('fill', 'none').attr('stroke', BONE).attr('stroke-opacity', .4).attr('stroke-width', .9);
    }
    const u = nodes.filter(n => limbOf(n.a) === 'unrecorded');
    gz.insert('line', '.limbs').attr('x1', LIMB.unrecorded.x).attr('x2', LIMB.unrecorded.x).attr('y1', d3.min(u, n => n.y)).attr('y2', d3.max(u, n => n.y))
      .attr('stroke', BONE).attr('stroke-opacity', .16).attr('stroke-dasharray', '2 6');

    // lineage the prose states: the Garden State pipeline
    const gX = gz.append('g');
    const gs = leafOf.get(47);
    for (const tId of [67, 69]) {
      const B = leafOf.get(tId);
      gX.append('path').attr('class', 'th').attr('data-id', `${47} ${tId}`).attr('data-t', B.a.t0).attr('d', `M${gs.x},${gs.y} C${gs.x},${(gs.y + B.y) / 2} ${B.x},${(gs.y + B.y) / 2} ${B.x},${B.y}`)
        .attr('fill', 'none').attr('stroke', INK).attr('stroke-opacity', .5).attr('stroke-width', 1);
    }
    txt(gX, gs.x - 12, gs.y + 30, 'the Garden State pipeline', { cls: 'serif', it: 1, size: 14, fill: SOFT, anchor: 'end' });

    // artist threads: artists who came back years later
    const gA = gz.append('g');
    const longThreads = [];
    for (const [, list] of d3.groups(albums, a => a.artist.toLowerCase())) {
      const pts = list.flatMap(a => nodes.filter(n => n.a === a)).sort((p, q) => (p.echo ? p.t : p.a.t0) - (q.echo ? q.t : q.a.t0));
      if (pts.length < 2) continue;
      const span = (pts.at(-1).echo ? pts.at(-1).t : pts.at(-1).a.t0) - (pts[0].echo ? pts[0].t : pts[0].a.t0);
      if (span < 1.5) continue;
      if (span >= 4) longThreads.push({ pts, span });
      for (let i = 1; i < pts.length; i++) {
        const P = pts[i - 1], Q = pts[i], bow = Math.max(-120, Math.min(120, (Q.x - P.x) * .3));
        gA.append('path').attr('class', 'th').attr('data-id', `${P.a.id} ${Q.a.id}`).attr('data-t', Q.echo ? Q.t : Q.a.t0)
          .attr('d', `M${P.x},${P.y} C${P.x + bow},${P.y - 50} ${Q.x - bow},${Q.y + 50} ${Q.x},${Q.y}`)
          .attr('fill', 'none').attr('stroke', A.vivid(P.a)).attr('stroke-opacity', .8).attr('stroke-width', 1.3).attr('stroke-dasharray', '1 4').attr('stroke-linecap', 'round');
      }
    }

    // leaves
    const gF = gz.append('g');
    for (const n of nodes.slice().sort((p, q) => q.r - p.r)) {
      const a = n.a, col = A.tone(a), low = n.echo ? true : a.conf === 'low', quiet = a.silent;
      const g = gF.append('g').attr('class', 'lf').attr('data-id', a.id).attr('data-t', n.echo ? n.t : a.t0)
        .attr('transform', `translate(${n.x},${n.y})`);
      const inner = g.append('g').attr('class', 'lf-in');
      inner.append('circle').attr('r', n.r + 1.8).attr('fill', BG);
      if (a.cover) {
        const cid = `trc${n.key.replace('-', '_')}`;
        defs.append('clipPath').attr('id', cid).append('circle').attr('r', n.r);
        inner.append('image').attr('href', a.cover).attr('x', -n.r).attr('y', -n.r).attr('width', 2 * n.r).attr('height', 2 * n.r)
          .attr('clip-path', `url(#${cid})`).attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('opacity', n.echo ? .35 : quiet ? .32 : low ? .55 : A.major(a) ? 1 : .82);
      } else inner.append('circle').attr('r', n.r).attr('fill', col).attr('fill-opacity', quiet ? .15 : .9);
      inner.append('circle').attr('r', n.r + .7).attr('fill', 'none').attr('stroke', col).attr('stroke-width', A.major(a) && !n.echo ? 1.8 : 1.1)
        .attr('stroke-dasharray', low || quiet ? '2.2 2.2' : null);
      n.el = g;
    }

    // labels: rank-1 artists once, flip or skip on collision; verbatim notes reserve their space first
    const gN = gz.append('g').attr('pointer-events', 'none');
    const boxes = [];
    const NOTES = [
      [71, -48, 18, 'ORIGIN POINT · THE BEATLES · 1998', 'tr71', 54, 'end'],
      [8, -40, -34, 'LED ZEPPELIN · 2004', 'tr8', 49, 'end'],
      [82, 56, 22, 'LINKIN PARK · 2001 · THE FIRST FORK', 'tr82', 28, 'start'],
      [15, 44, -26, 'ANDREW BIRD · 2008', 'tr15', 27, 'start'],
      [41, 118, 28, 'MUMFORD & SONS · 2011', 'tr41', 39, 'start'],
      [104, -44, 34, 'VULFPECK · 2023', 'tr104', 32, 'end'],
    ];
    for (const [id, dx, dy, head, , len, anchor] of NOTES) {
      const n = leafOf.get(id), lx = n.x + dx, ly = n.y + dy, w = Math.max(head.length * 6.4, len * 7.2);
      boxes.push({ x: anchor === 'end' ? lx - w : lx, y: ly - 11, w, h: 28 });
    }
    const free = (x0, y0, w, h) => x0 > 70 && x0 + w < W - 180 && !boxes.some(b => x0 < b.x + b.w && x0 + w > b.x && y0 < b.y + b.h && y0 + h > b.y);
    function placeLabel(g, n, s, fill) {
      const w = s.length * 6.2 + 4, h = 13, pref = n.x >= colX(limbOf(n.a), n.a.t0);
      for (const right of [pref, !pref]) {
        const x0 = right ? n.x + n.r + 5 : n.x - n.r - 5 - w;
        if (free(x0, n.y - 8, w, h)) { boxes.push({ x: x0, y: n.y - 8, w, h }); txt(g, right ? x0 : x0 + w, n.y + 4, s, { size: 10, fill, anchor: right ? 'start' : 'end', op: .92 }).attr('class', 'mono lbl').attr('data-t', n.a.t0); return true; }
      }
      return false;
    }
    const named = new Set();
    for (const n of nodes.filter(n => !n.echo && n.a.rank === 1).sort((p, q) => p.a.t0 - q.a.t0)) {
      if (named.has(n.a.artist)) continue;
      if (placeLabel(gN, n, n.a.artist, INK)) named.add(n.a.artist);
    }
    for (const { pts, span } of longThreads.sort((p, q) => q.span - p.span).slice(0, 4)) {
      const B = pts.at(-1);
      placeLabel(gN, B, `${B.a.artist} · ${new Set(pts.map(p => p.a.id)).size} albums · ${Math.round(span)} yrs`, A.vivid(B.a));
    }

    // limb names
    const gLab = gz.append('g').attr('pointer-events', 'none');
    for (const [k, L] of Object.entries(LIMB)) {
      const leaves = nodes.filter(n => limbOf(n.a) === k && !n.echo);
      const low = d3.greatest(leaves, n => n.y), high = d3.least(leaves, n => n.y);
      const anchor = k === 'family' ? 'end' : 'middle';
      const xl = k === 'family' ? STEM - 26 : k === 'live' ? colX(k, high.a.t0) : colX(k, low.a.t0);
      const yb = k === 'live' ? high.y - 44 : low.y + (k === 'family' ? 50 : 38);
      const tFirst = d3.min(leaves, n => n.a.t0);
      txt(gLab, xl, yb, L.label, { size: 12, ls: '.26em', fill: INK, anchor }).attr('class', 'mono lbl').attr('data-t', tFirst);
      const sub = txt(gLab, xl, yb + 15, `${leaves.length} albums · ${L.pk && !A.locked ? A.note(L.pk) || L.sub : L.sub}`, { size: 9.5, fill: MUTE, anchor }).attr('class', 'mono lbl').attr('data-t', tFirst);
      if (L.pk) sub.attr('data-pks', L.pk).attr('data-n', leaves.length);
    }
    const uu = nodes.filter(n => limbOf(n.a) === 'unrecorded');
    txt(gLab, 40, d3.max(uu, n => n.y) + 80, 'Kid A, The Wall, Illinois and 15 others', { cls: 'serif', it: 1, size: 15, fill: SOFT });
    txt(gLab, 40, d3.max(uu, n => n.y) + 97, 'have no discovery channel yet.', { cls: 'serif', it: 1, size: 15, fill: SOFT });

    // verbatim notes: headings are public, the quoted words arrive with the unlock
    const gn = gz.append('g').attr('pointer-events', 'none');
    function note(id, dx, dy, head, key, len, anchor = 'start') {
      const n = leafOf.get(id), lx = n.x + dx, ly = n.y + dy;
      gn.append('path').attr('d', `M${n.x + Math.sign(dx) * (n.r + 2)},${n.y} H${n.x + dx * .45} L${lx - Math.sign(dx) * 4},${ly + 5}`)
        .attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.3)').attr('stroke-width', .8).attr('class', 'lbl').attr('data-t', n.a.t0);
      txt(gn, lx, ly, head, { size: 9.5, ls: '.12em', anchor }).attr('class', 'mono lbl').attr('data-t', n.a.t0);
      txt(gn, lx, ly + 19, A.note(key), { cls: 'serif', it: 1, size: 15.5, fill: SOFT, anchor }).attr('class', 'serif lbl').attr('data-t', n.a.t0).attr('data-pk', key);
      const w = Math.min(150, len * 7.2);
      gn.append('rect').attr('class', 'pk-bar lbl').attr('data-t', n.a.t0)
        .attr('x', anchor === 'end' ? lx - w : lx).attr('y', ly + 8).attr('width', w).attr('height', 12).attr('rx', 2);
    }
    for (const args of NOTES) note(...args);

    // reading it
    const gk = svg.append('g').attr('transform', `translate(40,${H - 40})`);
    ['Time runs up, 1998 at the root. Limbs are the discovery channels in the data, grouped; each forks when its first album arrives.',
     'Leaf size = influence. Full-colour ring = anchor, turning point or hinge. Dashed = unsure of the date, or nothing written yet. Dotted curves = an artist returning.'
    ].forEach((s, i) => txt(gk, 0, i * 20, s, { cls: 'sans', size: 12.5, fill: SOFT }));

    // interaction
    svg.selectAll('.lf').on('pointerenter', function (ev) { hoverAlbum(+this.dataset.id, ev); })
      .on('pointermove', function (ev) { A.tip(A.byId.get(+this.dataset.id), ev.clientX, ev.clientY); })
      .on('pointerleave', unhover)
      .on('click', function () { A.openPanel(+this.dataset.id); });
    svg.selectAll('.tw[data-l]').style('cursor', 'pointer').on('pointerenter', function () { highlightLimb(this.dataset.l); }).on('pointerleave', () => highlightLimb(null));

    zoom = d3.zoom().scaleExtent([1, 6]).translateExtent([[-200, -100], [W + 200, H + 100]])
      .filter(ev => (ev.type === 'wheel' ? ev.ctrlKey || ev.metaKey : ev.type.startsWith('touch') ? ev.touches.length > 1 : !ev.button))
      .on('zoom', ev => gz.attr('transform', ev.transform));
    svg.call(zoom).on('dblclick.zoom', null);
    V._nodes = nodes;
    built = true;
  }

  function hoverAlbum(id, ev) {
    const a = A.byId.get(id);
    const same = new Set(albums.filter(x => x.artist === a.artist).map(x => x.id));
    svg.classed('hl', true);
    svg.selectAll('.lf').classed('on', function () { return same.has(+this.dataset.id); });
    svg.selectAll('.th').classed('on', function () { return this.dataset.id.split(' ').some(v => same.has(+v)); });
    svg.selectAll('.tw').classed('on', function () { return this.dataset.l === limbOf(a) || same.has(+this.dataset.id); });
    if (ev) A.tip(a, ev.clientX, ev.clientY);
  }
  function unhover() { svg.classed('hl', false); svg.selectAll('.on').classed('on', false); A.tip(null); }
  function highlightLimb(k) {
    if (!k) return unhover();
    svg.classed('hl', true);
    svg.selectAll('.lf').classed('on', function () { return limbOf(A.byId.get(+this.dataset.id)) === k; });
    svg.selectAll('.tw').classed('on', function () { return this.dataset.l === k || (this.dataset.id && limbOf(A.byId.get(+this.dataset.id)) === k); });
    svg.selectAll('.th').classed('on', false);
  }

  function setYear(Y, fromGrow) {
    yearOut.textContent = Y >= 2026 ? '2025' : Math.floor(Y);
    if (!fromGrow) yearIn.value = Y;
    svg.selectAll('.lf,.th,.tw[data-id],.lbl').classed('future', function () { return +this.dataset.t > Y; });
    svg.select('.limbs').attr('clip-path', 'url(#trGrow)');
    clipRect.attr('y', yT(Math.min(2026.3, Y + .2))).attr('height', H + 4000);
  }

  function grow(force) {
    if (grown && !force) return;
    grown = true;
    if (A.reduced) return setYear(2026, false);
    const dur = 6500;
    d3.select({}).transition().duration(dur).ease(d3.easeCubicInOut).tween('grow', () => t => {
      const Y = 1997.9 + (2026 - 1997.9) * t;
      setYear(Y, true); yearIn.value = Y;
    });
  }
  function zoomBy(z) {
    const s = svg.transition().duration(450);
    if (z === 'in') zoom.scaleBy(s, 1.6); else if (z === 'out') zoom.scaleBy(s, 1 / 1.6); else zoom.transform(s, d3.zoomIdentity);
  }

  function show() { if (built) grow(false); }
  function hide() { unhover(); }
  function focus(id) {
    const n = (V._nodes || []).find(n => n.a.id === +id && !n.echo); if (!n) return;
    setYear(2026, false);
    const k = 2.4;
    zoom.transform(svg.transition().duration(A.reduced ? 0 : 900), d3.zoomIdentity.translate(W / 2 - n.x * k, H / 2 - n.y * k).scale(k));
    hoverAlbum(n.a.id);
    setTimeout(unhover, 2600);
    root.scrollIntoView({ behavior: A.reduced ? 'auto' : 'smooth', block: 'start' });
  }
})();
