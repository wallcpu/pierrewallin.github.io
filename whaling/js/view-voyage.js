/* The Whale Road: One Voyage.
   One logbook at a time: the track on the map, the ship's latitude day by day, what she sighted and struck,
   where she called, who sailed, what she brought home and how the ship ended. Below, every logbook as a tile. */
(function () {
  'use strict';
  const X = window.WX, W = X.W;
  const rad = Math.PI / 180;
  let el, ui = {}, built = false, visible = false, land = null, grat = null;
  let li = -1, vi = -1, s = 0, n = 0, proj = null, pts = null, dpr = 1;
  let mapW = 0, mapH = 0, latW = 0, latH = 0, latX = null, latY = null;
  let playing = false, prog = 1, raf = 0, last = 0, hoverJ = -1, pinJ = -1, sound = false, lastStruck = -1;
  let wallOrder = [], wallSort = 'year', wallGeo = null, wallHover = -1, byYear = null;
  const PLAY_S = 26;

  // ---------- picks the data supports ----------
  function picks() {
    const LG = X.LOGS, out = [];
    const logOf = id => { const i = X.byId.get(id); return i === undefined ? -1 : X.logOfVoyage(i); };
    const lastVoyage = i => { const e = X.vesselEnd.get(W.v[i][1]); return e && e.voyage === i ? e : null; };
    const best = (f, key) => { let b = -1, bv = -Infinity; for (let k = 0; k < LG.length; k++) { if (!f(k)) continue; const v = key(k); if (v > bv) { bv = v; b = k; } } return b; };
    const mel = logOf('AV00209'); if (mel >= 0) out.push(['Melville\u2019s ship', mel]);
    const lastBy = cls => best(k => { const e = lastVoyage(LG[k][0]); return e && e.cls === cls; }, k => LG[k][2]);
    const ala = best(k => { const e = lastVoyage(LG[k][0]); return e && e.cls === 'raider' && /Alabama/.test(W.vessels[W.v[LG[k][0]][1]][5]); }, k => LG[k][2]);
    if (ala >= 0) out.push(['Burned by the Alabama', ala]);
    const shen = lastBy('shen'); if (shen >= 0) out.push(['Burned by the Shenandoah', shen]);
    const ice = best(k => { const e = lastVoyage(LG[k][0]); return e && e.cls === 'ice' && e.year === 1871; }, k => LG[k][2]); if (ice >= 0) out.push(['Lost in the ice, 1871', ice]);
    const stone = lastBy('stone'); if (stone >= 0) out.push(['Before the Stone Fleet', stone]);
    const most = best(() => true, k => LG[k][7]); if (most >= 0) out.push(['Most whales struck', most]);
    const north = best(() => true, k => LG[k][8]); if (north >= 0) out.push(['Farthest north', north]);
    const lastLog = logOf('AV02736'); if (lastLog >= 0) out.push(['The last log', lastLog]);
    return out;
  }

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="v-top">
        <div class="v-read">
          <div class="v-kick"></div>
          <h2 class="v-name"></h2>
          <div class="v-sub"></div>
          <div class="v-story"></div>
        </div>
        <div class="v-ctl">
          <div class="v-search">
            <input type="search" placeholder="Find a ship or a captain" aria-label="Find a ship or a captain" autocomplete="off" spellcheck="false">
            <div class="v-sugg" role="listbox"></div>
          </div>
          <div class="v-picks"></div>
          <div class="v-ctl-row">
            <button class="ctl v-playbtn" data-c="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Sail it</span></button>
            <button class="ctl" data-c="sound" aria-pressed="false">Sound off</button>
            <button class="ctl" data-c="random">Any logbook</button>
          </div>
        </div>
      </div>
      <div class="v-map"><canvas aria-label="Map of the voyage"></canvas><div class="v-day" aria-live="off"></div></div>
      <div class="v-lat"><canvas aria-label="The ship's latitude, day by day"></canvas></div>
      <div class="v-key">
        <span><i class="k-track"></i>The ship at noon</span>
        <span><i class="k-ring"></i>Whales sighted</span>
        <span><i class="k-dot"></i>Whales struck</span>
        ${[1, 2, 3, 4, 5].map(k => `<span><i class="k-sw" style="background:${X.SP_HEX[k]}"></i>${X.SP_SHORT[k]}</span>`).join('')}
        <span><i class="k-gap"></i>Log silent more than ten days</span>
      </div>
      <div class="v-wall-top">
        <h3 class="v-wall-h">Every logbook</h3>
        <div class="v-wall-sort">
          <span class="lbl">Order by</span>
          <button class="chip-btn" data-s="year" aria-pressed="true">Year</button>
          <button class="chip-btn" data-s="days" aria-pressed="false">Longest</button>
          <button class="chip-btn" data-s="whales" aria-pressed="false">Most whales</button>
          <button class="chip-btn" data-s="north" aria-pressed="false">Farthest north</button>
          <button class="chip-btn" data-s="wife" aria-pressed="false">Wife aboard first</button>
        </div>
      </div>
      <div class="v-wall"><canvas aria-label="Every logbook as a small map"></canvas></div>`;
    ui = {
      kick: el.querySelector('.v-kick'), name: el.querySelector('.v-name'), sub: el.querySelector('.v-sub'), story: el.querySelector('.v-story'),
      input: el.querySelector('.v-search input'), sugg: el.querySelector('.v-sugg'), picks: el.querySelector('.v-picks'),
      play: el.querySelector('[data-c=play]'), sound: el.querySelector('[data-c=sound]'),
      map: el.querySelector('.v-map canvas'), day: el.querySelector('.v-day'), lat: el.querySelector('.v-lat canvas'), wall: el.querySelector('.v-wall canvas'),
    };
    el.querySelector('.v-ctl-row').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !built) return;
      const a = b.dataset.c;
      if (a === 'play') { if (playing) stop(); else sail(); }
      if (a === 'sound') { sound = !sound; b.setAttribute('aria-pressed', String(sound)); b.textContent = sound ? 'Sound on' : 'Sound off'; if (sound) X.audio(); }
      if (a === 'random') load(Math.floor(Math.random() * X.NL), true);
    });
    ui.picks.addEventListener('click', e => { const b = e.target.closest('[data-li]'); if (b) load(+b.dataset.li, true); });
    ui.input.addEventListener('input', suggest);
    ui.input.addEventListener('focus', suggest);
    ui.input.addEventListener('keydown', e => {
      const items = [...ui.sugg.querySelectorAll('button')];
      if (e.key === 'Enter' && items[0]) { e.preventDefault(); items[0].click(); }
      if (e.key === 'Escape') { ui.sugg.innerHTML = ''; ui.input.blur(); }
    });
    ui.sugg.addEventListener('click', e => { const b = e.target.closest('[data-li]'); if (!b) return; ui.sugg.innerHTML = ''; ui.input.value = ''; load(+b.dataset.li, true); });
    document.addEventListener('click', e => { if (ui.sugg && !e.target.closest('.v-search')) ui.sugg.innerHTML = ''; });
    el.querySelector('.v-wall-sort').addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      wallSort = b.dataset.s; el.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      drawWall();
    });
    for (const k of [ui.map, ui.lat]) {
      k.addEventListener('pointermove', onMove);
      k.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') onMove(e); });
      k.addEventListener('pointerleave', () => { hoverJ = -1; X.tip(null); redraw(); });
      k.addEventListener('click', () => { if (hoverJ >= 0) { pinJ = pinJ === hoverJ ? -1 : hoverJ; redraw(); } });
    }
    ui.wall.addEventListener('pointermove', onWallMove);
    ui.wall.addEventListener('pointerleave', () => { wallHover = -1; X.tip(null); drawWallHover(); });
    ui.wall.addEventListener('click', () => {
      if (wallHover < 0) return;
      load(wallHover, true);
      el.querySelector('.v-top').scrollIntoView({ behavior: X.reduced ? 'auto' : 'smooth', block: 'start' });
    });
    document.addEventListener('keydown', e => {
      if (!visible || !built || e.defaultPrevented || (e.target.closest && e.target.closest('input, textarea, .u-tabs'))) return;
      if (e.code === 'Space') { e.preventDefault(); if (playing) stop(); else sail(); }
    });
    const dims = () => [ui.map.parentNode, ui.lat.parentNode].map(n => n.clientWidth + 'x' + n.clientHeight).join(',') + ',' + ui.wall.parentNode.clientWidth;
    let lastDims = '';
    const ro = new ResizeObserver(() => { const d = dims(); if (built && visible && d !== lastDims) { lastDims = d; layout(); } });
    [ui.map.parentNode, ui.lat.parentNode, ui.wall.parentNode].forEach(n => ro.observe(n));

    Promise.all([X.loadLogs(), X.land()]).then(([, ln]) => {
      land = ln; grat = d3.geoGraticule().step([20, 20])();
      built = true;
      byYear = X.LOGS.map((r, k) => k).sort((a, b) => X.LOGS[a][3] - X.LOGS[b][3]);
      ui.picks.innerHTML = picks().map(([label, k]) => `<button class="chip-btn" data-li="${k}" aria-pressed="false">${X.esc(label)}</button>`).join('');
      wallGeo = X.LOGS.map((r, k) => ({ k, year: r[3], days: r[4] - r[3], whales: r[7], north: r[8], wife: W.v[r[0]][14] ? 1 : 0 }));
      const p = pending; pending = null;
      if (visible) show(p || {});
    });
  }
  const redraw = () => { drawMap(); drawLat(); dayText(); };

  // ---------- one logbook ----------
  function load(k, user, day) {
    if (k < 0 || k >= X.NL) return;
    stop();
    li = k; vi = X.LOGS[k][0]; s = X.LOGS[k][1]; n = X.LOGS[k][2];
    hoverJ = -1; pinJ = -1; prog = 1;
    if (day != null) { const j = X.entryAt(li, day); pinJ = j >= 0 ? j : -1; }
    if (user) X.setParams({ voyage: W.v[vi][0] });
    pts = [];
    for (let j = s; j < s + n; j++) pts.push([X.L.lon[j], X.L.lat[j]]);
    readout();
    fitProj();
    redraw(); drawWallHover();
    ui.picks.querySelectorAll('[data-li]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.li === li)));
    ui.play.querySelector('span').textContent = 'Sail it';
  }
  function readout() {
    const r = W.v[vi], ves = X.vesselOf(vi), L = X.L, lg = X.LOGS[li];
    const ms = X.mastersOf(vi);
    ui.kick.textContent = `Logbook ${X.fmt(byYear.indexOf(li) + 1)} of ${X.fmt(X.NL)}, in order of sailing`;
    ui.name.textContent = ves[0];
    const port = X.shortPort(X.portOf(vi));
    const bits = [`${cap(X.rigWord(W.rigs[r[15]] || W.rigs[ves[1]]))}${port ? ' of ' + X.esc(port) : ''}`];
    if (ves[2]) bits.push(`${X.fmt(ves[2])} tons`);
    if (X.yearsText(vi)) bits.push(X.yearsText(vi));
    ui.sub.innerHTML = bits.join(' \u00B7 ');
    const lines = [];
    if (ms.length) {
      let m = `<b>Captain ${X.esc(ms[0].name)}</b>`;
      if (ms[0].killed) m += `, killed by a whale on this voyage`;
      else if (ms[0].died) m += `, who died on this voyage`;
      else if (ms[0].left) m += `, who left the ship partway, usually a sign of illness`;
      const rest = ms.slice(1).filter(x => x.name !== ms[0].name);
      if (rest.length) m += `. After him, ${rest.map(x => `Captain ${X.esc(x.name)}${x.killed ? ', killed by a whale' : x.died ? ', who died' : ''}`).join(', then ')}`;
      lines.push(m + '.');
    }
    if (r[14]) lines.push(r[14] === 'yes' ? `The captain\u2019s wife sailed with him.` : `His wife, <b>${X.esc(wifeName(r[14]))}</b>, sailed with him.`);
    const days = lg[4] - lg[3] + 1;
    lines.push(n < days * .25 && days > 60
      ? `The log survives only in pieces: <b>${X.fmt(n)}</b> noons over ${X.fmt(days)} days, from ${X.fullDate(lg[3])} to ${X.fullDate(lg[4])}.`
      : `The log has <b>${X.fmt(n)}</b> noons over ${X.fmt(days)} days, from ${X.fullDate(lg[3])} to ${X.fullDate(lg[4])}.`);
    const sightDays = lg[5], strikeDays = lg[6], whales = lg[7];
    if (sightDays || strikeDays) {
      const spc = new Map();
      for (let j = s; j < s + n; j++) if (X.enc(j) === 2) spc.set(X.spec(j), (spc.get(X.spec(j)) || 0) + Math.max(1, L.nst[j]));
      const top = [...spc.entries()].filter(e => e[0] && e[0] !== 8).sort((a, b) => b[1] - a[1]);
      const most = top.length ? `, most of them ${X.SP_PLURAL[top[0][0]]}` : '';
      if (sightDays && strikeDays) lines.push(`Whales were sighted on ${X.plural(sightDays, 'day')} and struck on ${X.plural(strikeDays, 'day')}: <b>${X.plural(whales, 'whale')}</b> in all${most}.`);
      else if (strikeDays) lines.push(`Whales were struck on ${X.plural(strikeDays, 'day')}: <b>${X.plural(whales, 'whale')}</b> in all${most}.`);
      else lines.push(`Whales were sighted on ${X.plural(sightDays, 'day')}, and the log records none struck.`);
    } else lines.push('The log records no whales at all.');
    const ct = X.catchText(vi);
    const vend0 = X.vesselEnd.get(r[1]), lostHere = vend0 && vend0.voyage === vi && X.LOST_AT_SEA.has(vend0.cls);
    if (ct) lines.push(lostHere ? `The records credit the voyage with ${ct}.` : `She came home${r[7] ? ' in ' + r[7] : ''} with ${ct}.`);
    if (r[17]) lines.push(`The crew list names ${X.plural(r[17], 'man', 'men')}.`);
    const mel = W.meta.melville;
    if (mel && mel.voyage === r[0]) lines.push(`Among them is <b>Herman Melville</b>, ${mel.rank ? mel.rank.toLowerCase() : 'crewman'}, on a ${mel.lay.replace('-', '/')} share. He deserted at Nuku Hiva in July 1842, and published Moby-Dick nine years later.`);
    const vend = X.vesselEnd.get(r[1]);
    const endT = X.endText(r[1]);
    if (endT) {
      const last = vend && vend.voyage === vi;
      const said = vend && vend.cls === 'stone' ? 'The Union Navy bought her for the Stone Fleet and loaded her with stone, to be sunk blocking Charleston harbor.' : X.esc(endT) + (/[.!?]$/.test(endT) ? '' : '.');
      lines.push(`${last ? 'This was her last voyage.' : 'Her end:'} ${said}`);
    }
    const others = (X.vesselVoyages.get(r[1]) || []).filter(i => i !== vi && X.logOfVoyage(i) >= 0);
    const more = others.length ? `<div class="v-also">Other logs from this ship: ${others.map(i => `<a href="#" data-li="${X.logOfVoyage(i)}">${X.esc(X.yearsText(i))}</a>`).join(', ')}</div>` : '';
    ui.story.innerHTML = lines.map(x => `<p>${x}</p>`).join('') + more;
    ui.story.querySelectorAll('[data-li]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); load(+a.dataset.li, true); }));
  }
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const wifeName = X.wifeName;

  // ---------- map ----------
  function fitProj() {
    if (!mapW || !pts) return;
    let sx = 0, sy = 0;
    for (const [lon] of pts) { sx += Math.cos(lon * rad); sy += Math.sin(lon * rad); }
    const c0 = Math.atan2(sy, sx) / rad;
    const lats = pts.map(p => p[1]), latMin = Math.min(...lats), latMax = Math.max(...lats);
    const lons = pts.map(p => ((p[0] - c0 + 540) % 360) - 180), lonMin = Math.min(...lons), lonMax = Math.max(...lons);
    const padLon = Math.max(0, 18 - (lonMax - lonMin)) / 2 + 3, padLat = Math.max(0, 12 - (latMax - latMin)) / 2 + 3;
    const box = { type: 'MultiPoint', coordinates: [[c0 + lonMin - padLon, latMin - padLat], [c0 + lonMax + padLon, latMax + padLat], [c0 + lonMin - padLon, latMax + padLat], [c0 + lonMax + padLon, latMin - padLat], [c0, (latMin + latMax) / 2]] };
    const pad = mapW < 700 ? 14 : 30;
    proj = d3.geoEqualEarth().rotate([-c0, 0]).fitExtent([[pad, pad], [mapW - pad, mapH - pad]], box);
    pts.px = pts.map(p => proj(p));
    // the land, graticule and equator only change with the projection: draw them once
    mapBase = document.createElement('canvas'); mapBase.width = Math.round(mapW * dpr); mapBase.height = Math.round(mapH * dpr);
    const g = mapBase.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const path = d3.geoPath(proj, g);
    g.fillStyle = '#000'; g.fillRect(0, 0, mapW, mapH);
    g.beginPath(); path(grat); g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.stroke();
    g.beginPath(); path({ type: 'LineString', coordinates: d3.range(-180, 181, 2).map(q => [q, 0]) }); g.strokeStyle = 'rgba(255,255,255,.1)'; g.stroke();
    g.beginPath(); path(land); g.fillStyle = '#0d0f14'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.17)'; g.lineWidth = .7; g.stroke();
  }
  let mapBase = null;
  const rotLon = lon => { const r = proj.rotate()[0]; return ((lon + r + 540) % 360) - 180; };
  function brk(j) {
    // 1: the line would cross the back of the map, 2: the log is silent for more than ten days
    const L = X.L;
    if (Math.abs(rotLon(L.lon[j]) - rotLon(L.lon[j - 1])) > 120) return 1;
    if (L.day[j] - L.day[j - 1] > 10) return 2;
    return 0;
  }
  const upTo = () => s + Math.max(0, Math.round((n - 1) * prog));
  const focus = () => hoverJ >= 0 ? hoverJ : pinJ >= 0 ? pinJ : (playing || prog < 1 ? upTo() : -1);
  function drawMap() {
    if (!built || li < 0 || !proj) return;
    const k = ui.map, c = k.getContext('2d'), L = X.L;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (mapBase) c.drawImage(mapBase, 0, 0); else { c.fillStyle = '#000'; c.fillRect(0, 0, k.width, k.height); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = pts.px, upto = upTo();
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let j = s + 1; j < s + n; j++) {
        const a = P[j - 1 - s], b = P[j - s]; if (!a || !b) continue;
        const bk = brk(j); if (bk === 1) continue;
        const done = j <= upto;
        if ((pass === 0) === done) continue;
        c.strokeStyle = done ? 'rgba(246,240,226,.8)' : 'rgba(246,240,226,.15)';
        c.lineWidth = done ? 1.3 : 1;
        c.setLineDash(bk === 2 ? [2, 4] : []);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
    }
    c.setLineDash([]);
    const lastJ = Math.min(upto, s + n - 1);
    for (let j = s; j <= lastJ; j++) {
      const p = P[j - s]; if (!p || X.enc(j) !== 1) continue;
      c.strokeStyle = X.SP_HEX[X.spec(j)]; c.globalAlpha = .75; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], 2.7, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
    for (let j = s; j <= lastJ; j++) {
      const p = P[j - s]; if (!p || X.enc(j) !== 2) continue;
      const r = 2.3 + Math.min(2.6, Math.sqrt(Math.max(1, L.nst[j])) - 1);
      c.fillStyle = X.SP_HEX[X.spec(j)]; c.globalAlpha = .2; c.beginPath(); c.arc(p[0], p[1], r * 2.3, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill();
    }
    placeLabels(c, P, lastJ);
    // Melville's desertion, where the Acushnet's log goes quiet at the Marquesas
    const mel = W.meta.melville;
    if (mel && mel.voyage === W.v[vi][0]) {
      for (let j = s; j < Math.min(lastJ, s + n - 1); j++) {
        if (L.day[j + 1] - L.day[j] > 14 && L.lat[j] < -7 && L.lat[j] > -11 && L.lon[j] < -138 && L.lon[j] > -142) {
          const p = P[j - s]; if (!p) break;
          c.fillStyle = '#fff1c9'; c.beginPath(); c.arc(p[0], p[1], 3, 0, Math.PI * 2); c.fill();
          c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
          const lab = mapW < 700 ? 'Melville deserts, 1842' : 'Nuku Hiva: Melville deserts, July 9, 1842';
          const left = p[0] - 9 - c.measureText(lab).width > 6;
          c.textAlign = left ? 'right' : 'left';
          halo(c, lab, p[0] + (left ? -9 : 9), p[1] + 1);
          break;
        }
      }
    }
    const a = P[0];
    if (a) { c.strokeStyle = '#fff'; c.lineWidth = 1.4; c.beginPath(); c.arc(a[0], a[1], 4.5, 0, Math.PI * 2); c.stroke(); }
    const f = focus();
    if (f >= 0 && P[f - s]) {
      const p = P[f - s];
      c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0], p[1], 3.4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], 9, 0, Math.PI * 2); c.stroke();
    }
    // how the ship ended, if this was her last voyage and she ended at sea
    const e = X.vesselEnd.get(W.v[vi][1]);
    if (e && e.voyage === vi && prog >= 1 && ['ice', 'shen', 'raider', 'whale', 'wreck', 'missing', 'stone'].includes(e.cls)) {
      const z = P[n - 1]; if (z) {
        const fa = X.FATES[e.cls];
        c.strokeStyle = fa.hex; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(z[0] - 5, z[1] - 5); c.lineTo(z[0] + 5, z[1] + 5); c.moveTo(z[0] + 5, z[1] - 5); c.lineTo(z[0] - 5, z[1] + 5); c.stroke();
        c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
        const right = z[0] > mapW - 220;
        c.textAlign = right ? 'right' : 'left'; c.fillStyle = fa.hex;
        halo(c, X.fateLabel(W.v[vi][1]), z[0] + (right ? -11 : 11), z[1]);
      }
    }
  }
  function halo(c, text, x, y) {
    const f = c.fillStyle;
    c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(text, x, y); c.fillStyle = f; c.fillText(text, x, y);
  }
  function placeLabels(c, P, lastJ) {
    const L = X.L, seen = new Set(), boxes = [];
    c.font = '500 11px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
    let count = 0;
    for (let j = s; j <= lastJ && count < 14; j++) {
      const name = L.place.get(j); if (!name || seen.has(name)) continue;
      seen.add(name);
      const p = P[j - s]; if (!p) continue;
      const w = c.measureText(name).width;
      const right = p[0] + 9 + w < mapW - 6;
      const bx = right ? p[0] + 7 : p[0] - 7 - w, by = p[1] - 7;
      if (boxes.some(b => bx < b[0] + b[2] + 4 && bx + w + 4 > b[0] && by < b[1] + 14 && by + 14 > b[1])) continue;
      boxes.push([bx, by, w]); count++;
      c.fillStyle = 'rgba(214,220,232,.88)'; c.textAlign = right ? 'left' : 'right';
      c.beginPath(); c.arc(p[0], p[1], 1.8, 0, Math.PI * 2); c.fill();
      halo(c, name, right ? p[0] + 7 : p[0] - 7, p[1]);
    }
  }

  // ---------- latitude, day by day ----------
  function drawLat() {
    if (!built || li < 0 || !latW) return;
    const k = ui.lat, c = k.getContext('2d'), L = X.L, lg = X.LOGS[li];
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.width, k.height); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padL = 56, padR = 14, padT = 14, padB = 24;
    const lo = Math.min(-10, Math.floor((lg[9] - 4) / 10) * 10), hi = Math.max(10, Math.ceil((lg[8] + 4) / 10) * 10);
    latX = d3.scaleLinear().domain([lg[3], Math.max(lg[4], lg[3] + 1)]).range([padL, latW - padR]);
    latY = d3.scaleLinear().domain([lo, hi]).range([latH - padB, padT]);
    c.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'right';
    const step = hi - lo > 80 ? 20 : 10;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const y = latY(v);
      c.fillStyle = v === 0 ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.07)'; c.fillRect(padL, y, latW - padL - padR, 1);
      c.fillStyle = 'rgba(169,176,192,.85)'; c.fillText(v === 0 ? 'Equator' : `${Math.abs(v)}\u00B0${v < 0 ? 'S' : 'N'}`, padL - 8, y);
    }
    c.textAlign = 'center'; c.textBaseline = 'top';
    const y0 = X.yearOf(lg[3]), y1 = X.yearOf(lg[4]), span = lg[4] - lg[3];
    const every = span > 1400 ? 6 : span > 500 ? 3 : 1;
    for (let y = y0; y <= y1; y++) for (let m = 0; m < 12; m += every) {
      const d = Math.round((Date.UTC(y, m, 1) - X.EPOCH) / X.DAY); if (d < lg[3] || d > lg[4]) continue;
      const x = latX(d);
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x, latH - padB, 1, 4);
      c.fillStyle = m === 0 ? 'rgba(214,220,232,.9)' : 'rgba(169,176,192,.6)';
      c.fillText(m === 0 ? String(y) : X.MON3[m], x, latH - padB + 6);
    }
    const upto = upTo();
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (let j = s + 1; j < s + n; j++) {
      const gap = L.day[j] - L.day[j - 1] > 10;
      c.strokeStyle = j <= upto ? 'rgba(246,240,226,.85)' : 'rgba(246,240,226,.16)'; c.lineWidth = j <= upto ? 1.4 : 1;
      c.setLineDash(gap ? [2, 4] : []);
      c.beginPath(); c.moveTo(latX(L.day[j - 1]), latY(L.lat[j - 1])); c.lineTo(latX(L.day[j]), latY(L.lat[j])); c.stroke();
    }
    c.setLineDash([]);
    const lastJ = Math.min(upto, s + n - 1);
    for (let j = s; j <= lastJ; j++) {
      const e = X.enc(j); if (!e || e === 3) continue;
      const x = latX(L.day[j]), y = latY(L.lat[j]);
      c.fillStyle = c.strokeStyle = X.SP_HEX[X.spec(j)];
      if (e === 2) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
      else { c.globalAlpha = .7; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 2.3, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
    }
    const seen = new Set(); let lastX = -99;
    c.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
    for (let j = s; j <= lastJ; j++) {
      const name = L.place.get(j); if (!name || seen.has(name)) continue; seen.add(name);
      const x = latX(L.day[j]), y = latY(L.lat[j]);
      if (x - lastX < 64) continue; lastX = x;
      c.fillStyle = 'rgba(214,220,232,.82)'; halo(c, name, x + 4, y - 5);
    }
    const f = focus();
    if (f >= 0) {
      const x = latX(L.day[f]);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, padT, 1, latH - padT - padB);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, latY(L.lat[f]), 3.4, 0, Math.PI * 2); c.fill();
    }
  }

  function dayText() {
    if (li < 0) return;
    const j = focus();
    ui.day.classList.toggle('show', j >= 0);
    if (j >= 0) ui.day.innerHTML = entryHtml(j, true);
  }
  function entryHtml(j, big) {
    const L = X.L, e = X.enc(j), sp = X.spec(j), nn = L.nst[j], place = L.place.get(j), rem = L.remark.get(j);
    let what = '';
    if (e === 2) what = nn > 1 ? `Struck ${nn} ${X.SP_PLURAL[sp] || 'whales'}` : `Struck ${X.SP_ONE[sp] || 'a whale'}`;
    else if (e === 1) what = `Sighted ${X.SP_PLURAL[sp] || 'whales'}`;
    else if (e === 3) what = 'Spoke a whaler that had taken a whale';
    const where = place ? `At ${X.esc(place)}` : `${X.latText(L.lat[j])}, ${X.lonText(L.lon[j])}`;
    const dayN = L.day[j] - X.LOGS[li][3] + 1;
    return big
      ? `<b>${X.fullDate(L.day[j])}</b><span>Day ${X.fmt(dayN)} \u00B7 ${where}</span>${what ? `<em style="color:${e === 3 ? 'var(--ink-soft)' : X.SP_HEX[sp]}">${what}</em>` : ''}${rem ? `<q>${X.esc(rem)}</q>` : ''}`
      : `<b>${X.fullDate(L.day[j])}</b><small>Day ${X.fmt(dayN)} \u00B7 ${where}</small>${what ? `<em>${what}${rem ? `, \u201C${X.esc(rem)}\u201D` : ''}</em>` : rem ? `<em>\u201C${X.esc(rem)}\u201D</em>` : ''}`;
  }
  function onMove(e) {
    if (li < 0 || !pts) return;
    const k = e.currentTarget, r = k.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, L = X.L;
    let best = -1;
    if (k === ui.lat) {
      if (!latX || x < latX.range()[0] - 10) { hoverJ = -1; X.tip(null); redraw(); return; }
      const d = latX.invert(x);
      let bd = Infinity;
      for (let j = s; j < s + n; j++) { const dd = Math.abs(L.day[j] - d); if (dd < bd) { bd = dd; best = j; } }
    } else {
      let bd = 16 * 16;
      for (let j = s; j < s + n; j++) {
        const p = pts.px[j - s]; if (!p) continue;
        const dx = p[0] - x, dy = p[1] - y, d2 = dx * dx + dy * dy;
        if (d2 < bd || (d2 <= bd + 6 && X.enc(j) === 2)) { bd = d2; best = j; }
      }
    }
    hoverJ = best;
    k.style.cursor = best >= 0 ? 'pointer' : 'crosshair';
    if (best >= 0) X.tip(entryHtml(best, false), e.clientX, e.clientY); else X.tip(null);
    redraw();
  }

  // ---------- sailing ----------
  function sail() {
    if (li < 0) return;
    if (sound) X.audio();
    if (prog >= 1) prog = 0;
    playing = true; pinJ = -1; lastStruck = upTo();
    ui.play.querySelector('span').textContent = 'Stop';
    ui.play.querySelector('svg').innerHTML = '<path d="M6 6h12v12H6z"/>';
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf);
    if (ui.play) { ui.play.querySelector('span').textContent = prog < 1 ? 'Sail on' : 'Sail it'; ui.play.querySelector('svg').innerHTML = '<path d="M7 4.5v15l12.5-7.5z"/>'; }
  }
  function tick(now) {
    if (!playing) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const dur = Math.max(8, Math.min(PLAY_S, n / 40));
    prog = Math.min(1, prog + dt / dur);
    const upto = upTo();
    if (sound) for (let j = lastStruck + 1; j <= upto; j++) if (X.enc(j) === 2) { const p = pts.px[j - s]; X.strike(X.spec(j), p ? (p[0] / mapW) * 1.6 - .8 : 0, .22); break; }
    lastStruck = upto;
    redraw();
    if (prog >= 1) { stop(); redraw(); return; }
    raf = requestAnimationFrame(tick);
  }

  // ---------- every logbook ----------
  let tileW = 0, tileH = 0, cols = 0, wallBase = null, wallKey = '';
  function drawWall() {
    if (!built || !wallGeo) return;
    const k = ui.wall;
    const w = Math.round(inner(k.parentNode)[0]); if (!w) return;
    const key = `${w}|${dpr}|${wallSort}`;
    if (key === wallKey && wallBase) { drawWallHover(); return; }
    wallKey = key;
    const base = w < 700 ? 50 : 58;
    cols = Math.max(4, Math.floor((w + 4) / (base + 4))); tileW = Math.floor((w - (cols - 1) * 4) / cols); tileH = Math.round(tileW * .5);
    const rows = Math.ceil(X.NL / cols), h = rows * (tileH + 4);
    k.width = w * dpr; k.height = h * dpr; k.style.width = w + 'px'; k.style.height = h + 'px';
    const sortKey = { year: g => g.year, days: g => -g.days, whales: g => -g.whales, north: g => -g.north, wife: g => -g.wife * 1e7 + g.year }[wallSort];
    wallOrder = wallGeo.slice().sort((a, b) => (sortKey(a) - sortKey(b)) || (a.year - b.year)).map(g => g.k);
    const c = k.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const tp = d3.geoEqualEarth().rotate([150, 0]).fitSize([tileW - 2, tileH - 2], { type: 'Sphere' });
    const tl = document.createElement('canvas'); tl.width = tileW * dpr; tl.height = tileH * dpr;
    const tc = tl.getContext('2d'); tc.setTransform(dpr, 0, 0, dpr, 0, 0); tc.translate(1, 1);
    tc.beginPath(); d3.geoPath(tp, tc)({ type: 'Sphere' }); tc.fillStyle = '#07080b'; tc.fill();
    tc.beginPath(); d3.geoPath(tp, tc)(land); tc.fillStyle = '#181a21'; tc.fill();
    const L = X.L, TS = tp.scale(), [TX, TY] = tp.translate();
    const pr = (lon, lat) => { const p = d3.geoEqualEarthRaw((((lon + 150 + 540) % 360) - 180) * rad, lat * rad); return [1 + TX + TS * p[0], 1 + TY - TS * p[1]]; };
    wallOrder.forEach((lk, q) => {
      const x0 = (q % cols) * (tileW + 4), y0 = Math.floor(q / cols) * (tileH + 4);
      c.drawImage(tl, x0, y0, tileW, tileH);
      const st = X.LOGS[lk][1], nn = X.LOGS[lk][2];
      c.save(); c.translate(x0, y0);
      c.strokeStyle = 'rgba(246,240,226,.72)'; c.lineWidth = .75; c.beginPath();
      let pl = 0;
      for (let j = st; j < st + nn; j++) {
        const p = pr(L.lon[j], L.lat[j]), sl = (((L.lon[j] + 150 + 540) % 360) - 180);
        if (j === st || Math.abs(sl - pl) > 90 || L.day[j] - L.day[j - 1] > 20) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
        pl = sl;
      }
      c.stroke();
      for (let j = st; j < st + nn; j++) if (X.enc(j) === 2) { const p = pr(L.lon[j], L.lat[j]); c.fillStyle = X.SP_HEX[X.spec(j)]; c.fillRect(p[0] - .8, p[1] - .8, 1.7, 1.7); }
      c.restore();
    });
    wallBase = document.createElement('canvas'); wallBase.width = k.width; wallBase.height = k.height; wallBase.getContext('2d').drawImage(k, 0, 0);
    drawWallHover();
  }
  function drawWallHover() {
    if (!wallBase) return;
    const k = ui.wall, c = k.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.width, k.height); c.drawImage(wallBase, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const [kk, style] of [[li, '#fff'], [wallHover, 'rgba(255,255,255,.55)']]) {
      if (kk < 0) continue;
      const q = wallOrder.indexOf(kk); if (q < 0) continue;
      const x0 = (q % cols) * (tileW + 4), y0 = Math.floor(q / cols) * (tileH + 4);
      c.strokeStyle = style; c.lineWidth = 1.2; c.strokeRect(x0 + .5, y0 + .5, tileW - 1, tileH - 1);
    }
  }
  function onWallMove(e) {
    const r = ui.wall.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const cx = Math.floor(x / (tileW + 4)), cy = Math.floor(y / (tileH + 4)), q = cy * cols + cx;
    const k = cx < cols && q >= 0 && q < wallOrder.length ? wallOrder[q] : -1;
    if (k !== wallHover) { wallHover = k; drawWallHover(); }
    if (k < 0) { X.tip(null); ui.wall.style.cursor = 'default'; return; }
    ui.wall.style.cursor = 'pointer';
    const lg = X.LOGS[k], v = lg[0];
    X.tip(`<b>${X.esc(X.vesselOf(v)[0])}</b><small>${X.esc(X.shortPort(X.portOf(v)))}, ${X.esc(X.yearsText(v))}</small><small>${X.plural(lg[2], 'noon')} logged, ${X.plural(lg[7], 'whale')} struck</small>${W.v[v][14] ? '<em>The captain\u2019s wife sailed too</em>' : ''}`, e.clientX, e.clientY);
  }

  // ---------- layout ----------
  const inner = elx => { const cs = getComputedStyle(elx); return [elx.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), elx.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)]; };
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    [mapW, mapH] = inner(ui.map.parentNode).map(Math.round);
    [latW, latH] = inner(ui.lat.parentNode).map(Math.round);
    for (const [k, w, h] of [[ui.map, mapW, mapH], [ui.lat, latW, latH]]) { k.width = w * dpr; k.height = h * dpr; k.style.width = w + 'px'; k.style.height = h + 'px'; }
    if (li >= 0) { fitProj(); redraw(); }
    drawWall();
  }

  // ---------- suggestions ----------
  let names = null;
  function suggest() {
    const q = ui.input.value.trim().toLowerCase();
    if (!built) return;
    if (!names) names = X.LOGS.map((r, k) => ({ k, ship: X.vesselOf(r[0])[0].toLowerCase(), caps: X.mastersOf(r[0]).map(m => m.name.toLowerCase()).join(' | ') }));
    if (q.length < 2) { ui.sugg.innerHTML = ''; return; }
    const hits = [];
    for (const nm of names) {
      const a = nm.ship.startsWith(q) ? 0 : nm.ship.includes(q) ? 1 : nm.caps.includes(q) ? 2 : -1;
      if (a >= 0) hits.push([a, nm.k]);
    }
    hits.sort((a, b) => a[0] - b[0] || X.LOGS[a[1]][3] - X.LOGS[b[1]][3]);
    ui.sugg.innerHTML = hits.slice(0, 9).map(([, k]) => { const v = X.LOGS[k][0]; return `<button data-li="${k}" role="option"><b>${X.esc(X.vesselOf(v)[0])}</b><span>${X.esc(X.yearsText(v))} \u00B7 ${X.esc(X.shortPort(X.portOf(v)))}${X.captain(v) ? ' \u00B7 ' + X.esc(X.captain(v)) : ''}</span></button>`; }).join('') || `<div class="v-none">No logbook for that name</div>`;
  }

  // ---------- view API ----------
  let pending = null;
  function show(opts) {
    visible = true;
    if (!built) { pending = opts; return; }
    layout();
    let k = li;
    if (opts && opts.voyage) { const i = X.byId.get(opts.voyage); if (i !== undefined && X.logOfVoyage(i) >= 0) k = X.logOfVoyage(i); }
    if (k < 0) { const i = X.byId.get('AV00209'); k = i !== undefined ? X.logOfVoyage(i) : 0; }
    if (k !== li || (opts && opts.day != null)) load(k, false, opts && opts.day);
  }
  function hide() { visible = false; stop(); X.tip(null); }
  X.views.voyage = { init, show, hide, load: k => load(k, true), state: () => ({ built, li, vi, prog, playing }) };
})();
