/* Bluish Green: One Name.
   Type a name and see the colors people meant by it: 200 of their answers, each a dot in its own color on the same map,
   sorted into a strip, with the names people used for the same colors. Two names can be laid over each other. */
(function () {
  'use strict';
  const X = window.CO, D = X.D, FW = X.FW, FH = X.FH, KS = D.ks;
  const PAIRS = [['teal', 'turquoise'], ['maroon', 'burgundy'], ['lilac', 'lavender'], ['cyan', 'aqua'], ['mauve', 'puce'], ['salmon', 'peach'], ['chartreuse', 'lime green'], ['puke green', 'vomit green']];
  const SINGLES = ['puce', 'periwinkle', 'fuchsia', 'taupe', 'ochre', 'eggplant', 'robin\'s egg blue', 'seafoam green'];
  let el, cv, c, sc, sx, dpr = 1, VW = 0, VH = 0, SW = 0, built = false, visible = false;
  let M = null, C = null, a = null, b = null, pan = FW - FW * 50 / 360, drag = null, hot = null, spread = null;

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="nm-wrap">
        <aside class="nm-side">
          <div class="nm-search">
            <input type="text" class="nm-input" placeholder="Type a color name" aria-label="Color name" autocomplete="off" spellcheck="false">
            <ul class="nm-drop" role="listbox"></ul>
          </div>
          <div class="nm-try"><span class="lbl">Try</span>${SINGLES.filter(n => X.byName.has(n)).map(n => `<button class="chip-btn" data-n="${X.esc(n)}">${X.esc(n)}</button>`).join('')}<button class="chip-btn" data-rand>Surprise me</button></div>
          <div class="nm-try"><span class="lbl">Or compare</span>${PAIRS.filter(p => p.every(n => X.byName.has(n))).map(([p, q]) => `<button class="chip-btn" data-a="${X.esc(p)}" data-b="${X.esc(q)}">${X.esc(p)} or ${X.esc(q)}</button>`).join('')}</div>
          <div class="nm-card"></div>
        </aside>
        <div class="nm-main">
          <div class="nm-stage"><canvas class="nm-cloud" aria-label="The answers given for this name, each one a dot in its own color"></canvas></div>
          <canvas class="nm-strip" aria-label="The same answers, sorted from light to dark"></canvas>
          <p class="nm-key">Each dot is one answer, drawn in the color that person was shown and placed on the map with light at the top, dark at the bottom and hue across. Bigger dots are more colorful, and grays have no real hue, so they scatter sideways. The strip underneath sorts the same answers from light to dark.</p>
        </div>
      </div>`;
    cv = el.querySelector('.nm-cloud'); c = cv.getContext('2d');
    sc = el.querySelector('.nm-strip'); sx = sc.getContext('2d');
    const inp = el.querySelector('.nm-input'), drop = el.querySelector('.nm-drop');
    let sel = 0, list = [];
    const suggest = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { drop.innerHTML = ''; drop.classList.remove('on'); return; }
      const pre = X.NAMES.filter(o => o.name.startsWith(q)), mid = X.NAMES.filter(o => !o.name.startsWith(q) && o.name.includes(q));
      list = pre.concat(mid).slice(0, 8); sel = 0;
      drop.innerHTML = list.length ? list.map((o, i) => `<li role="option" data-i="${o.i}" aria-selected="${i === sel}"><i class="sw" style="background:${o.hex}"></i>${X.esc(o.name)}<small>${X.fmt(o.users)}</small></li>`).join('') : '<li class="none">Not among the 1,000 most used names</li>';
      drop.classList.add('on');
    };
    inp.addEventListener('input', suggest);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!list.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length; drop.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === sel))); }
      if (e.key === 'Enter' && list[sel]) { pick(list[sel].name); }
      if (e.key === 'Escape') { drop.classList.remove('on'); }
    });
    drop.addEventListener('pointerdown', e => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(X.NAMES[+li.dataset.i].name); } });
    inp.addEventListener('blur', () => setTimeout(() => drop.classList.remove('on'), 120));
    const pick = n => { inp.value = ''; drop.classList.remove('on'); set(n, null); };
    el.querySelector('.nm-side').addEventListener('click', e => {
      const bt = e.target.closest('button'); if (!bt) return;
      if (bt.dataset.n) set(bt.dataset.n, null);
      else if (bt.dataset.a) set(bt.dataset.a, bt.dataset.b);
      else if (bt.hasAttribute('data-rand')) set(X.NAMES[Math.floor(Math.random() * X.NAMES.length)].name, null);
      else if (bt.dataset.nb) set(bt.dataset.nb, null);
      else if (bt.dataset.vs) set(a.name, bt.dataset.vs);
      else if (bt.hasAttribute('data-solo')) set(a.name, null);
    });
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, pan, moved: false }; });
    cv.addEventListener('pointermove', e => {
      if (drag && (e.buttons || e.pointerType === 'touch')) { const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { drag.moved = true; cv.setPointerCapture(e.pointerId); } if (drag.moved) { pan = drag.pan + dx / (VW / FW); draw(); return; } }
      hot = nearest(e); draw();
      if (hot) X.tip(dotTip(hot), e.clientX, e.clientY); else X.tip(null);
    });
    cv.addEventListener('click', e => { if (drag && drag.moved) return; hot = nearest(e); draw(); if (hot) X.tip(dotTip(hot), e.clientX, e.clientY); });
    addEventListener('pointerup', () => setTimeout(() => { drag = null; }, 0));
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; hot = null; X.tip(null); draw(); });
    new ResizeObserver(() => { if (visible) resize(); }).observe(el.querySelector('.nm-main'));
    Promise.all([X.maps(), X.clouds()]).then(([m, cl]) => { M = m; C = cl; measureSpread(); if (!a) { const p = X.params(); set(p.get('name') && X.byName.has(p.get('name')) ? p.get('name') : 'teal', p.get('vs') && X.byName.has(p.get('vs')) ? p.get('vs') : null, true); } else { card(); draw(); } });
    built = true;
  }

  // ---------- how tightly people agree on each name ----------
  function measureSpread() {
    spread = new Float32Array(X.NAMES.length);
    for (let i = 0; i < X.NAMES.length; i++) {
      const labs = [];
      for (let k = 0; k < KS; k++) { const o = (i * KS + k) * 3; labs.push(X.rgb2lab(C[o], C[o + 1], C[o + 2])); }
      const m = [0, 1, 2].map(j => labs.reduce((s, v) => s + v[j], 0) / KS);
      spread[i] = labs.reduce((s, v) => s + Math.hypot(v[0] - m[0], v[1] - m[1], v[2] - m[2]), 0) / KS;
    }
    const sorted = Array.from(spread).sort((p, q) => p - q);
    X.NAMES.forEach((o, i) => { o.spread = spread[i]; o.tighter = 1 - sorted.indexOf(spread[i]) / (sorted.length - 1); });
  }

  // ---------- one name, or two ----------
  function set(n1, n2, fromUrl) {
    a = X.byName.get(n1) || a; b = n2 ? X.byName.get(n2) : null;
    if (b && b.i === a.i) b = null;
    if (!fromUrl || visible) X.setParams({ name: a.name, vs: b ? b.name : null });
    hot = null; card(); draw();
  }
  function pts(o) {
    const out = [];
    for (let k = 0; k < KS; k++) {
      const q = (o.i * KS + k) * 3, r = C[q], g = C[q + 1], bb = C[q + 2];
      const [h, s, l] = X.rgb2hsl(r, g, bb);
      out.push({ r, g, b: bb, h, s, l, x: X.mapX(h) * FW, y: (1 - l) * FH, hex: X.rgb2hex(r, g, bb), o });
    }
    return out;
  }
  function card() {
    const box = el.querySelector('.nm-card');
    if (!a) { box.innerHTML = ''; return; }
    const one = o => {
      const tight = o.tighter === undefined ? '' : `<p class="nm-agree"><span class="nm-meter"><i style="width:${(o.tighter * 100).toFixed(0)}%"></i></span>${o.tighter > .66 ? 'People mostly meant the same color.' : o.tighter > .33 ? 'People meant a fair range of colors.' : 'People meant very different colors by it.'} <small>Tighter than ${Math.round(o.tighter * 100)}% of the 1,000 most used names.</small></p>`;
      return `<div class="nm-one"><div class="nm-big" style="background:${o.hex}"><span style="color:${X.inkOn(o.hex)}">${o.hex}</span></div>
        <h3>${X.esc(o.name)}</h3><p class="nm-stat">Typed by ${X.fmt(o.users)} people, ${X.fmt(o.n)} times. The square is the average of their colors.</p>${tight}</div>`;
    };
    let html = one(a) + (b ? one(b) : '');
    if (!b) {
      const nb = a.nb.slice(0, 6).map(j => X.NAMES[j]);
      html += `<p class="lbl nm-h">Names for the same colors</p><div class="nm-nbs">${nb.map(o => `<button class="chip-btn" data-nb="${X.esc(o.name)}"><i class="sw" style="background:${o.hex}"></i>${X.esc(o.name)}</button>`).join('')}</div>
        <p class="lbl nm-h">Compare it with</p><div class="nm-nbs">${nb.slice(0, 3).map(o => `<button class="chip-btn" data-vs="${X.esc(o.name)}">${X.esc(a.name)} or ${X.esc(o.name)}</button>`).join('')}</div>`;
    } else {
      const s = a.nb.indexOf(b.i) >= 0 ? a.sims[a.nb.indexOf(b.i)] : null;
      html += `<p class="nm-vs">${s !== null ? `These two are among each other's closest names.` : ''} Filled dots are ${X.esc(a.name)}, rings are ${X.esc(b.name)}.</p><button class="chip-btn" data-solo>Just ${X.esc(a.name)}</button>`;
    }
    box.innerHTML = html;
  }

  // ---------- drawing ----------
  let A = [], B = [];
  function draw() {
    if (!M || !C || !VW || !a) return;
    A = pts(a); B = b ? pts(b) : [];
    const cw = VW / FW, ch = VH / FH, off = (((pan % FW) + FW) % FW) * cw;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#050506'; c.fillRect(0, 0, VW, VH);
    // the basic-word borders underneath, for bearings
    const G = X.geometry(M, 0, 'basic');
    c.save(); c.translate(off - VW, 0); c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1;
    c.beginPath();
    for (const p of G.polys) for (const poly of p.coords) for (const ring of poly) ring.forEach(([x, y], i) => i ? c.lineTo(x * cw, y * ch) : c.moveTo(x * cw, y * ch));
    c.stroke(); c.restore();
    c.font = `500 ${VW < 640 ? 10 : 12}px "Schibsted Grotesk", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.22)';
    for (const L of G.labels) { if (L.d < 3) continue; for (const dx of [-VW, 0, VW]) { const px = off + L.x * cw + dx; if (px > -60 && px < VW + 60) c.fillText(D.basic[L.k], px, L.y * ch); } }
    const place = p => { let px = ((p.x * cw + off) % VW + VW) % VW; return [px, p.y * ch]; };
    const rad = p => (VW < 640 ? 1.8 : 2.4) + p.s * (VW < 640 ? 2.2 : 3.2);
    for (const p of A) { const [px, py] = place(p); c.fillStyle = p.hex; c.beginPath(); c.arc(px, py, rad(p), 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = .8; c.stroke(); }
    for (const p of B) { const [px, py] = place(p); c.strokeStyle = p.hex; c.lineWidth = 1.6; c.beginPath(); c.arc(px, py, rad(p) + .6, 0, Math.PI * 2); c.stroke(); }
    if (hot) { const [px, py] = place(hot); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.arc(px, py, rad(hot) + 4, 0, Math.PI * 2); c.stroke(); }
    strip();
  }
  function strip() {
    const rows = b ? [A, B] : [A], rh = b ? 26 : 44, gap = 6;
    const H = rows.length * rh + (rows.length - 1) * gap;
    if (sc.height !== Math.round(H * dpr) || sc.width !== Math.round(SW * dpr)) { sc.width = Math.round(SW * dpr); sc.height = Math.round(H * dpr); sc.style.height = H + 'px'; }
    sx.setTransform(dpr, 0, 0, dpr, 0, 0); sx.clearRect(0, 0, SW, H);
    rows.forEach((P, ri) => {
      const s = P.slice().sort((p, q) => q.l - p.l || p.h - q.h), w = SW / s.length;
      s.forEach((p, k) => { sx.fillStyle = p.hex; sx.fillRect(k * w, ri * (rh + gap), Math.ceil(w) + .5, rh); });
    });
  }
  function nearest(e) {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, cw = VW / FW, ch = VH / FH, off = (((pan % FW) + FW) % FW) * cw;
    let best = null, bd = (e.pointerType === 'touch' ? 18 : 10) ** 2;
    for (const p of A.concat(B)) { const px = ((p.x * cw + off) % VW + VW) % VW, py = p.y * ch, d = (px - mx) ** 2 + (py - my) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  const dotTip = p => `<b>${X.esc(p.o.name)}</b><small>One person's ${X.esc(p.o.name)}: ${p.hex}</small>`;

  function resize() {
    const box = el.querySelector('.nm-stage').getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(box.width); if (!w) return;
    const h = Math.round(w < 640 ? w * .72 : Math.min(Math.max(320, innerHeight - 330), w * .5));
    VW = w; VH = h; SW = w; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    draw();
  }
  function show() {
    visible = true; resize();
    if (a) X.setParams({ name: a.name, vs: b ? b.name : null });
  }
  function hide() { visible = false; X.tip(null); X.setParams({ name: null, vs: null }); }
  X.views.name = { init, show, hide, set, state: () => ({ built, a: a && a.name, b: b && b.name, loaded: !!(M && C), dots: A.length + B.length }) };
})();
