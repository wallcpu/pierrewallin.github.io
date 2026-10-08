/* Where the Eye Sits: draws the sheet from eye/data/eye.js with the same geometry as the printed poster
   (render_sheet.py). Drag to pan, pinch or Ctrl+wheel to zoom, hover a mark for its shot, click a row for its film. */
(() => {
  'use strict';
  const E = window.EYE;
  if (!E) return;
  const P = E.p;
  const C = { paper: '#f4efe4', ink: '#1d1a16', trace: '#a39b8f', rule: '#ddd4c4', faint: '#8c8476', hair: '#cfc5b3', hi: 'rgba(29, 26, 22, .065)' };
  const FONT = "'Schibsted Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const TAN = P.slant.map(a => Math.tan(a * Math.PI / 180));
  const CAP = P.rise_cap * P.lane;
  const LEVEL = ['still', 'turns or shakes in place', 'travels', 'moves in more than one way'];
  const AX = 26;            // year axis strip at the foot of the frame, in px
  const MAX_S = 10;

  const films = E.films;
  for (const f of films) {
    const n = f.D.length;
    f.tc = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) f.tc[i + 1] = f.tc[i] + f.D[i] / 10;
    f.x1 = f.x0 + f.tc[n] * P.px_sec;
  }
  const shot = (f, i) => {
    const v = f.F[i];
    return { band: (v & 7) - 1, move: ((v >> 3) & 7) - 1, empty: ((v >> 6) & 3) - 1, mh: (v >> 8) & 1, air: (v >> 9) & 1, card: (v >> 10) & 1, word: (v >> 11) & 31 };
  };
  const bandOf = (f, s) => (s.band >= 0 ? s.band : f.bands[0]);
  const upper = (t, v) => { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] <= v) lo = m + 1; else hi = m; } return lo; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const yearX = y => P.ml + (y - P.year0) * P.px_year;
  const dur = d => {
    if (d < 60) return `${d.toFixed(1)} seconds`;
    const t = Math.round(d), m = Math.floor(t / 60), s = t % 60;
    return `${m} minute${m > 1 ? 's' : ''}${s ? ` ${s} second${s > 1 ? 's' : ''}` : ''}`;
  };

  // what the frame can show
  const TOP = E.bands[E.bands.length - 1].y0 - 24, BOT = E.bands[0].y1 + 6;
  const LEFT = P.ml - 150, RIGHT = E.W - P.mr + 30;

  // one shot, in the poster's grammar: flat if the camera is still, slanted by how much it moves,
  // a flat strand hatched at that slant when a moving shot is too long for one stroke
  function emit(ctx, f, i, X, Y, s) {
    if (s.empty === 1 || s.card === 1) return;
    let a = f.x0 + f.tc[i] * P.px_sec, b = f.x0 + f.tc[i + 1] * P.px_sec;
    const g = Math.min(P.gap, 0.45 * (b - a));
    a += g / 2; b -= g / 2;
    if (b - a < P.min_mark) { const m = (a + b) / 2; a = m - P.min_mark / 2; b = m + P.min_mark / 2; }
    const y = f.ys[bandOf(f, s)];
    const lev = Math.max(0, s.move);
    if (!lev) { ctx.moveTo(X(a), Y(y)); ctx.lineTo(X(b), Y(y)); return; }
    const t = TAN[lev], run = CAP / t, len = b - a;
    if (len <= run * 1.15) { const r = len * t / 2; ctx.moveTo(X(a), Y(y + r)); ctx.lineTo(X(b), Y(y - r)); return; }
    const n = Math.max(2, Math.round(len / run)), step = len / n;
    ctx.moveTo(X(a), Y(y)); ctx.lineTo(X(b), Y(y));
    for (let k = 0; k < n; k++) { const c = a + k * step + (step - run) / 2; ctx.moveTo(X(c), Y(y + CAP / 2)); ctx.lineTo(X(c + run), Y(y - CAP / 2)); }
  }

  // ---------- elements ----------
  const frame = document.getElementById('eFrame');
  const cv = document.getElementById('eSheet');
  const mini = document.getElementById('eMini');
  const tip = document.getElementById('eTip');
  const panel = document.getElementById('ePanel');
  const find = document.getElementById('eFind');
  const cx = cv.getContext('2d');
  const mx = mini.getContext('2d');
  let dpr = 1, fw = 0, fh = 0, sc = 1, vx = LEFT, vy = TOP, raf = 0, hover = null, current = null;
  let mw = 0, mh = 0, ms = 1, mox = 0, moy = 0, miniImg = null;

  const minS = () => Math.min(fw / (RIGHT - LEFT), (fh - AX) / (BOT - TOP));
  const fitH = () => (fh - AX) / (BOT - TOP);
  function clamp() {
    sc = Math.min(MAX_S, Math.max(minS(), sc));
    const vw = fw / sc, vh = (fh - AX) / sc, cw = RIGHT - LEFT, ch = BOT - TOP;
    vx = cw <= vw ? LEFT - (vw - cw) / 2 : Math.min(RIGHT - vw, Math.max(LEFT, vx));
    vy = ch <= vh ? TOP - (vh - ch) / 2 : Math.min(BOT - vh, Math.max(TOP, vy));
  }
  function zoomAt(px, py, k) {
    const x = vx + px / sc, y = vy + py / sc;
    sc *= k; clamp();
    vx = x - px / sc; vy = y - py / sc; clamp(); req();
  }
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };

  // ---------- the sheet ----------
  function draw() {
    raf = 0;
    const ctx = cx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, fw, fh);
    const X = x => (x - vx) * sc, Y = y => (y - vy) * sc;
    const xa = vx - 40 / sc, xb = vx + (fw + 40) / sc;
    const sp = P.lane * sc;   // screen distance between two rows

    ctx.lineWidth = 1;
    ctx.strokeStyle = C.rule; ctx.beginPath();
    for (let b = 0; b < E.bands.length - 1; b++) { const yy = Math.round(Y(E.bands[b].y0)) + .5; ctx.moveTo(0, yy); ctx.lineTo(fw, yy); }
    ctx.stroke();
    const gy = Math.round(Y(E.bands[0].y1)) + .5;
    ctx.strokeStyle = C.faint; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(fw, gy); ctx.stroke();
    const skyTop = Y(E.bands[E.bands.length - 1].y0);
    ctx.strokeStyle = C.hair; ctx.beginPath();
    for (const [yr] of E.events) { const xx = Math.round(X(yearX(yr))) + .5; ctx.moveTo(xx, skyTop - 6); ctx.lineTo(xx, gy); }
    ctx.stroke();
    ctx.font = `11px ${FONT}`; ctx.fillStyle = C.faint; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (const [yr, word] of E.events) ctx.fillText(word, X(yearX(yr)) + 5, skyTop + 13);

    if (hover || current) {
      ctx.fillStyle = C.hi;
      for (const f of new Set([hover && hover.f, current].filter(Boolean)))
        for (const b of f.bands) ctx.fillRect(X(f.x0) - 4, Y(f.ys[b] - P.lane / 2), (f.x1 - f.x0) * sc + 8, P.lane * sc);
    }

    for (const pr of [0, 1]) {
      ctx.beginPath();
      for (const f of films) {
        if (f.pr !== pr || f.x1 < xa || f.x0 > xb) continue;
        const i0 = Math.max(0, upper(f.tc, (xa - f.x0) / P.px_sec) - 2), i1 = Math.min(f.D.length, upper(f.tc, (xb - f.x0) / P.px_sec) + 1);
        for (let i = i0; i < i1; i++) emit(ctx, f, i, X, Y, shot(f, i));
      }
      ctx.lineWidth = pr ? Math.min(3.4, Math.max(.8, P.w_principal * sc)) : Math.min(2.4, Math.max(.65, P.w_trace * sc));
      ctx.strokeStyle = pr ? C.ink : C.trace; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      ctx.stroke();
    }

    if (hover) {
      const { f, i } = hover, s = shot(f, i), y = Y(f.ys[bandOf(f, s)]) + Math.max(4, sp * .42);
      const a = X(f.x0 + f.tc[i] * P.px_sec), b = X(f.x0 + f.tc[i + 1] * P.px_sec);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(a, y); ctx.lineTo(Math.max(b, a + 2), y); ctx.stroke();
    }

    // names at the left of each row, titles and squares at the right, when the rows have room
    if (sp >= 8.5) {
      const fs = Math.max(9.5, Math.min(13, sp * .7));
      const ft = Math.max(9, Math.min(12, sp * .58));
      const q = Math.max(4, Math.min(7, sp * .34));
      ctx.textBaseline = 'middle';
      for (const f of films) {
        if (f.x1 + 400 / sc < xa || f.x0 - 200 / sc > xb) continue;
        const col = f.pr ? C.ink : C.trace;
        const yb = Y(f.ys[f.bands[0]]);
        ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.font = `${fs}px ${FONT}`;
        ctx.fillText(f.d, X(f.x0) - 7, yb);
        if (sp >= 11) {
          ctx.textAlign = 'left'; ctx.font = `italic ${ft}px ${FONT}`;
          const tx = X(f.x1) + 7;
          ctx.fillText(f.t, tx, yb);
          let qx = tx + ctx.measureText(f.t).width + 7;
          for (const st of f.prov) { square(ctx, qx, yb - q / 2, q, st, col); qx += q + 3; }
        }
      }
    }

    // band names stay at the left edge; the years run along the foot
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `12px ${FONT}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = C.paper; ctx.fillStyle = C.faint;
    for (const b of E.bands) {
      const cy = Y((b.y0 + b.y1) / 2);
      if (cy < 8 || cy > fh - AX - 6 || (b.y1 - b.y0) * sc < 15) continue;
      ctx.strokeText(b.label, 12, cy); ctx.fillText(b.label, 12, cy);
    }
    ctx.fillStyle = 'rgba(244, 239, 228, .94)'; ctx.fillRect(0, fh - AX, fw, AX);
    const pxy = P.px_year * sc, every = pxy >= 60 ? 1 : pxy >= 14 ? 5 : 10;
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = C.faint; ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let yr = Math.ceil(Math.max(P.year0, P.year0 + (vx - P.ml) / P.px_year - 1) / every) * every; yr <= P.year1; yr += every) {
      const x = X(yearX(yr));
      if (x < -20 || x > fw + 20) continue;
      ctx.moveTo(Math.round(x) + .5, fh - AX); ctx.lineTo(Math.round(x) + .5, fh - AX + 4);
      ctx.fillText(String(yr), x, fh - AX + 14);
    }
    ctx.stroke();
    drawMini();
  }

  function square(ctx, x, y, s, st, col) {
    ctx.lineWidth = .8; ctx.strokeStyle = col; ctx.fillStyle = col;
    if (st === 2) { ctx.fillRect(x, y, s, s); return; }
    ctx.strokeRect(x + .4, y + .4, s - .8, s - .8);
    if (st === 1) { ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.closePath(); ctx.fill(); }
  }

  // ---------- the whole scroll, small, above the sheet ----------
  function buildMini() {
    mw = mini.clientWidth; mh = mini.clientHeight;
    if (!mw || !mh) return;
    mini.width = Math.round(mw * dpr); mini.height = Math.round(mh * dpr);
    ms = Math.min((mw - 16) / (RIGHT - LEFT), (mh - 8) / (BOT - TOP));
    mox = (mw - (RIGHT - LEFT) * ms) / 2; moy = (mh - (BOT - TOP) * ms) / 2;
    const off = document.createElement('canvas');
    off.width = mini.width; off.height = mini.height;
    const o = off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.fillStyle = C.paper; o.fillRect(0, 0, mw, mh);
    const X = x => mox + (x - LEFT) * ms, Y = y => moy + (y - TOP) * ms;
    o.strokeStyle = C.rule; o.lineWidth = .6; o.beginPath();
    for (let b = 0; b < E.bands.length - 1; b++) { o.moveTo(X(LEFT), Y(E.bands[b].y0)); o.lineTo(X(RIGHT), Y(E.bands[b].y0)); }
    o.stroke();
    for (const pr of [0, 1]) {
      o.beginPath();
      for (const f of films) if (f.pr === pr) for (let i = 0; i < f.D.length; i++) emit(o, f, i, X, Y, shot(f, i));
      o.lineWidth = pr ? 1.1 : .8; o.strokeStyle = pr ? C.ink : C.trace; o.stroke();
    }
    miniImg = off;
  }
  function drawMini() {
    if (!miniImg) return;
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.drawImage(miniImg, 0, 0);
    mx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = mox + (vx - LEFT) * ms, y = moy + (vy - TOP) * ms, w = fw / sc * ms, h = (fh - AX) / sc * ms;
    mx.fillStyle = 'rgba(244, 239, 228, .62)';
    mx.beginPath(); mx.rect(0, 0, mw, mh); mx.rect(x, y, w, h); mx.fill('evenodd');
    mx.strokeStyle = C.ink; mx.lineWidth = 1; mx.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.max(2, Math.round(w) - 1), Math.max(2, Math.round(h) - 1));
  }
  function miniTo(e) {
    const r = mini.getBoundingClientRect();
    const x = LEFT + (e.clientX - r.left - mox) / ms, y = TOP + (e.clientY - r.top - moy) / ms;
    vx = x - fw / sc / 2; vy = y - (fh - AX) / sc / 2; clamp(); req();
  }
  let miniDown = false;
  mini.addEventListener('pointerdown', e => { miniDown = true; mini.setPointerCapture(e.pointerId); miniTo(e); });
  mini.addEventListener('pointermove', e => { if (miniDown) miniTo(e); });
  const miniUp = () => { miniDown = false; };
  mini.addEventListener('pointerup', miniUp);
  mini.addEventListener('pointercancel', miniUp);

  // ---------- picking and the tooltip ----------
  function pick(px, py) {
    const x = vx + px / sc, y = vy + py / sc;
    let best = null, bd = P.lane * .5;
    for (const f of films) {
      if (x < f.x0 - 1 || x > f.x1 + 1) continue;
      for (const b of f.bands) { const d = Math.abs(y - f.ys[b]); if (d < bd) { bd = d; best = f; } }
    }
    if (!best) return null;
    const i = Math.max(0, Math.min(best.D.length - 1, upper(best.tc, (x - best.x0) / P.px_sec) - 1));
    return { f: best, i };
  }
  function tipHTML(f, i) {
    const s = shot(f, i);
    let h = `<b>${esc(f.t)}</b><small class="m">${esc(f.d)}, ${f.y}</small><small>Shot ${i + 1} of ${f.n}, ${dur(f.D[i] / 10)}</small>`;
    if (s.card) return h + '<small>An intertitle card</small>';
    if (s.empty === 1) return h + '<small>Nobody in the frame</small>';
    const how = s.mh ? 'measured' : f.hs === 'documented' ? 'documented' : 'assumed';
    h += `<small>${esc(E.bands[bandOf(f, s)].label)}, ${how}</small>`;
    if (s.move >= 0) h += `<small>Camera: ${esc(s.word ? E.words[s.word - 1] : LEVEL[s.move])}</small>`;
    else h += '<small class="m">Movement not logged</small>';
    return h;
  }
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.classList.add('show');
    const r = tip.getBoundingClientRect();
    let left = x + 16, top = y + 16;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tip.style.transform = 'none';
    tip.style.left = `${Math.max(8, left)}px`; tip.style.top = `${Math.max(8, top)}px`;
  }
  const hideTip = () => tip.classList.remove('show');
  function hoverAt(px, py, ev) {
    const h = pick(px, py);
    const same = h && hover && h.f === hover.f && h.i === hover.i;
    hover = h;
    cv.classList.toggle('on-row', !!h);
    if (h) showTip(tipHTML(h.f, h.i), ev.clientX, ev.clientY); else hideTip();
    if (!same) req();
  }

  // ---------- pointer, wheel and keys ----------
  const pts = new Map();
  let drag = null, pinch = null, moved = false;
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    hideTip();
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, vx, vy, touch: e.pointerType !== 'mouse' }; moved = false; }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, sc, vx, vy };
      drag = null; moved = true; hideTip();
    }
  });
  cv.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, local(e));
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const x = pinch.vx + pinch.m.x / pinch.sc, y = pinch.vy + pinch.m.y / pinch.sc;
      sc = pinch.sc * d / pinch.d; clamp();
      vx = x - m.x / sc; vy = y - m.y / sc; clamp(); req();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > 4) { moved = true; cv.classList.add('drag'); hideTip(); hover = null; }
      if (moved) { vx = drag.vx - dx / sc; if (!drag.touch) vy = drag.vy - dy / sc; clamp(); req(); }
      return;
    }
    if (e.pointerType === 'mouse') { const p = local(e); hoverAt(p.x, p.y, e); }
  });
  function endPointer(e) {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) { drag = null; cv.classList.remove('drag'); }
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  // the panel opens on the canvas's own click, so on touch the tap cannot land on the panel it just opened
  cv.addEventListener('click', e => {
    if (moved) return;
    const p = local(e), h = pick(p.x, p.y);
    if (h) { hover = h; openPanel(h.f); req(); }
  });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) { hover = null; hideTip(); cv.classList.remove('on-row'); req(); } });
  cv.addEventListener('wheel', e => {
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? fh : 1;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit * .0022));
      return;
    }
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) * .6) {
      e.preventDefault(); hideTip();
      vx += dx * unit / sc; clamp(); req();
    }
  }, { passive: false });
  cv.addEventListener('keydown', e => {
    const step = fw / sc * .12;
    const k = e.key;
    if (k === 'ArrowLeft') vx -= step; else if (k === 'ArrowRight') vx += step;
    else if (k === 'ArrowUp') vy -= step * .5; else if (k === 'ArrowDown') vy += step * .5;
    else if (k === '+' || k === '=') { zoomAt(fw / 2, (fh - AX) / 2, 1.4); e.preventDefault(); return; }
    else if (k === '-' || k === '_') { zoomAt(fw / 2, (fh - AX) / 2, 1 / 1.4); e.preventDefault(); return; }
    else if (k === '0') { sc = minS(); }
    else return;
    e.preventDefault(); clamp(); req();
  });
  document.querySelectorAll('[data-zoom]').forEach(btn => btn.addEventListener('click', () => {
    const z = btn.dataset.zoom, cxv = vx + fw / sc / 2, cyv = vy + (fh - AX) / sc / 2;
    if (z === 'in') return zoomAt(fw / 2, (fh - AX) / 2, 1.5);
    if (z === 'out') return zoomAt(fw / 2, (fh - AX) / 2, 1 / 1.5);
    sc = z === 'all' ? minS() : fitH();
    clamp(); vx = cxv - fw / sc / 2; vy = cyv - (fh - AX) / sc / 2; clamp(); req();
  }));
  find.addEventListener('change', () => {
    const f = films.find(g => g.k === find.value);
    if (!f) return;
    sc = Math.max(fitH() * .55, Math.min(2.2, fw * .8 / (f.x1 - f.x0)));
    clamp();
    vx = (f.x0 + f.x1) / 2 - fw / sc / 2; vy = f.ys[f.bands[0]] - (fh - AX) / sc / 2; clamp();
    openPanel(f); req();
    find.value = '';
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---------- one film, opened ----------
  let strip = null;
  function openPanel(f) {
    hideTip();
    current = f;
    const L = f.log || {};
    const band = E.bands[f.bands[0]].label;
    let height;
    if (f.hs === 'documented') height = `${esc(band)}. Documented: ${esc(f.hb)} (${esc(f.hc)}).`;
    else if (f.hs === 'measured') height = 'Measured shot by shot.';
    else height = `${esc(band)}. <span class="no">Assumed: no source on this director&rsquo;s camera height was found.</span>`;
    let move;
    if (f.ms === 'logged' || f.ms === 'measured') move = `${f.nM} of ${f.n} shots move. Logged by ${esc(f.mv.split(',')[0])}.`;
    else if (f.ms === 'documented') move = `None. The camera does not move in Ozu&rsquo;s films after <em>Equinox Flower</em> (1958): Bordwell, p. 14.`;
    else move = '<span class="no">Not logged. The row is drawn flat.</span>';
    let empty = f.es === 'logged' || f.es === 'measured' ? `${f.nE} of ${f.n} shots have nobody in them. Logged by ${esc(f.em.split(',')[0])}.` : '<span class="no">Not logged. The row is drawn unbroken.</span>';
    if (f.nC) empty += ` ${f.nC} intertitle cards, tagged by ${esc(f.cards.split(',')[0])}, are left blank.`;
    const notes = [];
    if (f.sw) notes.push(`Not on the original list: added because ${esc(f.why)}.`);
    for (const n of f.notes) notes.push(esc(n.charAt(0).toUpperCase() + n.slice(1)) + '.');
    panel.innerHTML = `
      <button class="e-x" aria-label="Close">&times;</button>
      <p class="e-kick">${esc(f.d)}, ${f.y}</p>
      <h2 tabindex="-1">${esc(f.t)}</h2>
      <p class="e-stats">${f.n.toLocaleString('en-US')} shots over ${Math.round(f.tc[f.n] / 60)} minutes. Average ${f.asl} seconds, median ${f.msl}, longest ${dur(f.max)}.</p>
      <div class="e-strip-wrap"><canvas class="e-strip"></canvas></div>
      <p class="e-strip-cap">The whole film, five minutes to a line. Click a shot to find it on the sheet.</p>
      <dl class="e-src">
        <dt>Shot lengths</dt><dd>Logged by <a href="https://cinemetrics.uchicago.edu/movie/${esc(L.uuid)}" target="_blank" rel="noopener">${esc(L.submitter)}</a> on Cinemetrics${L.date ? `, ${esc(L.date)}` : ''}.</dd>
        <dt>Height</dt><dd>${height}</dd>
        <dt>Movement</dt><dd>${move}</dd>
        <dt>Empty shots</dt><dd>${empty}</dd>
      </dl>
      ${notes.map(n => `<p class="e-note">${n}</p>`).join('')}`;
    panel.hidden = false;
    panel.querySelector('.e-x').addEventListener('click', closePanel);
    strip = { f, cv: panel.querySelector('.e-strip'), hi: -1 };
    bindStrip();
    drawStrip();
    panel.querySelector('h2').focus({ preventScroll: true });
    req();
  }
  function closePanel() {
    panel.hidden = true; current = null; strip = null; hideTip(); req();
    cv.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
  addEventListener('scroll', hideTip, { passive: true });
  panel.addEventListener('scroll', hideTip, { passive: true });

  const LINE = 300, LH = 20, LBL = 26;
  function stripGeom() {
    const w = strip.cv.clientWidth;
    return { w, k: (w - LBL - 2) / LINE, lines: Math.ceil(strip.f.tc[strip.f.n] / LINE) };
  }
  function drawStrip() {
    if (!strip) return;
    const { f } = strip, g = stripGeom();
    const h = g.lines * LH + 4;
    strip.cv.style.height = `${h}px`;
    strip.cv.width = Math.round(g.w * dpr); strip.cv.height = Math.round(h * dpr);
    const c = strip.cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.font = `10px ${FONT}`; c.fillStyle = C.faint; c.textBaseline = 'middle'; c.textAlign = 'right';
    for (let l = 0; l < g.lines; l++) c.fillText(String(l * 5), LBL - 7, l * LH + LH / 2 + 2);
    const cap = LH * .62, col = f.pr ? C.ink : C.trace;
    c.beginPath();
    for (let i = 0; i < f.n; i++) {
      const s = shot(f, i);
      if (s.empty === 1 || s.card === 1) continue;
      const off = (bandOf(f, s) - f.bands[0]) * -4;
      const lev = Math.max(0, s.move);
      let t0 = f.tc[i], t1 = f.tc[i + 1];
      while (t0 < t1 - 1e-6) {
        const l = Math.floor(t0 / LINE), te = Math.min(t1, (l + 1) * LINE);
        let a = LBL + (t0 - l * LINE) * g.k, b = LBL + (te - l * LINE) * g.k;
        if (te === t1) b -= Math.min(1, (b - a) * .4);
        if (b - a < .6) b = a + .6;
        const y = l * LH + LH / 2 + 2 + off;
        if (!lev) { c.moveTo(a, y); c.lineTo(b, y); }
        else {
          const t = TAN[lev], run = cap / t, len = b - a;
          if (len <= run * 1.15) { const r = len * t / 2; c.moveTo(a, y + r); c.lineTo(b, y - r); }
          else {
            const n = Math.max(2, Math.round(len / run)), step = len / n;
            c.moveTo(a, y); c.lineTo(b, y);
            for (let k = 0; k < n; k++) { const x = a + k * step + (step - run) / 2; c.moveTo(x, y + cap / 2); c.lineTo(x + run, y - cap / 2); }
          }
        }
        t0 = te;
      }
    }
    c.strokeStyle = col; c.lineWidth = 1.6; c.lineCap = 'butt'; c.stroke();
    if (strip.hi >= 0) {
      const i = strip.hi;
      let t0 = f.tc[i];
      const t1 = f.tc[i + 1];
      c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath();
      while (t0 < t1 - 1e-6) {
        const l = Math.floor(t0 / LINE), te = Math.min(t1, (l + 1) * LINE);
        const y = l * LH + LH - 1;
        c.moveTo(LBL + (t0 - l * LINE) * g.k, y); c.lineTo(Math.max(LBL + (te - l * LINE) * g.k, LBL + (t0 - l * LINE) * g.k + 2), y);
        t0 = te;
      }
      c.stroke();
    }
  }
  function stripPick(e) {
    const r = strip.cv.getBoundingClientRect(), g = stripGeom();
    const l = Math.floor((e.clientY - r.top - 2) / LH), x = e.clientX - r.left - LBL;
    if (l < 0 || l >= g.lines || x < 0) return -1;
    const t = l * LINE + x / g.k;
    if (t > strip.f.tc[strip.f.n]) return -1;
    return Math.max(0, Math.min(strip.f.n - 1, upper(strip.f.tc, t) - 1));
  }
  function bindStrip() {
    const el = strip.cv;
    const mine = () => strip && strip.cv === el;
    el.addEventListener('pointermove', e => {
      if (!mine()) return;
      const i = stripPick(e);
      if (i !== strip.hi) { strip.hi = i; drawStrip(); }
      if (i >= 0 && e.pointerType === 'mouse') showTip(tipHTML(strip.f, i), e.clientX, e.clientY); else hideTip();
    });
    el.addEventListener('pointerleave', () => { if (!mine()) return; strip.hi = -1; drawStrip(); hideTip(); });
    el.addEventListener('click', e => {
      if (!mine()) return;
      const i = stripPick(e);
      if (i < 0) return;
      const f = strip.f, x = f.x0 + (f.tc[i] + f.tc[i + 1]) / 2 * P.px_sec;
      sc = Math.max(sc, 1.6); clamp();
      vx = x - fw / sc / 2; vy = f.ys[bandOf(f, shot(f, i))] - (fh - AX) / sc / 2; clamp();
      hover = { f, i }; req();
      if (e.pointerType !== 'mouse') showTip(tipHTML(f, i), e.clientX, e.clientY);
    });
  }

  // ---------- size ----------
  let first = true;
  function resize() {
    const cxv = vx + fw / sc / 2, cyv = vy + (fh - AX) / sc / 2;
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    fw = frame.clientWidth; fh = frame.clientHeight;
    cv.width = Math.round(fw * dpr); cv.height = Math.round(fh * dpr);
    if (first) { sc = fitH(); clamp(); vx = yearX(1946.4) - 160 / sc; vy = TOP; clamp(); first = false; }
    else { clamp(); vx = cxv - fw / sc / 2; vy = cyv - (fh - AX) / sc / 2; clamp(); }
    buildMini();
    if (strip) drawStrip();
    req();
  }
  new ResizeObserver(resize).observe(frame);
  matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener?.('change', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildMini(); req(); });
})();
