/* Fifty Seasons: The Edit.
   Confessionals are the moments a castaway talks straight to camera, and fans read them for clues about who wins.
   At each merge, who had been given the most so far? And was that the eventual winner? */
(function () {
  'use strict';
  const X = window.SX, D = X.D;
  const FONT = '"Schibsted Grotesk", system-ui, sans-serif';
  const GOLD = '#ffd27a';
  const NS = D.seasons.length;
  const seasonLabel = S => S.name === String(S.n) ? `Survivor ${S.n}` : S.name;
  const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);

  // everyone still in the game at the merge, with their confessionals up to and including the merge episode
  const merges = D.seasons.map((S, si) => {
    const st = S.stages.find(s => s[2].some(l => l[1] === 'Merged' || l[1] === 'Mergatory')) || S.stages[Math.floor(S.stages.length / 2)];
    const k = Math.max(1, S.eps.findIndex(e => e.n === st[0]) + 1);
    const alive = st[2].flatMap(l => l[2]);
    if (!alive.includes(S.winner)) alive.push(S.winner);
    const upto = alive.map(ci => ({ ci, n: S.cast[ci].c.slice(0, k).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.n - a.n || (a.ci === S.winner ? -1 : b.ci === S.winner ? 1 : 0));
    const wn = upto.find(u => u.ci === S.winner).n;
    return { si, k, ep: st[0], alive: upto, rank: 1 + upto.filter(u => u.n > wn).length, top: upto[0] };
  });
  const top1 = merges.filter(m => m.rank === 1).length, top3 = merges.filter(m => m.rank <= 3).length;
  const quiet = merges.slice().sort((a, b) => (b.rank / b.alive.length) - (a.rank / a.alive.length))[0];
  const MAXA = Math.max(...merges.map(m => m.alive.length));

  const heat = d3.scaleSqrt().domain([0, 1, 4, 9, 16]).range(['#101218', '#3b1d10', '#9a3b14', '#f0822a', '#fff1c9']).clamp(true);

  let el, lad, lc, ldpr = 1, LW = 0, LH = 0, lg = null, lhover = null, sel = null, hm, hc, HW = 0, HH = 0, hg = null, hhover = null, shown = false;
  let game = null, played = [], score = { found: 0, edit: 0, rounds: 0 }, born = 0, iraf = 0;

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="d-top">
        <div class="s-kick">Who the show lets talk</div>
        <h2 class="d-head">At the merge, the eventual winner had more confessionals than anyone else left in the game in ${word(top1)} of fifty seasons.</h2>
        <p class="s-line">They were among the three most heard in ${top3}. Confessionals are the moments a castaway talks straight to the camera, counted here up to and including the merge episode. Each column below is one merge, with the most heard player at the top. The gold ring is who went on to win.</p>
      </div>
      <div class="d-ladder"><canvas aria-label="The players left at each merge, ranked by confessionals"></canvas></div>
      <div class="d-cols">
        <div class="d-season">
          <div class="d-season-h" aria-live="polite"></div>
          <div class="d-heat"><canvas aria-label="Confessionals by episode for one season"></canvas></div>
        </div>
        <div class="d-game">
          <div class="s-kick">A game</div>
          <h3 class="d-game-h">Spot the winner</h3>
          <p class="d-game-p">Here is a real season at the merge, with each player's confessionals so far. The names are hidden. Who wins?</p>
          <div class="d-bars"></div>
          <div class="d-game-foot"><p class="d-verdict" aria-live="polite"></p><button class="ctl d-next">Another season</button></div>
          <p class="d-score"></p>
        </div>
      </div>`;
    lad = el.querySelector('.d-ladder canvas'); lc = lad.getContext('2d');
    hm = el.querySelector('.d-heat canvas'); hc = hm.getContext('2d');
    lad.addEventListener('pointermove', onLadder);
    lad.addEventListener('pointerleave', () => { lhover = null; X.tip(null); drawLadder(); });
    lad.addEventListener('click', () => { if (lhover) { sel = lhover.m.si; seasonHead(); layoutHeat(); drawLadder(); } });
    hm.addEventListener('pointermove', onHeat);
    hm.addEventListener('pointerleave', () => { hhover = null; X.tip(null); drawHeat(); });
    el.querySelector('.d-bars').addEventListener('click', e => { const b = e.target.closest('[data-ci]'); if (b && game && !game.done) guess(+b.dataset.ci); });
    el.querySelector('.d-next').addEventListener('click', newRound);
    el.querySelector('.d-season-h').addEventListener('click', e => { const a = e.target.closest('[data-open]'); if (a) { e.preventDefault(); X.go('season', { season: D.seasons[sel].n }); } });
    new ResizeObserver(() => { if (shown) { layoutLadder(); layoutHeat(); } }).observe(el);
    sel = quiet.si;
    newRound();
  }

  // ---------- the ladder: fifty merges ----------
  function layoutLadder() {
    const box = el.querySelector('.d-ladder');
    LW = box.clientWidth; LH = box.clientHeight; if (!LW || !LH) return;
    ldpr = Math.min(devicePixelRatio || 1, 2);
    lad.width = Math.round(LW * ldpr); lad.height = Math.round(LH * ldpr); lad.style.width = LW + 'px'; lad.style.height = LH + 'px';
    const gut = parseFloat(getComputedStyle(el.querySelector('.d-top')).paddingLeft) || 24;
    const left = gut + 34, right = gut, top = 26, bottom = 30;
    lg = { left, right, top, bottom, colW: (LW - left - right) / NS, rowH: (LH - top - bottom) / MAXA };
    lg.x = si => left + (si + .5) * lg.colW; lg.y = r => top + (r + .5) * lg.rowH;
    drawLadder();
  }
  function drawLadder() {
    if (!lg) return;
    const c = lc; c.setTransform(ldpr, 0, 0, ldpr, 0, 0); c.clearRect(0, 0, LW, LH);
    // the top three
    c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(lg.left - 6, lg.top, LW - lg.left - lg.right + 12, lg.rowH * 3);
    c.font = `500 10.5px ${FONT}`; c.fillStyle = 'rgba(107,114,130,.95)'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('1st', lg.left - 12, lg.y(0)); c.fillText('3rd', lg.left - 12, lg.y(2)); c.fillText('10th', lg.left - 12, lg.y(9));
    const r = Math.max(2.4, Math.min(lg.colW * .2, lg.rowH * .32));
    const e = X.reduced ? 1 : Math.min(1, (performance.now() - born) / 1400);
    merges.forEach((m, si) => {
      const S = D.seasons[si], x = lg.x(si), on = !lhover || lhover.m === m, picked = sel === si;
      const grow = Math.min(1, Math.max(0, e * (NS + 10) - si) / 10);
      if (!grow) return;
      if (picked) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x - lg.colW / 2 + 1, lg.top - 4, lg.colW - 2, lg.rowH * m.alive.length + 8); }
      m.alive.forEach((u, k) => {
        if (k > grow * m.alive.length) return;
        const y = lg.y(k), w = u.ci === S.winner;
        c.globalAlpha = (on ? 1 : .35) * grow;
        c.fillStyle = X.castColour(S, u.ci); c.beginPath(); c.arc(x, y, w ? r * .95 : r * .78, 0, Math.PI * 2); c.fill();
        if (w) { c.strokeStyle = GOLD; c.lineWidth = 1.8; c.beginPath(); c.arc(x, y, r + 2.6, 0, Math.PI * 2); c.stroke(); }
      });
      c.globalAlpha = 1;
      c.font = `600 10.5px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = picked || (lhover && lhover.m === m) ? '#fff' : 'rgba(107,114,130,.95)';
      if (lg.colW > 17 ? true : lg.colW > 9 ? si % 2 === 0 || si === NS - 1 : S.n === 1 || S.n % 10 === 0 || picked) c.fillText(String(S.n), x, lg.top - 10);
    });
    c.textBaseline = 'alphabetic';
  }
  function onLadder(ev) {
    if (!lg) return;
    const b = lad.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top;
    const si = Math.floor((mx - lg.left) / lg.colW), m = merges[si];
    let nh = null;
    if (m) { const k = Math.floor((my - lg.top) / lg.rowH); nh = { m, k: k >= 0 && k < m.alive.length ? k : null }; }
    if (!nh || !lhover || nh.m !== lhover.m || nh.k !== lhover.k) { lhover = nh; drawLadder(); }
    if (nh) {
      const S = D.seasons[m.si], w = S.cast[S.winner];
      const u = nh.k != null ? m.alive[nh.k] : null;
      X.tip(`<b>${X.esc(seasonLabel(S))}</b><small>${u ? `${X.esc(S.cast[u.ci].full)}: ${u.n} confessionals by the merge${u.ci === S.winner ? ', and won' : ''}.` : `${m.alive.length} players at the merge.`}</small><em>${X.esc(w.name)} ${m.rank === 1 ? 'led the edit' : `was ${X.ord(m.rank)} in the edit`} and won. Click to see every episode.</em>`, ev.clientX, ev.clientY);
      lad.style.cursor = 'pointer';
    } else { X.tip(null); lad.style.cursor = 'default'; }
  }

  // ---------- one season, every episode ----------
  function seasonHead() {
    const S = D.seasons[sel], m = merges[sel], w = S.cast[S.winner];
    el.querySelector('.d-season-h').innerHTML = `<div class="s-kick">Season ${S.n}, ${X.year(S)}</div><h3 class="d-season-name">${X.esc(seasonLabel(S))}</h3><p class="s-line">${X.esc(w.full)} ${m.rank === 1 ? 'had the most confessionals of anyone left at the merge' : `was ${X.ord(m.rank)} of ${m.alive.length} in confessionals at the merge`}, and won. The most heard was ${X.esc(S.cast[m.top.ci].full)}, with ${m.top.n}. <a href="#" data-open>Open the season</a></p>`;
  }
  function layoutHeat() {
    const box = el.querySelector('.d-heat'), S = D.seasons[sel];
    HW = box.clientWidth; if (!HW || !S) return;
    const rowH = 17, top = 40, bottom = 8, n = S.cast.length;
    HH = top + bottom + n * rowH;
    box.style.height = HH + 'px';
    const dpr = Math.min(devicePixelRatio || 1, 2);
    hm.width = Math.round(HW * dpr); hm.height = Math.round(HH * dpr); hm.style.width = HW + 'px'; hm.style.height = HH + 'px';
    const left = 128, right = 44, E = S.eps.length;
    hg = { dpr, left, right, top, rowH, E, cw: (HW - left - right) / E };
    drawHeat();
  }
  function drawHeat() {
    if (!hg) return;
    const S = D.seasons[sel], m = merges[sel], c = hc;
    c.setTransform(hg.dpr, 0, 0, hg.dpr, 0, 0); c.clearRect(0, 0, HW, HH);
    const rows = S.cast.map((q, i) => i).sort((a, b) => S.cast[a].place - S.cast[b].place);
    c.font = `500 10.5px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = 'rgba(107,114,130,.95)';
    c.fillText('Episode', hg.left - 34, hg.top - 8);
    for (let e = 0; e < hg.E; e++) if (hg.cw > 16 || e % 2 === 0) c.fillText(String(S.eps[e].n), hg.left + (e + .5) * hg.cw, hg.top - 8);
    rows.forEach((i, r) => {
      const q = S.cast[i], y = hg.top + r * hg.rowH, lastEp = q.ep ? S.eps.findIndex(e => e.n === q.ep) : hg.E - 1;
      c.font = `${q.win ? 700 : 500} 11px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillStyle = q.win ? GOLD : X.rgba(X.castColour(S, i), .95); c.fillText(q.name, hg.left - 10, y + hg.rowH / 2);
      for (let e = 0; e < hg.E; e++) {
        if (e > (lastEp < 0 ? hg.E - 1 : lastEp) && !q.fin) continue;
        const v = q.c[e] || 0;
        c.fillStyle = heat(v); c.fillRect(hg.left + e * hg.cw + 1, y + 1, hg.cw - 2, hg.rowH - 2);
        if (hhover && hhover.i === i && hhover.e === e) { c.strokeStyle = '#fff'; c.lineWidth = 1.4; c.strokeRect(hg.left + e * hg.cw + .5, y + .5, hg.cw - 1, hg.rowH - 1); }
      }
      const tot = q.c.reduce((a, b) => a + b, 0);
      c.textAlign = 'left'; c.font = `500 10.5px ${FONT}`; c.fillStyle = q.win ? GOLD : 'rgba(169,176,192,.9)'; c.fillText(String(tot), HW - hg.right + 8, y + hg.rowH / 2);
      if (q.win) { c.strokeStyle = GOLD; c.lineWidth = 1.4; c.strokeRect(hg.left - .5, y + .5, hg.E * hg.cw + 1, hg.rowH - 1); }
    });
    // the merge
    const xm = hg.left + m.k * hg.cw;
    c.strokeStyle = 'rgba(255,241,201,.7)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(xm, hg.top - 22); c.lineTo(xm, HH - 4); c.stroke(); c.setLineDash([]);
    c.font = `650 10.5px ${FONT}`; c.fillStyle = '#fff1c9'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText('Merge', xm + 5, hg.top - 26);
  }
  function onHeat(ev) {
    if (!hg) return;
    const S = D.seasons[sel], b = hm.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top;
    const rows = S.cast.map((q, i) => i).sort((a, b2) => S.cast[a].place - S.cast[b2].place);
    const r = Math.floor((my - hg.top) / hg.rowH), e = Math.floor((mx - hg.left) / hg.cw);
    const nh = r >= 0 && r < rows.length && e >= 0 && e < hg.E ? { i: rows[r], e } : null;
    if (!nh || !hhover || nh.i !== hhover.i || nh.e !== hhover.e) { hhover = nh; drawHeat(); }
    if (nh) {
      const q = S.cast[nh.i], ep = S.eps[nh.e], v = q.c[nh.e] || 0;
      X.tip(`<b>${X.esc(q.full)}</b><small>Episode ${ep.n}${ep.t ? `, ${X.esc(ep.t)}` : ''}: ${v} ${v === 1 ? 'confessional' : 'confessionals'}</small>`, ev.clientX, ev.clientY);
    } else X.tip(null);
  }

  // ---------- spot the winner ----------
  function newRound() {
    const pool = merges.filter(m => !played.includes(m.si) && m.alive.length >= 5);
    const m = (pool.length ? pool : merges)[Math.floor(Math.random() * (pool.length || merges.length))];
    played.push(m.si);
    const S = D.seasons[m.si], order = m.alive.slice();
    game = { m, S, done: false };
    const max = Math.max(...order.map(u => u.n), 1);
    el.querySelector('.d-bars').innerHTML = order.map((u, k) => `<button class="d-bar" data-ci="${u.ci}" style="--w:${(u.n / max * 100).toFixed(1)}%;--c:${X.castColour(S, u.ci)}"><span class="d-bar-n">${String.fromCharCode(65 + k)}</span><span class="d-bar-track"><i></i></span><span class="d-bar-v">${u.n}</span></button>`).join('');
    el.querySelector('.d-verdict').textContent = `${order.length} players, ${S.eps[m.k - 1] ? `${m.k} episodes in` : ''}. The colors show their starting tribes.`;
    el.querySelector('.d-next').hidden = true;
    el.querySelector('.d-game-p').innerHTML = `Here is a real season at the merge, with each player's confessionals so far. The names are hidden. Who wins?`;
    scoreLine();
  }
  function guess(ci) {
    const { m, S } = game; game.done = true;
    const right = ci === S.winner;
    score.rounds++; if (right) score.found++; if (m.top.ci === S.winner) score.edit++;
    el.querySelectorAll('.d-bar').forEach(b => {
      const i = +b.dataset.ci;
      b.classList.toggle('win', i === S.winner); b.classList.toggle('picked', i === ci); b.disabled = true;
      b.querySelector('.d-bar-n').textContent = S.cast[i].name;
    });
    el.querySelector('.d-game-p').innerHTML = `This was <b>${X.esc(seasonLabel(S))}</b>, season ${S.n}.`;
    el.querySelector('.d-verdict').innerHTML = right ? `Yes. ${X.esc(S.cast[S.winner].full)} won${m.rank === 1 ? ', and the edit said so too.' : `, from ${X.ord(m.rank)} place in the edit.`}` : `No. It was ${X.esc(S.cast[S.winner].full)}, ${m.rank === 1 ? 'the most heard player.' : `${X.ord(m.rank)} in the edit at the merge.`}`;
    el.querySelector('.d-next').hidden = false;
    scoreLine();
  }
  function scoreLine() {
    el.querySelector('.d-score').textContent = score.rounds ? `You have found ${score.found} ${score.found === 1 ? 'winner' : 'winners'} in ${score.rounds} ${score.rounds === 1 ? 'season' : 'seasons'}. Always picking the most heard player would have found ${score.edit}.` : '';
  }

  function show() {
    shown = true; layoutLadder(); seasonHead(); layoutHeat();
    born = performance.now(); cancelAnimationFrame(iraf);
    const step = () => { drawLadder(); if (performance.now() - born < 1500 && shown) iraf = requestAnimationFrame(step); };
    iraf = requestAnimationFrame(step);
  }
  function hide() { shown = false; cancelAnimationFrame(iraf); X.tip(null); }
  X.views.edit = { init, show, hide };
})();
