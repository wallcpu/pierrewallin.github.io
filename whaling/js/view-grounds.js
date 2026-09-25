/* The Whale Road: The Grounds.
   Every noon position in the logbooks replays over the oceans, ship by ship, and burns into a long exposure
   of where the hunting was. Each whale struck flashes in the colour of its kind, with a spout and a low note. */
(function () {
  'use strict';
  const X = window.WX, W = X.W;
  const DUR = 240;                      // seconds for the whole replay at 1x
  const SPEEDS = [1, 2, 4, 0.5];
  const WAKE = 42;                      // days of wake behind each ship
  const LABELS = [
    [-70.93, 41.64, 'New Bedford', 'port'], [-157.86, 21.31, 'Honolulu', 'port'], [-140.1, -8.9, 'Nuku Hiva', 'port'],
    [-122.42, 37.77, 'San Francisco', 'port'], [-67.3, -55.98, 'Cape Horn', 'port'], [18.47, -34.36, 'Cape of Good Hope', 'port'],
    [-28.6, 40.2, 'Western Islands', 'ground'], [-34, -27, 'Brazil Banks', 'ground'], [-116, -6, 'Offshore Ground', 'ground'],
    [156, 34, 'Japan Ground', 'ground'], [147, 55.5, 'Okhotsk', 'ground'], [-147, 51.5, 'Northwest Coast', 'ground'],
    [-163, 72.2, 'Western Arctic', 'ground'], [-86, 59.5, 'Hudson Bay', 'ground'], [-58, 68.5, 'Davis Strait', 'ground'],
    [69.5, -46.6, 'Desolation', 'ground'], [-168.5, 66.6, 'Bering Strait', 'place'],
  ];

  let el, cv, c, baseCv, bc, labCv, lc, expCv, ec, expImg, strikeCv, sc, dpr = 1, VW = 0, VH = 0;
  let K = 1, TX = 0, TY = 0, gain = 1;             // projection scale and translate (css px), exposure gain
  let px, py, ok, still;                           // projected entry positions, and how much each noon counts
  let grid = null, lut = null, expW = 0, expH = 0, expDirty = false;
  let ord = null, cur = 0;                         // entries in day order, and the replay cursor
  let T0 = 0, T1 = 0, t = 0, wall = 0, playing = false, started = false, ended = false, speedI = 0, sound = true, exposure = true;
  let spFilter = 0, wivesOnly = false, raf = 0, last = 0, lastSound = 0, msI = 0, msUntil = 0;
  let ptr = null, fx = [], ui = {}, hover = -1, hoverLi = -1, bucket = null, bucketT = -1;
  let months = 0, cum = null, scaleW = 1, allSea = null, logSea = null, strM = null, strMax = 1, seaMax = 1, MS = [];
  let land = null, sprites = [], built = false, visible = false;
  const rad = Math.PI / 180, raw = d3.geoEqualEarthRaw;

  // ---------- projection: Equal Earth centred on the Pacific, cut at 30E ----------
  function project(lon, lat) {
    let l = lon + 150; l = ((l + 540) % 360) - 180;
    const p = raw(l * rad, lat * rad);
    return [TX + K * p[0], TY - K * p[1]];
  }
  const seamLon = lon => { let l = lon + 150; return ((l + 540) % 360) - 180; };

  // ---------- build: data, layout, canvases ----------
  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="g-stage">
        <div class="g-map"><canvas class="g-canvas" aria-label="Map of the world's oceans with whaling ships' noon positions appearing over time"></canvas></div>
        <div class="g-read" aria-live="off">
          <div class="g-year">1784 to 1920</div>
          <div class="g-month">One long exposure</div>
          <div class="g-count"></div>
          <div class="g-legend"><b>Each point of light is a ship at noon,</b> where its log put it. Colored light is whales struck, in the color of their kind.</div>
        </div>
        <div class="g-start">
          <button class="g-play" aria-label="Play 136 years"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg></button>
          <b>Watch 136 years</b><small>About four minutes, sound on</small>
          <button class="quiet">or watch without sound</button>
        </div>
        <div class="g-end"><b>Every noon, for 136 years.</b><span>Colored light is where whales were struck. Hover a track for the ship, click to follow its voyage.</span></div>
        <div class="g-load">Unrolling 1,436 logbooks</div>
        <div class="g-dock">
          <p class="g-ms" aria-live="polite"></p>
          <div class="g-strip"><canvas></canvas></div>
          <div class="g-ctls">
            <button class="ctl" data-c="play" aria-label="Play or pause"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play</span></button>
            <button class="ctl" data-c="speed">1&times;</button>
            <button class="ctl" data-c="sound" aria-pressed="true">Sound on</button>
            <button class="ctl" data-c="exposure" aria-pressed="true">Long exposure</button>
            <button class="ctl" data-c="restart">From 1784</button>
            <span class="g-sep"></span>
            <span class="lbl">Whales</span>
            <button class="chip-btn" data-f="0" aria-pressed="true">All kinds</button>
            ${[1, 2, 3, 4, 5].map(s => `<button class="chip-btn" data-f="${s}" aria-pressed="false"><i style="background:${X.SP_HEX[s]}"></i>${X.SP_SHORT[s]}</button>`).join('')}
            <span class="g-sep"></span>
            <button class="chip-btn" data-w="1" aria-pressed="false">Captain's wife aboard</button>
          </div>
        </div>
      </div>`;
    cv = el.querySelector('.g-canvas'); c = cv.getContext('2d');
    baseCv = document.createElement('canvas'); bc = baseCv.getContext('2d');
    labCv = document.createElement('canvas'); lc = labCv.getContext('2d');
    expCv = document.createElement('canvas'); ec = expCv.getContext('2d');
    strikeCv = document.createElement('canvas'); sc = strikeCv.getContext('2d');
    ui = {
      year: el.querySelector('.g-year'), month: el.querySelector('.g-month'), count: el.querySelector('.g-count'), ms: el.querySelector('.g-ms'),
      start: el.querySelector('.g-start'), end: el.querySelector('.g-end'), load: el.querySelector('.g-load'),
      stripCv: el.querySelector('.g-strip canvas'), play: el.querySelector('[data-c=play]'), speed: el.querySelector('[data-c=speed]'),
      sound: el.querySelector('[data-c=sound]'), exposure: el.querySelector('[data-c=exposure]'),
    };
    ui.sc = ui.stripCv.getContext('2d');
    ui.start.querySelector('.g-play').addEventListener('click', () => begin(true));
    ui.start.querySelector('.quiet').addEventListener('click', () => begin(false));
    el.querySelector('.g-ctls').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !built) return;
      if (b.dataset.f !== undefined) { spFilter = +b.dataset.f; el.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.f === spFilter))); rebuild(); frame(); return; }
      if (b.dataset.w !== undefined) { wivesOnly = !wivesOnly; b.setAttribute('aria-pressed', String(wivesOnly)); rebuild(); frame(); readout(true); return; }
      const a = b.dataset.c;
      if (a === 'play') { if (!started) begin(sound); else if (playing) pause(); else play(); }
      if (a === 'speed') { speedI = (speedI + 1) % SPEEDS.length; b.textContent = SPEEDS[speedI] === .5 ? '\u00BD\u00D7' : SPEEDS[speedI] + '\u00D7'; }
      if (a === 'sound') { sound = !sound; b.setAttribute('aria-pressed', String(sound)); b.textContent = sound ? 'Sound on' : 'Sound off'; if (sound) X.audio(); }
      if (a === 'exposure') { exposure = !exposure; b.setAttribute('aria-pressed', String(exposure)); frame(); }
      if (a === 'restart') begin(sound);
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') onMove(e); });
    cv.addEventListener('pointerleave', () => { hover = -1; hoverLi = -1; X.tip(null); if (!playing) frame(); });
    cv.addEventListener('click', onClick);
    stripEvents();
    document.addEventListener('keydown', onKey);
    new ResizeObserver(() => { if (built && visible) { resize(); } }).observe(cv);
    new ResizeObserver(() => { if (built && visible) stripFit(); }).observe(el.querySelector('.g-strip'));

    Promise.all([X.loadLogs(), X.land()]).then(([, ln]) => {
      land = ln; setup(); built = true; ui.load.classList.add('gone');
      resize();
      const mp = el.querySelector('.g-map'); if (mp.scrollWidth > mp.clientWidth) mp.scrollLeft = (mp.scrollWidth - mp.clientWidth) * .45;
      seek(T1, true); frame(); readout(true);
      const p = pending; pending = null;
      if (visible) show(p || {});
    }).catch(err => { ui.load.textContent = 'The logbooks did not load. ' + (err && err.message ? err.message : ''); });
  }

  // ---------- one-time data work ----------
  function setup() {
    const L = X.L, N = L.N;
    T0 = L.day[0]; T1 = L.day[0];
    for (let j = 0; j < N; j++) { const d = L.day[j]; if (d < T0) T0 = d; if (d > T1) T1 = d; }
    // entries in day order (counting sort)
    const span = T1 - T0 + 1, cnt = new Uint32Array(span + 1);
    for (let j = 0; j < N; j++) cnt[L.day[j] - T0 + 1]++;
    for (let d = 1; d <= span; d++) cnt[d] += cnt[d - 1];
    ord = new Uint32Array(N);
    const fill = cnt.slice(0, span);
    for (let j = 0; j < N; j++) ord[fill[L.day[j] - T0]++] = j;
    ptr = new Int32Array(X.NL).fill(-1);
    px = new Float32Array(N); py = new Float32Array(N); ok = new Uint8Array(N);
    // a ship lying at anchor logs the same spot for weeks: those noons count for less in the exposure
    still = new Float32Array(N).fill(1);
    for (const r of X.LOGS) for (let j = r[1] + 1; j < r[1] + r[2]; j++) {
      if (Math.abs(L.lat[j] - L.lat[j - 1]) < .25 && Math.abs(L.lon[j] - L.lon[j - 1]) < .25) still[j] = .18;
    }

    // monthly series for the strip and the time warp
    months = Math.ceil((T1 - T0) / 30.4375) + 1;
    const mOf = d => Math.max(0, Math.min(months - 1, Math.floor((d - T0) / 30.4375)));
    logSea = new Float32Array(months); allSea = new Float32Array(months); strM = new Float32Array(months * 9);
    const dl = new Float32Array(months + 1), da = new Float32Array(months + 1);
    for (const r of X.LOGS) { dl[mOf(r[3])]++; dl[Math.min(months, mOf(r[4]) + 1)]--; }
    for (const r of W.v) { if (r[3] < 0 || r[4] < 0) continue; if (r[4] < T0 || r[3] > T1) continue; da[mOf(r[3])]++; da[Math.min(months, mOf(r[4]) + 1)]--; }
    let a = 0, b = 0;
    for (let m = 0; m < months; m++) { a += dl[m]; b += da[m]; logSea[m] = a; allSea[m] = b; }
    for (let j = 0; j < N; j++) if (X.enc(j) === 2) strM[mOf(L.day[j]) * 9 + X.spec(j)] += Math.max(1, L.nst[j]);
    seaMax = Math.max(...allSea);
    for (let m = 0; m < months; m++) { let s = 0; for (let k = 1; k < 9; k++) s += strM[m * 9 + k]; if (s > strMax) strMax = s; }
    cum = new Float64Array(months + 1);
    for (let m = 0; m < months; m++) cum[m + 1] = cum[m] + 0.22 + Math.pow(logSea[m], 0.62);
    scaleW = DUR / cum[months];
    buildNotes(mOf);
    const tot = X.LOGS.reduce((s, r) => s + r[7], 0);
    ui.count.innerHTML = `<b>${X.fmt(N)}</b> noons from <b>${X.fmt(X.NL)}</b> logbooks<br><b>${X.fmt(tot)}</b> whales struck`;
  }
  function wallToT(w) {
    const target = w / scaleW; let lo = 0, hi = months - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid - 1; }
    const f = (target - cum[lo]) / (cum[lo + 1] - cum[lo]);
    return Math.min(T1, T0 + (lo + Math.max(0, Math.min(1, f))) * 30.4375);
  }
  function tToWall(tt) { const x = (tt - T0) / 30.4375, m = Math.max(0, Math.min(months - 1, Math.floor(x))); return (cum[m] + Math.max(0, Math.min(1, x - m)) * (cum[m + 1] - cum[m])) * scaleW; }

  // ---------- the notes the data supports ----------
  function buildNotes(mOf) {
    const L = X.L, LG = X.LOGS;
    const logOf = id => { const i = X.byId.get(id); return i === undefined ? -1 : X.logOfVoyage(i); };
    const dayOf = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - X.EPOCH) / X.DAY);
    const add = (d, text, bell = 1) => MS.push({ t: d, text, bell });
    // the first noon
    const j0 = ord[0], v0 = LG[L.voy[j0]][0];
    add(L.day[j0], `${X.fullDate(L.day[j0])}. The ${X.vesselOf(v0)[0]}, out of ${X.shortPort(X.portOf(v0))}, logs the first noon in these records.`);
    // the Essex, from the voyages
    const essex = W.vend.find(e => W.vessels[e[0]][0] === 'Essex' && e[2] === 'whale');
    if (essex) add(dayOf(1820, 11, 20), `November 1820. A whale rams and sinks the Essex of Nantucket in the Pacific. Her story becomes the ending of Moby-Dick.`);
    // Melville on the Acushnet
    const ac = logOf('AV00209'), mel = W.meta.melville;
    if (ac >= 0 && mel) {
      const s = LG[ac][1];
      add(L.day[s], `${X.monthYear(L.day[s])}. The Acushnet of Fairhaven is off Brazil, bound for the Pacific. One of her greenhands, on a 1/175 share, is Herman Melville.`);
      // the gap in the log at the Marquesas
      let gj = -1;
      for (let j = s; j < s + LG[ac][2] - 1; j++) if (L.day[j + 1] - L.day[j] > 14 && L.lat[j] < -7 && L.lat[j] > -11 && L.lon[j] < -138 && L.lon[j] > -142) { gj = j; break; }
      if (gj >= 0) add(L.day[gj], `${X.fullDate(L.day[gj])}. The Acushnet anchors at Nuku Hiva. Melville deserts on July 9, and the log is silent for ${L.day[gj + 1] - L.day[gj]} days. He turns it into his first book, Typee.`);
    }
    // bowheads
    let bj = -1;
    for (let k = 0; k < ord.length; k++) { const j = ord[k]; if (X.enc(j) === 2 && X.spec(j) === 3) { bj = j; break; } }
    const dec = (y0, s) => { let n = 0; for (let m = mOf(dayOf(y0, 1, 1)); m <= mOf(dayOf(y0 + 9, 12, 31)); m++) n += strM[m * 9 + s]; return n; };
    if (bj >= 0) add(L.day[bj], `${X.monthYear(L.day[bj])}. The ${X.vesselOf(LG[L.voy[bj]][0])[0]} strikes the first bowhead in these logs. By the 1850s only sperm whales are struck more often.`);
    // the peak: most ships at sea on an average day
    const sea = X.atSea();
    add(dayOf(sea.peakYear, 1, 1), `${sea.peakYear}. On an average day ${X.fmt(sea.peak)} American whaleships are at sea, the most there will ever be.`);
    // right whales
    add(dayOf(1850, 1, 1), `The logs record ${X.fmt(dec(1840, 2))} right whales struck in the 1840s. In the 1850s, ${X.fmt(dec(1850, 2))}.`);
    // the Arctic
    let aj = -1;
    for (let k = 0; k < ord.length; k++) { const j = ord[k]; if (L.lat[j] > 65.8 && (L.lon[j] < -155 || L.lon[j] > 165)) { aj = j; break; } }
    if (aj >= 0) add(L.day[aj], `${X.fullDate(L.day[aj])}. The ${X.vesselOf(LG[L.voy[aj]][0])[0]} is the first ship in these logs north of the Bering Strait.`);
    // Acushnet stove
    add(dayOf(1847, 6, 1), `1847. A whale stoves in the Acushnet, Melville's old ship. She survives it, and is lost in 1851.`);
    add(dayOf(1859, 8, 27), `August 27, 1859. Oil is struck at Titusville, Pennsylvania.`);
    const stone = W.vend.filter(e => e[2] === 'stone').length;
    add(dayOf(1861, 12, 19), `December 1861. The Union Navy buys old whaleships, loads them with stone and sinks them to block Charleston harbor. These records name ${stone}. Melville writes a poem about them, The Stone Fleet.`);
    const juneShen = W.vend.filter(e => e[2] === 'shen' && /Jun[e]?\s*2\d,\s*1865|June 2\d, 1865/.test(W.vessels[e[0]][5])).length;
    add(dayOf(1865, 6, 22), `June 1865. Two months after Appomattox, the Confederate raider Shenandoah burns at least ${juneShen} whaleships in the Bering Sea and Strait in a single week.`, 2);
    const ice71 = W.vend.filter(e => e[2] === 'ice' && e[3] === 1871).length;
    add(dayOf(1871, 9, 14), `September 14, 1871. Trapped by ice off Point Belcher, Alaska, the Arctic fleet is abandoned and its crews escape south in whaleboats. The records list ${ice71} whaleships lost in the ice that year.`, 2);
    const jl = ord[ord.length - 1], vl = LG[L.voy[jl]][0];
    add(L.day[jl] - 40, `${X.fullDate(L.day[jl])}. The last noon in the logs, from the ${X.vesselOf(vl)[0]}. She is still afloat, at Mystic Seaport.`);
    MS.sort((a, b) => a.t - b.t);
  }

  // ---------- canvases ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    const ndpr = Math.min(devicePixelRatio || 1, 2);
    const nw = Math.max(320, Math.round(r.width)), nh = Math.max(240, Math.round(r.height));
    if (nw === VW && nh === VH && ndpr === dpr && grid) { stripFit(); return; }
    dpr = ndpr; VW = nw; VH = nh;
    for (const k of [cv, baseCv, labCv, strikeCv]) { k.width = Math.round(VW * dpr); k.height = Math.round(VH * dpr); }
    const dockEl = el.querySelector('.g-dock');
    const overlay = getComputedStyle(dockEl).position === 'absolute';
    const dock = overlay ? (dockEl.getBoundingClientRect().height || 110) : 0;
    const narrow = VW < 760;
    // fit the whole sphere across, then place 78N at the top and keep 62S clear of the dock
    const pad = narrow ? 8 : 24;
    const p = d3.geoEqualEarth().rotate([150, 0]).fitWidth(VW - pad * 2, { type: 'Sphere' });
    K = p.scale();
    const yN = raw(0, 78 * rad)[1], yS = raw(0, -62 * rad)[1];
    const top = narrow ? 8 : 30, avail = VH - dock - top - (overlay ? 10 : 8);
    if (K * (yN - yS) > avail) K = avail / (yN - yS);
    TX = VW / 2; TY = top + K * yN;
    // the same noons land on fewer pixels on a smaller map: count each for less so the exposure keeps its range
    gain = Math.min(1.15, Math.pow(K / 257, 2));
    // projected positions of every noon
    const L = X.L;
    for (let j = 0; j < L.N; j++) {
      const q = project(L.lon[j], L.lat[j]); px[j] = q[0]; py[j] = q[1]; ok[j] = 1;
    }
    drawBase();
    expW = VW; expH = VH; expCv.width = expW; expCv.height = expH;
    grid = new Float32Array(expW * expH);
    expImg = ec.createImageData(expW, expH);
    const dd = expImg.data; for (let k = 0; k < dd.length; k += 4) { dd[k] = 246; dd[k + 1] = 240; dd[k + 2] = 226; dd[k + 3] = 0; }
    if (!lut) { lut = new Uint8ClampedArray(4096); for (let i = 0; i < 4096; i++) { const v = i / 16; lut[i] = 255 * Math.pow(1 - Math.exp(-v / 26), 0.72); } }
    sprites = X.SP_HEX.map(h => sprite(h));
    bucketT = -1;
    rebuild();
    drawStrip();
    frame();
  }
  function sprite(hex) {
    const S = Math.ceil(11 * dpr), k = document.createElement('canvas'); k.width = k.height = S;
    const g = k.getContext('2d'), rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    const col = d3.rgb(hex);
    rg.addColorStop(0, `rgba(${col.r},${col.g},${col.b},.2)`); rg.addColorStop(.3, `rgba(${col.r},${col.g},${col.b},.07)`); rg.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    return k;
  }
  function drawBase() {
    const path = d3.geoPath(d3.geoEqualEarth().rotate([150, 0]).scale(K).translate([TX, TY]), bc);
    bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, baseCv.width, baseCv.height); bc.setTransform(dpr, 0, 0, dpr, 0, 0);
    bc.beginPath(); path(land); bc.fillStyle = '#0c0e13'; bc.fill();
    bc.lineWidth = .6; bc.strokeStyle = 'rgba(255,255,255,.13)'; bc.stroke();
    // labels, drawn on their own layer so the exposure never covers them
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, labCv.width, labCv.height); lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const small = VW < 760;
    for (const [lon, lat, text, kind] of LABELS) {
      if (small && kind !== 'ground') continue;
      const [x, y] = project(lon, lat);
      lc.font = kind === 'ground' ? `italic 500 ${small ? 9.5 : 11}px "Schibsted Grotesk", system-ui, sans-serif` : `500 ${small ? 9.5 : 11}px "Schibsted Grotesk", system-ui, sans-serif`;
      lc.textAlign = kind === 'port' ? 'left' : 'center'; lc.textBaseline = 'middle';
      lc.lineJoin = 'round'; lc.lineWidth = 3.2; lc.strokeStyle = 'rgba(0,0,0,.82)';
      const tx = kind === 'port' ? x + 5 : x, ty = kind === 'port' ? y - 1 : y;
      lc.strokeText(text, tx, ty);
      lc.fillStyle = kind === 'ground' ? 'rgba(214,220,232,.62)' : 'rgba(214,220,232,.72)';
      if (kind === 'port') { lc.beginPath(); lc.arc(x, y, 1.6, 0, Math.PI * 2); lc.fill(); }
      lc.fillText(text, tx, ty);
    }
  }

  // ---------- the long exposure ----------
  const visibleLog = li => !wivesOnly || !!W.v[X.LOGS[li][0]][14];
  function splat(j) {
    const x = px[j], y = py[j];
    const ix = x | 0, iy = y | 0;
    if (ix < 1 || iy < 1 || ix >= expW - 1 || iy >= expH - 1) return;
    const k = iy * expW + ix, d = expImg.data, w = still[j] * gain;
    const put = (kk, a) => { const v = grid[kk] += a * w; d[kk * 4 + 3] = lut[Math.min(4095, (v * 16) | 0)]; };
    put(k, 1); put(k - 1, .34); put(k + 1, .34); put(k - expW, .34); put(k + expW, .34);
    put(k - expW - 1, .12); put(k - expW + 1, .12); put(k + expW - 1, .12); put(k + expW + 1, .12);
    expDirty = true;
  }
  function strikeMark(j) {
    const s = X.spec(j); if (spFilter && s !== spFilter) return;
    const S = sprites[s], n = Math.min(3, Math.max(1, X.L.nst[j]));
    sc.globalCompositeOperation = 'lighter'; sc.globalAlpha = Math.max(.3, gain);
    for (let q = 0; q < n; q++) sc.drawImage(S, px[j] * dpr - S.width / 2, py[j] * dpr - S.width / 2);
    sc.globalAlpha = 1;
  }
  function rebuild() {
    // clear the exposure and replay everything up to t without sound
    if (!grid) return;
    grid.fill(0);
    const d = expImg.data; for (let k = 3; k < d.length; k += 4) d[k] = 0;
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, strikeCv.width, strikeCv.height);
    const L = X.L;
    cur = 0;
    while (cur < ord.length && L.day[ord[cur]] <= t) {
      const j = ord[cur++];
      if (!visibleLog(L.voy[j])) continue;
      splat(j); if (X.enc(j) === 2) strikeMark(j);
    }
    ptr.fill(-1);
    expDirty = true; bucketT = -1;
  }
  function advance(t1, live) {
    const L = X.L; let struck = 0;
    while (cur < ord.length && L.day[ord[cur]] <= t1) {
      const j = ord[cur++];
      if (!visibleLog(L.voy[j])) continue;
      splat(j);
      if (X.enc(j) === 2) {
        strikeMark(j);
        if (live && (!spFilter || X.spec(j) === spFilter)) {
          fx.push({ j, born: wall, s: X.spec(j) });
          struck++;
          const now = performance.now();
          if (sound && now - lastSound > 110 && Math.random() < .55) { lastSound = now; X.strike(X.spec(j), (px[j] / VW) * 1.6 - .8, .16 + Math.random() * .1); }
        }
      }
    }
    if (fx.length > 260) fx.splice(0, fx.length - 260);
    return struck;
  }
  function seek(tt, silent) {
    const back = tt < t;
    t = Math.max(T0, Math.min(T1, tt)); wall = tToWall(t);
    if (back) rebuild(); else advance(t, false);
    if (silent) fx = [];
    msI = 0; while (msI < MS.length && MS[msI].t <= t) msI++;
    ui.ms.classList.remove('show'); msUntil = 0;
  }

  // ---------- one frame ----------
  function frame() {
    if (!built) return;
    const L = X.L;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(baseCv, 0, 0);
    if (exposure) {
      if (expDirty) { ec.putImageData(expImg, 0, 0); expDirty = false; }
      c.globalAlpha = ended || !started ? .95 : .78;
      c.imageSmoothingEnabled = true; c.drawImage(expCv, 0, 0, expW, expH, 0, 0, cv.width, cv.height);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter'; c.drawImage(strikeCv, 0, 0); c.globalCompositeOperation = 'source-over';
    }
    c.drawImage(labCv, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (started && !ended) drawShips();
    drawFx();
    if (hover >= 0) {
      c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.arc(px[hover], py[hover], 6, 0, Math.PI * 2); c.stroke();
      if (hoverLi >= 0 && (!started || ended || !playing)) drawTrack(hoverLi, 'rgba(255,255,255,.75)', 1.1);
    }
    drawStripHead();
  }
  function drawTrack(li, style, w) {
    const L = X.L, [, s, n] = X.LOGS[li];
    c.strokeStyle = style; c.lineWidth = w; c.beginPath();
    let pen = false;
    for (let j = s; j < s + n; j++) {
      if (j > s && brk(j - 1, j)) pen = false;
      if (!pen) { c.moveTo(px[j], py[j]); pen = true; } else c.lineTo(px[j], py[j]);
    }
    c.stroke();
  }
  const brk = (a, b) => {
    const L = X.L;
    if (L.day[b] - L.day[a] > 20) return true;
    if (Math.abs(seamLon(L.lon[b]) - seamLon(L.lon[a])) > 90) return true;
    const dx = px[b] - px[a], dy = py[b] - py[a];
    return dx * dx + dy * dy > 90 * 90;
  };
  function drawShips() {
    const L = X.L, LG = X.LOGS;
    c.lineCap = 'round';
    for (let li = 0; li < LG.length; li++) {
      const r = LG[li];
      if (r[3] > t || r[4] + 18 < t || !visibleLog(li)) { ptr[li] = -1; continue; }
      let p = ptr[li];
      const s = r[1], e = r[1] + r[2] - 1;
      if (p < s || p > e || L.day[p] > t) p = X.entryAt(li, t);
      else while (p < e && L.day[p + 1] <= t) p++;
      ptr[li] = p;
      if (p < 0) continue;
      const ended_ = L.day[e] < t;
      const fade = ended_ ? Math.max(0, 1 - (t - L.day[e]) / 18) : 1;
      // wake
      let q = p, prevX = null, prevY = null;
      c.lineWidth = 1;
      while (q > s && L.day[q - 1] > t - WAKE) {
        if (!brk(q - 1, q)) {
          const age = (t - L.day[q - 1]) / WAKE;
          c.strokeStyle = `rgba(246,240,226,${(.46 * (1 - age) * fade).toFixed(3)})`;
          c.beginPath(); c.moveTo(px[q - 1], py[q - 1]); c.lineTo(px[q], py[q]); c.stroke();
        }
        q--;
      }
      // head, between this noon and the next
      let hx = px[p], hy = py[p];
      if (p < e && !brk(p, p + 1)) {
        const f = Math.max(0, Math.min(1, (t - L.day[p]) / (L.day[p + 1] - L.day[p])));
        hx += (px[p + 1] - hx) * f; hy += (py[p + 1] - hy) * f;
      } else if (t - L.day[p] > 12 && !ended_) continue;
      c.fillStyle = `rgba(255,252,244,${(.2 * fade).toFixed(3)})`;
      c.beginPath(); c.arc(hx, hy, 4.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(255,252,244,${(.95 * fade).toFixed(3)})`;
      c.beginPath(); c.arc(hx, hy, 2, 0, Math.PI * 2); c.fill();
      if (li === hoverLi) { c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.arc(hx, hy, 6, 0, Math.PI * 2); c.stroke(); }
    }
  }
  function drawFx() {
    const keep = [];
    for (const f of fx) {
      const age = (wall - f.born) / (1.9 * SPEEDS[speedI]);
      if (age > 1 || age < 0) continue;
      keep.push(f);
      const x = px[f.j], y = py[f.j], hex = X.SP_HEX[f.s], col = d3.rgb(hex);
      c.strokeStyle = `rgba(${col.r},${col.g},${col.b},${(.9 * (1 - age)).toFixed(3)})`;
      c.lineWidth = 1.3;
      c.beginPath(); c.arc(x, y, 2 + age * 13, 0, Math.PI * 2); c.stroke();
      // the spout: a short plume rising and thinning
      const h = 4 + age * 10;
      c.strokeStyle = `rgba(255,255,255,${(.7 * (1 - age) * (1 - age)).toFixed(3)})`;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y - 2); c.quadraticCurveTo(x - 2, y - h * .6, x - 3, y - h); c.moveTo(x, y - 2); c.quadraticCurveTo(x + 2, y - h * .6, x + 3, y - h); c.stroke();
    }
    fx = keep;
  }

  // ---------- the strip: ships at sea, and what they struck ----------
  function drawStrip() {
    const k = ui.stripCv, r = k.parentNode.getBoundingClientRect();
    const w = Math.max(200, Math.round(r.width)), h = Math.round(r.height) || 54;
    k.width = w * dpr; k.height = h * dpr; k.style.width = w + 'px'; k.style.height = h + 'px';
    ui.sw = w; ui.sh = h; ui.sdpr = dpr;
    stripBase = document.createElement('canvas'); stripBase.width = k.width; stripBase.height = k.height;
    const g = stripBase.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const labH = 14, band = 10, topH = h - labH - band - 4;
    const xOf = m => (m / (months - 1)) * w;
    // every voyage at sea, faint; the logbooks, brighter
    g.fillStyle = 'rgba(214,220,232,.2)';
    g.beginPath(); g.moveTo(0, topH);
    for (let m = 0; m < months; m++) g.lineTo(xOf(m), topH - (allSea[m] / seaMax) * (topH - 6));
    g.lineTo(w, topH); g.closePath(); g.fill();
    g.fillStyle = 'rgba(246,240,226,.7)';
    g.beginPath(); g.moveTo(0, topH);
    for (let m = 0; m < months; m++) g.lineTo(xOf(m), topH - (logSea[m] / seaMax) * (topH - 6));
    g.lineTo(w, topH); g.closePath(); g.fill();
    // whales struck, by kind, smoothed over a year
    const yb = topH + 2;
    for (let m = 0; m < months; m += 3) {
      let tot = 0; const sums = new Float32Array(9);
      for (let q = Math.max(0, m - 6); q < Math.min(months, m + 6); q++) for (let s = 1; s < 9; s++) { sums[s] += strM[q * 9 + s]; }
      for (let s = 1; s < 9; s++) tot += sums[s];
      if (!tot) continue;
      const hh = band;
      let y = yb;
      for (const s of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const part = hh * sums[s] / tot; if (part <= 0) continue;
        g.fillStyle = X.SP_HEX[s]; g.globalAlpha = s === 8 ? .35 : .85;
        g.fillRect(xOf(m), y, Math.max(1, xOf(3) - .5), part); y += part;
      }
      g.globalAlpha = 1;
    }
    // decades
    g.font = '500 10.5px "Schibsted Grotesk", system-ui, sans-serif'; g.fillStyle = 'rgba(169,176,192,.7)'; g.textBaseline = 'top';
    const y0 = X.yearOf(T0), y1 = X.yearOf(T1);
    for (let y = Math.ceil(y0 / 20) * 20; y <= y1; y += 20) {
      const m = (Math.round((Date.UTC(y, 0, 1) - X.EPOCH) / X.DAY) - T0) / 30.4375, x = xOf(m);
      g.fillRect(x, topH - 3, 1, 3); g.textAlign = x < 20 ? 'left' : x > w - 20 ? 'right' : 'center'; g.fillText(String(y), x, yb + band + 3);
    }
    ui.topH = topH;
  }
  let stripBase = null, stripDrag = false;
  // the strip follows its own box, which can change width while the map canvas does not (the narrow layout)
  function stripFit() {
    const w = Math.max(200, Math.round(ui.stripCv.parentNode.getBoundingClientRect().width));
    if (!stripBase || w !== ui.sw || ui.sdpr !== dpr) { drawStrip(); drawStripHead(); }
  }
  function drawStripHead() {
    if (!stripBase) return;
    const k = ui.stripCv, g = ui.sc;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, k.width, k.height); g.drawImage(stripBase, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (started) {
      const x = ((t - T0) / (T1 - T0)) * ui.sw;
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, ui.sw - x, ui.topH + 1);
      g.fillStyle = '#fff'; g.fillRect(x - .5, 0, 1.5, ui.topH + 14);
    }
    for (const m of MS) {
      const x = ((m.t - T0) / (T1 - T0)) * ui.sw;
      g.fillStyle = m.t <= t && started ? '#fff1c9' : 'rgba(255,241,201,.45)'; g.beginPath(); g.arc(x, 3, 1.8, 0, Math.PI * 2); g.fill();
    }
  }
  function stripEvents() {
    const k = ui.stripCv;
    const tAt = e => { const r = k.getBoundingClientRect(); return T0 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (T1 - T0); };
    k.addEventListener('pointerdown', e => { if (!built) return; stripDrag = true; k.setPointerCapture(e.pointerId); if (!started) { started = true; ui.start.classList.add('gone'); } ended = false; ui.end.classList.remove('show'); seek(tAt(e), true); readout(true); frame(); });
    k.addEventListener('pointermove', e => {
      if (!built) return;
      const tt = tAt(e), m = Math.max(0, Math.min(months - 1, Math.floor((tt - T0) / 30.4375)));
      if (stripDrag) { seek(tt, true); readout(true); frame(); }
      let s = 0, top = 0; for (let q = 1; q < 9; q++) { s += strM[m * 9 + q]; if (strM[m * 9 + q] > strM[m * 9 + top]) top = q; }
      X.tip(`<b>${X.monthYear(Math.round(tt))}</b><small>${X.fmt(X.atSea().on(tt))} whaleships at sea, ${X.fmt(logSea[m])} of them with a log that survives</small>${s ? `<em>${X.plural(s, 'whale')} struck that month${top ? `, mostly ${X.SP_PLURAL[top]}` : ''}</em>` : ''}`, e.clientX, e.clientY);
    });
    k.addEventListener('pointerup', () => { stripDrag = false; });
    k.addEventListener('pointerleave', () => { X.tip(null); });
  }

  // ---------- readout ----------
  let lastRead = '';
  function readout(force) {
    if (!built) return;
    if (!started || ended) {
      const key = 'all' + wivesOnly;
      if (!force && lastRead === key) return; lastRead = key;
      ui.year.textContent = `${X.yearOf(T0)} to ${X.yearOf(T1)}`; ui.year.classList.add('range');
      ui.month.textContent = wivesOnly ? 'Voyages with the captain\u2019s wife aboard' : 'One long exposure';
      if (wivesOnly) {
        const n = X.LOGS.filter((r, li) => visibleLog(li)).length;
        ui.count.innerHTML = `<b>${X.fmt(n)}</b> logbooks from voyages where the captain\u2019s wife sailed too`;
      } else {
        const tot = X.LOGS.reduce((s, r) => s + r[7], 0);
        ui.count.innerHTML = `<b>${X.fmt(X.L.N)}</b> noons from <b>${X.fmt(X.NL)}</b> logbooks<br><b>${X.fmt(tot)}</b> whales struck`;
      }
      return;
    }
    const d = Math.round(t), dt = X.dateOf(d);
    const key = dt.getUTCFullYear() + '-' + dt.getUTCMonth() + wivesOnly;
    if (!force && key === lastRead) return; lastRead = key;
    ui.year.classList.remove('range');
    ui.year.textContent = dt.getUTCFullYear();
    ui.month.textContent = X.MONTHS[dt.getUTCMonth()];
    const m = Math.max(0, Math.min(months - 1, Math.floor((t - T0) / 30.4375)));
    let active = 0; for (let li = 0; li < X.NL; li++) { const r = X.LOGS[li]; if (r[3] <= t && r[4] >= t && visibleLog(li)) active++; }
    ui.count.innerHTML = `<b>${X.fmt(active)}</b> ships logging their noons<br><b>${X.fmt(X.atSea().on(t))}</b> American whaleships at sea`;
  }
  function note() {
    if (msI < MS.length && MS[msI].t <= t) {
      while (msI + 1 < MS.length && MS[msI + 1].t <= t) msI++;
      const m = MS[msI++];
      ui.ms.textContent = m.text; ui.ms.classList.add('show');
      msUntil = wall + Math.max(7, m.text.length / 16) * Math.max(1, SPEEDS[speedI]) * .9;
      if (sound) X.bells(m.bell || 1, .12);
    } else if (msUntil && wall > msUntil) { ui.ms.classList.remove('show'); msUntil = 0; }
  }

  // ---------- play ----------
  function begin(withSound) {
    if (!built) return;
    sound = withSound; ui.sound.setAttribute('aria-pressed', String(sound)); ui.sound.textContent = sound ? 'Sound on' : 'Sound off';
    if (sound) X.audio();
    started = true; ended = false; ui.start.classList.add('gone'); ui.end.classList.remove('show');
    t = T0 - 1; wall = 0; msI = 0; fx = []; rebuild(); t = T0; wall = 0;
    ui.ms.classList.remove('show');
    readout(true); play();
  }
  function play() {
    if (ended) { begin(sound); return; }
    if (sound) X.audio();
    playing = true; setPlayIcon(); last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function pause() { playing = false; setPlayIcon(); cancelAnimationFrame(raf); frame(); }
  function setPlayIcon() {
    ui.play.querySelector('span').textContent = playing ? 'Pause' : 'Play';
    ui.play.querySelector('svg').innerHTML = playing ? '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/>' : '<path d="M7 4.5v15l12.5-7.5z"/>';
  }
  function loop(now) {
    if (!playing) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    wall += dt * SPEEDS[speedI];
    const t1 = wallToT(wall);
    advance(t1, true); t = t1;
    note(); readout();
    frame();
    if (t >= T1 - .5) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }
  function finish() {
    playing = false; ended = true; setPlayIcon(); fx = [];
    ui.end.classList.add('show'); readout(true); frame();
    setTimeout(() => ui.ms.classList.remove('show'), 5000);
  }

  // ---------- hover and click ----------
  function buildBucket() {
    // a coarse grid of every visible noon up to t, for hover
    const L = X.L, CS = 8, cols = Math.ceil(VW / CS) + 1, rows = Math.ceil(VH / CS) + 1;
    const counts = new Uint32Array(cols * rows + 1);
    const lim = cur;
    for (let k = 0; k < lim; k++) { const j = ord[k]; if (!visibleLog(L.voy[j])) continue; const cx = px[j] / CS | 0, cy = py[j] / CS | 0; if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) counts[cy * cols + cx + 1]++; }
    for (let q = 1; q < counts.length; q++) counts[q] += counts[q - 1];
    const items = new Uint32Array(counts[counts.length - 1]), fill = counts.slice(0, -1);
    for (let k = 0; k < lim; k++) { const j = ord[k]; if (!visibleLog(L.voy[j])) continue; const cx = px[j] / CS | 0, cy = py[j] / CS | 0; if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) items[fill[cy * cols + cx]++] = j; }
    bucket = { CS, cols, rows, counts, items }; bucketT = t + (wivesOnly ? .5 : 0);
  }
  function nearestNoon(x, y) {
    if (!bucket || bucketT !== t + (wivesOnly ? .5 : 0)) buildBucket();
    const { CS, cols, rows, counts, items } = bucket, cx = x / CS | 0, cy = y / CS | 0;
    let best = -1, bd = 12 * 12, bestStrike = -1, bs = 12 * 12;
    for (let yy = cy - 2; yy <= cy + 2; yy++) for (let xx = cx - 2; xx <= cx + 2; xx++) {
      if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
      const q = yy * cols + xx;
      for (let k = counts[q]; k < counts[q + 1]; k++) {
        const j = items[k], dx = px[j] - x, dy = py[j] - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = j; }
        if (X.enc(j) === 2 && d2 < bs) { bs = d2; bestStrike = j; }
      }
    }
    return bestStrike >= 0 && bs < 36 ? bestStrike : best;
  }
  function nearestShip(x, y) {
    const L = X.L; let best = -1, bd = 14 * 14, bj = -1;
    for (let li = 0; li < X.NL; li++) {
      const p = ptr[li]; if (p < 0) continue;
      const dx = px[p] - x, dy = py[p] - y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = li; bj = p; }
    }
    return [best, bj];
  }
  function noonText(j) {
    const L = X.L, li = L.voy[j], vi = X.LOGS[li][0], ves = X.vesselOf(vi);
    const e = X.enc(j), s = X.spec(j), n = L.nst[j];
    let what = '';
    if (e === 2) what = n > 1 ? `Struck ${n} ${X.SP_PLURAL[s] || 'whales'}.` : `Struck ${X.SP_ONE[s] || 'a whale'}.`;
    else if (e === 1) what = `Sighted ${X.SP_PLURAL[s] || 'whales'}.`;
    else if (e === 3) what = 'Spoke another whaler.';
    const place = L.place.get(j), rem = L.remark.get(j);
    const cap = X.captain(vi);
    return `<b>${X.esc(ves[0])}</b><small>${X.esc(X.shortPort(X.portOf(vi)))}, ${X.esc(X.yearsText(vi))}${cap ? ` \u00B7 Captain ${X.esc(cap)}` : ''}</small>` +
      `<small>${X.fullDate(L.day[j])}: ${place ? 'at ' + X.esc(place) : X.latText(L.lat[j]) + ' ' + X.lonText(L.lon[j])}</small>` +
      (what ? `<em>${what}${rem ? ` \u201C${X.esc(rem)}\u201D` : ''}</em>` : (rem ? `<em>\u201C${X.esc(rem)}\u201D</em>` : '')) +
      `<em>Click to follow this voyage</em>`;
  }
  function onMove(e) {
    if (!built) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let j = -1, li = -1;
    if (started && !ended && playing) { const [l, p] = nearestShip(x, y); li = l; j = p; }
    else if (exposure || (started && !ended)) {
      if (started && !ended) { const [l, p] = nearestShip(x, y); if (l >= 0) { li = l; j = p; } }
      if (j < 0) { j = nearestNoon(x, y); li = j >= 0 ? X.L.voy[j] : -1; }
    }
    hover = j; hoverLi = li;
    cv.style.cursor = j >= 0 ? 'pointer' : 'crosshair';
    if (j >= 0) X.tip(noonText(j), e.clientX, e.clientY); else X.tip(null);
    if (!playing) frame();
  }
  function onClick() {
    if (hoverLi < 0) return;
    const vi = X.LOGS[hoverLi][0];
    if (playing) pause();
    X.tip(null);
    X.go('voyage', { voyage: W.v[vi][0], day: hover >= 0 ? X.L.day[hover] : null });
  }
  function onKey(e) {
    if (!visible || !built || e.defaultPrevented) return;
    if (e.target.closest && e.target.closest('input, textarea, .u-tabs')) return;
    if (e.code === 'Space') { e.preventDefault(); if (!started) begin(sound); else if (playing) pause(); else play(); }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && started && !playing) {
      e.preventDefault(); seek(t + (e.key === 'ArrowRight' ? 365.25 : -365.25), true); ended = false; ui.end.classList.remove('show'); readout(true); frame();
    }
  }

  // ---------- view API ----------
  let pending = null;
  function show(opts) {
    visible = true;
    if (!built) { pending = opts; return; }
    resize();
    if (opts && opts.year && !started) {
      const y = +opts.year;
      if (y >= X.yearOf(T0) && y <= X.yearOf(T1)) { started = true; ui.start.classList.add('gone'); seek(Math.round((Date.UTC(y, 6, 1) - X.EPOCH) / X.DAY), true); readout(true); frame(); }
    }
  }
  function hide() { visible = false; pending = null; if (playing) pause(); X.tip(null); }
  // for tests and screenshots: jump to a day and draw
  function debugAt(y, m, d, withShips) {
    if (!built) return false;
    started = !!withShips; ended = false; ui.start.classList.toggle('gone', !!withShips); ui.end.classList.remove('show');
    seek(Math.round((Date.UTC(y, (m || 1) - 1, d || 1) - X.EPOCH) / X.DAY), true);
    readout(true); frame(); return true;
  }
  X.views.grounds = {
    init, show, hide, debugAt,
    where: (lon, lat) => { const r = cv.getBoundingClientRect(), p = project(lon, lat); return [r.left + p[0], r.top + p[1]]; },
    state: () => ({ built, t, playing, started, ended, T0, T1, cur, fx: fx.length, MS: MS.map(m => m.text), hover, hoverLi }),
  };
})();
