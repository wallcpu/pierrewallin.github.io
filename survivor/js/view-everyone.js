/* Fifty Seasons: Everyone.
   Every castaway who ever played, as a torch: one column per season, one row per finishing place, the winner at the top.
   Only the winners' torches are still lit. A line connects each appearance of the 121 people who came back. */
(function () {
  'use strict';
  const X = window.SX, D = X.D;
  const FONT = '"Schibsted Grotesk", system-ui, sans-serif';
  const GOLD = '#ffd27a';
  const NS = D.seasons.length, MAXP = Math.max(...D.seasons.map(s => s.nCast));
  const FILTERS = [
    ['Everyone', () => true],
    ['Winners', (S, c) => c.win],
    ['Came back', (S, c) => D.people[c.p].apps.length > 1],
    ['The jury', (S, c) => c.jury],
    ['Left early', (S, c) => /medically|quit|withdrew|ejected/i.test(c.result || '') && !/voted out/i.test(c.result || '')],
    ['First out', (S, c) => c.order === 1 && !c.fin],
  ];
  const seasonLabel = S => S.name === String(S.n) ? `Survivor ${S.n}` : S.name;

  let el, cv, c, dpr = 1, W = 0, H = 0, geo = null, filter = 0, hover = null, raf = 0, born = 0, shown = false;
  const arcs = [];
  D.people.forEach((p, pi) => { for (let k = 1; k < p.apps.length; k++) arcs.push({ pi, a: p.apps[k - 1], b: p.apps[k] }); });
  const returnees = D.people.filter(p => p.apps.length > 1).length;
  const most = Math.max(...D.people.map(p => p.apps.length)), mostPeople = D.people.filter(p => p.apps.length === most).map(p => p.name);

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="e-top">
        <div class="e-read" aria-live="polite"></div>
        <div class="e-filters" role="group" aria-label="Show">${FILTERS.map((f, i) => `<button class="chip-btn" data-f="${i}" aria-pressed="${i === 0}">${f[0]}</button>`).join('')}</div>
      </div>
      <div class="e-chart"><canvas class="e-canvas" aria-label="Every castaway by season and finishing place"></canvas></div>`;
    cv = el.querySelector('.e-canvas'); c = cv.getContext('2d');
    el.querySelector('.e-filters').addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      filter = +b.dataset.f; el.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.f === filter)));
      draw(performance.now());
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { hover = null; X.tip(null); readout(); });
    cv.addEventListener('click', () => { if (hover && hover.type === 'cast') { X.tip(null); X.go('season', { season: D.seasons[hover.si].n, who: D.seasons[hover.si].cast[hover.ci].p }); } });
    new ResizeObserver(() => { if (shown) layout(); }).observe(el.querySelector('.e-chart'));
    readout();
  }

  function layout() {
    const box = el.querySelector('.e-chart');
    W = box.clientWidth; H = box.clientHeight; if (!W || !H) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const gut = parseFloat(getComputedStyle(el.querySelector('.e-top')).paddingLeft) || 24;
    const left = gut + 30, right = gut, arcRoom = Math.min(170, H * .22), top = arcRoom + 34, viewH = Math.min(96, H * .13), bottom = viewH + 44;
    const colW = (W - left - right) / NS, rowH = (H - top - bottom) / MAXP;
    geo = { left, right, top, bottom, colW, rowH, viewH, arcRoom, x: si => left + (si + .5) * colW, y: place => top + (place - .5) * rowH };
  }

  // a torch: a pole in the tribe's colour with a cup on top; lit for the winner, snuffed for everyone else
  function torch(x, y, col, lit, a, now, h) {
    const top = y - h * .3, bot = y + h * .44, pw = Math.max(1.5, geo.colW * .075);
    c.globalAlpha = a; c.fillStyle = col;
    c.fillRect(x - pw / 2, top, pw, bot - top);
    const cw = pw * 2.6, ch = Math.max(3, h * .17);
    c.beginPath(); c.moveTo(x - cw / 2, top - ch); c.lineTo(x + cw / 2, top - ch); c.lineTo(x + cw * .3, top + .5); c.lineTo(x - cw * .3, top + .5); c.closePath(); c.fill();
    if (lit) {
      const f = 1 + .08 * Math.sin(now * 9 + x) + .05 * Math.sin(now * 13.7 + x * 2), fh = h * .52 * f, fw = Math.max(3.4, geo.colW * .2);
      const gy = top - ch;
      const gr = c.createRadialGradient(x, gy - fh * .35, 0, x, gy - fh * .35, fh * 1.4);
      gr.addColorStop(0, 'rgba(255,210,122,.5)'); gr.addColorStop(1, 'rgba(255,210,122,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, gy - fh * .35, fh * 1.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffb347';
      c.beginPath(); c.moveTo(x, gy - fh); c.bezierCurveTo(x + fw, gy - fh * .45, x + fw * .8, gy, x, gy); c.bezierCurveTo(x - fw * .8, gy, x - fw, gy - fh * .45, x, gy - fh); c.fill();
      c.fillStyle = '#fff1c9';
      c.beginPath(); c.moveTo(x, gy - fh * .62); c.bezierCurveTo(x + fw * .45, gy - fh * .3, x + fw * .35, gy, x, gy); c.bezierCurveTo(x - fw * .35, gy, x - fw * .45, gy - fh * .3, x, gy - fh * .62); c.fill();
    }
    c.globalAlpha = 1;
  }

  function arcPath(A) {
    const S0 = D.seasons[A.a[0]], S1 = D.seasons[A.b[0]];
    const x0 = geo.x(A.a[0]), y0 = geo.y(S0.cast[A.a[1]].place) - geo.rowH * .3, x1 = geo.x(A.b[0]), y1 = geo.y(S1.cast[A.b[1]].place) - geo.rowH * .3;
    const lift = Math.min(geo.arcRoom + Math.min(y0, y1) - geo.top + 10, 18 + (x1 - x0) * .32);
    const top = Math.min(y0, y1) - lift;
    c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + (x1 - x0) * .12, top, x1 - (x1 - x0) * .12, top, x1, y1);
  }

  function draw(now) {
    if (!geo) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const t = Math.min(1, (now - born) / 1600), e = X.reduced ? 1 : 1 - Math.pow(1 - t, 3);
    const pass = FILTERS[filter][1], hp = hover && hover.type === 'cast' ? D.seasons[hover.si].cast[hover.ci].p : null;
    // columns: season numbers, and a rule over the 26-day seasons
    c.font = `600 10.5px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const every = geo.colW > 17 ? 1 : geo.colW > 9 ? 2 : 0;
    D.seasons.forEach((S, si) => {
      const x = geo.x(si), on = hover && hover.si === si;
      c.fillStyle = on ? '#fff' : 'rgba(107,114,130,.95)';
      if (every ? si % every === 0 || si === NS - 1 : S.n === 1 || S.n % 10 === 0 || on) c.fillText(String(S.n), x, geo.top - 14);
    });
    // returnees
    c.lineWidth = 1;
    const arcsOn = filter === 0 || filter === 2, k = Math.min(1, Math.max(0, e * 1.6 - .6));
    if (arcsOn && k) {
      c.strokeStyle = `rgba(255,236,205,${.2 * k})`;
      for (const A of arcs) { arcPath(A); c.stroke(); }
    }
    // torches
    const h = Math.min(geo.rowH * .95, 22);
    D.seasons.forEach((S, si) => {
      const show = Math.min(1, Math.max(0, e * (NS + 8) - si) / 8);
      if (!show) return;
      const x = geo.x(si);
      S.cast.forEach((cc, ci) => {
        const y = geo.y(cc.place), on = pass(S, cc), isP = hp != null && cc.p === hp;
        const a = show * (hp != null ? (isP ? 1 : .22) : on ? 1 : .13);
        torch(x, y + (1 - show) * 10, X.castColour(S, ci), cc.win, a, now / 1000, h);
      });
    });
    // one person's whole career
    if (hp != null) {
      c.strokeStyle = GOLD; c.lineWidth = 1.8; c.shadowColor = 'rgba(255,210,122,.6)'; c.shadowBlur = 8;
      for (const A of arcs) if (A.pi === hp) { arcPath(A); c.stroke(); }
      c.shadowBlur = 0;
      for (const [si, ci] of D.people[hp].apps) {
        const S = D.seasons[si], x = geo.x(si), y = geo.y(S.cast[ci].place);
        c.strokeStyle = '#fff'; c.lineWidth = 1.3; c.beginPath(); c.arc(x, y - h * .1, Math.max(7, geo.colW * .36), 0, Math.PI * 2); c.stroke();
      }
    }
    // places down the side
    c.font = `500 10.5px ${FONT}`; c.fillStyle = 'rgba(107,114,130,.95)'; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const p of [1, 2, 3, 5, 10, 15, 20, 24]) if (p <= MAXP) c.fillText(p === 1 ? 'Won' : X.ord(p), geo.left - 10, geo.y(p));
    viewers();
  }

  function viewers() {
    const y0 = H - geo.bottom + 34, y1 = H - 20, vmax = Math.max(...D.seasons.map(s => s.viewers || 0));
    const pts = D.seasons.map((S, si) => [geo.x(si), y1 - (S.viewers || 0) / vmax * (y1 - y0)]);
    c.fillStyle = 'rgba(214,220,232,.08)';
    c.beginPath(); c.moveTo(pts[0][0], y1); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(pts[pts.length - 1][0], y1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(214,220,232,.5)'; c.lineWidth = 1.2; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    c.font = `600 11px ${FONT}`; c.fillStyle = 'rgba(169,176,192,.95)'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('Viewers an episode', geo.left, y0 - 12);
    const top = D.seasons.reduce((b, S, si) => (S.viewers || 0) > (D.seasons[b].viewers || 0) ? si : b, 0), lastI = NS - 1;
    c.font = `500 11px ${FONT}`; c.fillStyle = 'rgba(214,220,232,.9)';
    c.textAlign = 'left'; c.fillText(`${D.seasons[top].viewers.toFixed(1)} million`, pts[top][0] + 8, pts[top][1] + 14);
    c.textAlign = 'right'; c.fillText(`${D.seasons[lastI].viewers.toFixed(1)} million`, pts[lastI][0], pts[lastI][1] - 8);
    if (hover) {
      const si = hover.si, S = D.seasons[si];
      if (S.viewers) { c.fillStyle = '#fff'; c.beginPath(); c.arc(pts[si][0], pts[si][1], 3, 0, Math.PI * 2); c.fill(); }
    }
  }

  function onMove(ev) {
    if (!geo) return;
    const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const si = Math.floor((mx - geo.left) / geo.colW);
    let nh = null;
    if (si >= 0 && si < NS) {
      const S = D.seasons[si], place = Math.round((my - geo.top) / geo.rowH + .5);
      if (my < geo.top - 2 && my > geo.top - 30) nh = { type: 'col', si };
      else if (place >= 1 && place <= S.nCast && my >= geo.top - geo.rowH * .5) { const ci = S.cast.findIndex(q => q.place === place); if (ci >= 0) nh = { type: 'cast', si, ci }; }
      else if (my > H - geo.bottom) nh = { type: 'col', si };
    }
    const same = (a, b) => (!a && !b) || (a && b && a.type === b.type && a.si === b.si && a.ci === b.ci);
    if (!same(nh, hover)) { hover = nh; readout(); if (!raf) draw(performance.now()); }
    if (hover && hover.type === 'cast') {
      const S = D.seasons[hover.si], cc = S.cast[hover.ci];
      X.tip(`<b>${X.esc(cc.full)}</b><small>${X.esc(seasonLabel(S))}. ${X.esc(X.exitText(S, hover.ci))}</small><em>Click to open the season</em>`, ev.clientX, ev.clientY);
      cv.style.cursor = 'pointer';
    } else { X.tip(null); cv.style.cursor = 'crosshair'; }
  }

  function readout() {
    const box = el.querySelector('.e-read');
    if (hover && hover.type === 'cast') {
      const S = D.seasons[hover.si], cc = S.cast[hover.ci], p = D.people[cc.p];
      const career = p.apps.map(([si, ci]) => { const T = D.seasons[si], q = T.cast[ci]; return `<span${si === hover.si ? ' class="on"' : ''}>${X.esc(seasonLabel(T))}, ${q.win ? '<b>won</b>' : X.ord(q.place)}</span>`; }).join('');
      box.innerHTML = `<div class="s-kick">${p.apps.length > 1 ? `Played ${p.apps.length} times` : `Season ${S.n}, ${X.year(S)}`}</div><h2 class="s-name" style="color:${cc.win ? GOLD : '#fff'}">${X.esc(p.name)}</h2><div class="e-career">${career}</div>`;
      return;
    }
    if (hover && hover.type === 'col') {
      const S = D.seasons[hover.si], back = S.cast.filter(q => D.people[q.p].apps[0][0] !== hover.si).length;
      box.innerHTML = `<div class="s-kick">Season ${S.n}, ${X.year(S)}</div><h2 class="s-name">${X.esc(seasonLabel(S))}</h2><p class="s-line">${S.nCast} castaways${back ? `, ${back === S.nCast ? 'all' : back} of them back from earlier seasons` : ''}. ${X.esc(S.cast[S.winner].full)} won. ${S.viewers ? `${S.viewers.toFixed(1)} million viewers an episode.` : ''}</p>`;
      return;
    }
    const names = mostPeople.map(X.esc), list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
    const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] || String(n);
    box.innerHTML = `<div class="s-kick">Everyone who ever played</div><h2 class="s-name">${X.fmt(D.people.length)} people, ${X.fmt(D.seasons.reduce((s, S) => s + S.cast.length, 0))} times</h2><p class="s-line">${returnees} of them came back at least once, and ${list} each played ${word(most)} times. Only the fifty winners' torches are still lit.</p>`;
  }

  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
  function show() { shown = true; layout(); born = performance.now(); cancelAnimationFrame(raf); if (X.reduced) { raf = 0; draw(performance.now()); } else raf = requestAnimationFrame(loop); }
  function hide() { shown = false; cancelAnimationFrame(raf); raf = 0; X.tip(null); }
  X.views.everyone = { init, show, hide };
})();
