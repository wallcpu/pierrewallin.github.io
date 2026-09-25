/* The Whale Road: The Fleet.
   Every American whaling voyage on record, each one a thread from the day it sailed to the day it came home,
   packed so the outline of the whole is the rise and fall of the industry. Then how every ship ended,
   what came home, and the French fleet for comparison. */
(function () {
  'use strict';
  const X = window.WX, W = X.W;
  const Y0 = 1665, Y1 = 1940, OPEN = 600;   // a voyage with no recorded return is drawn fading over 600 days, about the median length
  const AMBER = '#ffb44f', TEAL = '#56d6c2';
  const PORT_HEX = ['#f6f0e2', '#ffb44f', '#56d6c2', '#ff7d8c', '#8ec9ff', '#c7a2ff', '#cfc6b2', '#7f95ff'];
  const ORDER = ['shen', 'raider', 'stone', 'ice', 'whale', 'taken', 'wreck', 'missing', 'condemned', 'fire', 'retired', 'kept'];
  const WARS = [[1775.3, 1783.7, 'War of Independence'], [1812.5, 1815.1, 'War of 1812'], [1861.3, 1865.4, 'Civil War']];
  let el, ui = {}, built = false, visible = false, dpr = 1;
  let mode = 'catch', topPorts = [], portIdx = new Map();
  let fw = 0, fh = 0, x = null, laneH = 1, lanes = [], base = null, hoverV = -1, pinV = -1;
  let ew = 0, eh = 0, ex = null, endDots = [], endBase = null, hoverE = -1;
  let cw = 0, ch = 0, catchBase = null, catchSeries = null, hoverYear = -1;
  let frw = 0, frh = 0, frBase = null, frHover = -1, frX = null;
  const V = W.v;
  const yf = d => X.yearFrac(d);
  const STEP = () => (fw || ew || cw || 1000) < 700 ? 40 : 20;

  function init(root) {
    el = root;
    // ports by number of voyages
    const pc = new Map(); for (const r of V) pc.set(r[2], (pc.get(r[2]) || 0) + 1);
    topPorts = [...pc.entries()].filter(e => W.ports[e[0]]).sort((a, b) => b[1] - a[1]).slice(0, 7).map(e => e[0]);
    topPorts.forEach((p, i) => portIdx.set(p, i));
    const drawn = V.filter(r => r[3] >= 0).length;
    const firstY = Math.min(...V.filter(r => r[6]).map(r => r[6])), lastY = Math.max(...V.map(r => r[7] || r[6]));
    el.innerHTML = `
      <div class="f-top">
        <div class="f-read">
          <div class="f-kick">${X.fmt(X.NV)} voyages, ${X.fmt(W.vessels.length)} ships, ${X.fmt(W.ports.length - 1)} home ports</div>
          <h2 class="f-head">Every American whaling voyage on record, ${firstY} to ${lastY}</h2>
          <p class="f-line">Each voyage is a thread from the day it sailed to the day it came home, stacked so the outline is how many ships were out. <span class="f-dim">Threads that fade had no recorded return.</span></p>
          <div class="f-pin" aria-live="polite"></div>
        </div>
        <div class="f-ctl">
          <span class="lbl">Color by</span>
          <button class="chip-btn" data-m="catch" aria-pressed="true">What they hunted</button>
          <button class="chip-btn" data-m="port" aria-pressed="false">Home port</button>
          <button class="chip-btn" data-m="fate" aria-pressed="false">How the ship ended</button>
          <button class="chip-btn" data-m="wife" aria-pressed="false">Wife aboard</button>
        </div>
      </div>
      <div class="f-key"></div>
      <div class="f-chart"><canvas aria-label="Every whaling voyage as a thread through time"></canvas></div>
      <div class="f-sec">
        <h3 class="f-h">How the ships ended</h3>
        <p class="f-line">Every ship, placed in the year her last voyage ended. Hover a dot for what the records say.</p>
      </div>
      <div class="f-ends"><canvas aria-label="How each whaleship ended, by year"></canvas></div>
      <div class="f-sec">
        <h3 class="f-h">What came home</h3>
        <p class="f-line f-catch-line"></p>
      </div>
      <div class="f-catch"><canvas aria-label="Oil and whalebone landed each year"></canvas></div>
      <div class="f-sec">
        <h3 class="f-h">Meanwhile, in France</h3>
        <p class="f-line f-fr-line"></p>
      </div>
      <div class="f-fr"><canvas aria-label="Every French whaling voyage as a thread through time"></canvas></div>`;
    ui = {
      pin: el.querySelector('.f-pin'), key: el.querySelector('.f-key'), chart: el.querySelector('.f-chart canvas'),
      ends: el.querySelector('.f-ends canvas'), catch: el.querySelector('.f-catch canvas'), fr: el.querySelector('.f-fr canvas'),
      catchLine: el.querySelector('.f-catch-line'), frLine: el.querySelector('.f-fr-line'),
    };
    el.querySelector('.f-ctl').addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      mode = b.dataset.m; el.querySelectorAll('[data-m]').forEach(q => q.setAttribute('aria-pressed', String(q === b)));
      drawChart(); keyRow();
    });
    ui.chart.addEventListener('pointermove', onChartMove);
    ui.chart.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') onChartMove(e); });
    ui.ends.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') onEndsMove(e); });
    ui.chart.addEventListener('pointerleave', () => { hoverV = -1; X.tip(null); overlay(); pinText(); });
    ui.chart.addEventListener('click', () => {
      if (hoverV < 0) return;
      const li = X.logOfVoyage(hoverV);
      if (li >= 0) { X.tip(null); X.go('voyage', { voyage: V[hoverV][0] }); window.scrollTo({ top: document.querySelector('.u-head').offsetTop, behavior: 'auto' }); return; }
      pinV = pinV === hoverV ? -1 : hoverV; overlay(); pinText();
    });
    ui.ends.addEventListener('pointermove', onEndsMove);
    ui.ends.addEventListener('pointerleave', () => { hoverE = -1; X.tip(null); drawEndsHover(); });
    ui.ends.addEventListener('click', () => {
      if (hoverE < 0) return;
      const d = endDots[hoverE]; const li = d.v >= 0 ? X.logOfVoyage(d.v) : -1;
      if (li >= 0) { X.tip(null); X.go('voyage', { voyage: V[d.v][0] }); window.scrollTo({ top: document.querySelector('.u-head').offsetTop }); }
    });
    ui.catch.addEventListener('pointermove', onCatchMove);
    ui.catch.addEventListener('pointerleave', () => { hoverYear = -1; X.tip(null); drawCatchHover(); });
    ui.fr.addEventListener('pointermove', onFrMove);
    ui.fr.addEventListener('pointerleave', () => { frHover = -1; X.tip(null); drawFrHover(); });
    let lastDims = '';
    const dims = () => `${ui.chart.parentNode.clientWidth}x${ui.chart.parentNode.clientHeight},${el.clientWidth}`;
    new ResizeObserver(() => { const d = dims(); if (visible && d !== lastDims) { lastDims = d; layout(); } }).observe(ui.chart.parentNode);
    buildEnds(); buildCatch(); frText();
    built = true;
    keyRow();
  }

  // ---------- colour of a voyage ----------
  const lerp = d3.interpolateLab(TEAL, AMBER);
  function colorOf(i) {
    const r = V[i];
    if (mode === 'catch') {
      const sp = r[10], oil = r[11];
      if (!sp && !oil) return r[12] ? '#8ec9ff' : 'rgba(150,156,170,.55)';
      return lerp(sp / (sp + oil));
    }
    if (mode === 'port') { const k = portIdx.get(r[2]); return k === undefined ? 'rgba(150,156,170,.45)' : PORT_HEX[k]; }
    if (mode === 'wife') return r[14] ? '#ffffff' : 'rgba(150,156,170,.22)';
    const e = X.vesselEnd.get(r[1]);
    if (e && e.voyage === i && e.cls && X.FATES[e.cls]) return e.cls === 'retired' || e.cls === 'condemned' ? 'rgba(150,156,170,.5)' : X.FATES[e.cls].hex;
    return 'rgba(150,156,170,.18)';
  }
  function keyRow() {
    let h = '';
    if (mode === 'catch') h = `<span><i class="f-ramp"></i>Amber for sperm oil, teal for whale oil from right whales, bowheads and humpbacks</span><span><i class="f-sw" style="background:#8ec9ff"></i>Whalebone only</span><span><i class="f-sw" style="background:rgba(150,156,170,.55)"></i>No catch recorded</span>`;
    if (mode === 'port') h = topPorts.map((p, i) => `<span><i class="f-sw" style="background:${PORT_HEX[i]}"></i>${X.esc(X.shortPort(W.ports[p]))}</span>`).join('') + `<span><i class="f-sw" style="background:rgba(150,156,170,.45)"></i>${X.fmt(W.ports.length - 1 - topPorts.length)} other ports</span>`;
    if (mode === 'fate') h = ORDER.filter(k => k !== 'retired' && k !== 'condemned' && k !== 'kept').map(k => `<span><i class="f-sw" style="background:${X.FATES[k].hex}"></i>${X.FATES[k].name}</span>`).join('') + `<span><i class="f-sw" style="background:rgba(150,156,170,.5)"></i>Sold, condemned or broken up</span>`;
    if (mode === 'wife') { const n = V.filter(r => r[14]).length; h = `<span><i class="f-sw" style="background:#fff"></i>${X.fmt(n)} voyages where the captain\u2019s wife sailed too</span>`; }
    ui.key.innerHTML = h;
  }

  // ---------- the voyages ----------
  function spanOf(i) {
    const r = V[i]; if (r[3] < 0) return null;
    return [r[3], r[4] >= 0 ? r[4] : -1];
  }
  function drawChart() {
    if (!fw) return;
    const k = ui.chart, c = k.getContext('2d');
    k.width = fw * dpr; k.height = fh * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, fw, fh);
    const top = 34, bottom = fh - 26;
    x = d3.scaleLinear().domain([Y0, Y1]).range([6, fw - 6]);
    const NLANE = W.meta.lanes;
    laneH = (bottom - top) / NLANE;
    // wars
    c.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textBaseline = 'top';
    let lastR = -1e9;
    for (const [a, b, name] of WARS) {
      c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x(a), top - 8, x(b) - x(a), bottom - top + 8);
      const label = fw < 700 ? { 'War of Independence': 'Revolution', 'War of 1812': '1812', 'Civil War': 'Civil War' }[name] : name;
      const w = c.measureText(label).width, cx = (x(a) + x(b)) / 2;
      if (cx - w / 2 < lastR + 6) continue;
      lastR = cx + w / 2;
      c.fillStyle = 'rgba(169,176,192,.7)'; c.textAlign = 'center'; c.fillText(label, cx, 2);
    }
    // years
    c.textAlign = 'center';
    for (let y = 1680; y <= 1920; y += STEP()) { c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x(y), top - 8, 1, bottom - top + 8); c.fillStyle = 'rgba(169,176,192,.75)'; c.fillText(String(y), x(y), bottom + 8); }
    lanes = Array.from({ length: NLANE }, () => []);
    const hL = Math.max(.5, laneH * .86);
    for (let i = 0; i < V.length; i++) {
      const sp = spanOf(i), ln = V[i][18]; if (!sp || ln < 0) continue;
      const x0 = x(yf(sp[0])), y = bottom - (ln + 1) * laneH;
      const open = sp[1] < 0, x1 = open ? x(yf(sp[0] + OPEN)) : Math.max(x0 + .8, x(yf(sp[1])));
      lanes[ln].push([x0, x1, i]);
      const col = colorOf(i);
      if (open) {
        const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = .75; c.fillStyle = g;
      } else { c.globalAlpha = 1; c.fillStyle = col; }
      c.fillRect(x0, y, x1 - x0, hL);
    }
    c.globalAlpha = 1;
    // the data's own notes
    const peak = peakAtSea();
    const note = (yr, text, yv) => {
      const px = x(yr);
      c.fillStyle = 'rgba(255,241,201,.85)'; c.fillRect(px, yv, 1, 16);
      c.font = '600 11.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = px > fw - 220 ? 'right' : 'left'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = 3.4; c.strokeStyle = 'rgba(0,0,0,.9)';
      const tx = px + (c.textAlign === 'right' ? -6 : 6);
      c.strokeText(text, tx, yv + 8); c.fillStyle = '#fff1c9'; c.fillText(text, tx, yv + 8);
    };
    if (peak) note(peak.year, `${peak.year}: ${X.fmt(peak.n)} ships at sea on an average day`, Math.max(top, bottom - peak.lane * laneH - 24));
    note(1859.65, 'Oil struck in Pennsylvania, 1859', bottom - NLANE * laneH * .64);
    note(1871.7, 'Arctic fleet lost in the ice, 1871', bottom - NLANE * laneH * .36);
    base = document.createElement('canvas'); base.width = k.width; base.height = k.height; base.getContext('2d').drawImage(k, 0, 0);
    overlay();
  }
  let peakCache = null;
  function peakAtSea() {
    if (peakCache) return peakCache;
    const s = X.atSea(), bd = Math.round((Date.UTC(s.peakYear, 6, 1) - X.EPOCH) / X.DAY);
    let lane = 0; for (const r of V) if (r[3] >= 0 && r[3] <= bd && (r[4] < 0 ? r[3] + OPEN : r[4]) >= bd) lane = Math.max(lane, r[18]);
    return (peakCache = { n: s.peak, day: bd, year: s.peakYear, lane });
  }
  function overlay() {
    if (!base) return;
    const k = ui.chart, c = k.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.width, k.height); c.drawImage(base, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bottom = fh - 26;
    for (const [i, a] of [[pinV, 1], [hoverV, .9]]) {
      if (i < 0) continue;
      const sp = spanOf(i); const ln = V[i][18];
      const x0 = x(yf(sp[0])), x1 = sp[1] < 0 ? x(yf(sp[0] + OPEN)) : Math.max(x0 + 1, x(yf(sp[1])));
      const y = bottom - (ln + 1) * laneH;
      c.fillStyle = '#fff'; c.globalAlpha = a; c.fillRect(x0, y - 1, x1 - x0, Math.max(2, laneH) + 2); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y - 6); c.lineTo(x0, y + 8); c.moveTo(x1, y - 6); c.lineTo(x1, y + 8); c.stroke();
      // the rest of this ship's voyages, in a dimmer white
      for (const j of X.vesselVoyages.get(V[i][1]) || []) {
        if (j === i) continue; const s2 = spanOf(j); if (!s2 || V[j][18] < 0) continue;
        const a0 = x(yf(s2[0])), a1 = s2[1] < 0 ? x(yf(s2[0] + OPEN)) : Math.max(a0 + 1, x(yf(s2[1])));
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(a0, bottom - (V[j][18] + 1) * laneH, a1 - a0, Math.max(1.2, laneH));
      }
    }
  }
  function voyageHtml(i, short) {
    const r = V[i], ves = X.vesselOf(i), cap = X.captain(i), ct = X.catchText(i);
    const e = X.vesselEnd.get(r[1]);
    const endT = e && e.voyage === i ? X.endText(r[1]) : '';
    const sp = spanOf(i);
    const when = sp ? `${X.fullDate(sp[0])}${sp[1] >= 0 ? ' to ' + X.fullDate(sp[1]) : ', return not recorded'}` : X.yearsText(i);
    const log = X.logOfVoyage(i) >= 0;
    return `<b>${X.esc(ves[0])}</b><small>${X.esc(X.shortPort(X.portOf(i)))}${W.grounds[r[9]] ? ' \u00B7 bound for ' + X.esc(W.grounds[r[9]]) : ''}</small><small>${when}</small>` +
      (cap ? `<small>Captain ${X.esc(cap)}${r[14] ? `, with his wife${r[14] !== 'yes' ? ' ' + X.esc(X.wifeName(r[14])) : ''}` : ''}</small>` : '') +
      (ct ? `<em>${endT && X.LOST_AT_SEA.has((e || {}).cls) ? 'Credited with' : 'Brought home'} ${ct}</em>` : '') + (endT ? `<em>Her last voyage. ${X.esc(endT)}</em>` : '') +
      (short ? '' : (log ? `<em>Click to follow her logbook</em>` : ''));
  }
  function pinText() {
    const i = hoverV >= 0 ? hoverV : pinV;
    if (i < 0) { ui.pin.innerHTML = ''; return; }
    ui.pin.innerHTML = voyageHtml(i, true);
  }
  function onChartMove(e) {
    if (!x) return;
    const r = ui.chart.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const bottom = fh - 26, ln0 = Math.floor((bottom - my) / laneH);
    let best = -1, bd = 3;
    for (let dl = -2; dl <= 2; dl++) {
      const ln = ln0 + dl; if (ln < 0 || ln >= lanes.length) continue;
      for (const [x0, x1, i] of lanes[ln]) {
        const dx = mx < x0 ? x0 - mx : mx > x1 ? mx - x1 : 0;
        const d = dx + Math.abs(dl) * laneH * .6;
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best !== hoverV) { hoverV = best; overlay(); pinText(); }
    ui.chart.style.cursor = best >= 0 ? (X.logOfVoyage(best) >= 0 ? 'pointer' : 'crosshair') : 'crosshair';
    if (best >= 0) X.tip(voyageHtml(best, false), e.clientX, e.clientY); else X.tip(null);
  }

  // ---------- how the ships ended ----------
  function buildEnds() {
    endDots = [];
    for (const [k, i, cls, y] of W.vend) {
      if (!cls || !y || y < Y0) continue;
      endDots.push({ k, v: i, cls, y, kind: 'ship' });
    }
    // captains killed by whales, on the voyage they died
    for (let i = 0; i < V.length; i++) for (const [m, f] of V[i][13]) if (f & 2) { endDots.push({ k: V[i][1], v: i, cls: 'killed', y: V[i][6] || X.yearOf(V[i][3]), m, kind: 'captain' }); break; }
  }
  const ROWS = () => [...ORDER, 'killed'];
  const rowName = k => k === 'killed' ? 'Captain killed by a whale' : X.FATES[k].name;
  const rowHex = k => k === 'killed' ? '#ff7d8c' : X.FATES[k].hex;
  function drawEnds() {
    if (!ew) return;
    const k = ui.ends, c = k.getContext('2d');
    const rows = ROWS(), rowH = ew < 700 ? 22 : 26, top = 6;
    eh = rows.length * rowH + 34;
    k.width = ew * dpr; k.height = eh * dpr; k.style.height = eh + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, ew, eh);
    // the same time axis as the voyages above, so the years line up; the labels sit in the empty early years
    ex = d3.scaleLinear().domain([Y0, Y1]).range([6, ew - 6]);
    c.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
    for (let y = 1680; y <= 1920; y += STEP()) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(ex(y), top, 1, rows.length * rowH); c.fillStyle = 'rgba(169,176,192,.75)'; c.fillText(String(y), ex(y), top + rows.length * rowH + 8); }
    for (const [a, b] of WARS) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(ex(a), top, ex(b) - ex(a), rows.length * rowH); }
    const rnd = s2 => { const h = Math.sin(s2 * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
    rows.forEach((cls, ri) => {
      const cy = top + ri * rowH + rowH / 2;
      c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(6, top + (ri + 1) * rowH - .5, ew - 12, 1);
      const ds = endDots.filter(d => d.cls === cls);
      ds.forEach((d, q) => {
        d.x = ex(d.y + rnd(q + ri * 1000) * .9); d.cy = cy + (rnd(q * 3 + 7 + ri) - .5) * (rowH - 9);
        c.fillStyle = rowHex(cls); c.globalAlpha = cls === 'retired' || cls === 'condemned' ? .55 : .9;
        c.beginPath(); c.arc(d.x, d.cy, cls === 'retired' || cls === 'condemned' || cls === 'wreck' ? 1.6 : 2.3, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;
      c.font = `500 ${ew < 700 ? 11 : 12.5}px "Schibsted Grotesk", system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = 3.4; c.strokeStyle = 'rgba(0,0,0,.9)'; c.strokeText(rowName(cls), 6, cy);
      c.fillStyle = rowHex(cls); c.fillText(rowName(cls), 6, cy);
      c.font = '600 12px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'right'; c.fillStyle = 'rgba(214,220,232,.8)'; c.fillText(X.fmt(ds.length), ew - 6, cy);
    });
    endBase = document.createElement('canvas'); endBase.width = k.width; endBase.height = k.height; endBase.getContext('2d').drawImage(k, 0, 0);
    drawEndsHover();
  }
  function drawEndsHover() {
    if (!endBase) return;
    const k = ui.ends, c = k.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.width, k.height); c.drawImage(endBase, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (hoverE >= 0) { const d = endDots[hoverE]; c.strokeStyle = '#fff'; c.lineWidth = 1.3; c.beginPath(); c.arc(d.x, d.cy, 5.5, 0, Math.PI * 2); c.stroke(); }
  }
  function onEndsMove(e) {
    const r = ui.ends.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 8 * 8;
    endDots.forEach((d, q) => { if (d.x === undefined) return; const dx = d.x - mx, dy = d.cy - my, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = q; } });
    if (best !== hoverE) { hoverE = best; drawEndsHover(); }
    if (best < 0) { X.tip(null); ui.ends.style.cursor = 'default'; return; }
    const d = endDots[best], ves = W.vessels[d.k];
    ui.ends.style.cursor = d.v >= 0 && X.logOfVoyage(d.v) >= 0 ? 'pointer' : 'default';
    if (d.kind === 'captain') {
      X.tip(`<b>Captain ${X.esc(W.masters[d.m])}</b><small>of the ${X.esc(ves[0])}, ${X.esc(X.shortPort(X.portOf(d.v)))}, ${X.esc(X.yearsText(d.v))}</small><em>Killed by a whale on this voyage</em>`, e.clientX, e.clientY);
    } else {
      X.tip(`<b>${X.esc(ves[0])}</b><small>${X.esc(X.shortPort(X.portOf(d.v)))}${ves[3] ? ' \u00B7 built at ' + X.esc(ves[3]) : ''}${ves[4] ? ', ' + X.esc(ves[4]) : ''}</small><small>${X.esc(X.endText(d.k) || rowName(d.cls))}</small>${X.logOfVoyage(d.v) >= 0 ? '<em>Click to follow her last logbook</em>' : ''}`, e.clientX, e.clientY);
    }
  }

  // ---------- what came home ----------
  function buildCatch() {
    const yrs = Y1 - Y0 + 1;
    catchSeries = { sperm: new Float64Array(yrs), oil: new Float64Array(yrs), bone: new Float64Array(yrs), n: new Uint16Array(yrs) };
    for (const r of V) {
      const y = r[7] || (r[4] >= 0 ? X.yearOf(r[4]) : 0); if (!y || y < Y0 || y > Y1) continue;
      catchSeries.sperm[y - Y0] += r[10]; catchSeries.oil[y - Y0] += r[11]; catchSeries.bone[y - Y0] += r[12];
      if (r[10] || r[11] || r[12]) catchSeries.n[y - Y0]++;
    }
    const peak = a => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return [Y0 + b, a[b]]; };
    const [ps, vs] = peak(catchSeries.sperm), [po, vo] = peak(catchSeries.oil), [pb, vb] = peak(catchSeries.bone);
    ui.catchLine.innerHTML = `Oil and whalebone landed each year, by the year the ships came home. Sperm oil peaked in <b>${ps}</b> at ${X.fmt(vs)} barrels, whale oil in <b>${po}</b> at ${X.fmt(vo)} barrels. Whalebone peaked in <b>${pb}</b>, at ${X.fmt(vb)} pounds.`;
  }
  function drawCatch() {
    if (!cw) return;
    const k = ui.catch, c = k.getContext('2d');
    ch = cw < 700 ? 190 : 230;
    k.width = cw * dpr; k.height = ch * dpr; k.style.height = ch + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
    const cx = d3.scaleLinear().domain([Y0, Y1]).range([6, cw - 6]);
    const rows = [['sperm', AMBER, 'Sperm oil, barrels'], ['oil', TEAL, 'Whale oil, barrels'], ['bone', '#8ec9ff', 'Whalebone, pounds']];
    const bandH = (ch - 30) / 3;
    rows.forEach(([key, hex, label], ri) => {
      const a = catchSeries[key], mx = Math.max(...a), y0 = 6 + (ri + 1) * bandH;
      c.fillStyle = hex; c.globalAlpha = .85;
      c.beginPath(); c.moveTo(cx(Y0), y0);
      for (let y = Y0; y <= Y1; y++) c.lineTo(cx(y), y0 - (a[y - Y0] / mx) * (bandH - 8));
      c.lineTo(cx(Y1), y0); c.closePath(); c.fill(); c.globalAlpha = 1;
      c.font = '600 11.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = hex; c.fillText(label, 8, y0 - bandH + 8);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(6, y0, cw - 12, 1);
    });
    c.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = 'rgba(169,176,192,.75)';
    for (let y = 1680; y <= 1920; y += STEP()) c.fillText(String(y), cx(y), ch - 18);
    catchBase = document.createElement('canvas'); catchBase.width = k.width; catchBase.height = k.height; catchBase.getContext('2d').drawImage(k, 0, 0);
    ui.cx = cx;
  }
  function drawCatchHover() {
    if (!catchBase) return;
    const k = ui.catch, c = k.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.width, k.height); c.drawImage(catchBase, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (hoverYear >= 0) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(ui.cx(hoverYear + .5), 6, 1, ch - 30); }
  }
  function onCatchMove(e) {
    const r = ui.catch.getBoundingClientRect(), mx = e.clientX - r.left;
    const y = Math.round(ui.cx.invert(mx)); if (y < Y0 || y > Y1) return;
    hoverYear = y; drawCatchHover();
    const i = y - Y0, S = catchSeries;
    X.tip(`<b>${y}</b><small>${X.fmt(S.n[i])} voyages came home with a recorded catch</small><small>${X.fmt(S.sperm[i])} barrels of sperm oil</small><small>${X.fmt(S.oil[i])} barrels of whale oil</small><small>${X.fmt(S.bone[i])} pounds of whalebone</small>`, e.clientX, e.clientY);
  }

  // ---------- the French fleet ----------
  function frText() {
    const F = W.fr, pc = new Map();
    for (const f of F) if (f[1]) pc.set(f[1], (pc.get(f[1]) || 0) + 1);
    const top = [...pc.entries()].sort((a, b) => b[1] - a[1]);
    const dec = new Map(); for (const f of F) if (f[2] >= 0) { const d = Math.floor(X.yearOf(f[2]) / 10) * 10; dec.set(d, (dec.get(d) || 0) + 1); }
    const best = [...dec.entries()].sort((a, b) => b[1] - a[1])[0];
    const am = new Map(); for (const r of V) if (r[6]) { const d = Math.floor(r[6] / 10) * 10; am.set(d, (am.get(d) || 0) + 1); }
    const amBest = [...am.entries()].sort((a, b) => b[1] - a[1])[0];
    const ys = F.filter(f => f[2] >= 0).map(f => X.yearOf(f[2]));
    ui.frLine.innerHTML = `${X.fmt(F.length)} French whaling voyages, ${Math.min(...ys)} to ${Math.max(...ys)}, from Les Baleiniers Fran\u00E7ais. Most sailed from <b>${X.esc(top[0][0])}</b> (${X.fmt(top[0][1])}) and <b>${X.esc(top[1][0])}</b> (${X.fmt(top[1][1])}). The busiest decade was the <b>${best[0]}s</b>, with ${X.fmt(best[1])} sailings. The American fleet\u2019s was the ${amBest[0]}s, with ${X.fmt(amBest[1])}.`;
  }
  const FR_PORT_HEX = ['#8ec9ff', '#ff7d8c', '#ffb44f', '#56d6c2', '#c7a2ff'];
  let frPorts = [];
  function drawFr() {
    if (!frw) return;
    const F = W.fr, k = ui.fr, c = k.getContext('2d'), NL = W.meta.frLanes;
    const lh = frw < 700 ? 2 : 2.4;
    frh = NL * lh + 40;
    k.width = frw * dpr; k.height = frh * dpr; k.style.height = frh + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, frw, frh);
    frX = d3.scaleLinear().domain([Y0, Y1]).range([6, frw - 6]);
    const pc = new Map(); for (const f of F) if (f[1]) pc.set(f[1], (pc.get(f[1]) || 0) + 1);
    frPorts = [...pc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
    const bottom = frh - 24;
    c.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
    for (let y = 1680; y <= 1920; y += STEP()) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(frX(y), 8, 1, bottom - 8); c.fillStyle = 'rgba(169,176,192,.75)'; c.fillText(String(y), frX(y), bottom + 6); }
    F.forEach((f, i) => {
      if (f[2] < 0 || f[11] < 0) return;
      const x0 = frX(yf(f[2])), open = f[3] < 0, x1 = open ? frX(yf(f[2] + OPEN)) : Math.max(x0 + .8, frX(yf(f[3])));
      const pi = frPorts.indexOf(f[1]), col = pi >= 0 ? FR_PORT_HEX[pi] : 'rgba(150,156,170,.6)';
      c.globalAlpha = open ? .45 : .95; c.fillStyle = col;
      c.fillRect(x0, bottom - (f[11] + 1) * lh, x1 - x0, lh * .8);
      f.box = [x0, x1, bottom - (f[11] + 1) * lh];
    });
    c.globalAlpha = 1;
    // a small key, in the empty years after the French fleet stops
    c.font = '500 11.5px "Schibsted Grotesk", system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    let ky = 16;
    [...frPorts, 'Other ports'].forEach((p, i) => {
      const hex = i < frPorts.length ? FR_PORT_HEX[i] : 'rgba(150,156,170,.6)';
      c.fillStyle = hex; c.beginPath(); c.arc(frX(1880), ky, 3.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(214,220,232,.85)'; c.fillText(p, frX(1880) + 10, ky); ky += 17;
    });
    frBase = document.createElement('canvas'); frBase.width = k.width; frBase.height = k.height; frBase.getContext('2d').drawImage(k, 0, 0);
  }
  function drawFrHover() {
    if (!frBase) return;
    const k = ui.fr, c = k.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.width, k.height); c.drawImage(frBase, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (frHover >= 0) { const b = W.fr[frHover].box; c.fillStyle = '#fff'; c.fillRect(b[0], b[2] - 1, b[1] - b[0], 4); }
  }
  function onFrMove(e) {
    const r = ui.fr.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 4;
    W.fr.forEach((f, i) => { if (!f.box) return; const [x0, x1, y] = f.box; const dx = mx < x0 ? x0 - mx : mx > x1 ? mx - x1 : 0, dy = Math.abs(my - y - 1); const d = dx + dy; if (d < bd) { bd = d; best = i; } });
    if (best !== frHover) { frHover = best; drawFrHover(); }
    if (best < 0) { X.tip(null); return; }
    const f = W.fr[best];
    const when = `${X.fullDate(f[2])}${f[3] >= 0 ? ' to ' + X.fullDate(f[3]) : ', return not recorded'}`;
    const bits = []; if (f[5]) bits.push(`${X.fmt(f[5])} barrels of sperm oil`); if (f[6]) bits.push(`${X.fmt(f[6])} barrels of whale oil`); if (f[7]) bits.push(`${X.fmt(f[7])} pounds of whalebone`);
    X.tip(`<b>${X.esc(f[0])}</b><small>${X.esc(f[1] || 'Port not recorded')}${f[4] ? ' \u00B7 bound for ' + X.esc(f[4]) : ''}</small><small>${when}</small>${f[8] ? `<small>Captain ${X.esc(f[8])}</small>` : ''}${bits.length ? `<em>Brought home ${bits.join(', ')}</em>` : ''}${f[9] ? `<em>${X.esc(f[9])}</em>` : ''}`, e.clientX, e.clientY);
  }

  // ---------- layout ----------
  const inner = elx => { const cs = getComputedStyle(elx); return elx.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    fw = Math.round(inner(ui.chart.parentNode)); fh = Math.round(ui.chart.parentNode.clientHeight);
    ui.chart.style.width = fw + 'px'; ui.chart.style.height = fh + 'px';
    ew = Math.round(inner(ui.ends.parentNode)); ui.ends.style.width = ew + 'px';
    cw = Math.round(inner(ui.catch.parentNode)); ui.catch.style.width = cw + 'px';
    frw = Math.round(inner(ui.fr.parentNode)); ui.fr.style.width = frw + 'px';
    drawChart(); drawEnds(); drawCatch(); drawCatchHover(); drawFr(); drawFrHover();
  }

  function show() { visible = true; layout(); }
  function hide() { visible = false; X.tip(null); }
  X.views.fleet = { init, show, hide };
})();
