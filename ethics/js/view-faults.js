/* Hard Cases: Fault Lines. Nineteen theories, placed by how often they agree. Every case is a crack that runs
   between the theories that say yes and the ones that say no, so the cracks between two theories count how often they part. */
(function () {
  'use strict';
  const X = window.HC, F = window.HC_FAULTS;
  if (!F) { X.views.faults = { init() {}, show() {}, hide() {} }; return; }
  const T = F.th, C = F.cases, NT = T.length, NC = C.length;
  const tIdx = Object.fromEntries(T.map((t, i) => [t.id, i])), cIdx = Object.fromEntries(C.map((c, i) => [c.id, i]));
  const DIALS = F.dials;
  const dialOf = Object.fromEntries(DIALS.flatMap(d => d.cases.map(c => [c, d])));
  // V[c][t]: null when the theory is silent, else { v, k, why, src, yes, no }
  const V = C.map(c => T.map(t => { const r = F.v[c.id] && F.v[c.id][t.id]; return r ? { v: r[0], k: r[1], why: r[2], src: r[3], yes: r[4], no: r[5] } : null; }));
  const val = r => !r ? null : (r.v === 'R' || r.v === 'P') ? 1 : r.v === 'F' ? -1 : 0;
  const WORD = { R: 'Must', P: 'May', F: 'Must not', S: 'Torn', D: 'Depends' };
  const said = T.map((_, t) => V.reduce((a, row) => a + (row[t] ? 1 : 0), 0));
  // where a case's crack runs: between yes and no; when nobody says yes outright, a school torn on it stands in for
  // the yes side (strict act utilitarianism on the footbridge), and the same the other way round
  const FV = V.map(row => {
    const v = row.map(val), yes = v.includes(1), no = v.includes(-1), torn = row.some(r => r && r.v === 'S');
    return row.map((r, i) => v[i] === null ? null : v[i] !== 0 ? v[i] : r.v === 'S' && !yes && no ? 1 : r.v === 'S' && yes && !no ? -1 : 0);
  });
  const splits = c => FV[c].includes(1) && FV[c].includes(-1);

  // ---------- agreement ----------
  function agree(a, b) {
    let both = 0, part = 0; const cases = [];
    for (let c = 0; c < NC; c++) {
      const x = val(V[c][a]), y = val(V[c][b]); if (x === null || y === null) continue;
      both++;
      if (x !== 0 && y !== 0 && x !== y) { part++; cases.push(c); }
    }
    return { both, part, cases };
  }

  // ---------- where each theory sits: classical scaling, then stress majorization ----------
  function place() {
    const D = [];
    for (let a = 0; a < NT; a++) {
      D.push(new Float64Array(NT));
      for (let b = 0; b < NT; b++) {
        if (a === b) continue;
        let s = 0, m = 0;
        for (let c = 0; c < NC; c++) { const x = val(V[c][a]), y = val(V[c][b]); if (x === null || y === null) continue; s += Math.abs(x - y) / 2; m++; }
        // few shared cases say little, so pull those pairs toward the middle distance
        D[a][b] = (s + .5 * 1.6) / (m + 1.6) + .06;
      }
    }
    const n = NT, D2 = D.map(r => Array.from(r, x => x * x));
    const rm = D2.map(r => r.reduce((a, b) => a + b) / n), gm = rm.reduce((a, b) => a + b) / n;
    const B = D2.map((r, i) => r.map((x, j) => -.5 * (x - rm[i] - rm[j] + gm)));
    const eig = prev => {
      let v = Array.from({ length: n }, (_, i) => Math.sin(i * 1.31 + (prev ? 2.1 : .3)) + .2);
      for (let it = 0; it < 400; it++) {
        let w = B.map(r => r.reduce((a, x, j) => a + x * v[j], 0));
        if (prev) { const d = w.reduce((a, x, i) => a + x * prev[i], 0); w = w.map((x, i) => x - d * prev[i]); }
        const nn = Math.hypot(...w) || 1; v = w.map(x => x / nn);
      }
      const lam = B.map(r => r.reduce((a, x, j) => a + x * v[j], 0)).reduce((a, x, i) => a + x * v[i], 0);
      return { v, lam: Math.max(lam, 1e-6) };
    };
    const e1 = eig(null), e2 = eig(e1.v);
    let P = e1.v.map((x, i) => [x * Math.sqrt(e1.lam), e2.v[i] * Math.sqrt(e2.lam)]);
    for (let it = 0; it < 120; it++) {
      const Q = P.map(() => [0, 0]);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d = Math.hypot(dx, dy) || 1e-6, k = D[i][j] / d;
        Q[i][0] += P[j][0] + k * dx; Q[i][1] += P[j][1] + k * dy;
      }
      P = Q.map(([x, y]) => [x / (n - 1), y / (n - 1)]);
    }
    // turn the map so act utilitarianism sits on the left of Kant, and care ethics is above the middle
    const a = tIdx.act_utilitarianism, k = tIdx.kant ?? tIdx.kantian_contemporary;
    if (a !== undefined && k !== undefined) {
      const ang = Math.atan2(P[k][1] - P[a][1], P[k][0] - P[a][0]), cs = Math.cos(-ang), sn = Math.sin(-ang);
      P = P.map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
    }
    const care = tIdx.care_ethics, my = P.reduce((s, p) => s + p[1], 0) / n;
    if (care !== undefined && P[care][1] > my) P = P.map(([x, y]) => [x, -y]);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return P.map(([x, y]) => [(x - x0) / (x1 - x0 || 1), (y - y0) / (y1 - y0 || 1)]);
  }
  const UNIT = place();

  // ---------- state ----------
  let root, plateEl, bgCv, fgCv, bg, fg, labelsEl, panel, modeBtns, dialsEl, sortWrap;
  let W = 0, H = 0, pts = [], sig = 80, cracks = [], fields = [], gridW = 0, gridH = 0, STEP = 5, shown = false;
  let selCase = -1, hotCase = -1, selA = -1, selB = -1, hotT = -1, mode = 'plate', sortBy = 'map';

  // value noise that bends the cracks the same way every time
  const noise = seed => { const r = X.rng(seed), p = new Float32Array(1024); for (let i = 0; i < 1024; i++) p[i] = r() * 2 - 1; const h = (i, j) => p[((i * 73856093) ^ (j * 19349663)) & 1023]; return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = X.ease(x - i), fy = X.ease(y - j), a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }; };
  const n1 = noise(3), n2 = noise(4);
  const bend = (x, y) => [x + 4.2 * n1(x / 17, y / 17) + 1.5 * n1(x / 4.5, y / 4.5), y + 4.2 * n2(x / 17, y / 17) + 1.5 * n2(x / 4.5, y / 4.5)];

  // ---------- geometry ----------
  function layoutPoints() {
    const mob = W < 700, pxL = mob ? 22 : 40, pxR = mob ? 96 : 180, pyT = mob ? 30 : 48, pyB = mob ? 36 : 54;
    pts = UNIT.map(([u, v]) => [pxL + u * (W - pxL - pxR), pyT + v * (H - pyT - pyB)]);
    // nudge apart points that sit on top of each other
    const m = mob ? 30 : 46;
    for (let it = 0; it < 160; it++) for (let a = 0; a < NT; a++) for (let b = a + 1; b < NT; b++) {
      const dx = pts[b][0] - pts[a][0], dy = pts[b][1] - pts[a][1], d = Math.hypot(dx, dy) || .01;
      if (d < m) { const f = (m - d) / 2 / d; pts[a][0] -= dx * f; pts[a][1] -= dy * f; pts[b][0] += dx * f; pts[b][1] += dy * f; }
    }
    for (const p of pts) { p[0] = X.clamp(p[0], 14, W - 14); p[1] = X.clamp(p[1], 18, H - 18); }
    sig = .1 * (W + H) / 2;
  }
  function fieldOf(c) {
    const ids = []; for (let t = 0; t < NT; t++) if (FV[c][t] !== null) ids.push(t);
    const gw = gridW, gh = gridH, out = new Float32Array(gw * gh), s2 = 2 * sig * sig;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = i * STEP, y = j * STEP; let num = 0, den = 0;
      for (const t of ids) { const dx = x - pts[t][0], dy = y - pts[t][1], w = Math.exp(-(dx * dx + dy * dy) / s2) + 1e-12; num += w * FV[c][t]; den += w; }
      out[j * gw + i] = den > 0 ? num / den : 0;
    }
    return out;
  }
  function nearInvolved(c, x, y) { let m = 1e9; for (let t = 0; t < NT; t++) if (val(V[c][t]) !== null) m = Math.min(m, Math.hypot(x - pts[t][0], y - pts[t][1])); return m; }
  function crackOf(c) {
    if (!splits(c)) return null;
    const f = fields[c], gw = gridW, gh = gridH, segs = [], reach = .36 * Math.min(W, H) + 40;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = f[j * gw + i], b = f[j * gw + i + 1], cc = f[(j + 1) * gw + i + 1], d = f[(j + 1) * gw + i];
      const x = i * STEP, y = j * STEP, P = [];
      const e = (p, q, x1, y1, x2, y2) => { if ((p > 0) !== (q > 0)) { const t = p / (p - q); P.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); } };
      e(a, b, x, y, x + STEP, y); e(b, cc, x + STEP, y, x + STEP, y + STEP); e(d, cc, x, y + STEP, x + STEP, y + STEP); e(a, d, x, y, x, y + STEP);
      for (let k = 0; k + 3 < P.length; k += 4) {
        const mx = (P[k] + P[k + 2]) / 2, my = (P[k + 1] + P[k + 3]) / 2, fade = Math.pow(X.clamp(1 - nearInvolved(c, mx, my) / reach, 0, 1), .8);
        if (fade <= .02) continue;
        const [ax, ay] = bend(P[k], P[k + 1]), [bx, by] = bend(P[k + 2], P[k + 3]);
        segs.push(ax, ay, bx, by, fade);
        bx0 = Math.min(bx0, ax, bx); by0 = Math.min(by0, ay, by); bx1 = Math.max(bx1, ax, bx); by1 = Math.max(by1, ay, by);
      }
    }
    return segs.length ? { segs: Float32Array.from(segs), box: [bx0 - 8, by0 - 8, bx1 + 8, by1 + 8] } : null;
  }
  function distToCrack(k, x, y) {
    const cr = cracks[k]; if (!cr) return 1e9;
    const b = cr.box; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return 1e9;
    let m = 1e9; const s = cr.segs;
    for (let i = 0; i < s.length; i += 5) {
      if (s[i + 4] < .18) continue;
      const ax = s[i], ay = s[i + 1], vx = s[i + 2] - ax, vy = s[i + 3] - ay, L2 = vx * vx + vy * vy || 1;
      const t = X.clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1), dx = ax + vx * t - x, dy = ay + vy * t - y;
      m = Math.min(m, dx * dx + dy * dy);
    }
    return Math.sqrt(m);
  }
  function crackNear(x, y, within) { let best = -1, bd = within; for (let c = 0; c < NC; c++) { const d = distToCrack(c, x, y); if (d < bd) { bd = d; best = c; } } return best; }

  // ---------- drawing ----------
  function drawBase() {
    bg.clearRect(0, 0, W, H);
    const gr = bg.createRadialGradient(W * .45, H * .45, 20, W * .5, H * .5, Math.max(W, H) * .72);
    gr.addColorStop(0, '#15130f'); gr.addColorStop(1, '#030303');
    bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    const R = X.rng(9);
    for (let i = 0, n = Math.round(W * H / 26); i < n; i++) { bg.fillStyle = `rgba(255,248,236,${.018 + R() * .035})`; bg.fillRect(R() * W, R() * H, 1, 1); }
    bg.lineCap = 'round';
    cracks.forEach(cr => strokeCrack(bg, cr, f => `rgba(236,230,220,${.3 * f})`, f => .5 + .75 * f));
  }
  function strokeCrack(g, cr, col, wid) {
    if (!cr) return;
    const s = cr.segs;
    for (let i = 0; i < s.length; i += 5) { g.strokeStyle = col(s[i + 4]); g.lineWidth = wid(s[i + 4]); g.beginPath(); g.moveTo(s[i], s[i + 1]); g.lineTo(s[i + 2], s[i + 3]); g.stroke(); }
  }
  let shadeCv = null;
  function shade(c) {
    // the two sides of a case: warm where the theories nearby say yes, cool where they say no
    const f = fields[c], gw = gridW, gh = gridH;
    if (!shadeCv) shadeCv = document.createElement('canvas');
    shadeCv.width = gw; shadeCv.height = gh;
    const sg = shadeCv.getContext('2d'), img = sg.createImageData(gw, gh), reach = .4 * Math.min(W, H) + 60;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const v = f[j * gw + i], k = (j * gw + i) * 4, fade = X.clamp(1 - nearInvolved(c, i * STEP, j * STEP) / reach, 0, 1), a = Math.min(1, Math.abs(v) * 1.6) * fade;
      if (v > 0) { img.data[k] = 242; img.data[k + 1] = 162; img.data[k + 2] = 60; img.data[k + 3] = 50 * a; }
      else { img.data[k] = 125; img.data[k + 1] = 179; img.data[k + 2] = 255; img.data[k + 3] = 38 * a; }
    }
    sg.putImageData(img, 0, 0);
    fg.imageSmoothingEnabled = true;
    fg.drawImage(shadeCv, 0, 0, gw, gh, 0, 0, gw * STEP, gh * STEP);
  }
  function star(g, x, y, seed) {
    const R = X.rng(seed); g.strokeStyle = '#fff'; g.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + R() * .9, len = 11 + R() * 8;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 1; s <= 3; s++) g.lineTo(x + Math.cos(a + (R() - .5) * .5) * len * s / 3, y + Math.sin(a + (R() - .5) * .5) * len * s / 3);
      g.stroke();
    }
  }
  function verdictColor(r) { const v = val(r); return v === null ? 'rgba(255,255,255,.22)' : v > 0 ? X.YES : v < 0 ? X.NO : r.v === 'S' ? '#fff' : '#9c958c'; }
  // agreement as a colour: full agreement is warm, full disagreement cool
  function mix(p) { const a = [242, 162, 60], b = [125, 179, 255]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * p)).join(',')})`; }
  function drawTop() {
    if (!fg) return;
    fg.clearRect(0, 0, W, H);
    const pair = selA >= 0 && selB >= 0, one = selA >= 0 && selB < 0;
    if (pair || selCase >= 0) { fg.fillStyle = 'rgba(0,0,0,.45)'; fg.fillRect(0, 0, W, H); }
    fg.lineCap = 'round';
    if (selCase >= 0) {
      shade(selCase);
      strokeCrack(fg, cracks[selCase], f => `rgba(255,255,255,${.5 + .5 * f})`, f => 1 + 1.7 * f);
    }
    if (pair) {
      const g2 = agree(selA, selB);
      for (const c of g2.cases) strokeCrack(fg, cracks[c], f => `rgba(255,255,255,${.35 + .6 * f})`, f => .8 + 1.2 * f);
      const [ax, ay] = pts[selA], [bx, by] = pts[selB];
      fg.setLineDash([3, 5]); fg.strokeStyle = 'rgba(255,255,255,.6)'; fg.lineWidth = 1; fg.beginPath(); fg.moveTo(ax, ay); fg.lineTo(bx, by); fg.stroke(); fg.setLineDash([]);
    }
    if (hotCase >= 0 && hotCase !== selCase) strokeCrack(fg, cracks[hotCase], f => `rgba(255,255,255,${.35 + .6 * f})`, f => .9 + 1.2 * f);
    for (let t = 0; t < NT; t++) {
      const [x, y] = pts[t], r = 2.6 + 3.4 * Math.sqrt(said[t] / NC);
      let col = '#efe9df', alpha = 1;
      if (selCase >= 0) { const v = V[selCase][t]; col = verdictColor(v); if (v && v.v === 'S') star(fg, x, y, t * 7 + selCase); }
      else if (one && t !== selA) { const g2 = agree(selA, t); col = g2.both ? mix(g2.part / g2.both) : 'rgba(255,255,255,.25)'; }
      else if (pair && t !== selA && t !== selB) alpha = .3;
      fg.globalAlpha = alpha; fg.fillStyle = col; fg.beginPath(); fg.arc(x, y, r, 0, 7); fg.fill();
      if (t === selA || t === selB || t === hotT) { fg.strokeStyle = '#fff'; fg.lineWidth = 1.4; fg.beginPath(); fg.arc(x, y, r + 4, 0, 7); fg.stroke(); }
    }
    fg.globalAlpha = 1;
    syncLabels();
  }

  // ---------- labels ----------
  let labelEls = [];
  function placeLabels() {
    labelsEl.innerHTML = '';
    const boxes = [], mob = W < 700;
    labelEls = T.map((t, i) => {
      const b = X.el('button', 'f-tl' + (mob ? ' sm' : ''), X.esc(t.short || t.name)); b.type = 'button'; b.dataset.t = i;
      labelsEl.appendChild(b);
      const w = b.offsetWidth, h = b.offsetHeight, [x, y] = pts[i], gap = 7 + 3.4 * Math.sqrt(said[i] / NC);
      const tries = [[x + gap, y - h / 2], [x - gap - w, y - h / 2], [x - w / 2, y - gap - h], [x - w / 2, y + gap], [x + gap, y - h - 1], [x + gap, y + 1], [x - gap - w, y - h - 1], [x - gap - w, y + 1]];
      let best = tries[0], bestS = 1e9;
      for (const [lx, ly] of tries) {
        let s = 0;
        if (lx < 2 || lx + w > W - 2 || ly < 2 || ly + h > H - 2) s += 600;
        for (const q of boxes) s += Math.max(0, Math.min(lx + w, q[2]) - Math.max(lx, q[0])) * Math.max(0, Math.min(ly + h, q[3]) - Math.max(ly, q[1]));
        for (let k = 0; k < NT; k++) { if (k === i) continue; const [px, py] = pts[k]; if (px > lx - 5 && px < lx + w + 5 && py > ly - 5 && py < ly + h + 5) s += 150; }
        if (s < bestS) { bestS = s; best = [lx, ly]; }
      }
      boxes.push([best[0], best[1], best[0] + w, best[1] + h]);
      b.style.transform = `translate(${Math.round(best[0])}px, ${Math.round(best[1])}px)`;
      b.addEventListener('mouseenter', () => { hotT = i; drawTop(); X.tip(`<b>${X.esc(t.name)}</b><small>${X.esc(t.idea)}</small>`, b.getBoundingClientRect().right, b.getBoundingClientRect().top); });
      b.addEventListener('mouseleave', () => { hotT = -1; drawTop(); X.tip(null); });
      b.addEventListener('click', () => { X.tip(null); clickTheory(i); });
      return b;
    });
  }
  function syncLabels() {
    labelEls.forEach((b, t) => {
      let s = '';
      if (selCase >= 0) { const v = val(V[selCase][t]); s = v === null ? 'mute' : v > 0 ? 'yes' : v < 0 ? 'no' : 'torn'; }
      else if (selA >= 0 && selB >= 0) s = t === selA || t === selB ? '' : 'mute';
      b.dataset.s = s;
      b.classList.toggle('sel', t === selA || t === selB);
    });
  }

  // ---------- the panel ----------
  const badge = r => r.k === 'cited' ? '' : `<span class="f-k" title="${r.k === 'reading' ? 'The usual reading in the secondary literature, not the founders\u2019 own words' : 'General knowledge, not traced to a page'}">${r.k === 'reading' ? 'reading' : 'unsourced'}</span>`;
  const vcls = r => val(r) > 0 ? 'vy' : val(r) < 0 ? 'vn' : 'vt';
  function peopleBars(c) {
    const p = C[c].people; if (!p) return '';
    const row = (lab, v, sub) => `<div class="f-pp"><span>${lab}<small>${sub}</small></span><i><b style="width:${v}%"></b></i><em>${X.fmt1(v)}%</em></div>`;
    return `<div class="f-h">How many said yes</div>${p.pub !== undefined ? row('People in the study', p.pub, 'Awad and others, 2020') : ''}${p.phil !== undefined ? row('Philosophers', p.phil, 'PhilPapers Survey, 2020') : ''}`;
  }
  function caseCard(c) {
    const cs = C[c], groups = { yes: [], no: [], torn: [], dep: [], mute: [] };
    T.forEach((t, i) => { const r = V[c][i]; if (!r) { groups.mute.push(i); return; } const v = val(r); (v > 0 ? groups.yes : v < 0 ? groups.no : r.v === 'S' ? groups.torn : groups.dep).push(i); });
    const row = i => { const r = V[c][i]; return `<li><button class="f-row" data-t="${i}"><span class="f-rt"><b>${X.esc(T[i].name)}</b><span class="f-w ${vcls(r)}">${WORD[r.v]}</span>${badge(r)}</span><span class="f-why">${X.esc(r.why)}</span>${r.v === 'S' && (r.yes || r.no) ? `<span class="f-sides"><em class="y">Yes: ${X.esc(r.yes || '')}</em><em class="n">No: ${X.esc(r.no || '')}</em></span>` : ''}<small>${X.esc(r.src)}</small></button></li>`; };
    const grp = (name, cls, arr) => arr.length ? `<div class="f-h ${cls}">${name} <span>${arr.length}</span></div><ul class="f-list">${arr.map(row).join('')}</ul>` : '';
    const dial = dialOf[cs.id];
    panel.innerHTML = `<div class="f-nav"><button class="ctl" data-step="-1" aria-label="Previous case">&larr;</button><button class="ctl" data-step="1" aria-label="Next case">&rarr;</button><button class="ctl" data-clear>Clear</button></div>
      <div class="f-kick">${dial ? X.esc(dial.name) : ''}</div><h3>${X.esc(cs.name)}</h3><p class="f-setup">${X.esc(cs.setup)}</p><p class="f-q">${X.esc(cs.act)}?</p>
      ${!cracks[c] ? '<p class="f-none">No crack here. Every theory that answers this case gives the same answer.</p>' : ''}
      ${peopleBars(c)}
      ${grp('Yes', 'y', groups.yes)}${grp('No', 'n', groups.no)}${grp('Torn inside the school', 't', groups.torn)}${grp('It depends', 'd', groups.dep)}
      ${groups.mute.length ? `<div class="f-h m">Say nothing about it <span>${groups.mute.length}</span></div><p class="f-mute">${groups.mute.map(i => X.esc(T[i].name)).join(', ')}</p>` : ''}`;
  }
  function theoryCard(t) {
    const th = T[t];
    const others = T.map((_, k) => k).filter(k => k !== t).map(k => ({ k, ...agree(t, k) })).filter(o => o.both >= 3);
    others.forEach(o => { o.r = o.part / o.both; });
    const near = [...others].sort((a, b) => a.r - b.r || b.both - a.both).slice(0, 3), far = [...others].sort((a, b) => b.r - a.r || b.both - a.both).slice(0, 3);
    const li = o => `<li><button class="f-mini" data-t="${o.k}"><b>${X.esc(T[o.k].name)}</b><span>${o.part ? `part on ${o.part} of ${o.both}` : `agree on all ${o.both}`}</span></button></li>`;
    const vlist = DIALS.map(d => {
      const rows = d.cases.map(id => cIdx[id]).filter(c => c !== undefined && V[c][t]);
      if (!rows.length) return '';
      return `<div class="f-h">${X.esc(d.name)}</div><ul class="f-list">${rows.map(c => { const r = V[c][t]; return `<li><button class="f-row" data-c="${c}"><span class="f-rt"><b>${X.esc(C[c].name)}</b><span class="f-w ${vcls(r)}">${WORD[r.v]}</span>${badge(r)}</span><span class="f-why">${X.esc(r.why)}</span></button></li>`; }).join('')}</ul>`;
    }).join('');
    panel.innerHTML = `<div class="f-nav"><button class="ctl" data-clear>Clear</button></div><div class="f-kick">${X.esc(th.fam || '')}</div><h3>${X.esc(th.name)}</h3><p class="f-who">${X.esc(th.who)}</p><p class="f-setup">${X.esc(th.idea)}</p>
      <p class="f-q">Answers ${said[t]} of the ${NC} cases. On the map, warm dots mostly agree with it and cool ones mostly do not. Pick a second theory to set the two side by side.</p>
      ${near.length ? `<div class="f-h">Closest</div><ul class="f-minis">${near.map(li).join('')}</ul>` : ''}
      ${far.length ? `<div class="f-h">Farthest</div><ul class="f-minis">${far.map(li).join('')}</ul>` : ''}
      ${vlist}`;
  }
  function pairCard(a, b) {
    const g2 = agree(a, b), A = T[a], B = T[b], same = [];
    for (let c = 0; c < NC; c++) { const x = val(V[c][a]), y = val(V[c][b]); if (x !== null && y !== null && !g2.cases.includes(c)) same.push(c); }
    const side = r => `<span class="f-w ${vcls(r)}">${WORD[r.v]}</span> ${X.esc(r.why)}`;
    panel.innerHTML = `<div class="f-nav"><button class="ctl" data-clear>Clear</button></div><div class="f-kick">Two theories</div><h3>${X.esc(A.name)} and ${X.esc(B.name)}</h3>
      <p class="f-q">${g2.both ? `They both answer ${g2.both} case${g2.both === 1 ? '' : 's'} and part on ${g2.part}. Each of those is a crack the dotted line crosses.` : 'They never answer the same case, so the map can only guess at the distance between them.'}</p>
      ${g2.cases.map(c => `<div class="f-pair"><button class="f-pc" data-c="${c}">${X.esc(C[c].name)}</button><div class="f-ps"><div><b>${X.esc(A.short || A.name)}</b>${side(V[c][a])}</div><div><b>${X.esc(B.short || B.name)}</b>${side(V[c][b])}</div></div></div>`).join('')}
      ${same.length ? `<div class="f-h">Where they agree, or one is torn</div><p class="f-mute">${same.map(c => X.esc(C[c].name)).join(', ')}</p>` : ''}`;
  }
  function intro() {
    const groups = DIALS.map(d => `<div class="f-h">${X.esc(d.name)}</div><ul class="f-cases">${d.cases.map(id => cIdx[id]).filter(c => c !== undefined).map(c => {
      const vs = V[c].map(val), y = vs.filter(v => v === 1).length, n = vs.filter(v => v === -1).length, t = vs.filter(v => v === 0).length, all = y + n + t || 1;
      return `<li><button class="f-case" data-c="${c}"><b>${X.esc(C[c].name)}</b><i aria-hidden="true"><s style="width:${y / all * 100}%;background:var(--yes)"></s><s style="width:${t / all * 100}%;background:#d8d2c8"></s><s style="width:${n / all * 100}%;background:var(--no)"></s></i></button></li>`;
    }).join('')}</ul>`).join('');
    panel.innerHTML = `<p class="f-intro">Theories that usually give the same answer sit close together. Each faint line is one case, running between the theories that say yes and the ones that say no. A bigger dot answers more of the cases.</p><p class="f-intro">Pick a line, or a case from the list. Pick a theory to see who agrees with it, then a second one to compare the two.</p>${groups}`;
  }
  function render() {
    if (selCase >= 0) caseCard(selCase);
    else if (selA >= 0 && selB >= 0) pairCard(selA, selB);
    else if (selA >= 0) theoryCard(selA);
    else intro();
    panel.scrollTop = 0;
    drawTop();
  }
  function setCase(c) { selCase = c; selA = selB = -1; render(); sync(); }
  function clickTheory(t) {
    if (selCase >= 0) { selCase = -1; selA = t; selB = -1; }
    else if (selA < 0) selA = t;
    else if (selA === t) { selA = selB; selB = -1; }
    else if (selB === t) selB = -1;
    else if (selB < 0) selB = t;
    else { selA = selB; selB = t; }
    render(); sync();
  }
  function clearAll() { selCase = selA = selB = -1; render(); sync(); }
  function sync() { X.setParams({ case: selCase >= 0 ? C[selCase].id : null, a: selCase < 0 && selA >= 0 ? T[selA].id : null, b: selCase < 0 && selB >= 0 ? T[selB].id : null, dials: mode === 'dials' ? '1' : null, sort: mode === 'dials' && sortBy !== 'map' ? sortBy : null }); }

  // ---------- every verdict: one table, cases in order along each dial ----------
  function rowOrder() {
    const ids = T.map((_, i) => i);
    if (sortBy === 'said') return ids.sort((a, b) => said[b] - said[a] || a - b);
    if (sortBy === 'family') return ids.sort((a, b) => (T[a].fr ?? 0) - (T[b].fr ?? 0) || a - b);
    return ids.sort((a, b) => UNIT[a][0] - UNIT[b][0]);
  }
  function dials() {
    const mob = innerWidth < 700, order = rowOrder(), cw = mob ? 28 : 33, lw = mob ? 128 : 190, gap = 16, headH = 150;
    const cols = []; let x = lw;
    DIALS.forEach(d => { d.cases.forEach(id => { const c = cIdx[id]; if (c === undefined) return; cols.push({ c, x, d }); x += cw; }); x += gap; });
    const width = x, top = headH + 62, rh = 26, height = top + order.length * rh + 8;
    let s = `<svg class="f-dsvg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Every verdict, theory by case">`;
    DIALS.forEach(d => {
      const cs = cols.filter(k => k.d === d); if (!cs.length) return;
      s += `<text x="${cs[0].x + 2}" y="14" class="f-dn">${X.esc(d.name)}</text><line x1="${cs[0].x + 2}" x2="${cs[cs.length - 1].x + cw - 4}" y1="22" y2="22" class="f-dl"/>`;
    });
    cols.forEach(({ c, x }) => { s += `<g class="f-ch" data-c="${c}" tabindex="0" role="button" aria-label="Show ${X.esc(C[c].name)} on the map"><rect x="${x}" y="26" width="${cw}" height="${headH - 20}" fill="transparent"/><text transform="translate(${x + cw / 2 + 4},${headH}) rotate(-62)" class="f-ct">${X.esc(C[c].name)}</text></g>`; });
    [['People in the study', 'pub'], ['Philosophers', 'phil']].forEach(([lab, k], ri) => {
      const y = headH + 8 + ri * 26;
      s += `<text x="${lw - 10}" y="${y + 15}" text-anchor="end" class="f-rl p">${lab}</text>`;
      cols.forEach(({ c, x }) => { const p = C[c].people && C[c].people[k]; if (p === undefined || p === null) return; const h = 18 * p / 100; s += `<rect x="${x + 7}" y="${y + 20 - h}" width="${cw - 14}" height="${h}" fill="var(--yes)" opacity=".85"><title>${lab}: ${X.fmt1(p)}% said yes</title></rect><rect x="${x + 5}" y="${y + 20}" width="${cw - 10}" height="1" fill="rgba(255,255,255,.25)"/>`; });
    });
    order.forEach((t, ri) => {
      const y = top + ri * rh;
      s += `<g class="f-r" data-t="${t}" tabindex="0" role="button" aria-label="Show ${X.esc(T[t].name)} on the map"><rect x="0" y="${y}" width="${width}" height="${rh}" class="f-rb"/><text x="${lw - 10}" y="${y + 17}" text-anchor="end" class="f-rl">${X.esc(T[t].name)}</text></g>`;
      let prev = null;
      cols.forEach(({ c, x, d }, ci) => {
        const r = V[c][t], cx = x + cw / 2, cy = y + rh / 2;
        if (ci > 0 && cols[ci - 1].d !== d) prev = null;
        if (!r) { s += `<circle cx="${cx}" cy="${cy}" r="1.3" fill="rgba(255,255,255,.18)"/>`; return; }
        const v = val(r), tipTxt = X.esc(`${T[t].name} on ${C[c].name}. ${WORD[r.v]}. ${r.why}`);
        if (v > 0) s += `<circle cx="${cx}" cy="${cy}" r="${r.v === 'R' ? 7 : 5.5}" fill="var(--yes)" data-tip="${tipTxt}"/>`;
        else if (v < 0) s += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="none" stroke="var(--no)" stroke-width="2" data-tip="${tipTxt}"/>`;
        else if (r.v === 'S') s += `<g data-tip="${tipTxt}"><circle cx="${cx}" cy="${cy}" r="6" fill="#000" stroke="#fff" stroke-width="1.2"/><path d="M${cx - 6} ${cy}A6 6 0 0 1 ${cx + 6} ${cy}Z" fill="#fff"/></g>`;
        else s += `<rect x="${cx - 5.5}" y="${cy - 1}" width="11" height="2.2" fill="#9c958c" data-tip="${tipTxt}"/>`;
        // a break: the theory said yes to the case before on this dial and no to this one, or the reverse
        if (v !== 0 && prev !== null && prev.v !== v) s += `<line x1="${(prev.x + cx) / 2}" x2="${(prev.x + cx) / 2}" y1="${y + 3}" y2="${y + rh - 3}" class="f-brk"/>`;
        if (v !== 0) prev = { v, x: cx };
      });
    });
    s += '</svg>';
    dialsEl.querySelector('.f-dscroll').innerHTML = s;
  }

  // ---------- size ----------
  function resize(force) {
    const w = Math.round(plateEl.clientWidth); if (!w || (!force && w === W)) return;
    W = w; H = W < 700 ? Math.round(Math.min(W * 1.25, 560)) : X.clamp(Math.round(innerHeight * .8), 560, 780);
    plateEl.style.height = H + 'px';
    bg = X.sizeCanvas(bgCv, W, H); fg = X.sizeCanvas(fgCv, W, H);
    STEP = W < 700 ? 4 : 5;
    gridW = Math.ceil(W / STEP) + 1; gridH = Math.ceil(H / STEP) + 1;
    layoutPoints();
    fields = C.map((_, c) => fieldOf(c));
    cracks = C.map((_, c) => crackOf(c));
    drawBase(); placeLabels(); drawTop();
  }
  function setMode(m) {
    mode = m; X.tip(null);
    modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fm === m)));
    root.querySelector('.f-wrap').style.display = m === 'plate' ? '' : 'none';
    dialsEl.style.display = m === 'dials' ? '' : 'none';
    sortWrap.style.display = m === 'dials' ? '' : 'none';
    if (m === 'dials') dials(); else { resize(true); render(); }
    sync();
  }

  function init(el) {
    root = el;
    const nV = V.flat().filter(Boolean).length;
    root.innerHTML = `
      <div class="bar">
        <div class="bar-group" role="group" aria-label="View">
          <button class="chip-btn" data-fm="plate" aria-pressed="true">The map</button>
          <button class="chip-btn" data-fm="dials" aria-pressed="false">Every verdict</button>
        </div>
        <div class="bar-group f-sort" role="group" aria-label="Order theories by" style="display:none">
          <span style="font-size:.84rem;color:var(--ink-mute);margin-right:.2rem">Order by</span>
          <button class="chip-btn" data-sort="map" aria-pressed="true">Left to right on the map</button>
          <button class="chip-btn" data-sort="family" aria-pressed="false">Family</button>
          <button class="chip-btn" data-sort="said" aria-pressed="false">How much they say</button>
        </div>
        <span class="bar-note">${NT} theories, ${NC} cases, ${nV} verdicts</span>
      </div>
      <div class="f-wrap">
        <div class="f-plate"><canvas class="f-bg"></canvas><canvas class="f-fg"></canvas><div class="f-labels"></div></div>
        <aside class="f-panel" aria-live="polite"></aside>
      </div>
      <div class="f-dials" style="display:none"><p class="f-dnote">Each row is a theory and each column a case. The cases are grouped by what they turn on, and run from easier to harder within each group. A short white bar marks where a theory changes its answer.</p>
        <p class="f-key"><span><i class="ky"></i>yes</span><span><i class="kr"></i>must</span><span><i class="kn"></i>no</span><span><i class="kt"></i>torn</span><span><i class="kd"></i>depends</span><span><i class="ks"></i>silent</span></p><div class="f-dscroll"></div></div>`;
    plateEl = root.querySelector('.f-plate'); bgCv = root.querySelector('.f-bg'); fgCv = root.querySelector('.f-fg'); labelsEl = root.querySelector('.f-labels'); panel = root.querySelector('.f-panel');
    dialsEl = root.querySelector('.f-dials'); sortWrap = root.querySelector('.f-sort');
    modeBtns = [...root.querySelectorAll('[data-fm]')];
    modeBtns.forEach(b => b.addEventListener('click', () => { if (b.dataset.fm !== mode) setMode(b.dataset.fm); }));
    sortWrap.addEventListener('click', e => { const b = e.target.closest('[data-sort]'); if (!b) return; sortBy = b.dataset.sort; sortWrap.querySelectorAll('[data-sort]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); dials(); sync(); });

    fgCv.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = fgCv.getBoundingClientRect(), best = crackNear(e.clientX - r.left, e.clientY - r.top, 7);
      if (best !== hotCase) { hotCase = best; drawTop(); }
      fgCv.style.cursor = best >= 0 ? 'pointer' : 'default';
      if (best < 0) { X.tip(null); return; }
      const vs = V[best].map(val), yN = vs.filter(v => v === 1).length, nN = vs.filter(v => v === -1).length;
      X.tip(`<b>${X.esc(C[best].name)}</b><small>${X.esc(C[best].act)}? <span class="y">${yN} yes</span>, <span class="n">${nN} no</span></small>`, e.clientX, e.clientY);
    });
    let lastPointer = 'mouse';
    fgCv.addEventListener('pointerdown', e => { lastPointer = e.pointerType; });
    fgCv.addEventListener('pointerleave', () => { hotCase = -1; X.tip(null); drawTop(); });
    fgCv.addEventListener('click', e => {
      const r = fgCv.getBoundingClientRect(), best = crackNear(e.clientX - r.left, e.clientY - r.top, lastPointer === 'touch' ? 14 : 7);
      if (best >= 0) setCase(best); else clearAll();
    });
    panel.addEventListener('click', e => {
      const st = e.target.closest('[data-step]'); if (st) { setCase(((selCase < 0 ? 0 : selCase) + +st.dataset.step + NC) % NC); return; }
      if (e.target.closest('[data-clear]')) { clearAll(); return; }
      const cb = e.target.closest('[data-c]'); if (cb) { setCase(+cb.dataset.c); if (innerWidth < 900) plateEl.scrollIntoView({ behavior: X.reduced ? 'auto' : 'smooth', block: 'start' }); return; }
      const tb = e.target.closest('[data-t]'); if (tb) { const t = +tb.dataset.t; if (selCase >= 0) { selCase = -1; selA = t; selB = -1; render(); sync(); } else clickTheory(t); }
    });
    dialsEl.addEventListener('pointermove', e => { const g = e.target.closest('[data-tip]'); if (!g) { X.tip(null); return; } X.tip(`<small>${g.getAttribute('data-tip')}</small>`, e.clientX, e.clientY); });
    dialsEl.addEventListener('pointerleave', () => X.tip(null));
    dialsEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.f-ch, .f-r')) { e.preventDefault(); e.target.closest('.f-ch, .f-r').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    dialsEl.addEventListener('click', e => {
      const h = e.target.closest('.f-ch'); if (h) { selCase = +h.dataset.c; selA = selB = -1; setMode('plate'); scrollTo({ top: root.getBoundingClientRect().top + scrollY - 90, behavior: X.reduced ? 'auto' : 'smooth' }); return; }
      const r = e.target.closest('.f-r'); if (r) { selCase = -1; selA = +r.dataset.t; selB = -1; setMode('plate'); scrollTo({ top: root.getBoundingClientRect().top + scrollY - 90, behavior: X.reduced ? 'auto' : 'smooth' }); }
    });
    addEventListener('keydown', e => {
      if (!shown || mode !== 'plate') return;
      if (e.key === 'Escape') clearAll();
      if (selCase >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !(e.target.closest && e.target.closest('input, select, textarea, [role="tab"]'))) { e.preventDefault(); setCase((selCase + (e.key === 'ArrowRight' ? 1 : NC - 1)) % NC); }
    });
    X.onWidth(root, () => { if (!shown) return; if (mode === 'plate') resize(); else dials(); });
    X.watchDpr(() => { if (shown && mode === 'plate') resize(true); });

    const q = X.params();
    const qc = q.get('case'); if (qc && cIdx[qc] !== undefined) selCase = cIdx[qc];
    const qa = q.get('a'), qb = q.get('b');
    if (selCase < 0 && qa && tIdx[qa] !== undefined) { selA = tIdx[qa]; if (qb && tIdx[qb] !== undefined && qb !== qa) selB = tIdx[qb]; }
    const qs = q.get('sort'); if (qs === 'family' || qs === 'said') { sortBy = qs; sortWrap.querySelectorAll('[data-sort]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sort === qs))); }
    if (q.get('dials') === '1') mode = 'dials';
  }
  function show() { shown = true; setMode(mode); }
  function hide() { shown = false; X.tip(null); }

  X.views.faults = { init, show, hide, sync };
})();
