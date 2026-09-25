/* Fifty Seasons: The Season.
   Every castaway is a thread running from day 1 to the day they left. Threads sit in their tribe's lane, move when tribes swap
   and merge, and are as thick as that episode's confessionals. Every vote is a stitch from the voter to the target.
   Jurors walk down to the jury and, at the end, cast one last line to the finalist they chose. */
(function () {
  'use strict';
  const X = window.SX, D = X.D;
  const FONT = '"Schibsted Grotesk", system-ui, sans-serif';
  const G = 1.15, G2 = 1.5, JG = 1.7, JSP = .6;
  const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  const EMBER = '#ff7a3d', GOLD = '#ffd27a';

  // ---------- layout, in "slots" (one castaway high) and days ----------
  const cache = new Map();
  function layout(S) {
    if (cache.has(S.n)) return cache.get(S.n);
    const n = S.cast.length;
    // a period is a run of stages with the same tribes; each tribe keeps its centre for the whole period
    const periods = []; let cur = null;
    S.stages.forEach((s, k) => { const key = s[2].map(l => l[0]).join('|'); if (!cur || cur.key !== key) { cur = { key, ks: [] }; periods.push(cur); } cur.ks.push(k); });
    for (const per of periods) {
      per.hmax = S.stages[per.ks[0]][2].map((_, li) => Math.max(...per.ks.map(k => S.stages[k][2][li][2].length)));
      per.height = per.hmax.reduce((a, b) => a + b, 0) + G * (per.hmax.length - 1);
    }
    const HmainP = Math.max(...periods.map(p => p.height));
    const centreOf = new Map();
    for (const per of periods) { let y = (HmainP - per.height) / 2; const cs = per.hmax.map(h => { const c0 = y + h / 2; y += h + G; return c0; }); for (const k of per.ks) centreOf.set(k, cs); }
    const st = S.stages.map((s, k) => {
      const [ep, day, lanes, specials] = s;
      const pos = new Map(), boxes = [], cs = centreOf.get(k);
      lanes.forEach((L, li) => { const m = L[2].length, top = cs[li] - m / 2; L[2].forEach((ci, j) => pos.set(ci, top + j + .5)); boxes.push({ name: L[0], status: L[1], top, bot: top + m }); });
      const y = HmainP;
      let sy = 0; const spos = new Map(), sboxes = [];
      specials.forEach((L, li) => { if (li) sy += G; const top = sy; for (const ci of L[1]) { spos.set(ci, sy + .5); sy += 1; } sboxes.push({ name: L[0], top, bot: sy }); });
      const dPrev = k ? S.stages[k - 1][1] : 0;
      return { ep, day, dPrev, tr: Math.min(1.6, Math.max(.35, (day - dPrev) * .5)), pos, boxes, mainH: y, spos, sboxes, specH: sy };
    });
    const Hmain = Math.max(...st.map(s => s.mainH)), Hspec = Math.max(0, ...st.map(s => s.specH));
    for (const s of st) s.off = 0;
    const specTop = Hmain + (Hspec ? G2 : 0);
    const jurors = S.cast.map((c, i) => i).filter(i => S.cast[i].jury && !S.cast[i].fin).sort((a, b) => (S.cast[a].jo || 99) - (S.cast[b].jo || 99));
    const juryTop = specTop + Hspec + JG;
    const total = juryTop + Math.max(jurors.length, 1) * JSP + .6;
    const jurySlot = new Map(jurors.map((ci, k) => [ci, juryTop + (k + .5) * JSP]));
    const juryVote = new Map(S.jury.map(([j, f]) => [j, f]));

    const threads = S.cast.map((c, i) => {
      const segs = [];
      st.forEach((s, k) => {
        if (s.pos.has(i)) segs.push({ k, d0: s.dPrev, d1: s.day, y: s.off + s.pos.get(i), mode: 'main', tr: s.tr });
        else if (s.spos.has(i)) segs.push({ k, d0: s.dPrev, d1: s.day, y: specTop + s.spos.get(i), mode: 'spec', tr: s.tr });
      });
      if (!segs.length) return null;
      for (let j = 1; j < segs.length; j++) if (segs[j].d0 > segs[j - 1].d1 + 1e-6) segs[j].gapFrom = segs[j - 1].d1;
      let end = segs[segs.length - 1].d1;
      if (!c.fin && c.day && c.day > end && c.day <= S.days) { segs[segs.length - 1].d1 = c.day; end = c.day; }
      return { i, segs, start: 0, end, jury: jurySlot.has(i) ? jurySlot.get(i) : null, votedFor: juryVote.get(i), fin: c.fin, win: c.win };
    });
    const out = { S, st, threads, Hmain, Hspec, specTop, juryTop, total, jurors, n, D: S.days };
    cache.set(S.n, out);
    return out;
  }

  // y (in slots) of a thread on a given day, following swaps and merges with an s-curve
  function yAt(th, d) {
    const segs = th.segs;
    for (let j = 0; j < segs.length; j++) {
      const s = segs[j];
      if (d <= s.d1 || j === segs.length - 1) {
        if (j && d < s.d0 + s.tr) { const p = segs[j - 1].y; return p + (s.y - p) * smooth((d - s.d0) / s.tr); }
        return s.y;
      }
    }
    return segs[segs.length - 1].y;
  }
  const modeAt = (th, d) => { for (const s of th.segs) if (d <= s.d1) return s.mode; return th.segs[th.segs.length - 1].mode; };

  function episodeAt(S, d) {
    for (let j = 0; j < S.eps.length; j++) if (S.eps[j].d1 != null && d <= S.eps[j].d1 + 1e-6) return j;
    return S.eps.length - 1;
  }

  // ---------- geometry of one drawing: slots and days to pixels ----------
  function frameFor(L, w, h, pad) {
    const g = { L, w, h, ...pad };
    g.sp = (h - g.top - g.bottom) / L.total;
    g.x = d => g.left + d / L.D * (w - g.left - g.right);
    g.y = s => g.top + s * g.sp;
    g.xFtc = g.x(L.D) + Math.min(64, g.right * .42);
    g.xEnd = w - Math.max(4, g.right * .08);
    g.day = x => (x - g.left) / (w - g.left - g.right) * L.D;
    return g;
  }

  // sampled paths in pixels, with widths from confessionals
  function paths(g, step, withWidth) {
    const L = g.L, S = L.S, out = [];
    const maxW = g.sp * .82, k = g.sp * .21;
    for (const th of L.threads) {
      if (!th) { out.push(null); continue; }
      const c = S.cast[th.i], xs = [], ys = [], ws = [], md = [];
      for (let d = 0; d <= th.end + 1e-9; d += step) {
        xs.push(g.x(d)); ys.push(g.y(yAt(th, d)));
        const m = modeAt(th, d); md.push(m);
        if (withWidth) { const cnt = c.c[episodeAt(S, d)] || 0; ws.push(Math.min(maxW, 1.1 + k * Math.sqrt(cnt)) * (m === 'spec' ? .8 : 1)); } else ws.push(1);
      }
      if (withWidth) for (let r = 0; r < 2; r++) for (let j = 1; j < ws.length - 1; j++) ws[j] = (ws[j - 1] + 2 * ws[j] + ws[j + 1]) / 4;
      // the walk to the jury, then the last line to a finalist
      let jury = null;
      if (th.jury != null) {
        const jy = g.y(th.jury), y0 = ys[ys.length - 1], x0 = xs[xs.length - 1], jx = [], jyy = [];
        const dStart = th.end, walk = Math.min(1.3, Math.max(.6, (L.D - dStart) * .3));
        for (let d = dStart; d <= L.D + 1e-9; d += step) { const u = smooth((d - dStart) / walk); jx.push(g.x(d)); jyy.push(y0 + (jy - y0) * u); }
        jury = { xs: jx, ys: jyy, x0, y0 };
      }
      out.push({ i: th.i, xs, ys, ws, md, jury });
    }
    // finalists' y at the end
    for (const p of out) if (p && L.threads[p.i].fin) p.yEnd = p.ys[p.ys.length - 1];
    return out;
  }

  // ---------- drawing ----------
  function ribbon(c, xs, ys, ws, a, b) {
    if (b <= a) return;
    const nx = new Float32Array(b - a + 1), ny = new Float32Array(b - a + 1);
    for (let k = a; k <= b; k++) {
      const k0 = Math.max(a, k - 1), k1 = Math.min(b, k + 1), dx = xs[k1] - xs[k0], dy = ys[k1] - ys[k0], l = Math.hypot(dx, dy) || 1;
      nx[k - a] = -dy / l; ny[k - a] = dx / l;
    }
    c.beginPath();
    for (let k = a; k <= b; k++) c.lineTo(xs[k] + nx[k - a] * ws[k] / 2, ys[k] + ny[k - a] * ws[k] / 2);
    for (let k = b; k >= a; k--) c.lineTo(xs[k] - nx[k - a] * ws[k] / 2, ys[k] - ny[k - a] * ws[k] / 2);
    c.closePath(); c.fill();
  }
  const line = (c, xs, ys, a, b) => { c.beginPath(); for (let k = a; k <= b; k++) k === a ? c.moveTo(xs[k], ys[k]) : c.lineTo(xs[k], ys[k]); c.stroke(); };

  function drawBands(c, g, alpha, labels) {
    const L = g.L, S = L.S;
    // one band per run of stages that share a lane
    const runs = new Map();
    L.st.forEach((s, k) => {
      for (const b of s.boxes) { const key = b.name; if (!runs.has(key)) runs.set(key, []); const r = runs.get(key); const last = r[r.length - 1]; if (last && last[last.length - 1].k === k - 1) last.push({ k, b }); else r.push([{ k, b }]); }
    });
    for (const [name, list] of runs) {
      const col = X.tribeColour(S, name);
      for (const run of list) {
        const top = [], bot = [], xs = [];
        const first = L.st[run[0].k], lastS = L.st[run[run.length - 1].k];
        const d0 = first.dPrev + (run[0].k ? first.tr : 0), d1 = lastS.day;
        const step = Math.max(.05, (d1 - d0) / 160);
        for (let d = d0; d <= d1 + 1e-9; d += step) {
          let j = run.length - 1; while (j > 0 && d <= L.st[run[j].k].dPrev + 1e-9) j--;
          const s = L.st[run[j].k], b = run[j].b;
          let t0 = s.off + b.top - .38, b0 = s.off + b.bot + .38;
          if (j > 0 && d < s.dPrev + s.tr) { const p = L.st[run[j - 1].k], pb = run[j - 1].b, u = smooth((d - s.dPrev) / s.tr); t0 = (p.off + pb.top - .38) * (1 - u) + t0 * u; b0 = (p.off + pb.bot + .38) * (1 - u) + b0 * u; }
          xs.push(g.x(d)); top.push(g.y(t0)); bot.push(g.y(b0));
        }
        if (xs.length < 2) continue;
        c.fillStyle = X.rgba(col, alpha);
        c.beginPath(); for (let k = 0; k < xs.length; k++) c.lineTo(xs[k], top[k]); for (let k = xs.length - 1; k >= 0; k--) c.lineTo(xs[k], bot[k]); c.closePath(); c.fill();
        if (labels) {
          c.font = `650 11px ${FONT}`; c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
          c.fillText(name, xs[0] + 3, top[0] - 4);
        }
      }
    }
    // Redemption Island, Edge of Extinction
    if (L.Hspec) {
      const spans = [];
      L.st.forEach(s => { if (s.specH) spans.push([s.dPrev, s.day, s.specH]); });
      if (spans.length) {
        const name = L.st.find(s => s.sboxes.length).sboxes[0].name, d0 = spans[0][0], d1 = spans[spans.length - 1][1];
        c.fillStyle = 'rgba(255,255,255,.035)';
        c.beginPath(); c.roundRect(g.x(d0), g.y(L.specTop - .38), g.x(d1) - g.x(d0), g.y(L.specTop + L.Hspec + .38) - g.y(L.specTop - .38), 4); c.fill();
        if (labels) { c.font = `650 11px ${FONT}`; c.fillStyle = 'rgba(169,176,192,.9)'; c.textAlign = 'left'; c.fillText(name, g.x(d0) + 3, g.y(L.specTop - .38) - 4); }
      }
    }
  }

  // the whole season, as a still; dim everything but `focus` when set
  function render(c, g, P, opt) {
    const L = g.L, S = L.S, big = opt.big, focus = opt.focus, tri = opt.tribal;
    const dimmed = focus != null || tri != null;
    const involved = new Set();
    if (tri != null) for (const [a, b] of S.tribals[tri].v) { involved.add(a); involved.add(b); }
    c.lineCap = 'round'; c.lineJoin = 'round';
    drawBands(c, g, big ? .085 : .12, big && opt.labels !== false);
    // jury: dashed walk and the final line to a finalist
    for (const p of P) {
      if (!p || !p.jury) continue;
      const i = p.i, on = !dimmed || focus === i || (focus != null && L.threads[i].votedFor === focus), col = X.castColour(S, i);
      c.strokeStyle = X.rgba(col, on ? (big ? .55 : .6) : .1); c.lineWidth = big ? 1.1 : .7; c.setLineDash(big ? [3, 3] : [2, 2]);
      line(c, p.jury.xs, p.jury.ys, 0, p.jury.xs.length - 1); c.setLineDash([]);
      const f = L.threads[i].votedFor, fp = f != null ? P[f] : null, jr = L.jurors.indexOf(i);
      if (fp && fp.yEnd != null && (opt.juryShown == null || jr < opt.juryShown)) {
        const x0 = p.jury.xs[p.jury.xs.length - 1], y0 = p.jury.ys[p.jury.ys.length - 1];
        c.strokeStyle = X.rgba(S.cast[f].win ? GOLD : col, on ? (big ? .75 : .7) : .12); c.lineWidth = big ? 1.2 : .7;
        c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + (g.xFtc - x0) * .6, y0, g.xFtc - (g.xFtc - x0) * .15, fp.yEnd, g.xFtc, fp.yEnd); c.stroke();
      }
    }
    // threads
    for (const p of P) {
      if (!p) continue;
      const i = p.i, col = X.castColour(S, i), th = L.threads[i];
      const on = !dimmed || focus === i || involved.has(i);
      let a = 0;
      while (a < p.xs.length - 1) {
        let b = a; while (b < p.xs.length - 1 && p.md[b + 1] === p.md[a]) b++;
        c.fillStyle = X.rgba(col, (on ? 1 : .16) * (p.md[a] === 'spec' ? .55 : 1));
        if (big) ribbon(c, p.xs, p.ys, p.ws, Math.max(0, a - 1), b); else { c.strokeStyle = c.fillStyle; c.lineWidth = .9; line(c, p.xs, p.ys, Math.max(0, a - 1), b); }
        a = b + 1;
      }
      if (th.fin) {
        const y = p.yEnd, x0 = p.xs[p.xs.length - 1];
        if (th.win && big) { c.shadowColor = GOLD; c.shadowBlur = 16; }
        const gr = c.createLinearGradient(x0, 0, g.xFtc, 0);
        gr.addColorStop(0, X.rgba(col, on ? 1 : .2)); gr.addColorStop(1, X.rgba(th.win ? GOLD : col, on ? 1 : .2));
        c.strokeStyle = gr; c.lineWidth = big ? Math.max(2, p.ws[p.ws.length - 1]) : 1.2;
        c.beginPath(); c.moveTo(x0, y); c.lineTo(g.xFtc, y); c.stroke(); c.shadowBlur = 0;
        if (th.win && big) { c.fillStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 18; c.beginPath(); c.arc(g.xFtc, y, 4, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; }
      }
    }
    if (!big) return;
    // votes: a stitch from each voter to the person they wrote down
    const rounds = new Map(); S.tribals.forEach(t => rounds.set(t.o, Math.max(rounds.get(t.o) || 1, t.vo)));
    S.tribals.forEach((t, ti) => {
      const xs = g.x(t.day) - 3 - (rounds.get(t.o) - t.vo) * 9, show = !dimmed || tri === ti;
      for (const [v, tg, nul] of t.v) {
        const pv = P[v], pt = P[tg]; if (!pv || !pt) continue;
        const mine = focus != null && (v === focus || tg === focus);
        if (dimmed && !show && !mine) continue;
        const yv = g.y(yAt(L.threads[v], t.day)), yt = g.y(yAt(L.threads[tg], t.day));
        c.strokeStyle = X.rgba(X.castColour(S, v), mine || tri === ti ? 1 : .72); c.lineWidth = mine || tri === ti ? 1.6 : 1.05;
        if (nul) c.setLineDash([2, 2]);
        c.beginPath(); c.moveTo(xs - 18, yv); c.quadraticCurveTo(xs - 2, yv, xs, yt); c.stroke();
        if (nul) c.setLineDash([]);
      }
    });
    // a snuffed torch where each thread ends
    for (const p of P) {
      if (!p) continue;
      const th = L.threads[p.i]; if (th.fin) continue;
      const x = p.xs[p.xs.length - 1], y = p.ys[p.ys.length - 1], on = !dimmed || focus === p.i || involved.has(p.i);
      c.fillStyle = X.rgba(EMBER, on ? .95 : .25); c.beginPath(); c.arc(x + 1.5, y, 2.1, 0, Math.PI * 2); c.fill();
    }
    // idols and advantages
    for (const [ci, day, code, ok] of S.adv) {
      const p = P[ci]; if (!p || day > L.D) continue;
      const k = Math.max(0, Math.min(p.xs.length - 1, Math.round(day / opt.step))), x = p.xs[k], y = p.ys[k];
      const on = !dimmed || focus === ci;
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
      if (code === 'p') { c.fillStyle = X.rgba(ok ? GOLD : '#ffffff', on ? 1 : .2); c.fillRect(-3, -3, 6, 6); }
      else { c.strokeStyle = X.rgba(GOLD, on ? .95 : .2); c.lineWidth = 1.2; c.strokeRect(-2.6, -2.6, 5.2, 5.2); }
      c.restore();
    }
  }

  // labels and axes for the big chart
  function chrome(c, g, P, opt) {
    const L = g.L, S = L.S, focus = opt.focus;
    c.textBaseline = 'middle';
    // names at the start
    c.font = `600 11.5px ${FONT}`; c.textAlign = 'right';
    for (const p of P) {
      if (!p) continue;
      const on = focus == null || focus === p.i;
      c.fillStyle = X.rgba(X.castColour(S, p.i), on ? .95 : .3);
      c.fillText(S.cast[p.i].name, g.left - 9, p.ys[0]);
    }
    // finalists at the end, with their jury votes
    const votes = new Map(); for (const [, f] of S.jury) votes.set(f, (votes.get(f) || 0) + 1);
    c.textAlign = 'left';
    const fins = opt.hideEnd ? [] : P.filter(p => p && L.threads[p.i].fin).sort((a, b) => a.yEnd - b.yEnd), ly = [];
    fins.forEach((p, k) => { ly[k] = k ? Math.max(p.yEnd, ly[k - 1] + 17) : p.yEnd; });
    fins.forEach((p, k) => {
      const w = L.threads[p.i].win, nv = votes.get(p.i) || 0, x = g.xFtc + 12, on = focus == null || focus === p.i;
      c.font = `${w ? 750 : 600} ${w ? 13 : 12}px ${FONT}`; c.fillStyle = w ? X.rgba(GOLD, on ? 1 : .4) : X.rgba('#d6dbe4', on ? .9 : .35);
      c.fillText(S.cast[p.i].name, x, ly[k]);
      const nw = c.measureText(S.cast[p.i].name).width;
      c.font = `500 11.5px ${FONT}`; c.fillStyle = w ? X.rgba(GOLD, on ? .85 : .35) : X.rgba('#a9b0c0', on ? .85 : .3);
      c.fillText(String(nv), x + nw + 6, ly[k]);
    });
    // jury label
    if (L.jurors.length) { c.font = `650 11px ${FONT}`; c.fillStyle = 'rgba(169,176,192,.75)'; c.textAlign = 'right'; c.fillText('Jury', g.left - 9, g.y(L.juryTop + L.jurors.length * JSP / 2)); }
    // days
    const yb = g.h - g.bottom + 18;
    c.font = `500 11px ${FONT}`; c.fillStyle = 'rgba(107,114,130,.95)'; c.textAlign = 'center';
    for (let d = 1; d <= L.D; d++) {
      if (d !== 1 && d % 5 && d !== L.D) continue;
      if (d !== L.D && L.D - d < 3) continue;
      c.fillText(d === 1 ? 'Day 1' : String(d), g.x(d - .5), yb);
    }
    // merge and swaps
    const mk = (d, text, col) => {
      const s = L.st.find(q => q.day >= d && q.dPrev < d + 1e-6 && q.day > d) || L.st.find(q => q.dPrev >= d);
      const x = g.x(s ? s.dPrev + s.tr * .5 : d);
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(x, g.top - 2); c.lineTo(x, g.h - g.bottom + 4); c.stroke(); c.setLineDash([]);
      c.font = `650 11px ${FONT}`; c.fillStyle = col; c.textAlign = 'center'; c.fillText(text, x, g.top - 30);
    };
    const mergeName = (L.st.find(s => s.boxes.some(b => b.status === 'Merged' || b.status === 'Mergatory')) || {}).boxes;
    if (S.merge != null) mk(S.merge - 1e-3, 'Merge', mergeName ? X.tribeColour(S, mergeName[0].name) : '#fff');
    for (const d of S.swaps) mk(d + 1e-3, 'Swap', 'rgba(214,220,232,.85)');
    // one mark per tribal council along the top, in the colour of the tribe that went
    const seen = new Set();
    S.tribals.forEach((tr, ti) => {
      if (seen.has(tr.o)) return; seen.add(tr.o);
      const x = g.x(tr.day), on = opt.tribal == null || S.tribals[opt.tribal].o === tr.o, col = tr.tribe && S.tribes[tr.tribe] ? X.tribeColour(S, tr.tribe) : '#d6dbe4';
      c.fillStyle = X.rgba(col, on ? .95 : .35); c.beginPath(); c.moveTo(x, g.top - 16); c.lineTo(x + 3.2, g.top - 9); c.lineTo(x, g.top - 5); c.lineTo(x - 3.2, g.top - 9); c.closePath(); c.fill();
    });
    // final tribal council
    c.font = `650 11px ${FONT}`; c.fillStyle = 'rgba(169,176,192,.85)'; c.textAlign = 'center';
    c.fillText('Final vote', g.xFtc, g.top - 30);
  }

  // ---------- the view ----------
  let el, cv, c, dpr = 1, W = 0, H = 0, S = null, L = null, g = null, P = null, step = .05;
  let focus = null, pinned = null, tribalHover = null, playing = false, t = 0, wall = 0, last = 0, raf = 0, sound = true, speed = 1, events = [], evI = 0, caption = '', sparks = [];
  let reveal = 1, revealAt = 0, rraf = 0, juryAt = 0;
  function startReveal() {
    if (X.reduced) { reveal = 1; return; }
    reveal = 0; revealAt = performance.now(); cancelAnimationFrame(rraf);
    const step = now => { reveal = Math.min(1, (now - revealAt) / 1300); draw(); if (reveal < 1 && !playing) rraf = requestAnimationFrame(step); else { reveal = 1; draw(); } };
    rraf = requestAnimationFrame(step);
  }
  const base = document.createElement('canvas'), bc = base.getContext('2d');
  const SPEEDS = [1, 2, 4];

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="s-top">
        <div class="s-read" aria-live="polite"></div>
        <div class="s-ctl">
          <div class="s-ctl-row">
            <button class="ctl s-prev" aria-label="Previous season"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 5.5 9 12l6.5 6.5-1.4 1.4L6.2 12l7.9-7.9z"/></svg></button>
            <button class="ctl s-play" data-c="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play the season</span></button>
            <button class="ctl" data-c="speed">1&times;</button>
            <button class="ctl s-all" data-c="all" hidden>Show the whole season</button>
            <button class="ctl" data-c="sound" aria-pressed="true">Sound on</button>
            <button class="ctl s-next" aria-label="Next season"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m8.5 18.5 6.5-6.5-6.5-6.5 1.4-1.4 7.9 7.9-7.9 7.9z"/></svg></button>
          </div>
          <p class="s-caption"></p>
        </div>
      </div>
      <div class="s-chart"><canvas class="s-canvas" aria-label="The season as threads, one per castaway"></canvas></div>
      <div class="s-key">
        <span><i class="k-thread"></i>A castaway, as thick as their confessionals that episode</span>
        <span><i class="k-stitch"></i>A vote</span>
        <span><i class="k-ember"></i>Out of the game</span>
        <span><i class="k-idol"></i>Idol found</span>
        <span><i class="k-idol on"></i>Idol played</span>
        <span><i class="k-jury"></i>On the jury</span>
      </div>
      <h3 class="s-wall-h">All fifty seasons</h3>
      <div class="s-wall"></div>`;
    cv = el.querySelector('.s-canvas'); c = cv.getContext('2d');
    el.querySelector('.s-prev').addEventListener('click', () => setSeason(Math.max(1, S.n - 1)));
    el.querySelector('.s-next').addEventListener('click', () => setSeason(Math.min(D.seasons.length, S.n + 1)));
    el.querySelector('.s-ctl-row').addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'play') { if (playing) pause(); else play(); }
      if (b.dataset.c === 'all') { pause(); t = 0; caption = ''; el.querySelector('.s-caption').textContent = ''; setPlayLabel(); draw(); }
      if (b.dataset.c === 'speed') { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; b.textContent = speed + '\u00D7'; }
      if (b.dataset.c === 'sound') { sound = !sound; b.setAttribute('aria-pressed', sound); b.textContent = sound ? 'Sound on' : 'Sound off'; if (sound) X.audio(); }
    });
    el.querySelector('.s-read').addEventListener('click', e => {
      const a = e.target.closest('[data-s]'); if (!a) return;
      e.preventDefault(); setSeason(+a.dataset.s, { who: a.dataset.p != null ? +a.dataset.p : null });
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { X.tip(null); tribalHover = null; focus = pinned; draw(); readout(); });
    cv.addEventListener('click', () => { pinned = focus === pinned ? null : focus; if (pinned != null) X.setParams({ who: S.cast[pinned].p }); else X.setParams({ who: null }); draw(); readout(); });
    addEventListener('keydown', onKey);
    new ResizeObserver(() => { if (el.classList.contains('on')) resize(); }).observe(el.querySelector('.s-chart'));
    buildWall();
  }

  function show(opts) {
    const n = opts && opts.season ? +opts.season : (S ? S.n : 20);
    const who = opts && opts.who != null && opts.who !== '' ? +opts.who : null;
    if (!S || n !== S.n || who != null) setSeason(X.seasonByN(n) ? n : 20, { who, quiet: !!(opts && opts.initial) });
    else resize();
  }
  function hide() { pause(); X.tip(null); }

  function setSeason(n, o = {}) {
    pause(); t = 0; playing = false; events = []; caption = ''; juryAt = 0;
    S = X.seasonByN(n); L = layout(S);
    pinned = null; focus = null;
    if (o.who != null) { const k = S.cast.findIndex(q => q.p === o.who); if (k >= 0) pinned = focus = k; }
    X.setParams({ season: n === 20 ? null : n, who: pinned != null ? S.cast[pinned].p : null });
    el.querySelectorAll('.s-mini').forEach(m => m.classList.toggle('on', +m.dataset.n === n));
    el.querySelector('.s-caption').textContent = '';
    setPlayLabel();
    resize(); readout(); startReveal();
    if (!o.quiet) el.querySelector('.s-top').scrollIntoView({ behavior: X.reduced ? 'auto' : 'smooth', block: 'nearest' });
  }

  function resize() {
    const box = el.querySelector('.s-chart');
    cv.style.width = ''; W = cv.getBoundingClientRect().width; H = box.clientHeight; if (!W || !H || !S) return;
    const gut = parseFloat(getComputedStyle(el.querySelector('.s-top')).paddingLeft) || 24;
    dpr = Math.min(devicePixelRatio || 1, 2);
    for (const k of [cv, base]) { k.width = Math.round(W * dpr); k.height = Math.round(H * dpr); }
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const narrow = W < 760;
    g = frameFor(L, W, H, { left: gut + (narrow ? 64 : 84), right: gut + (narrow ? 90 : 128), top: 46, bottom: 30 });
    step = Math.max(.03, L.D / ((W - g.left - g.right) / 2));
    P = paths(g, step, true);
    draw();
  }

  function draw() {
    if (!g) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const opt = { big: true, focus, tribal: tribalHover, step };
    if (playing || (t > 0 && t < L.D + 2.2)) opt.juryShown = juryAt ? Math.floor((performance.now() - juryAt) / 220) + 1 : 0;
    const rv = reveal < 1 && !playing && t === 0 ? 1 - Math.pow(1 - reveal, 3) : 1;
    if (playing || t > 0 || rv < 1) {
      const xr = rv < 1 ? g.left - 4 + (W - g.left + 4) * rv : g.x(Math.min(t, L.D)) + (t >= L.D ? W : 0);
      c.save(); c.beginPath(); c.rect(0, 0, xr, H); c.clip();
      render(c, g, P, opt); c.restore();
      chrome(c, g, P, { focus, tribal: tribalHover, hideEnd: rv < 1 ? rv < .97 : t < L.D + 1.3 });
      if (rv >= 1 && t < L.D + 1) { c.strokeStyle = 'rgba(255,241,201,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(xr, g.top - 10); c.lineTo(xr, H - g.bottom + 4); c.stroke(); }
    } else { render(c, g, P, opt); chrome(c, g, P, { focus, tribal: tribalHover }); }
    // focus labels: who they voted for, at each stitch
    if (focus != null && !playing) voteLabels();
    embers();
  }

  function voteLabels() {
    const upto = t > 0 && t < L.D + 2.2 ? t : Infinity;
    c.font = `600 10.5px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'center';
    for (const tr of S.tribals) for (const [v, tg] of tr.v) {
      if (v !== focus || tr.day > upto) continue;
      const x = g.x(tr.day) - 12, y = g.y(yAt(L.threads[tg], tr.day));
      const w = c.measureText(S.cast[tg].name).width + 8;
      c.fillStyle = 'rgba(0,0,0,.78)'; c.beginPath(); c.roundRect(x - w / 2, y - 18, w, 14, 7); c.fill();
      c.fillStyle = X.castColour(S, tg); c.fillText(S.cast[tg].name, x, y - 11);
    }
  }

  // ---------- reading ----------
  function onMove(ev) {
    if (!g) return;
    const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    if (my < g.top - 6) {
      // the row of tribal councils along the top
      let best = null, bd = 9;
      S.tribals.forEach((tr, ti) => { const dx = Math.abs(g.x(tr.day) - mx); if (dx < bd) { bd = dx; best = ti; } });
      if (best !== tribalHover) { tribalHover = best; focus = best == null ? pinned : null; draw(); readout(); }
      X.tip(null); return;
    }
    tribalHover = null;
    let bi = null, bd = 11;
    const d = g.day(mx);
    for (const p of P) {
      if (!p) continue;
      const k = Math.round(d / step);
      if (k >= 0 && k < p.xs.length) { const dd = Math.abs(p.ys[k] - my); if (dd < Math.max(bd, 0) && dd < p.ws[k] / 2 + 6) { bd = dd; bi = p.i; } }
      if (p.jury) { const kj = Math.round((d - L.threads[p.i].end) / step); if (kj >= 0 && kj < p.jury.xs.length) { const dd = Math.abs(p.jury.ys[kj] - my); if (dd < bd) { bd = dd; bi = p.i; } } }
      if (L.threads[p.i].fin && mx > p.xs[p.xs.length - 1]) { const dd = Math.abs(p.yEnd - my); if (dd < bd) { bd = dd; bi = p.i; } }
    }
    const nf = bi != null ? bi : pinned;
    if (nf !== focus) { focus = nf; draw(); readout(); }
    if (bi != null) {
      const cc = S.cast[bi];
      X.tip(`<b>${X.esc(cc.full)}</b><small>${X.esc(X.exitText(S, bi))}</small>`, ev.clientX, ev.clientY);
    } else X.tip(null);
  }

  function onKey(e) {
    if (!el || !el.classList.contains('on') || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || document.querySelector('.cmdk.open')) return;
    if (e.code === 'Space') { e.preventDefault(); if (playing) pause(); else play(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setSeason(Math.max(1, Math.min(D.seasons.length, S.n + (e.key === 'ArrowRight' ? 1 : -1)))); }
  }

  const tribalCount = S => new Set(S.tribals.map(t => t.o)).size;
  function readout() {
    const box = el.querySelector('.s-read'); if (!S) return;
    if (tribalHover != null) {
      const tr = S.tribals[tribalHover], out = tr.out.map(i => S.cast[i].name), tl = X.tally(tr);
      const who = tl.map(([tg, k]) => `<b style="color:${X.castColour(S, tg)}">${X.esc(S.cast[tg].name)}</b> ${k}`).join(', ');
      const place = tr.tribe ? `at ${X.esc(tr.tribe)}` : '';
      box.innerHTML = `<div class="s-kick">Day ${tr.day}, tribal council ${place}${tr.vo > 1 ? ', the revote' : ''}</div><h2 class="s-name">${out.length ? X.esc(out.join(' and ')) + ' voted out' : 'No one voted out'}</h2><p class="s-line">${X.tallyText(tr) || 'No votes counted'}. ${who}.${tr.ev && tr.ev.length ? ` ${X.esc(tr.ev.join(', '))}.` : ''}</p>`;
      return;
    }
    if (focus != null) { box.innerHTML = person(focus); return; }
    const w = S.cast[S.winner], jv = new Map(); for (const [, f] of S.jury) jv.set(f, (jv.get(f) || 0) + 1);
    const ru = S.cast.map((q, i) => i).filter(i => S.cast[i].fin && !S.cast[i].win).sort((a, b) => (jv.get(b) || 0) - (jv.get(a) || 0)).map(i => S.cast[i].full);
    box.innerHTML = `<div class="s-kick">Season ${S.n}, ${X.year(S)}</div><h2 class="s-name">${X.esc(S.name === String(S.n) ? 'Survivor ' + S.n : S.name)}</h2><p class="s-line">${X.esc(S.loc || '')}. ${S.nCast} castaways, ${S.days} days, ${tribalCount(S)} tribal councils. <b>${X.esc(w.full)}</b> won ${X.esc(S.finalVote)} over ${X.esc(ru.join(' and '))}. ${S.viewers ? `${S.viewers.toFixed(1)} million viewers an episode.` : ''}</p>`;
  }

  function person(i) {
    const cc = S.cast[i], th = L.threads[i];
    const tot = cc.c.reduce((a, b) => a + b, 0), rank = 1 + S.cast.filter(q => q.c.reduce((a, b) => a + b, 0) > tot).length;
    let cast = 0, got = 0; for (const tr of S.tribals) for (const [v, tg, nul] of tr.v) { if (v === i) cast++; if (tg === i && !nul) got++; }
    const found = S.adv.filter(a => a[0] === i && a[2] === 'f').length, played = S.adv.filter(a => a[0] === i && a[2] === 'p'), saved = played.reduce((s, a) => s + (a[4] || 0), 0);
    const bits = [];
    if (cc.age) bits.push(`Age ${cc.age}${X.home(cc) ? `, from ${X.esc(X.home(cc))}` : ''}.`);
    bits.push(`${tot} confessionals, ${rank === 1 ? 'the most' : `the ${X.ord(rank)} most`} this season.`);
    bits.push(`Cast ${cast} ${cast === 1 ? 'vote' : 'votes'} and received ${got}.`);
    if (found || played.length) bits.push(`Found ${found} ${found === 1 ? 'advantage' : 'advantages'}${played.length ? `, played ${played.length}${saved ? `, cancelling ${saved} ${saved === 1 ? 'vote' : 'votes'}` : ''}` : ''}.`);
    if (cc.imm) bits.push(`Won individual immunity ${cc.imm === 1 ? 'once' : cc.imm === 2 ? 'twice' : cc.imm + ' times'}.`);
    if (th && th.votedFor != null) bits.push(`On the jury, voted for ${X.esc(S.cast[th.votedFor].name)}.`);
    const apps = D.people[cc.p].apps.filter(a => D.seasons[a[0]].n !== S.n);
    const also = apps.length ? `<p class="s-also">Also played: ${apps.map(([si, ci]) => { const T = D.seasons[si], q = T.cast[ci]; return `<a href="#" data-s="${T.n}" data-p="${cc.p}">${X.esc(T.name === String(T.n) ? 'Survivor ' + T.n : T.name)}</a>${q.win ? ' (won)' : ''}`; }).join(', ')}</p>` : '';
    return `<div class="s-kick">Season ${S.n}, ${X.esc(cc.tribe)}${pinned === i ? ', pinned' : ''}</div><h2 class="s-name" style="color:${cc.win ? GOLD : '#fff'}">${X.esc(cc.full)}</h2><p class="s-exit">${X.esc(X.exitText(S, i))}</p><p class="s-line">${bits.join(' ')}</p>${also}`;
  }

  // ---------- playing a season ----------
  function buildEvents() {
    const ev = [];
    const rounds = new Map(); S.tribals.forEach(tr => rounds.set(tr.o, Math.max(rounds.get(tr.o) || 1, tr.vo)));
    for (const tr of S.tribals) {
      const out = tr.out.map(i => S.cast[i].name), final = tr.vo === rounds.get(tr.o);
      ev.push({ d: tr.day - .04, kind: 'tribal', tr, text: final && out.length ? `Day ${tr.day}. ${out.join(' and ')} ${out.length > 1 ? 'are' : 'is'} voted out${tr.tribe ? ` of ${tr.tribe}` : ''}, ${X.tallyText(tr)}.` : `Day ${tr.day}. A tie at ${tr.tribe || 'tribal council'}, ${X.tallyText(tr)}, so they vote again.` });
    }
    S.cast.forEach((cc, i) => {
      const r = cc.result || '';
      if (/medically|quit|withdrew|ejected/i.test(r) && !/voted out/i.test(r)) ev.push({ d: cc.day, kind: 'exit', i, text: `Day ${cc.day}. ${cc.name} ${/medically/i.test(r) ? 'is medically evacuated' : /ejected/i.test(r) ? 'is removed from the game' : 'quits'}.` });
      if (/fire/i.test(r)) ev.push({ d: cc.day - .02, kind: 'exit', i, text: `Day ${cc.day}. ${cc.name} loses the fire-making challenge.` });
    });
    if (S.merge != null) { const mName = (L.st.find(s => s.boxes.some(b => b.status === 'Merged' || b.status === 'Mergatory')) || { boxes: [{ name: '' }] }).boxes[0].name; const s = L.st.find(q => q.dPrev < S.merge && q.day >= S.merge) || L.st[0]; ev.push({ d: s.dPrev + s.tr * .5, kind: 'merge', text: `The tribes merge${mName && mName !== 'No tribe' ? ` into ${mName}` : ''}.` }); }
    for (const d of S.swaps) { const s = L.st.find(q => q.dPrev >= d) || L.st[0]; ev.push({ d: s.dPrev + s.tr * .5, kind: 'swap', text: `Day ${Math.ceil(s.dPrev + .01)}. The tribes are shuffled.` }); }
    const votes = new Map(); for (const [, f] of S.jury) votes.set(f, (votes.get(f) || 0) + 1);
    ev.push({ d: L.D + .3, kind: 'jury', text: `Day ${L.D}. The jury votes.` });
    ev.push({ d: L.D + 1.3, kind: 'win', text: `${S.cast[S.winner].full} is the Sole Survivor, ${S.finalVote}.` });
    return ev.sort((a, b) => a.d - b.d);
  }

  function setPlayLabel() {
    const b = el.querySelector('.s-play'), mid = t > 0 && t < L.D + 2.2;
    el.querySelector('.s-all').hidden = !(mid && !playing);
    b.innerHTML = playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg><span>Pause</span>'
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>${mid ? 'Keep playing' : 'Play the season'}</span>`;
  }
  function play() {
    if (!S) return;
    if (t <= 0 || t >= L.D + 2.2) { t = 0; evI = 0; juryAt = 0; events = buildEvents(); }
    if (sound) X.audio();
    playing = true; pinned = null; focus = null; tribalHover = null; X.tip(null); setPlayLabel(); readout();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function pause() { if (!playing) return; playing = false; cancelAnimationFrame(raf); setPlayLabel(); draw(); }

  // days run at about one a second, and slow down for tribal council
  function rate(d) {
    let slow = 1;
    for (const tr of S.tribals) { const dd = d - tr.day; if (dd > -.5 && dd < .35) { slow = Math.min(slow, .28); break; } }
    if (d > L.D) slow = .55;
    return (L.D > 30 ? 1.05 : .8) * slow;
  }
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    t += dt * rate(t) * speed;
    while (evI < events.length && events[evI].d <= t) fire(events[evI++]);
    if (t >= L.D + 2.2) { t = L.D + 2.2; playing = false; setPlayLabel(); draw(); readout(); return; }
    draw();
    raf = requestAnimationFrame(loop);
  }
  function fire(e) {
    caption = e.text; el.querySelector('.s-caption').textContent = caption;
    if (e.kind === 'jury') juryAt = performance.now();
    if (!sound) return;
    const pan = x => (x / W) * 2 - 1;
    if (e.kind === 'tribal') {
      X.drum(.55); X.drum(.38, .18);
      for (const i of e.tr.out) { const p = P[i]; setTimeout(() => X.snuff(.45, pan(p ? p.xs[p.xs.length - 1] : W / 2)), 520); spark(i); }
    }
    if (e.kind === 'exit') { X.snuff(.4); spark(e.i); }
    if (e.kind === 'merge') { X.bell(392, .16, 0, 1.6); X.bell(587.3, .1, .12, 1.6); }
    if (e.kind === 'swap') X.bell(440, .12, 0, 1.2);
    if (e.kind === 'jury') S.jury.forEach((_, k) => X.tick(.1, k * .22));
    if (e.kind === 'win') { X.bell(523.25, .22, 0, 3); X.bell(659.3, .16, .08, 3); X.bell(784, .12, .16, 3); }
  }
  // smoke from a torch as it goes out
  function spark(i) {
    if (X.reduced) return;
    const p = P[i]; if (!p) return;
    const x = p.xs[p.xs.length - 1], y = p.ys[p.ys.length - 1], now = performance.now() / 1000 + .5;
    for (let k = 0; k < 14; k++) sparks.push({ x, y, vx: (Math.random() - .5) * 16, vy: -12 - Math.random() * 22, born: now + Math.random() * .1, life: .9 + Math.random() * .6 });
  }
  function embers() {
    if (!sparks.length) return;
    const now = performance.now() / 1000;
    sparks = sparks.filter(s => now - s.born < s.life);
    c.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      const a = now - s.born; if (a < 0) continue;
      const q = a / s.life; c.fillStyle = q < .25 ? `rgba(255,150,80,${.9 * (1 - q)})` : `rgba(200,205,215,${.35 * (1 - q)})`;
      c.beginPath(); c.arc(s.x + s.vx * a, s.y + s.vy * a, q < .25 ? 1.4 : 1.4 + q * 2.4, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  // ---------- all fifty, small ----------
  function buildWall() {
    const wall = el.querySelector('.s-wall');
    wall.innerHTML = D.seasons.map(T => `<button class="s-mini" data-n="${T.n}" aria-label="Season ${T.n}: ${X.esc(T.name)}"><canvas></canvas><span><b>${T.n}</b> ${X.esc(T.name === String(T.n) ? '' : T.name)}</span></button>`).join('');
    wall.addEventListener('click', e => { const b = e.target.closest('.s-mini'); if (b) setSeason(+b.dataset.n); });
    wall.addEventListener('pointerover', e => {
      const b = e.target.closest('.s-mini'); if (!b) return;
      const T = X.seasonByN(+b.dataset.n), w = T.cast[T.winner];
      const r = b.getBoundingClientRect();
      X.tip(`<b>Season ${T.n}${T.name === String(T.n) ? '' : ', ' + X.esc(T.name)}</b><small>${X.year(T)}. ${T.nCast} castaways, ${T.days} days. ${X.esc(w.full)} won ${X.esc(T.finalVote)}.</small>`, r.left + r.width / 2, r.bottom - 6);
    });
    wall.addEventListener('pointerleave', () => X.tip(null));
    requestAnimationFrame(drawWall);
    new ResizeObserver(() => drawWall()).observe(wall);
  }
  function drawWall() {
    el.querySelectorAll('.s-mini canvas').forEach(k => {
      const T = X.seasonByN(+k.parentElement.dataset.n), LL = layout(T);
      const w = k.clientWidth, h = k.clientHeight; if (!w || !h) return;
      const r = Math.min(devicePixelRatio || 1, 2); k.width = Math.round(w * r); k.height = Math.round(h * r);
      const cc = k.getContext('2d'); cc.setTransform(r, 0, 0, r, 0, 0); cc.clearRect(0, 0, w, h);
      const gg = frameFor(LL, w, h, { left: 4, right: 16 + (w - 20) * (1 - Math.min(1, LL.D / 39)), top: 5, bottom: 4 });
      render(cc, gg, paths(gg, Math.max(.1, LL.D / 90), false), { big: false, step: .1 });
    });
  }

  X.views.season = { init, show, hide };
})();
