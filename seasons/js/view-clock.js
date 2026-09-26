/* The Slow Clock: the clock.
   One turn is one year, 1 January at the top. Each record sits at its date, and further out the later it was written:
   the centre is the ninth century, the rim is now. The lines are 31-year averages, so drift shows as a bend. */
(function () {
  'use strict';
  const X = window.CX;
  const Y0 = 790, Y1 = 2030, TAU = Math.PI * 2;
  let el, cv, c, W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0, r0 = 0, built = false, visible = false, raf = 0;
  let on = { suwa: true, kyoto: true, torne: true, burgundy: true }, hoverYear = null, hoverDot = null, pinYear = null;
  let playing = false, playFrom = 0, playYear = Y1, dots = [];
  const PLAY_SECS = 36;

  const ang = d => (d - 1) / 365.2425 * TAU - Math.PI / 2;
  const rad = y => r0 + (y - Y0) / (Y1 - Y0) * (R - r0);
  const yearAt = r => Y0 + (r - r0) / (R - r0) * (Y1 - Y0);
  function shiftText(k) {
    const n = Math.abs(k.shift), days = `${n} ${n === 1 ? 'day' : 'days'} ${k.shift < 0 ? 'earlier' : 'later'}`;
    if (k.key === 'suwa') { const w = Math.round(k.froze * 30); return `Over the last 30 winters it froze ${days} than it used to, and only in ${w} of them.`; }
    return `Over its last 30 years, ${days} than from 1400 to 1900.`;
  }

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="k-wrap">
        <aside class="k-side">
          <div class="k-year" aria-live="polite"><b id="kYear">Now</b><span id="kYearSub">Point anywhere on the clock to read a year.</span></div>
          <div class="k-read" id="kRead"></div>
          <div class="k-ctl">
            <button class="ctl k-play" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Wind it forward</span></button>
          </div>
        </aside>
        <div class="k-stage"><canvas aria-label="A clock of the year. Records of cherry blossom, grape harvests, lake ice and river ice, placed by date and by year"></canvas></div>
        <aside class="k-key">
          ${X.K.map(k => `<button class="k-chip" data-k="${k.key}" aria-pressed="true" style="--c:${k.col}"><i></i><span><b>${X.esc(k.name)}</b><small>${X.fmt(k.d.filter(v => v !== null).length)} records, ${k.first} to ${k.last}${k.key === 'suwa' ? `, and ${X.fmt(k.d.filter(v => v === null).length)} winters it never froze` : ''}</small><em>${X.esc(shiftText(k))}</em></span></button>`).join('')}
          <p class="k-how">One turn of the clock is one year, with 1 January at the top. The center is the ninth century and the rim is now, so every record sits at its date and its year. The thin lines are smoothed averages. The dotted hands show where each record pointed from 1400 to 1900, and the bright hands where it points now.</p>
        </aside>
      </div>`;
    cv = el.querySelector('canvas'); c = cv.getContext('2d');
    el.querySelector('.k-key').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; on[b.dataset.k] = !on[b.dataset.k]; b.setAttribute('aria-pressed', String(on[b.dataset.k])); });
    el.querySelector('.k-play').addEventListener('click', () => { playing ? stop() : play(); });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; hoverYear = null; hoverDot = null; X.tip(null); readout(); });
    // a tap sends no pointermove first, so the click reads its own position
    cv.addEventListener('click', e => { onMove(e); pinYear = hoverYear === null || pinYear === hoverYear ? null : hoverYear; readout(); });
    new ResizeObserver(() => { if (visible) resize(); }).observe(el.querySelector('.k-stage'));
    built = true;
  }

  // ---------- drawing ----------
  function resize() {
    const box = el.querySelector('.k-stage').getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(box.width), h = Math.round(Math.min(box.width, Math.max(420, innerHeight - 150)));
    if (!w || (w === W && h === H && cv.width === Math.round(w * dpr))) return;
    W = w; H = h; cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    cx = W / 2; cy = H / 2; R = Math.min(W, H) / 2 - (W < 520 ? 30 : 46); r0 = R * .1;
    layout();
  }
  function layout() {
    dots = [];
    for (const k of X.K) for (let i = 0; i < k.n; i++) {
      const d = k.d[i], y = k.y[i];
      const a = d === null ? ang(X.angleDay(k.base)) : ang(X.angleDay(d)), r = rad(y);
      dots.push({ k, i, y, none: d === null, x: cx + Math.cos(a) * r, yy: cy + Math.sin(a) * r, a, r });
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !W) return;
    if (playing) {
      const t = (now - playFrom) / 1000 / PLAY_SECS;
      playYear = Y0 + Math.min(1, t) * (Y1 - Y0);
      if (t >= 1) stop(); else if (Math.floor(playYear) !== lastShown) { lastShown = Math.floor(playYear); readout(); }
    }
    draw();
  }
  let lastShown = null;
  function draw() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const limit = playing ? playYear : Y1;
    // century rings
    c.lineWidth = 1;
    for (let y = 800; y <= 2000; y += 100) {
      const r = rad(y); if (y > limit) break;
      c.strokeStyle = y % 500 === 0 ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.06)';
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    }
    // months
    c.font = `500 ${W < 520 ? 10 : 12}px "Schibsted Grotesk", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let m = 0; m < 12; m++) {
      const a0 = ang(X.CUM[m] + 1), a1 = ang((X.CUM[m + 1] || 365) + 1);
      c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0); c.lineTo(cx + Math.cos(a0) * (R + 8), cy + Math.sin(a0) * (R + 8)); c.stroke();
      const am = (a0 + (a1 > a0 ? a1 : a1 + TAU)) / 2;
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillText(W < 520 ? X.MON[m][0] : X.MON[m], cx + Math.cos(am) * (R + (W < 520 ? 16 : 26)), cy + Math.sin(am) * (R + (W < 520 ? 16 : 26)));
    }
    // century labels, down the empty summer
    c.font = `500 ${W < 520 ? 9 : 11}px "Schibsted Grotesk", sans-serif`; c.fillStyle = 'rgba(255,255,255,.34)';
    const la = ang(203);
    for (let y = 900; y <= 2000; y += 100) { if (y > limit) break; if (W < 520 && y % 200) continue; const r = rad(y); c.fillText(String(y), cx + Math.cos(la) * r, cy + Math.sin(la) * r); }
    // the year being read
    const ry = pinYear ?? hoverYear ?? (playing ? playYear : null);
    if (ry !== null) {
      c.strokeStyle = playing && pinYear === null && hoverYear === null ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.7)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(cx, cy, rad(ry), 0, TAU); c.stroke();
    }
    // records
    const hot = ry !== null ? Math.round(ry) : null;
    for (const p of dots) {
      if (!on[p.k.key] || p.y > limit) continue;
      const near = hot !== null && Math.abs(p.y - hot) <= 0;
      if (p.none) {
        c.strokeStyle = near ? '#fff' : 'rgba(191,227,255,.42)'; c.lineWidth = 1;
        const ux = Math.cos(p.a), uy = Math.sin(p.a), t = 3.5;
        c.beginPath(); c.moveTo(p.x - uy * t, p.yy + ux * t); c.lineTo(p.x + uy * t, p.yy - ux * t); c.stroke();
        continue;
      }
      c.fillStyle = p.k.col; c.globalAlpha = near ? 1 : .78;
      c.beginPath(); c.arc(p.x, p.yy, near ? 3.6 : (W < 520 ? 1.6 : 2.1), 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // the averages
    for (const k of X.K) {
      if (!on[k.key]) continue;
      c.strokeStyle = k.col; c.lineWidth = 1.7; c.lineJoin = 'round';
      c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 5;
      let open = false; c.beginPath();
      for (const [y, v] of k.mean) {
        if (v === null || y > limit) { open = false; continue; }
        const a = ang(X.angleDay(v)), r = rad(y), x = cx + Math.cos(a) * r, yy = cy + Math.sin(a) * r;
        if (!open) { c.moveTo(x, yy); open = true; } else c.lineTo(x, yy);
      }
      c.stroke(); c.shadowBlur = 0;
    }
    // the hands: a dotted line where each record used to point, from 1400 to 1900, and a bright one where it points now
    for (const k of X.K) {
      if (!on[k.key]) continue;
      const ab = ang(X.angleDay(k.base));
      c.setLineDash([2, 4]); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + Math.cos(ab) * r0, cy + Math.sin(ab) * r0); c.lineTo(cx + Math.cos(ab) * (R + 6), cy + Math.sin(ab) * (R + 6)); c.stroke();
      c.setLineDash([]);
      let v = null, rr = R;
      if (playing) {
        const yr = Math.min(Math.floor(playYear), k.last);
        if (yr < k.first) continue;
        for (let q = yr; q >= yr - 40 && v === null; q--) v = k.meanAt.get(q) ?? null;
        rr = rad(yr);
      } else v = k.now;
      if (v === null) continue;
      const a = ang(X.angleDay(v));
      c.globalAlpha = k.key === 'suwa' && !playing ? .35 + .65 * k.froze : 1;
      c.strokeStyle = k.col; c.lineWidth = 2.6; c.shadowColor = k.col; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = k.col; c.beginPath(); c.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4, 0, TAU); c.fill();
      if (!playing) {
        // the gap between then and now, at the rim
        c.strokeStyle = k.col; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.arc(cx, cy, R + 6, Math.min(a, ab), Math.max(a, ab)); c.stroke(); c.lineCap = 'butt';
      }
      c.globalAlpha = 1;
    }
    if (hoverDot) { c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.arc(hoverDot.x, hoverDot.yy, 7, 0, TAU); c.stroke(); }
    // the hub
    c.fillStyle = 'rgba(255,255,255,.5)'; c.font = `600 ${W < 520 ? 10 : 12}px "Schibsted Grotesk", sans-serif`;
    c.fillText(playing ? String(Math.floor(playYear)) : '', cx, cy);
  }

  // ---------- reading a year ----------
  function onMove(e) {
    const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    const r = Math.hypot(mx - cx, my - cy);
    hoverYear = r >= r0 * .8 && r <= R + 6 ? Math.max(812, Math.min(2026, Math.round(yearAt(r)))) : null;
    let best = null, bd = 64;
    for (const p of dots) { if (!on[p.k.key]) continue; const dx = p.x - mx, dy = p.yy - my, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = p; } }
    hoverDot = best;
    if (best) { hoverYear = best.y; X.tip(X.recordHtml(best.k, best.i), e.clientX, e.clientY); } else X.tip(null);
    cv.style.cursor = hoverYear !== null ? 'crosshair' : 'default';
    readout();
  }
  function readout() {
    const y = pinYear ?? hoverYear ?? (playing ? Math.floor(playYear) : null);
    const yEl = el.querySelector('#kYear'), sub = el.querySelector('#kYearSub'), box = el.querySelector('#kRead');
    if (y === null) {
      yEl.textContent = 'Twelve centuries'; sub.textContent = 'Point anywhere on the clock to read a year.';
      box.innerHTML = X.K.map(k => `<div class="k-row" style="--c:${k.col}"><i></i><span><b>${X.esc(k.short)}</b><small>Between 1400 and 1900, ${X.esc(k.avg)} ${X.dateText(1801, k.base)}.</small></span></div>`).join('');
      return;
    }
    yEl.textContent = String(y); sub.textContent = pinYear !== null ? 'Kept. Tap or click the clock again to let go.' : ' ';
    box.innerHTML = X.K.map(k => {
      const i = k.at.get(y);
      let line;
      if (i === undefined) line = y < k.first ? 'Not yet recorded' : 'No record this year';
      else if (k.d[i] === null) line = 'The lake did not freeze';
      else line = `${X.dateText(y, k.d[i])}, ${X.offText(k, k.d[i])}`;
      return `<div class="k-row${i === undefined ? ' none' : ''}" style="--c:${k.col}"><i></i><span><b>${X.esc(k.short)}</b><small>${X.esc(line)}</small></span></div>`;
    }).join('');
  }

  // ---------- winding the clock ----------
  function play() {
    playing = true; playFrom = performance.now(); pinYear = null; lastShown = null;
    const b = el.querySelector('.k-play'); b.setAttribute('aria-pressed', 'true'); b.querySelector('span').textContent = 'Stop';
  }
  function stop() {
    playing = false; playYear = Y1;
    const b = el.querySelector('.k-play'); b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = 'Wind it forward';
    readout();
  }

  function show() { visible = true; resize(); readout(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function hide() { visible = false; cancelAnimationFrame(raf); X.tip(null); if (playing) stop(); }
  X.views.clock = { init, show, hide, state: () => ({ built, W, H, R, dots: dots.length, playing, hoverYear, pinYear }) };
})();
