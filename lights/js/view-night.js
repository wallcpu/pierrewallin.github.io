/* Night Coast: The Night.
   Every light on the world's coasts, blinking in its charted rhythm, on a map you can zoom to any harbor.
   Sector lights paint the sea in their colours and pulse when their light is lit. Listen turns the brightest lights in view into notes. */
(function () {
  'use strict';
  const X = window.LX, N = X.N;
  const PRESETS = [
    ['world', 'The whole world', null, 'World'],
    ['iroise', 'The Iroise Sea, Brittany', [-5.3, 47.75, -4.25, 48.62], 'Iroise Sea'],
    ['scheldt', 'The Scheldt, Netherlands and Belgium', [3.1, 51.2, 4.45, 51.75], 'Scheldt'],
    ['bergen', 'The coast of Bergen, Norway', [4.55, 59.9, 5.75, 60.75], 'Bergen'],
    ['prd', 'The Pearl River Delta', [113.35, 21.95, 114.45, 22.75], 'Pearl River Delta'],
    ['saimaa', 'Lake Saimaa, Finland', [27.4, 61.0, 29.4, 62.3], 'Lake Saimaa'],
    ['chesapeake', 'Chesapeake Bay', [-77.2, 36.8, -75.8, 39.6], 'Chesapeake'],
    ['nyc', 'New York Harbor', [-74.3, 40.4, -73.72, 40.9], 'New York'],
    ['singapore', 'The Singapore Strait', [103.55, 1.1, 104.25, 1.5], 'Singapore Strait'],
  ];
  const RAD = Math.PI / 180;
  let el, cv, c, dpr = 1, VW = 0, VH = 0, S = 1, T = d3.zoomIdentity, zoom = null, ui = {};
  let wx, wy, built = false, visible = false, raf = 0, sound = false, sectors = true, onlyMajor = false;
  let land50 = null, land10 = null, land10Load = false, gesturing = false;
  let landCv = null, landT = null, landAt = 0, landKey = '', cost = 8, lite = false, grid = null, landMs = 0, dotCv = null, dotCtx = null, dotImg = null, bmp = null;
  const BMW = 2048;
  const visI = new Int32Array(N), visX = new Float32Array(N), visY = new Float32Array(N); let visN = 0;
  let hover = -1, pin = -1, singers = [], singAt = 0, prevLit = new Map(), pingFx = [], preset = 'world', lastPings = [], moved = false;
  const sprites = [];

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="n-stage">
        <canvas class="n-canvas" aria-label="Map of the world's coastal lights, blinking in their charted rhythms"></canvas>
        <div class="n-read" aria-live="off">
          <div class="n-where">The whole world</div>
          <div class="n-count"></div>
          <div class="n-legend"><b>Every light flashes its charted rhythm and color.</b> The real lights keep their own time. Here each one starts at a random moment, so neighbors flash in step only by chance. Scroll or pinch to zoom into any harbor.</div>
        </div>
        <div class="n-card" aria-live="polite"></div>
        <div class="n-dock">
          <div class="n-presets">${PRESETS.map(([k, label, , short]) => `<button class="chip-btn" data-p="${k}" aria-pressed="${k === 'world'}" title="${X.esc(label)}">${X.esc(short)}</button>`).join('')}</div>
          <div class="n-ctls">
            <button class="ctl n-listen" data-c="sound" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg><span>Listen</span></button>
            <button class="ctl" data-c="sectors" aria-pressed="true">Sectors</button>
            <button class="ctl" data-c="major" aria-pressed="false">Lighthouses only</button>
            <span class="n-sep"></span>
            <button class="ctl" data-c="in" aria-label="Zoom in">+</button>
            <button class="ctl" data-c="out" aria-label="Zoom out">&minus;</button>
          </div>
        </div>
      </div>`;
    cv = el.querySelector('.n-canvas'); c = cv.getContext('2d');
    ui = { where: el.querySelector('.n-where'), count: el.querySelector('.n-count'), card: el.querySelector('.n-card') };
    // web mercator, 0..1 across and down
    wx = new Float32Array(N); wy = new Float32Array(N);
    for (let i = 0; i < N; i++) { wx[i] = (X.lon[i] + 180) / 360; const la = Math.max(-84, Math.min(84, X.lat[i])) * RAD; wy[i] = (1 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / Math.PI) / 2; }
    zoom = d3.zoom().scaleExtent([.5, 6000]).on('start', () => { gesturing = true; }).on('zoom', e => { T = e.transform; if (e.sourceEvent) moved = true; }).on('end', () => { gesturing = false; landAt = 0; });
    d3.select(cv).call(zoom).on('dblclick.zoom', null);
    el.querySelector('.n-presets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p, true); });
    el.querySelector('.n-ctls').addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const a = b.dataset.c;
      if (a === 'sound') { sound = !sound; b.setAttribute('aria-pressed', String(sound)); b.querySelector('span').textContent = sound ? 'Listening' : 'Listen'; if (sound) X.audio(); singAt = 0; }
      if (a === 'sectors') { sectors = !sectors; b.setAttribute('aria-pressed', String(sectors)); }
      if (a === 'major') { onlyMajor = !onlyMajor; b.setAttribute('aria-pressed', String(onlyMajor)); singAt = 0; }
      if (a === 'in' || a === 'out') { moved = true; d3.select(cv).transition().duration(450).call(zoom.scaleBy, a === 'in' ? 2 : .5, [VW / 2, VH / 2]); }
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { hover = -1; X.tip(null); });
    // a tap sends no pointermove first, so the click looks for its own light
    cv.addEventListener('click', e => { const i = pickAt(e.clientX, e.clientY); pin = i >= 0 && pin !== i ? i : -1; card(); if (pin >= 0 && sound) X.audio(); });
    document.addEventListener('keydown', e => { if (!visible || e.defaultPrevented || (e.target.closest && e.target.closest('input, .u-tabs'))) return; if (e.key === 'Escape') { pin = -1; card(); } });
    new ResizeObserver(() => { if (visible) resize(); }).observe(cv);
    X.watchDpr(() => { if (visible) resize(); });
    X.land('50m').then(l => { land50 = X.worldRings(l); landAt = 0; });
    built = true;
  }

  // ---------- geometry ----------
  const sx = x => T.x + T.k * S * x, sy = y => T.y + T.k * S * y;
  function fitTransform(b) {
    const x0 = (b[0] + 180) / 360, x1 = (b[2] + 180) / 360;
    const my = la => (1 - Math.log(Math.tan(Math.PI / 4 + la * RAD / 2)) / Math.PI) / 2;
    const y0 = my(b[3]), y1 = my(b[1]);
    const dock = el.querySelector('.n-dock').getBoundingClientRect().height || 110;
    const availH = VH - dock - 20, left = VW < 760 ? 0 : 260;
    const k = Math.min((VW - left - 40) / ((x1 - x0) * S), availH / ((y1 - y0) * S));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return d3.zoomIdentity.translate(left + (VW - left) / 2 - k * S * cx, 10 + availH / 2 - k * S * cy).scale(k);
  }
  function worldTransform() { return fitTransform([-180, -56, 180, 74]); }
  function go(key, animate) {
    const p = PRESETS.find(q => q[0] === key) || PRESETS[0];
    preset = p[0]; moved = false;
    el.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === preset)));
    ui.where.textContent = p[1];
    X.setParams({ at: preset === 'world' ? null : preset });
    const tr = p[2] ? fitTransform(p[2]) : worldTransform();
    if (p[2] && tr.k > 18 && !land10Load) loadLand10();
    if (animate && !X.reduced) d3.select(cv).transition().duration(1400).ease(d3.easeCubicInOut).call(zoom.transform, tr);
    else d3.select(cv).call(zoom.transform, tr);
    singAt = 0;
  }
  function loadLand10() {
    land10Load = true;
    X.land('10m').then(l => { land10 = X.worldRings(l); landAt = 0; });
  }

  // ---------- land and the unlit lights, re-drawn when the view settles and stretched in between ----------
  function drawLand(now) {
    const k = T.k;
    if (k > 18 && !land10Load) loadLand10();
    const want = k > 18 && land10 ? '10m' : '50m';
    const src = want === '10m' ? land10 : land50;
    const key = `${T.k}|${T.x}|${T.y}|${want}|${!!src}|${onlyMajor}|${VW}|${VH}`;
    if (key !== landKey && (now - landAt > (gesturing ? 260 : 160) || !landCv)) {
      const l0 = performance.now();
      if (!landCv) landCv = document.createElement('canvas');
      landCv.width = cv.width; landCv.height = cv.height;
      const g = landCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const KS = k * S;
      if (src) {
        if (want === '50m' && KS <= BMW * 1.3) {
          if (!bmp) bmp = X.landBitmap(land50, BMW);
          g.drawImage(bmp.cv, T.x, T.y + KS * bmp.top, KS, KS * bmp.cv.height / BMW);
        } else {
          g.beginPath(); X.traceRings(g, src, T.x, T.y, KS, VW, VH);
          g.fillStyle = '#0e1015'; g.fill('evenodd'); g.strokeStyle = 'rgba(255,255,255,.11)'; g.lineWidth = .6; g.stroke();
        }
      }
      // every light in view as a faint dot; the lit ones are drawn over it each frame. Lighthouses keep a larger mark so they can be found between flashes.
      // The dots are written straight into pixels: tens of thousands of tiny paths would stall the page while the map moves.
      if (!dotCv) { dotCv = document.createElement('canvas'); dotCtx = dotCv.getContext('2d'); }
      if (!dotImg || dotImg.width !== VW || dotImg.height !== VH) { dotImg = new ImageData(VW, VH); dotCv.width = VW; dotCv.height = VH; }
      const d32 = new Uint32Array(dotImg.data.buffer); d32.fill(0);
      const big = [], DOT = 0x30ffffff;
      const vx0 = -T.x / KS, vx1 = (VW - T.x) / KS;
      for (let i = 0; i < N; i++) {
        let w = wx[i];
        if (w < vx0 && vx1 > 1 && w + 1 <= vx1) w += 1; else if (w > vx1 && vx0 < 0 && w - 1 >= vx0) w -= 1;
        const px = T.x + KS * w, py = T.y + KS * wy[i];
        if (px < 0 || px >= VW || py < 0 || py >= VH || (onlyMajor && !X.major(i))) continue;
        if (X.major(i) && k > 3) { big.push(px, py); continue; }
        d32[(py | 0) * VW + (px | 0)] = DOT;
      }
      dotCtx.putImageData(dotImg, 0, 0);
      g.drawImage(dotCv, 0, 0, VW, VH);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath();
      for (let q = 0; q < big.length; q += 2) { g.moveTo(big[q] + 1.6, big[q + 1]); g.arc(big[q], big[q + 1], 1.6, 0, Math.PI * 2); }
      g.fill();
      landT = T; landAt = now; landKey = key; landMs = performance.now() - l0;
    }
    if (landCv && landT) {
      const r = T.k / landT.k;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(landCv, (T.x - landT.x * r) * dpr, (T.y - landT.y * r) * dpr, landCv.width * r, landCv.height * r);
    }
  }

  // ---------- one frame ----------
  function sprite(col) {
    if (sprites[col]) return sprites[col];
    const s = 64, k = document.createElement('canvas'); k.width = k.height = s;
    const g = k.getContext('2d'), rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2), cc = d3.rgb(X.COL_HEX[col]);
    rg.addColorStop(0, `rgba(${cc.r},${cc.g},${cc.b},.7)`); rg.addColorStop(.18, `rgba(${cc.r},${cc.g},${cc.b},.28)`); rg.addColorStop(.5, `rgba(${cc.r},${cc.g},${cc.b},.07)`); rg.addColorStop(1, `rgba(${cc.r},${cc.g},${cc.b},0)`);
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    return (sprites[col] = k);
  }
  const batches = X.COLORS.map(() => []);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !VW) return;
    const t = now / 1000;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    drawLand(now);
    const f0 = performance.now();          // the land redraw is occasional, so only the per-frame work counts toward the cost
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = T.k, KS = k * S;
    const x0 = (-T.x - 30) / KS, x1 = (VW - T.x + 30) / KS, y0 = (-T.y - 30) / KS, y1 = (VH - T.y + 30) / KS;
    const zoomed = Math.log2(Math.max(1, k));
    const base = .75 + Math.min(2.4, zoomed * .32);
    // sector fans first, underneath the lights
    if (sectors && KS > 2600) drawSectors(t, KS, x0, x1, y0, y1);
    for (const b of batches) b.length = 0;
    visN = 0;
    // near the date line the view can run past the edge of the world, so lights from the far side are brought round
    const wrapR = x1 > 1, wrapL = x0 < 0;
    for (let i = 0; i < N; i++) {
      let X0 = wx[i]; const Y0 = wy[i];
      if (Y0 < y0 || Y0 > y1) continue;
      if (X0 < x0 || X0 > x1) { if (wrapR && X0 + 1 <= x1) X0 += 1; else if (wrapL && X0 - 1 >= x0) X0 -= 1; else continue; }
      if (onlyMajor && !X.major(i)) continue;
      const px = T.x + KS * X0, py = T.y + KS * Y0;
      visI[visN] = i; visX[visN] = px; visY[visN] = py; visN++;
      const st = X.lit(i, t);
      if (st >= 0) batches[st].push(px, py, base + Math.sqrt(X.range[i]) * .32 * (X.major(i) ? 1.25 : 1), i);
    }
    // glow for the far-reaching lights, then the lit cores. On a slow machine the wide view keeps glow for the long-range lights only.
    const thin = lite && zoomed < 2.5;
    let litN = 0; for (const b of batches) litN += b.length / 4;
    // close in, the glow follows the light's range: a lighthouse seen 30 miles out blooms, a buoy barely does.
    // Where lights crowd together (a canal lined with lamps) each glow is turned down, so they don't add up to a white smear.
    const zf = Math.min(2, .6 + zoomed * .18);
    const dense = zoomed >= 3;
    const GW = Math.ceil(VW / 32) + 1, GH = Math.ceil(VH / 32) + 1;
    if (dense) {
      if (!grid || grid.length < GW * GH) grid = new Uint16Array(GW * GH); else grid.fill(0, 0, GW * GH);
      for (const arr of batches) for (let q = 0; q < arr.length; q += 4) { const gx = Math.floor(arr[q] / 32), gy = Math.floor(arr[q + 1] / 32); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) grid[gy * GW + gx]++; }
    }
    const gain = dense ? Math.max(.5, Math.min(1, Math.sqrt(600 / Math.max(1, litN)))) : 1;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = gain;
    batches.forEach((arr, col) => {
      if (!arr.length) return;
      const spr = sprite(col);
      for (let q = 0; q < arr.length; q += 4) {
        const r = arr[q + 2], i = arr[q + 3]; if (r < 1.5 && zoomed < 3) continue;
        if (thin && X.range[i] < 15 && !X.major(i)) continue;
        let g;
        if (dense) {
          g = (6 + Math.sqrt(X.range[i]) * 3.2) * zf * (X.major(i) ? 1.2 : 1);
          const gx = Math.floor(arr[q] / 32), gy = Math.floor(arr[q + 1] / 32);
          const n = gx >= 0 && gy >= 0 && gx < GW && gy < GH ? grid[gy * GW + gx] : 1;
          c.globalAlpha = gain * Math.min(1, 2.5 / Math.sqrt(n)) * (X.isFixed(i) ? .7 : 1);
        } else g = r * (3.2 + zoomed * .6);
        c.drawImage(spr, arr[q] - g, arr[q + 1] - g, g * 2, g * 2);
      }
    });
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    batches.forEach((arr, col) => {
      if (!arr.length) return;
      c.fillStyle = X.COL_HEX[col]; c.beginPath();
      for (let q = 0; q < arr.length; q += 4) { const r = arr[q + 2] * .55; c.rect(arr[q] - r, arr[q + 1] - r, r * 2, r * 2); }
      c.fill();
    });
    // sound, and the rings on the lights that are singing
    if (sound) sing(t, now);
    drawPings(now);
    for (const [i, a] of [[pin, 1], [hover, .8]]) {
      if (i < 0) continue;
      const px = sx(wx[i]), py = sy(wy[i]);
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.2; c.beginPath(); c.arc(px, py, 8, 0, Math.PI * 2); c.stroke();
    }
    if (pin >= 0) blinkCard(t);
    countText(t);
    cost = cost * .92 + (performance.now() - f0) * .08;
    if (!lite && cost > 20) lite = true; else if (lite && cost < 7) lite = false;
  }
  let secDrawn = 0;
  function drawSectors(t, KS, x0, x1, y0, y1) {
    c.globalCompositeOperation = 'lighter';
    // many overlapping fans turn the sea grey, so they dim as more of them are in view
    const sgain = Math.max(.35, Math.min(1, Math.sqrt(40 / Math.max(1, secDrawn))));
    let n = 0;
    for (let s = 0; s < X.SN; s++) {
      const i = X.sLight[s], X0 = wx[i], Y0 = wy[i];
      const rw = (X.sRange[s] / 60) / 360 / Math.cos(X.lat[i] * RAD);    // radius in world units
      if (X0 + rw < x0 || X0 - rw > x1 || Y0 + rw < y0 || Y0 - rw > y1) continue;
      if (onlyMajor && !X.major(i)) continue;
      const r = rw * KS; if (r < 5) continue;
      n++;
      // a fan only shows while its light is lit, so the beams come and go with the rhythm
      if (X.litPat(X.sPat[s], X.sCol[s], t, X.phase[i]) < 0) continue;
      const px = T.x + KS * X0, py = T.y + KS * Y0;
      let a0 = (X.sA[s] + 90) * RAD, a1 = (X.sB[s] + 90) * RAD;
      if (a1 <= a0) a1 += Math.PI * 2;
      const cc = d3.rgb(X.COL_HEX[X.sCol[s]]);
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      // narrow beams stay bright; a sector that covers half the sea is a wash, so it is kept faint
      const wide = Math.sqrt(Math.min(1, 50 * RAD / (a1 - a0)));
      const al = .3 * wide * sgain;
      g.addColorStop(0, `rgba(${cc.r},${cc.g},${cc.b},${al})`); g.addColorStop(.6, `rgba(${cc.r},${cc.g},${cc.b},${al * .4})`); g.addColorStop(1, `rgba(${cc.r},${cc.g},${cc.b},0)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(px, py); c.arc(px, py, r, a0, a1); c.closePath(); c.fill();
    }
    secDrawn = n;
    c.globalCompositeOperation = 'source-over';
  }

  // ---------- listening: the brightest rhythmic lights in view become notes ----------
  const SING = 18, bestI = new Int32Array(SING), bestS = new Float32Array(SING);
  function sing(t, now) {
    if (now - singAt > 700) {
      singAt = now;
      // one pass keeping the best 18, rather than sorting every light in view
      let n = 0, minQ = 0;
      for (let q = 0; q < visN; q++) {
        const i = visI[q]; if (X.isFixed(i)) continue;
        const s = X.range[i] + X.major(i) * 6 - X.phase[i] * .01;
        if (n < SING) { bestI[n] = i; bestS[n] = s; if (n === 0 || s < bestS[minQ]) minQ = n; n++; continue; }
        if (s <= bestS[minQ]) continue;
        bestI[minQ] = i; bestS[minQ] = s;
        for (let j = 0; j < SING; j++) if (bestS[j] < bestS[minQ]) minQ = j;
      }
      singers = Array.from(bestI.subarray(0, n));
      if (pin >= 0 && !X.isFixed(pin) && !singers.includes(pin)) singers.push(pin);
    }
    let fired = 0;
    lastPings = lastPings.filter(x => now - x < 140);
    for (const i of singers) {
      const st = X.lit(i, t), was = prevLit.get(i);
      prevLit.set(i, st);
      if (st >= 0 && (was === undefined || was < 0)) {
        if (was === undefined) continue;
        if (lastPings.length + fired >= 5) continue;
        fired++;
        const px = sx(wx[i]);
        const P = X.PAT[X.CODE[X.code[i]].pat];
        X.ping(st, P ? P.segs[0] : .3, (px / VW) * 1.6 - .8, .05 + Math.min(.1, X.range[i] / 250) + (i === pin ? .05 : 0), (X.phase[i] - .5) * 10);
        pingFx.push({ i, at: now, col: st });
        lastPings.push(now);
      }
    }
  }
  function drawPings(now) {
    pingFx = pingFx.filter(f => now - f.at < 900);
    for (const f of pingFx) {
      const a = 1 - (now - f.at) / 900, px = sx(wx[f.i]), py = sy(wy[f.i]);
      const cc = d3.rgb(X.COL_HEX[f.col]);
      c.strokeStyle = `rgba(${cc.r},${cc.g},${cc.b},${(a * .8).toFixed(3)})`; c.lineWidth = 1;
      c.beginPath(); c.arc(px, py, 4 + (1 - a) * 16, 0, Math.PI * 2); c.stroke();
    }
  }

  // ---------- words on the map ----------
  let lastCount = 0;
  function countText(t) {
    if (performance.now() - lastCount < 400) return; lastCount = performance.now();
    let on = 0; for (let q = 0; q < visN; q++) if (X.lit(visI[q], t) >= 0) on++;
    ui.count.innerHTML = `<b>${X.fmt(visN)}</b> ${visN === 1 ? 'light' : 'lights'} in view, <b>${X.fmt(on)}</b> lit this instant`;
  }
  function lightHtml(i, short) {
    const nm = X.nameOf(i), c0 = X.CODE[X.code[i]];
    const bits = nm ? [X.typeWord(i)] : [];
    if (X.range[i]) bits.push(`seen ${X.range[i]} nautical miles out`);
    if (X.height[i]) bits.push(`${X.height[i]} m up`);
    const secs = X.sectorsOf.get(i);
    const line = bits.join(', ');
    return `<b>${X.esc(nm || X.typeWord(i))}</b>${line ? `<small>${X.esc(line.charAt(0).toUpperCase() + line.slice(1))}</small>` : ''}` +
      `<span class="rh-row"><code>${X.esc(c0.text)}</code>${X.rhythmSvg(c0.pat, c0.col, 140, 9)}</span>` +
      (secs && secs.length > 1 ? `<em>${secs.length} sectors: ${[...new Set(secs.map(s => X.COL_NAME[X.sCol[s]]))].join(', ')}</em>` : '') +
      (X.fogText(i) ? `<em>${X.esc(X.fogText(i))}</em>` : '') + (X.heritage(i) ? '<em>A protected historic monument</em>' : '') +
      (short ? '' : '<em>Click to keep it</em>');
  }
  function card() {
    if (pin < 0) { ui.card.classList.remove('show'); return; }
    ui.card.innerHTML = `<i class="n-blink"></i><div>${lightHtml(pin, true)}</div>`;
    ui.card.classList.add('show');
    ui.blink = ui.card.querySelector('.n-blink');
    // on a narrow screen the card spans the width, so it goes in the half of the map away from the light
    if (VW < 760) {
      const dock = el.querySelector('.n-dock').getBoundingClientRect().height;
      const low = sy(wy[pin]) < VH * .45;
      ui.card.style.top = low ? 'auto' : '';
      ui.card.style.bottom = low ? `${Math.round(dock + 8)}px` : '';
    } else { ui.card.style.top = ''; ui.card.style.bottom = ''; }
  }
  function blinkCard(t) {
    if (!ui.blink) return;
    const st = X.lit(pin, t);
    ui.blink.style.background = st >= 0 ? X.COL_HEX[st] : 'transparent';
    ui.blink.style.boxShadow = st >= 0 ? `0 0 18px 4px ${X.COL_HEX[st]}` : 'none';
    ui.blink.style.borderColor = X.COL_HEX[X.CODE[X.code[pin]].col];
  }
  const coarse = matchMedia('(pointer: coarse)').matches;
  function pickAt(clientX, clientY) {
    const r = cv.getBoundingClientRect(), mx = clientX - r.left, my = clientY - r.top;
    const rad = coarse ? 20 : 12;
    let best = -1, bd = rad * rad;
    for (let q = 0; q < visN; q++) { const dx = visX[q] - mx, dy = visY[q] - my, d2 = dx * dx + dy * dy; if (d2 < bd || (d2 < bd * 1.4 && X.major(visI[q]) && (best < 0 || !X.major(best)))) { bd = d2; best = visI[q]; } }
    return best;
  }
  function onMove(e) {
    const best = pickAt(e.clientX, e.clientY);
    hover = best;
    cv.style.cursor = best >= 0 ? 'pointer' : 'grab';
    if (best >= 0) X.tip(lightHtml(best, false), e.clientX, e.clientY); else X.tip(null);
  }

  // ---------- layout ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh) return;
    const first = !VW;
    if (nw === VW && nh === VH && cv.width === Math.round(nw * dpr)) return;
    // if the reader has moved the map, a resize keeps the same place and scale instead of snapping back
    const keep = !first && moved ? { KS: T.k * S, cx: (VW / 2 - T.x) / (T.k * S), cy: (VH / 2 - T.y) / (T.k * S) } : null;
    VW = nw; VH = nh; S = VW;
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    landT = null; landAt = 0;
    zoom.extent([[0, 0], [VW, VH]]).translateExtent([[-VW * .5, -VW * .5], [VW * 1.5, VW * 1.5]]);
    // the whole-world framing sits below the usual floor on most screens, so the floor follows it
    zoom.scaleExtent([Math.min(.9, worldTransform().k * .98), 6000]);
    if (first) go(pendingAt || 'world', false);
    else if (keep) { d3.select(cv).call(zoom.transform, d3.zoomIdentity.translate(VW / 2 - keep.KS * keep.cx, VH / 2 - keep.KS * keep.cy).scale(keep.KS / S)); moved = true; }
    else go(preset, false);
  }
  let pendingAt = null;
  function show(opts) {
    visible = true;
    if (opts && opts.at) pendingAt = opts.at;
    resize();
    if (opts && opts.at && VW && opts.at !== preset) go(opts.at, false);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function hide() { visible = false; cancelAnimationFrame(raf); X.tip(null); }
  X.views.night = { init, show, hide, go, fit: b => { moved = true; d3.select(cv).call(zoom.transform, fitTransform(b)); }, state: () => ({ built, visN, preset, k: T.k, sound, singers: singers.length, cost: +cost.toFixed(1), lite, moved, landMs: +landMs.toFixed(1) }),
    pick: (mx, my, rad) => { const out = []; for (let q = 0; q < visN; q++) { const dx = visX[q] - mx, dy = visY[q] - my; if (dx * dx + dy * dy < rad * rad) out.push(visI[q]); } return out; } };
})();
