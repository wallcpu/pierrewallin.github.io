/* Hard Cases: Three Gates. The people who answered all three trolley problems fall through them as grains
   and land in the bin of the theory their three answers match. */
(function () {
  'use strict';
  const X = window.HC, G = window.HC_GATES;
  const PATS = G.pats;   // '000' to '111': Switch, Loop, Footbridge, 1 = pull or push
  const CASES = [
    { name: 'Switch', verb: 'pull', short: 'Pull a lever to turn the trolley onto one person.', text: 'A runaway trolley will kill five people. Pull a lever and it turns onto a side track, where it kills one person instead.' },
    { name: 'Loop', verb: 'pull', short: 'The side track loops back. Only the one body stops it.', text: 'The same, except the side track loops back to the five. The trolley stops only because it hits the one person.' },
    { name: 'Footbridge', verb: 'push', short: 'Push a large man off a bridge into its path.', text: 'You are on a bridge over the track. The only way to stop the trolley is to push a large man off it into the trolley\u2019s path. He dies, and the five live.' },
  ];
  const TH = {
    '111': { c: '#f2a23c', name: 'Count the lives', tag: 'Act utilitarianism', who: 'Act utilitarianism, from Bentham and Mill to Singer', why: 'Five deaths are worse than one, however they come about. Only the outcome counts, so you pull, pull and push.', src: 'Stanford Encyclopedia of Philosophy, Consequentialism' },
    '110': { c: '#ee6a5c', name: 'Not by your own hand', tag: 'Thomson, 1985', who: 'Judith Jarvis Thomson in 1985, and Joshua Greene on personal force', why: 'You may turn a threat away from five and onto one, even when his body is what stops it. You may not lay hands on a man and throw him into its path.', src: 'Thomson, The Trolley Problem, Yale Law Journal, 1985. Greene and others, Pushing moral buttons, Cognition, 2009' },
    '100': { c: '#62a9ee', name: 'Never as a means', tag: 'Double effect, strictly', who: 'Double effect, read strictly, as Warren Quinn did', why: 'A death you foresee as a side effect can be allowed. A death you need cannot. On the loop the one person\u2019s body is the brake, so the loop is out.', src: 'Quinn, Actions, Intentions, and Consequences, Philosophy and Public Affairs, 1989' },
    '000': { c: '#b9a1ff', name: 'Never kill', tag: 'Thomson, 2008', who: 'Thomson in 2008, and strict deontology', why: 'Killing one is worse than letting five die. Thomson came round to this in 2008, arguing that a bystander may not make someone pay a price he would not pay himself.', src: 'Thomson, Turning the Trolley, Philosophy and Public Affairs, 2008' },
  };
  const ODD = {
    '101': 'They pulled the plain lever and pushed the man, but would not take the loop, the case in between.',
    '011': 'They would not pull the plain lever, yet took the loop and pushed the man.',
    '010': 'They took the loop and nothing else.',
    '001': 'They refused both levers but pushed the man.',
  };
  const NONE = '#8f8a84';
  const colOf = p => TH[p] ? TH[p].c : NONE;
  const nameOf = p => TH[p] ? TH[p].name : 'No theory says this';
  const ALLN = G.all.n;
  const verbs = p => p.split('').map((b, i) => (b === '1' ? '' : 'no ') + CASES[i].verb).join(', ');
  const glyph = (p, c) => `<span class="glyph" style="color:${c}" aria-hidden="true">${p.split('').map(b => `<i class="${b === '1' ? 'on' : ''}"></i>`).join('')}</span>`;

  let root, bar, stageEl, cv, g, pileCv, pg, labelsEl, perEl, readEl, cardEl, factsEl, worldEl, legendEl, selEl;
  let modeBtns = [], replayBtn, sortWrap;
  let mode = 'people', country = null, sortKey = '111';
  let W = 0, H = 0, L = null, P = null, per = 1;
  let grains = [], order = [], next = 0, active = [], fill = [], perm = [], t0 = 0, raf = 0, shown = false, done = true;
  let hot = null, picked = null, gateOn = -1;

  // ---------- population ----------
  function population() {
    const d = country && G.countries.find(d => d.name === country);
    return d ? { name: d.name, n: d.n, c: d.c, label: d.name } : { name: null, n: ALLN, c: G.all.c, label: 'Everyone' };
  }
  const cntOf = (pre, c = P.c) => PATS.reduce((a, p, i) => a + (p.startsWith(pre) ? c[i] : 0), 0);

  // ---------- geometry ----------
  function layout() {
    const mob = W < 700;
    const LW = mob ? 0 : W < 1000 ? 168 : 214;
    const TX0 = LW + (mob ? 2 : 8), TW = W - TX0 - (mob ? 2 : 10);
    const step = TW / 8, BW = Math.min(122, step - (mob ? 5 : 16));
    const labelH = mob ? 34 : 104;
    const BH = X.clamp(H * .3, 120, 236);
    const floor = H - labelH, binTop = floor - BH, mouth = binTop - 6;
    const ys = []; for (let i = 0; i <= 7; i++) ys.push(16 + (mouth - 16) * i / 7);
    const sp = mob ? 2.05 : 2.55, gs = mob ? 1.45 : 1.85;
    return { mob, LW, TX0, TW, step, BW, BH, floor, binTop, mouth, ys, rootW: Math.min(168, TW * .16), sp, gs, perRow: Math.max(4, Math.floor(BW / sp)), rows: Math.max(4, Math.floor((BH - 3) / sp)) };
  }
  const leafX = i => L.TX0 + (i + .5) * L.step;
  function nodeX(pre) { const k = 3 - pre.length, a = pre ? parseInt(pre, 2) << k : 0, b = a + (1 << k); let s = 0; for (let i = a; i < b; i++) s += leafX(i); return s / (b - a); }
  const LV = [0, 0, 1, 1, 2, 2, 3, 3];
  // the x of a grain bound for leaf l at lateral position u (-.5 to .5) at station st
  function xAt(l, u, st) {
    const p = PATS[l], pre = p.slice(0, LV[st]), k = L.rootW / P.n, w = cntOf(pre) * k;
    let before = 0; for (let i = 0; i < l; i++) if (PATS[i].startsWith(pre)) before += P.c[i];
    return nodeX(pre) - w / 2 + (before + (u + .5) * P.c[l]) * k;
  }
  function pt(l, u, s) {
    const y = L.ys[0] + s * (L.ys[7] - L.ys[0]);
    let i = 0; while (i < 6 && y > L.ys[i + 1]) i++;
    const t = (y - L.ys[i]) / (L.ys[i + 1] - L.ys[i]), a = xAt(l, u, i), b = xAt(l, u, i + 1);
    return [a + (b - a) * X.ease(X.clamp(t, 0, 1)), y];
  }
  let bands = [];
  function buildBands() {
    bands = PATS.map((p, l) => {
      const path = new Path2D(), n = 72;
      for (let i = 0; i <= n; i++) { const [x, y] = pt(l, -.5, i / n); i ? path.lineTo(x, y) : path.moveTo(x, y); }
      for (let i = n; i >= 0; i--) { const [x, y] = pt(l, .5, i / n); path.lineTo(x, y); }
      path.closePath(); return path;
    });
  }
  // which leaf's stream is under the pointer
  function leafAt(x, y) {
    if (y >= L.binTop - 4 && y <= L.floor + 4) { for (let l = 0; l < 8; l++) if (Math.abs(x - leafX(l)) <= L.BW / 2 + 3) return l; return -1; }
    if (y < L.ys[0] || y > L.ys[7]) return -1;
    const s = (y - L.ys[0]) / (L.ys[7] - L.ys[0]);
    for (let l = 0; l < 8; l++) { if (!P.c[l]) continue; const a = pt(l, -.5, s)[0], b = pt(l, .5, s)[0]; if (x >= Math.min(a, b) - 2 && x <= Math.max(a, b) + 2) return l; }
    return -1;
  }

  // ---------- the fall ----------
  function prepare() {
    P = population();
    const maxBin = Math.max(...P.c), minSp = L.mob ? 1.9 : 2.35;
    // as few people per grain as the screen allows; a small country gets bigger grains, one person each
    for (const k of [1, 2, 5, 10, 20, 50, 100, 200, 500]) { per = k; if (P.n / k <= 6800 && Math.sqrt(.8 * L.BH * L.BW / Math.max(1, maxBin / k)) >= minSp) break; }
    L.sp = X.clamp(Math.sqrt(.8 * L.BH * L.BW / Math.max(1, Math.round(maxBin / per))), minSp, L.mob ? 6 : 8.5);
    L.gs = L.sp * (L.sp > 4 ? .8 : .72);
    L.perRow = Math.max(3, Math.floor(L.BW / L.sp)); L.rows = Math.max(3, Math.floor((L.BH - 3) / L.sp));
    const R = X.rng(11);
    grains = [];
    P.c.forEach((v, l) => { const m = Math.round(v / per); for (let j = 0; j < m; j++) grains.push({ l, u: R() - .5, v: .82 + R() * .36, st: 0, t: 0, tx: 0, ty: 0, x: 0, y: 0, ax: 0 }); });
    for (let i = grains.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const q = grains[i]; grains[i] = grains[j]; grains[j] = q; }
    const D = X.clamp(grains.length / 1100, 2.2, 6);
    grains.forEach((q, i) => { q.t = i / Math.max(1, grains.length) * D; });
    fill = new Array(8).fill(0);
    perm = Array.from({ length: L.perRow }, (_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    next = 0; active = [];
  }
  function slotXY(l, j) {
    const row = Math.floor(j / L.perRow), col = perm[j % L.perRow];
    const x0 = leafX(l) - (L.perRow * L.sp) / 2;
    return [x0 + (col + .5) * L.sp, L.floor - 1.5 - (row + .5) * L.sp];
  }
  function stamp(q) { pg.fillStyle = colOf(PATS[q.l]); pg.fillRect(q.tx - L.gs / 2, q.ty - L.gs / 2, L.gs, L.gs); }
  function finishAll() {
    cancelAnimationFrame(raf); raf = 0;
    clearPiles();
    fill = new Array(8).fill(0);
    for (const q of grains) { const [tx, ty] = slotXY(q.l, fill[q.l]++); q.tx = tx; q.ty = ty; q.st = 2; stamp(q); }
    next = grains.length; active = []; done = true; draw();
  }
  function clearPiles() { pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, pileCv.width, pileCv.height); const d = pileCv.width / W; pg.setTransform(d, 0, 0, d, 0, 0); }
  const FALL = 2.1, GRAV = 2600;
  function frame(now) {
    const t = (now - t0) / 1000;
    while (next < grains.length && grains[next].t <= t) { const q = grains[next++]; q.st = 1; active.push(q); }
    let w = 0;
    for (let i = 0; i < active.length; i++) {
      const q = active[i];
      if (q.st === 1) {
        const s = (t - q.t) * q.v / FALL;
        if (s >= 1) {
          [q.x, q.y] = pt(q.l, q.u, 1);
          const [tx, ty] = slotXY(q.l, fill[q.l]++); q.tx = tx; q.ty = ty; q.ax = q.x; q.st = 3; q.t = t;
        } else { const p = pt(q.l, q.u, Math.max(0, s)); q.x = p[0]; q.y = p[1]; }
      }
      if (q.st === 3) {
        const dt = t - q.t, y = L.mouth + 180 * dt + .5 * GRAV * dt * dt;
        if (y >= q.ty) { q.st = 2; stamp(q); continue; }
        const f = X.clamp((y - L.mouth) / Math.max(1, q.ty - L.mouth), 0, 1);
        q.x = q.ax + (q.tx - q.ax) * f; q.y = y;
      }
      active[w++] = q;
    }
    active.length = w;
    draw();
    if (next < grains.length || active.length) raf = requestAnimationFrame(frame);
    else { raf = 0; done = true; }
  }
  function drop() {
    if (mode !== 'people') return;
    cancelAnimationFrame(raf);
    prepare(); clearPiles();
    labelBins(); facts();
    if (X.reduced || !shown) { finishAll(); return; }
    done = false; t0 = performance.now(); raf = requestAnimationFrame(frame);
  }

  // ---------- drawing ----------
  function draw() {
    if (mode !== 'people' || !L) return;
    g.clearRect(0, 0, W, H);
    const focus = picked ?? hot;
    PATS.forEach((p, l) => {
      if (!P.c[l]) return;
      const on = focus === null || focus === l;
      g.fillStyle = colOf(p); g.globalAlpha = focus === null ? (TH[p] ? .13 : .07) : on ? .3 : .035;
      g.fill(bands[l]);
    });
    g.globalAlpha = 1;
    // the gates: a pin across every stream where it splits
    for (let gi = 0; gi < 3; gi++) {
      const y = L.ys[2 * gi + 1], k = L.rootW / P.n;
      for (const pre of gi === 0 ? [''] : gi === 1 ? ['0', '1'] : ['00', '01', '10', '11']) {
        const n = cntOf(pre); if (!n) continue;
        const x = nodeX(pre), w = n * k, split = x - w / 2 + cntOf(pre + '0') * k;
        g.strokeStyle = gateOn === gi ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - w / 2 - 7, y); g.lineTo(x + w / 2 + 7, y); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(split, y, 2.1, 0, 7); g.fill();
      }
    }
    // the bins
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 1;
    for (let l = 0; l < 8; l++) {
      const x = leafX(l), h = L.BW / 2 + 2;
      g.beginPath(); g.moveTo(x - h, L.binTop); g.lineTo(x - h, L.floor + .5); g.lineTo(x + h, L.floor + .5); g.lineTo(x + h, L.binTop); g.stroke();
    }
    // the piles, dimmed outside the focus
    if (focus === null) g.drawImage(pileCv, 0, 0, W, H);
    else {
      g.globalAlpha = .28; g.drawImage(pileCv, 0, 0, W, H); g.globalAlpha = 1;
      const d = pileCv.width / W, x = leafX(focus) - L.BW / 2 - 4, y = L.binTop - 2, w = L.BW + 8, h = L.floor - L.binTop + 4;
      g.drawImage(pileCv, x * d, y * d, w * d, h * d, x, y, w, h);
    }
    // grains in the air
    for (const q of active) {
      g.fillStyle = colOf(PATS[q.l]);
      g.globalAlpha = focus === null || focus === q.l ? .95 : .2;
      g.fillRect(q.x - L.gs / 2, q.y - L.gs / 2, L.gs, L.gs);
    }
    g.globalAlpha = 1;
  }

  // ---------- labels ----------
  function labelGates() {
    labelsEl.querySelectorAll('.g-gate, .g-split').forEach(e => e.remove());
    CASES.forEach((c, gi) => {
      const b = X.el('button', 'g-gate', `<b>${c.name}</b><span>${c.short}</span>`);
      b.type = 'button'; b.style.top = L.ys[2 * gi + 1] + 'px';
      if (L.mob) { b.style.left = '0'; b.innerHTML = `<b style="font-size:.78rem;background:rgba(0,0,0,.7);padding:1px 4px;border-radius:4px">${c.name}</b>`; b.style.transform = 'translateY(-130%)'; }
      b.addEventListener('mouseenter', () => { gateOn = gi; draw(); });
      b.addEventListener('mouseleave', () => { gateOn = -1; draw(); });
      b.addEventListener('click', () => { picked = null; showGate(gi); draw(); syncBins(); });
      labelsEl.appendChild(b);
    });
    const k = L.rootW / P.n;
    for (let gi = 0; gi < 3; gi++) for (const pre of gi === 0 ? [''] : gi === 1 ? ['0', '1'] : ['00', '01', '10', '11']) {
      const n = cntOf(pre); if (!n) continue;
      const s = X.el('span', 'g-split', `${Math.round(cntOf(pre + '1') / n * 100)}% ${CASES[gi].verb}`);
      s.style.top = L.ys[2 * gi + 1] + 'px';
      labelsEl.appendChild(s);
      // on a phone the gates are too close for side labels, so each sits under its pin
      if (L.mob) { s.style.top = (L.ys[2 * gi + 1] + 13) + 'px'; s.style.left = X.clamp(nodeX(pre) - s.offsetWidth / 2, 0, W - s.offsetWidth - 2) + 'px'; }
      else s.style.left = Math.min(nodeX(pre) + n * k / 2 + 10, W - s.offsetWidth - 2) + 'px';
    }
  }
  function labelBins() {
    labelsEl.querySelectorAll('.g-bin').forEach(e => e.remove());
    PATS.forEach((p, l) => {
      const th = TH[p], c = colOf(p);
      const b = X.el('button', 'g-bin' + (th ? '' : ' none'), `${glyph(p, c)}<b style="color:${c}">${X.pct(P.c[l], P.n)}</b><em>${nameOf(p)}</em>${th ? `<small>${th.tag}</small>` : ''}`);
      b.type = 'button'; b.dataset.l = l;
      b.setAttribute('aria-label', `${nameOf(p)}: ${verbs(p)}. ${X.pct(P.c[l], P.n)} of ${P.label === 'Everyone' ? 'everyone' : P.label}`);
      const w = Math.min(L.step - 4, L.mob ? L.step : 150);
      b.style.left = (leafX(l) - L.BW / 2 - 4) + 'px'; b.style.top = (L.floor + 6) + 'px'; b.style.width = w + 'px';
      b.addEventListener('mouseenter', () => { hot = l; draw(); });
      b.addEventListener('mouseleave', () => { hot = null; draw(); });
      b.addEventListener('click', () => pick(picked === l ? null : l));
      labelsEl.appendChild(b);
    });
    perEl.textContent = per === 1 ? 'Each grain is one person' : `Each grain is ${per} people`;
    syncBins();
  }
  const syncBins = () => labelsEl.querySelectorAll('.g-bin').forEach(b => b.classList.toggle('on', +b.dataset.l === picked));

  // ---------- the reading card and the facts ----------
  function pick(l) {
    picked = l; gateOn = -1; syncBins(); draw();
    if (l === null) { intro(); return; }
    const p = PATS[l], th = TH[p], c = colOf(p);
    cardEl.innerHTML = `<h3><i style="background:${c}"></i>${nameOf(p)}</h3>
      <p class="who">${th ? X.esc(th.who) : 'No textbook theory gives these three answers together.'}</p>
      <p>${glyph(p, c)} &nbsp;${X.esc(verbs(p))}</p>
      <p>${X.esc(th ? th.why : ODD[p])}</p>
      <div class="big" style="color:${c}">${X.pct(P.c[l], P.n)}</div>
      <p style="margin-top:.3rem">${X.fmt(P.c[l])} of ${X.fmt(P.n)} ${P.name ? 'people in ' + X.esc(P.name) : 'people'} answered this way.</p>
      ${th ? `<p class="src">${X.esc(th.src)}</p>` : ''}`;
  }
  function showGate(gi) {
    const c = CASES[gi], r = G.rates[c.name];
    const phil = gi === 0 ? G.phil.switch : gi === 2 ? G.phil.push : null;
    cardEl.innerHTML = `<h3>${c.name}</h3><p>${X.esc(c.text)}</p>
      <div class="big" style="color:var(--yes)">${X.pct(r[0], r[1])}</div>
      <p style="margin-top:.3rem">of ${X.fmt(r[1])} answers in the study said ${c.verb}.${phil !== null ? ` Among philosophers in the 2020 PhilPapers Survey, ${X.fmt1(phil)}% would.` : ' The PhilPapers Survey did not ask about the loop.'}</p>`;
    labelsEl.querySelectorAll('.g-gate').forEach((b, i) => b.classList.toggle('on', i === gi));
  }
  function intro() {
    labelsEl.querySelectorAll('.g-gate').forEach(b => b.classList.remove('on'));
    cardEl.innerHTML = `<p class="hint">Every theory in a textbook gives its own set of three answers, a path through the gates. The bins are those paths. Pick a bin to see whose path it is, or a gate to read the case.</p>`;
  }
  function facts() {
    const c = P.c, n = P.n, f = i => X.pct(c[PATS.indexOf(i)], n);
    const none = ['001', '010', '011', '101'].reduce((a, p) => a + c[PATS.indexOf(p)], 0);
    const lead = ['111', '110', '100', '000'].reduce((a, p) => c[PATS.indexOf(p)] > c[PATS.indexOf(a)] ? p : a, '111');
    const who = P.name ? `in ${P.name}` : 'of everyone';
    const items = [
      [f('111'), `${who === 'of everyone' ? 'of everyone' : who} pulled both levers and pushed the man, as act utilitarianism says to.`],
      [f('110'), `took both levers but would not push, the line Judith Jarvis Thomson drew in 1985.`],
      [X.pct(none, n), `gave a set of answers that no textbook theory gives.`],
      P.name
        ? [nameOf(lead), `is the biggest pile in ${P.name}, from ${X.fmt(n)} people. ${lead === '111' ? 'It is in 39 of the 41 countries.' : 'Only China and Japan break from Count the lives.'}`]
        : ['39 of 41', 'countries put Count the lives on top. China\u2019s biggest pile is Never kill, and Japan\u2019s is Not by your own hand.'],
    ];
    factsEl.innerHTML = items.map(([b, s]) => `<div class="fact"><b>${X.esc(b)}</b><span>${X.esc(s)}</span></div>`).join('');
  }

  // ---------- philosophers: the same gates, a hundred grains a group ----------
  let philCv, philG, philTimer = 0;
  const GROUPS = () => [
    { name: 'Everyone in the study', sub: `${X.fmt(G.users)} people`, sw: G.rates.Switch[0] / G.rates.Switch[1] * 100, pu: G.rates.Footbridge[0] / G.rates.Footbridge[1] * 100, two: true },
    { name: 'All philosophers', sub: '2020 PhilPapers Survey', sw: G.phil.switch, pu: G.phil.push, swNo: 13.3, puNo: 56.0 },
    ...G.phil.camps.map(([nm, share, sw, pu]) => ({ name: 'Lean ' + (nm === 'virtue ethics' ? 'virtue ethics' : nm === 'deontology' ? 'deontologist' : 'consequentialist'), sub: `${X.fmt1(share)}% of philosophers`, sw, pu })),
  ];
  const QS = [['Switch', 'sw', 'swNo', 'pull the lever'], ['Footbridge', 'pu', 'puNo', 'push the man']];
  function philGeom(W) {
    const groups = GROUPS(), mob = W < 700;
    if (!mob) {
      const cellW = W / groups.length, side = Math.min(150, cellW - 44), rowH = side + 128;
      return { mob, groups, side, h: 2 * rowH + 20, at: (gi, qi) => [gi * cellW + (cellW - side) / 2, 88 + qi * rowH] };
    }
    const side = Math.min(128, (W - 40) / 2), rowH = side + 96;
    return { mob, groups, side, h: groups.length * rowH + 30, at: (gi, qi) => [qi ? W / 2 + 8 : W / 2 - 8 - side, 56 + gi * rowH] };
  }
  function philDraw(progress) {
    const W = Math.round(philCv.parentNode.clientWidth) || 360, G2 = philGeom(W), { side, mob } = G2, gz = side / 10;
    philG = X.sizeCanvas(philCv, W, G2.h);
    philG.clearRect(0, 0, W, G2.h);
    const wrap = philCv.parentNode;
    wrap.querySelectorAll('.g-plab').forEach(e => e.remove());
    const lab = (x, y, html, w = side + 24) => { const s = X.el('div', 'g-plab', html); s.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;pointer-events:none;line-height:1.25`; wrap.appendChild(s); };
    const final = progress >= 1;
    let idx = 0;
    QS.forEach(([q, k, kNo, verb], qi) => {
      if (final && !mob) lab(0, G2.at(0, qi)[1] - (qi ? 64 : 84), `<span style="font-size:.8rem;color:var(--ink-mute)">${q}: would they ${verb}?</span>`, 400);
      if (final && mob) lab(G2.at(0, qi)[0], 6, `<span style="font-size:.8rem;color:var(--ink-mute)">${q}</span>`);
      G2.groups.forEach((gp, gi) => {
        const [x0, y0] = G2.at(gi, qi);
        const yes = Math.round(gp[k]), no = gp[kNo] !== undefined ? Math.round(gp[kNo]) : gp.two ? 100 - yes : 0;
        for (let j = 0; j < 100; j++) {
          const r = Math.floor(j / 10), c = j % 10;
          const a = X.clamp(progress * 1.7 - (j / 100) * .55 - idx * .025, 0, 1);
          if (a <= 0) continue;
          const ty = y0 + side - (r + 1) * gz, tx = x0 + c * gz, yy = ty - (1 - X.ease(a)) * 70;
          philG.globalAlpha = a;
          philG.fillStyle = j < yes ? X.YES : j < yes + no ? X.NO : 'rgba(255,255,255,.15)';
          philG.fillRect(tx + .7, yy + .7, gz - 1.7, gz - 1.7);
        }
        philG.globalAlpha = 1;
        if (final) {
          lab(x0 - 1, y0 + side + 10, `<b style="font-size:1.35rem;font-weight:740;letter-spacing:-.03em;color:var(--yes)">${X.fmt1(gp[k])}%</b> <span style="font-size:.8rem;color:var(--ink-mute)">${verb.split(' ')[0]}</span>`);
          if (mob ? qi === 0 : qi === 0) lab(mob ? 0 : x0 - 1, y0 - (mob ? 22 : 50), `<span style="font-size:.88rem;font-weight:650;color:var(--ink)">${gp.name}</span><br><span style="font-size:.74rem;color:var(--ink-mute)">${X.esc(gp.sub)}</span>`, mob ? W : side + 40);
        }
        idx++;
      });
    });
  }
  function philPlay() {
    cancelAnimationFrame(philTimer);
    if (X.reduced) { philDraw(1); return; }
    const t = performance.now();
    const step = now => { const p = Math.min(1, (now - t) / 1600); philDraw(p); if (p < 1) philTimer = requestAnimationFrame(step); };
    philTimer = requestAnimationFrame(step);
  }
  function philFacts() {
    const items = [
      [`${X.fmt1(G.phil.switch)}%`, `of philosophers would pull the lever, against ${X.pct(G.rates.Switch[0], G.rates.Switch[1])} of everyone in the study.`],
      [`${X.fmt1(G.phil.push)}%`, `of philosophers would push the man. In the study, ${X.pct(G.rates.Footbridge[0], G.rates.Footbridge[1])} said yes.`],
      [`${X.fmt1(G.phil.camps[0][3])}%`, 'of philosophers who lean consequentialist would push. Most of the people in the study were more willing than they are.'],
      [`${X.fmt1(G.phil.camps[1][3])}%`, 'of those who lean deontologist would push, the fewest of any camp.'],
    ];
    factsEl.innerHTML = items.map(([b, s]) => `<div class="fact"><b>${X.esc(b)}</b><span>${X.esc(s)}</span></div>`).join('');
    cardEl.innerHTML = `<h3>Philosophers at the same gates</h3><p>The 2020 PhilPapers Survey asked 1,785 philosophers about the switch and the footbridge, though not the loop. Each square is one percent of a group. Warm squares would act, cool ones would not, and the faint ones gave some other answer. For the camps, the faint squares hold everyone who did not say they would act.</p><p class="src">Bourget and Chalmers, Philosophers on Philosophy, Philosophers\u2019 Imprint, 2023</p>`;
  }

  // ---------- every country ----------
  const KEYS = [['111', 'Count the lives'], ['110', 'Not by your own hand'], ['100', 'Never as a means'], ['000', 'Never kill'], ['odd', 'No theory']];
  const shareOf = (d, k) => k === 'odd' ? ['001', '010', '011', '101'].reduce((a, p) => a + d.c[PATS.indexOf(p)], 0) / d.n : d.c[PATS.indexOf(k)] / d.n;
  function world() {
    const all = { name: 'Everyone', n: ALLN, c: G.all.c, all: true };
    const list = [...G.countries].sort((a, b) => shareOf(b, sortKey) - shareOf(a, sortKey));
    const card = d => {
      const max = .55, bw = 100 / KEYS.length;
      const bars = KEYS.map(([k], i) => { const v = shareOf(d, k), h = Math.max(1, v / max * 56), c = k === 'odd' ? NONE : TH[k].c; return `<rect x="${i * bw + 2}%" y="${64 - h}" width="${bw - 4}%" height="${h}" rx="1.5" fill="${c}" opacity="${k === sortKey ? 1 : .55}"><title>${KEYS[i][1]}: ${X.fmt1(v * 100)}%</title></rect>`; }).join('');
      const lead = ['111', '110', '100', '000'].reduce((a, p) => shareOf(d, p) > shareOf(d, a) ? p : a, '111');
      return `<button class="g-cty${d.all ? ' all' : ''}" data-c="${d.all ? '' : X.esc(d.name)}"><b>${X.esc(d.name)}</b><small>${X.fmt(d.n)} people</small><svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">${bars}</svg><span class="lead">${KEYS.find(k => k[0] === sortKey)[1]}: <b style="color:${sortKey === 'odd' ? NONE : TH[sortKey].c}">${X.fmt1(shareOf(d, sortKey) * 100)}%</b>${lead !== '111' ? ` &middot; biggest is ${TH[lead].name}` : ''}</span></button>`;
    };
    worldEl.innerHTML = card(all) + list.map(card).join('');
  }

  // ---------- modes ----------
  function setMode(m, keep) {
    mode = m; X.tip(null);
    modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    const people = m === 'people', phil = m === 'phil', wd = m === 'world';
    stageEl.style.display = people ? '' : 'none';
    philCv.parentNode.style.display = phil ? '' : 'none';
    worldEl.style.display = wd ? '' : 'none';
    legendEl.style.display = wd ? '' : 'none';
    selEl.parentNode.style.display = people ? '' : 'none';
    replayBtn.style.display = wd ? 'none' : '';
    sortWrap.style.display = wd ? '' : 'none';
    perEl.style.display = people ? '' : 'none';
    readEl.style.display = wd ? 'none' : '';
    if (people) { resize(true); intro(); facts(); if (!keep) drop(); else if (done) finishAll(); }
    if (phil) { philFacts(); philPlay(); }
    if (wd) world();
    if (!keep) sync();
  }
  function sync() { X.setParams({ mode: mode === 'people' ? null : mode, c: mode === 'people' ? country : null, sort: mode === 'world' && sortKey !== '111' ? sortKey : null }); }

  function resize(force) {
    const w = Math.round(stageEl.clientWidth);
    if (!force && w === W) return;
    W = w; H = W < 700 ? 600 : X.clamp(Math.round(innerHeight * .78), 640, 800);
    g = X.sizeCanvas(cv, W, H);
    pileCv.width = cv.width; pileCv.height = cv.height; pg = pileCv.getContext('2d');
    stageEl.style.height = H + 'px';
    L = layout(); P = population();
    buildBands(); labelGates();
    // a resize mid-fall (the scrollbar arriving as the page loads, a phone turning) starts the drop again at the new size
    if (mode === 'people') { const running = !!raf; prepare(); labelBins(); if (running) drop(); else finishAll(); }
  }

  function init(el) {
    root = el;
    root.innerHTML = `
      <div class="bar">
        <div class="bar-group" role="group" aria-label="Who">
          <button class="chip-btn" data-mode="people" aria-pressed="true">Everyone</button>
          <button class="chip-btn" data-mode="phil" aria-pressed="false">Philosophers</button>
          <button class="chip-btn" data-mode="world" aria-pressed="false">Every country</button>
        </div>
        <label class="sel"><select aria-label="Country"></select></label>
        <div class="bar-group g-sort" role="group" aria-label="Sort countries by"></div>
        <button class="ctl g-replay" type="button"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5"/></svg>Drop again</button>
        <span class="bar-note g-pertxt"></span>
      </div>
      <div class="g-stage"><canvas class="g-canvas"></canvas><div class="g-labels"></div></div>
      <div class="g-philwrap" style="position:relative;margin:0 var(--gutter);display:none"><canvas class="g-phil"></canvas></div>
      <div class="g-legend" style="display:none"></div>
      <div class="g-world" style="display:none"></div>
      <div class="g-read"><div class="g-card"></div><div class="facts"></div></div>`;
    bar = root.querySelector('.bar');
    stageEl = root.querySelector('.g-stage'); cv = root.querySelector('.g-canvas'); labelsEl = root.querySelector('.g-labels');
    pileCv = document.createElement('canvas');
    perEl = root.querySelector('.g-pertxt'); readEl = root.querySelector('.g-read'); cardEl = root.querySelector('.g-card'); factsEl = root.querySelector('.facts');
    worldEl = root.querySelector('.g-world'); legendEl = root.querySelector('.g-legend'); selEl = root.querySelector('select');
    philCv = root.querySelector('.g-phil'); philG = philCv.getContext('2d');
    replayBtn = root.querySelector('.g-replay'); sortWrap = root.querySelector('.g-sort');
    modeBtns = [...root.querySelectorAll('[data-mode]')];
    selEl.innerHTML = `<option value="">Everyone, ${X.fmt(ALLN)} people</option>` + G.countries.map(d => `<option value="${X.esc(d.name)}">${X.esc(d.name)}, ${X.fmt(d.n)}</option>`).join('');
    sortWrap.innerHTML = '<span class="lbl" style="font-size:.84rem;color:var(--ink-mute);margin-right:.2rem">Sort by</span>' + KEYS.map(([k, n]) => `<button class="chip-btn" data-sort="${k}" aria-pressed="${k === sortKey}">${n}</button>`).join('');
    legendEl.innerHTML = KEYS.map(([k, n]) => `<span><i style="background:${k === 'odd' ? NONE : TH[k].c}"></i>${n}</span>`).join('');

    const q = X.params();
    const qc = q.get('c'); if (qc && G.countries.some(d => d.name === qc)) country = qc;
    const qs = q.get('sort'); if (qs && KEYS.some(k => k[0] === qs)) sortKey = qs;
    selEl.value = country || '';

    modeBtns.forEach(b => b.addEventListener('click', () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode); }));
    selEl.addEventListener('change', () => { country = selEl.value || null; picked = null; sync(); drop(); intro(); });
    replayBtn.addEventListener('click', () => mode === 'phil' ? philPlay() : drop());
    sortWrap.addEventListener('click', e => { const b = e.target.closest('[data-sort]'); if (!b) return; sortKey = b.dataset.sort; sortWrap.querySelectorAll('[data-sort]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); world(); sync(); });
    worldEl.addEventListener('click', e => { const b = e.target.closest('.g-cty'); if (!b) return; country = b.dataset.c || null; selEl.value = country || ''; picked = null; setMode('people'); scrollTo({ top: root.getBoundingClientRect().top + scrollY - 90, behavior: X.reduced ? 'auto' : 'smooth' }); });

    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, l = leafAt(x, y);
      const h = l < 0 ? null : l;
      if (h !== hot) { hot = h; draw(); }
      if (h === null) { X.tip(null); return; }
      const p = PATS[h];
      X.tip(`<b style="color:${colOf(p)}">${nameOf(p)}</b><small>${X.esc(verbs(p))}. ${X.pct(P.c[h], P.n)}, ${X.fmt(P.c[h])} people.</small>`, e.clientX, e.clientY);
    });
    cv.addEventListener('pointerleave', () => { hot = null; X.tip(null); draw(); });
    cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), l = leafAt(e.clientX - r.left, e.clientY - r.top); pick(l < 0 || l === picked ? null : l); });
    addEventListener('keydown', e => {
      if (!shown) return;
      if (e.key === ' ' && X.spaceFree(e) && mode !== 'world') { e.preventDefault(); mode === 'phil' ? philPlay() : drop(); }
      if (e.key === 'Escape' && picked !== null) pick(null);
    });
    X.onWidth(root, () => { if (!shown) return; if (mode === 'people') resize(); else if (mode === 'phil') philDraw(1); });
    X.watchDpr(() => { if (shown && mode === 'people') resize(true); });

    const qm = q.get('mode');
    mode = qm === 'phil' || qm === 'world' ? qm : 'people';
  }
  function show() {
    shown = true;
    setMode(mode, true);
    if (mode === 'people') drop();
  }
  function hide() { shown = false; cancelAnimationFrame(raf); raf = 0; if (!done) finishAll(); cancelAnimationFrame(philTimer); X.tip(null); }

  X.views.gates = { init, show, hide, sync };
})();
