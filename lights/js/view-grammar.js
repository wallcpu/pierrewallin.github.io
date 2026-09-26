/* Night Coast: The Grammar.
   Lights say who they are by how they flash. A score of the rhythms in use, ranked; the clock face of the cardinal marks;
   the Morse letters; the beat. Whatever you point at lights up on the map beside it. */
(function () {
  'use strict';
  const X = window.LX, N = X.N;
  const SPAN = 30;                       // seconds of rhythm drawn in each row of the score
  const ROWS = 30;
  const RAD = Math.PI / 180;
  let el, built = false, visible = false, raf = 0, sound = false;
  let groups = [], fam = 'all', list = [], sel = null, pinSel = null;
  const sc = { hover: -1 }, mp = {}, ck = {};

  // ---------- the rhythms, grouped by how they are written on the chart ----------
  function family(ch) {
    if (!ch) return 'other';
    if (/^al/i.test(ch)) return 'al';
    if (/q/i.test(ch) && /lfl/i.test(ch)) return 'qlfl';
    if (/^(v|u|i|iv|iu)?q/i.test(ch)) return 'q';
    if (/^lfl/i.test(ch)) return 'lfl';
    if (/^f?fl/i.test(ch) || ch === 'flashing') return 'fl';
    if (/^(f|fixed)$/i.test(ch)) return 'f';
    if (/^f?iso/i.test(ch)) return 'iso';
    if (/^oc/i.test(ch)) return 'oc';
    if (/^mo$/i.test(ch)) return 'mo';
    return 'other';
  }
  const FAMS = [
    ['all', 'All'], ['fl', 'Flashing'], ['f', 'Steady'], ['q', 'Quick'], ['iso', 'Isophase'], ['oc', 'Occulting'], ['lfl', 'Long flash'], ['mo', 'Morse'], ['qlfl', 'Quick and long'], ['al', 'Alternating'],
  ];
  const FAM_WORD = {
    fl: 'A flashing light is dark for longer than it is lit.', f: 'A steady light never goes out.', q: 'A quick light flashes about once a second or faster.',
    iso: 'An isophase light is lit and dark for equal spells.', oc: 'An occulting light is lit for longer than it is dark.', lfl: 'A long flash lasts two seconds or more.',
    mo: 'These lights spell a letter in Morse code.', qlfl: 'Quick flashes followed by one long one. Most of these are south cardinal marks.', al: 'An alternating light changes color as it goes.',
  };

  function build() {
    const byText = new Map();
    for (let i = 0; i < N; i++) {
      const c = X.CODE[X.code[i]];
      let g = byText.get(c.text);
      if (!g) { g = { text: c.text, ids: [], pats: new Map(), col: c.col, fam: family(c.ch), per: c.per }; byText.set(c.text, g); }
      g.ids.push(i); g.pats.set(c.pat, (g.pats.get(c.pat) || 0) + 1);
    }
    groups = [...byText.values()].map(g => {
      let best = -1, bn = -1; for (const [p, n] of g.pats) if (n > bn) { bn = n; best = p; }
      return { text: g.text, ids: g.ids, n: g.ids.length, pat: best, col: g.col, fam: g.fam, per: g.per };
    }).sort((a, b) => b.n - a.n);
  }
  function mostly(ids) {
    const m = new Map(); for (const i of ids) { const w = X.typeWord(i); m.set(w, (m.get(w) || 0) + 1); }
    const [w, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = n / ids.length, pl = (w + 's').toLowerCase();
    return share > .5 ? `mostly ${pl}` : share > .25 ? `many of them ${pl}` : 'on many kinds of mark';
  }

  // ---------- page ----------
  function init(root) {
    el = root;
    build();
    const rhythms = new Set(groups.map(g => g.text.replace(/ (?:W|R|G|Y|Bu|Or|Vi|Am)+(?= |$)/g, '')));
    const byPer = new Map(); for (const g of groups) if (g.per) byPer.set(g.per, (byPer.get(g.per) || 0) + g.n);
    const beat = [...byPer.entries()].sort((a, b) => b[1] - a[1])[0];
    const slow = [...byPer.entries()].filter(([p]) => p > 30).reduce((s, [, n]) => s + n, 0);
    const steadyRed = groups.find(g => g.text === 'F R');
    el.innerHTML = `
      <div class="g-wrap">
        <div class="g-main">
          <section class="g-sec">
            <p class="g-big"><b>${X.fmt(groups.length)}</b> ways of being a light are written on these charts, from ${X.fmt(rhythms.size)} different rhythms. The commonest light of all is a steady red one, and there are ${X.fmt(steadyRed ? steadyRed.n : 0)} of them.</p>
            <h2 class="g-h">The score</h2>
            <p class="g-p">Each row is one way to flash, drawn over 30 seconds and ranked by how many lights use it. The dot on the left blinks as the line sweeps across. Point at a row to see where it flashes.</p>
            <div class="g-bar">
              <div class="g-fams" role="group" aria-label="Kind of rhythm">${FAMS.map(([k, l]) => `<button class="chip-btn" data-f="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}</div>
              <button class="ctl g-listen" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg><span>Play the score</span></button>
            </div>
            <p class="g-note" id="gFamNote"></p>
            <div class="g-score"><canvas aria-label="The commonest light rhythms, each drawn across 30 seconds"></canvas></div>
          </section>
          <section class="g-sec">
            <h2 class="g-h">The clock</h2>
            <p class="g-p">Cardinal marks tell a ship which side of a danger to pass. Their flashes are read like a clock face. Three flashes mean east, six mean south and nine mean west, and an unbroken ripple means north. The south mark adds one long flash so its six can't be mistaken for three or nine.</p>
            <div class="g-clock"><canvas aria-label="The four cardinal marks placed on a clock face"></canvas><div class="g-clock-key"></div></div>
          </section>
          <section class="g-sec">
            <h2 class="g-h">Letters</h2>
            <p class="g-p">Some lights spell a letter in Morse code. Safe water marks, which sit in open water at the mouth of a channel, often spell A. Offshore platforms spell U, which in the International Code of Signals means \u201cyou are running into danger.\u201d C, O and P are nearly all special marks on the coast of mainland China.</p>
            <div class="g-morse"></div>
          </section>
          <section class="g-sec">
            <h2 class="g-h">The beat</h2>
            <p class="g-p">This is how long each light takes before its pattern starts over. ${X.fmt(byPer.get(beat[0]))} lights repeat every ${beat[0]} seconds, more than any other beat. Only ${X.fmt(slow)} take longer than 30.</p>
            <div class="g-beat"><svg aria-label="How many lights repeat at each period, from half a second to 30 seconds"></svg></div>
          </section>
        </div>
        <aside class="g-side">
          <div class="g-map"><canvas aria-label="World map of the lights using the rhythm you point at"></canvas></div>
          <div class="g-cap" aria-live="polite"></div>
        </aside>
      </div>`;
    sc.cv = el.querySelector('.g-score canvas'); sc.c = sc.cv.getContext('2d');
    mp.cv = el.querySelector('.g-map canvas'); mp.c = mp.cv.getContext('2d');
    ck.cv = el.querySelector('.g-clock canvas'); ck.c = ck.cv.getContext('2d');
    el.querySelector('.g-fams').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; fam = b.dataset.f; el.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); layoutScore(); });
    el.querySelector('.g-listen').addEventListener('click', e => {
      const b = e.currentTarget; sound = !sound; b.setAttribute('aria-pressed', String(sound)); b.querySelector('span').textContent = sound ? 'Playing' : 'Play the score';
      if (sound) X.audio();
    });
    sc.cv.addEventListener('pointermove', e => { const r = rowAt(e); if (r === sc.hover) return; sc.hover = r; select(r >= 0 ? groupSel(list[r]) : pinSel); sc.cv.style.cursor = r >= 0 ? 'pointer' : 'default'; });
    sc.cv.addEventListener('pointerleave', () => { sc.hover = -1; select(pinSel); });
    sc.cv.addEventListener('click', e => { const r = rowAt(e); if (r < 0) return; toggle(groupSel(list[r])); if (sound) X.audio(); });
    buildClock(); buildMorse(); buildBeat();
    new ResizeObserver(() => { if (visible) resize(); }).observe(el.querySelector('.g-wrap'));
    X.watchDpr(() => { if (visible) { lastW = 0; mp.W = 0; resize(); } });
    X.land('50m').then(l => { mp.land = l; mp.W = 0; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (visible) layoutScore(); });
    built = true;
  }
  function toggle(s) { pinSel = pinSel && pinSel.key === s.key ? null : s; select(pinSel || s); }
  function groupSel(g) { return { key: 'g:' + g.text, label: g.text, ids: g.ids, pat: g.pat, col: g.col, note: `${X.fmt(g.n)} ${g.n === 1 ? 'light' : 'lights'}, ${mostly(g.ids)}` }; }

  // ---------- the score ----------
  function layoutScore() {
    list = (fam === 'all' ? groups : groups.filter(g => g.fam === fam)).slice(0, ROWS);
    const inFam = fam === 'all' ? null : groups.filter(g => g.fam === fam);
    el.querySelector('#gFamNote').textContent = inFam ? `${FAM_WORD[fam]} There are ${X.fmt(inFam.reduce((s, g) => s + g.n, 0))} of them here, written ${X.fmt(inFam.length)} ways.` : '';
    const W = Math.round(sc.cv.parentElement.getBoundingClientRect().width);
    if (!W) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), narrow = W < 560, RH = narrow ? 30 : 28, TOP = 26;
    const H = TOP + list.length * RH + 6;
    sc.cv.width = W * dpr; sc.cv.height = H * dpr; sc.cv.style.height = H + 'px';
    const L = { W, H, RH, TOP, dpr, lamp: 9, lab: 24, lw: narrow ? 96 : 132, cw: narrow ? 50 : 118, narrow };
    L.x0 = L.lab + L.lw + 6; L.x1 = W - L.cw - 10; L.sw = L.x1 - L.x0;
    sc.L = L;
    const st = sc.st || (sc.st = document.createElement('canvas'));
    st.width = W * dpr; st.height = H * dpr;
    const g = st.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textBaseline = 'middle';
    g.font = '500 11px "Schibsted Grotesk", sans-serif'; g.fillStyle = 'rgba(255,255,255,.4)';
    for (let s = 0; s <= SPAN; s += narrow ? 10 : 5) { const x = L.x0 + s / SPAN * L.sw; g.fillRect(x, TOP - 6, 1, 4); g.textAlign = s === 0 ? 'left' : s === SPAN ? 'right' : 'center'; g.fillText(s === 0 ? '0' : `${s}s`, x, TOP - 15); }
    const max = list.length ? list[0].n : 1;
    list.forEach((grp, r) => {
      const cy = TOP + r * RH + RH / 2;
      g.font = `600 ${narrow ? 12 : 13}px "Schibsted Grotesk", sans-serif`; g.fillStyle = '#f2f4f8'; g.textAlign = 'left';
      g.fillText(fit(g, grp.text, L.lw - 4), L.lab, cy);
      const sh = Math.min(12, RH - 14), sy = cy - sh / 2;
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(L.x0, sy, L.sw, sh);
      const P = X.PAT[grp.pat];
      if (!P || P.period <= 0) { g.fillStyle = X.COL_HEX[grp.col]; g.globalAlpha = .85; g.fillRect(L.x0, sy, L.sw, sh); g.globalAlpha = 1; }
      else {
        for (let t0 = 0; t0 < SPAN; t0 += P.period) {
          let t = t0;
          for (let k = 0; k < P.segs.length; k++) {
            const d = P.segs[k];
            if (!(k & 1) && d > 0 && t < SPAN) { g.fillStyle = X.COL_HEX[P.alt ? P.alt[(k >> 1) % P.alt.length] : grp.col]; g.fillRect(L.x0 + t / SPAN * L.sw, sy, Math.max(1, Math.min(d, SPAN - t) / SPAN * L.sw), sh); }
            t += d;
          }
        }
      }
      if (!narrow) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(L.x1 + 12, cy - 1.5, (L.cw - 56) * Math.sqrt(grp.n / max), 3); }
      g.font = '500 12px "Schibsted Grotesk", sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.textAlign = 'right';
      g.fillText(X.fmt(grp.n), W - 2, cy);
    });
    sc.prev = new Array(list.length).fill(-2);
    sc.hover = -1;
  }
  function fit(g, s, w) { if (g.measureText(s).width <= w) return s; while (s.length > 2 && g.measureText(s + '\u2026').width > w) s = s.slice(0, -1); return s + '\u2026'; }
  function rowAt(e) {
    if (!sc.L) return -1;
    const r = sc.cv.getBoundingClientRect(), y = e.clientY - r.top - sc.L.TOP;
    const i = Math.floor(y / sc.L.RH);
    return y >= 0 && i < list.length ? i : -1;
  }
  const SCALE = [0, 2, 4, 7, 9];
  function segAt(P, x) { for (let k = 0; k < P.edges.length; k++) if (x < P.edges[k]) return k; return -1; }
  function drawScore(t) {
    const L = sc.L; if (!L || !sc.st) return;
    const c = sc.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, sc.cv.width, sc.cv.height);
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    const selKey = sel && sel.key;
    list.forEach((grp, r) => {
      const on = r === sc.hover, picked = selKey === 'g:' + grp.text;
      if (on || picked) { c.fillStyle = on ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.045)'; c.fillRect(0, L.TOP + r * L.RH, L.W, L.RH); }
    });
    c.drawImage(sc.st, 0, 0, L.W, L.H);
    const tau = t % SPAN, px = L.x0 + tau / SPAN * L.sw;
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(px - .5, L.TOP - 4, 1, L.H - L.TOP);
    let fired = 0;
    list.forEach((grp, r) => {
      const cy = L.TOP + r * L.RH + L.RH / 2;
      const st = X.litPat(grp.pat, grp.col, tau, 0);
      if (st >= 0) {
        const cc = X.COL_HEX[st];
        c.fillStyle = cc; c.shadowColor = cc; c.shadowBlur = 12;
        c.beginPath(); c.arc(L.lamp, cy, 5, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      } else { c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1; c.beginPath(); c.arc(L.lamp, cy, 4.5, 0, Math.PI * 2); c.stroke(); }
      const was = sc.prev[r]; sc.prev[r] = st;
      const P = X.PAT[grp.pat];
      if (sound && P && st >= 0 && was === -1 && fired < 5) {
        fired++;
        const deg = r % 15, f = 196 * Math.pow(2, (Math.floor(deg / 5) * 12 + SCALE[deg % 5]) / 12);
        const k = segAt(P, tau % P.period);
        X.tone(f, k >= 0 ? P.segs[k] : .3, (tau / SPAN) * 1.2 - .6, .035 + .07 * Math.sqrt(grp.n / list[0].n));
      }
    });
  }

  // ---------- the clock of cardinal marks ----------
  const CARD = [
    ['north', 'North', 0, /^V?Q$|^V?Q \d/, 'Q', '12'],
    ['east', 'East', 90, /^V?Q\(3\)(?!\+)/, 'Q(3) 10s', '3'],
    ['south', 'South', 180, /^V?Q\(6\)\+LFl/, 'Q(6)+LFl 15s', '6'],
    ['west', 'West', 270, /^V?Q\(9\)(?!\+)/, 'Q(9) 15s', '9'],
  ];
  function buildClock() {
    ck.marks = CARD.map(([key, name, ang, re, text, hour]) => {
      const ids = [];
      for (let i = 0; i < N; i++) { if (!/cardinal/.test(X.D.types[X.type[i]])) continue; if (re.test(X.CODE[X.code[i]].text)) ids.push(i); }
      const g = groups.find(q => q.text === text);
      return { key, name, ang, ids, text, hour, pat: g ? g.pat : 0 };
    });
    const keyEl = el.querySelector('.g-clock-key');
    keyEl.innerHTML = ck.marks.map(m => `<button class="g-card" data-k="${m.key}"><i class="g-lamp"></i><b>${m.name}</b><code>${X.esc(m.text)}</code>${X.rhythmSvg(m.pat, 0, 150, 8, 15)}<small>${X.fmt(m.ids.length)} marks</small></button>`).join('');
    ck.cards = [...keyEl.querySelectorAll('.g-card')];
    const pick = k => { const m = ck.marks.find(q => q.key === k); return { key: 'c:' + k, label: `${m.name} cardinal marks`, ids: m.ids, pat: m.pat, col: 0, note: `${X.fmt(m.ids.length)} marks flashing ${m.text}, or the faster V${m.text.replace(/ \d+s$/, '')}` }; };
    keyEl.addEventListener('pointerover', e => { const b = e.target.closest('[data-k]'); if (b && ck.hover !== b.dataset.k) { ck.hover = b.dataset.k; select(pick(b.dataset.k)); } });
    keyEl.addEventListener('pointerleave', () => { ck.hover = null; select(pinSel); });
    keyEl.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) toggle(pick(b.dataset.k)); });
    const keyAt = e => {
      const r = ck.cv.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      const d = Math.hypot(x, y), R = r.width / 2 * .7;
      if (d <= R * .45 || d >= R * 1.4) return null;
      const a = (Math.atan2(y, x) / RAD + 450) % 360;
      return CARD[Math.round(a / 90) % 4][0];
    };
    ck.cv.addEventListener('pointermove', e => {
      const k = keyAt(e);
      if (k !== ck.hover) { ck.hover = k; select(k ? pick(k) : pinSel); }
      ck.cv.style.cursor = k ? 'pointer' : 'default';
    });
    ck.cv.addEventListener('pointerleave', () => { ck.hover = null; select(pinSel); });
    // a tap sends no pointermove first, so the click finds its own mark
    ck.cv.addEventListener('click', e => { const k = keyAt(e); if (k) toggle(pick(k)); });
  }
  function drawClock(t) {
    const cv = ck.cv, W = cv.clientWidth; if (!W) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr); }
    const c = ck.c; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, W);
    const cx = W / 2, cy = W / 2, R = W / 2 * .7;
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    for (let h = 0; h < 12; h++) {
      if (h % 3 === 0) continue;
      const a = (h * 30 - 90) * RAD;
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const m of ck.marks) {
      const a = (m.ang - 90) * RAD, lx = cx + Math.cos(a) * R, ly = cy + Math.sin(a) * R;
      const on = X.litPat(m.pat, 0, t, 0) >= 0, hot = ck.hover === m.key || (sel && sel.key === 'c:' + m.key);
      if (on) { c.fillStyle = '#fff3d6'; c.shadowColor = '#fff3d6'; c.shadowBlur = 24; c.beginPath(); c.arc(lx, ly, 9, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; }
      else { c.fillStyle = '#000'; c.strokeStyle = hot ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.arc(lx, ly, 8, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.font = `650 ${Math.max(12, W * .045)}px "Schibsted Grotesk", sans-serif`;
      c.fillStyle = hot ? '#f2f4f8' : 'rgba(255,255,255,.42)';
      c.fillText(m.hour, cx + Math.cos(a) * R * .74, cy + Math.sin(a) * R * .74);
      c.font = `600 ${Math.max(11, W * .038)}px "Schibsted Grotesk", sans-serif`;
      c.fillStyle = hot ? '#f2f4f8' : 'rgba(255,255,255,.72)';
      c.fillText(m.name, cx + Math.cos(a) * R * 1.24, cy + Math.sin(a) * R * 1.24);
    }
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(cx, cy, 2.5, 0, Math.PI * 2); c.fill();
    ck.cards.forEach((b, k) => { const m = ck.marks[k]; b.classList.toggle('lit', X.litPat(m.pat, 0, t, 0) >= 0); b.classList.toggle('hot', !!(sel && sel.key === 'c:' + m.key)); });
  }

  // ---------- Morse letters ----------
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  function buildMorse() {
    const by = new Map();
    for (const g of groups) { const m = g.text.match(/^Mo\(([A-Z])\)/); if (!m) continue; const L = m[1]; if (!by.has(L)) by.set(L, { L, ids: [], best: g }); const o = by.get(L); for (const i of g.ids) o.ids.push(i); if (g.n > o.best.n) o.best = g; }
    const letters = [...by.values()].filter(o => o.ids.length >= 5).sort((a, b) => b.ids.length - a.ids.length);
    const box = el.querySelector('.g-morse');
    box.innerHTML = letters.map(o => `<button class="g-mo" data-l="${o.L}" style="--lamp:${X.COL_HEX[o.best.col]}"><span class="g-mo-l">${o.L}</span><span class="g-mo-code" aria-hidden="true">${[...MORSE[o.L]].map(s => `<i class="${s === '-' ? 'da' : 'di'}"></i>`).join('')}</span><b>${X.fmt(o.ids.length)}</b><small>${X.esc(mostly(o.ids))}</small></button>`).join('');
    const pick = L => { const o = by.get(L); return { key: 'm:' + L, label: `The letter ${L}`, ids: o.ids, pat: o.best.pat, col: o.best.col, note: `${X.fmt(o.ids.length)} lights spelling ${L}, ${mostly(o.ids)}. The commonest is ${o.best.text}.` }; };
    box.addEventListener('pointerover', e => { const b = e.target.closest('[data-l]'); if (b && (!sel || sel.key !== 'm:' + b.dataset.l)) select(pick(b.dataset.l)); });
    box.addEventListener('pointerleave', () => select(pinSel));
    box.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) toggle(pick(b.dataset.l)); });
    ck.morse = letters.map(o => { const b = box.querySelector(`[data-l="${o.L}"]`); return { L: o.L, pat: o.best.pat, el: b, marks: [...b.querySelectorAll('.g-mo-code i')], idx: -2 }; });
  }
  function drawMorse(t) {
    if (!ck.morse) return;
    for (const m of ck.morse) {
      // light the dot or dash being sent right now
      const P = X.PAT[m.pat]; let idx = -1;
      if (P && P.period > 0) { const k = segAt(P, t % P.period); if (k >= 0 && !(k & 1)) idx = k >> 1; }
      if (idx !== m.idx) { m.idx = idx; m.marks.forEach((d, j) => d.classList.toggle('on', j === idx)); }
      m.el.classList.toggle('hot', !!(sel && sel.key === 'm:' + m.L));
    }
  }

  // ---------- the beat ----------
  function buildBeat() {
    const bins = new Map();
    for (const g of groups) {
      if (!g.per || g.per > 30) continue;
      const p = Math.round(g.per * 2) / 2;
      if (!bins.has(p)) bins.set(p, { p, n: 0, by: [0, 0, 0, 0, 0], ids: [] });
      const b = bins.get(p); b.n += g.n; b.by[g.col <= 3 ? g.col : 4] += g.n; for (const i of g.ids) b.ids.push(i);
    }
    ck.bins = [...bins.values()].sort((a, b) => a.p - b.p);
  }
  function drawBeat() {
    const svg = d3.select(el.querySelector('.g-beat svg')), bins = ck.bins;
    const W = el.querySelector('.g-beat').getBoundingClientRect().width || 600, H = 200, m = { l: 4, r: 8, t: 22, b: 26 };
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const x = d3.scaleLinear().domain([0, 30.5]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.n)]).range([H - m.b, m.t]);
    const bw = Math.max(2, (x(.5) - x(0)) * .7);
    const fill = ['#fff3d6', '#ff4d3f', '#38ff8e', '#ffd43b', '#8a90a0'];
    svg.selectAll('*').remove();
    const ax = svg.append('g').attr('class', 'g-ax');
    for (let s = 0; s <= 30; s += 5) ax.append('text').attr('x', x(s)).attr('y', H - 8).attr('text-anchor', s === 0 ? 'start' : 'middle').text(s === 0 ? '0' : `${s} s`);
    const bars = svg.append('g').selectAll('g').data(bins).join('g').attr('class', 'g-bin').attr('transform', b => `translate(${x(b.p) - bw / 2},0)`);
    bars.each(function (b) {
      let acc = 0; const gg = d3.select(this);
      b.by.forEach((n, k) => { if (!n) return; const y0 = y(acc), y1 = y(acc + n); gg.append('rect').attr('x', 0).attr('width', bw).attr('y', y1).attr('height', Math.max(.6, y0 - y1)).attr('fill', fill[k]); acc += n; });
      gg.append('rect').attr('x', -2).attr('width', bw + 4).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent');
    });
    const top = bins.reduce((a, b) => b.n > a.n ? b : a);
    svg.append('text').attr('class', 'g-top').attr('x', x(top.p) + bw).attr('y', y(top.n) + 4).text(`${top.p} seconds, ${X.fmt(top.n)} lights`);
    const tip = b => `<b>Every ${b.p} seconds</b><small>${X.fmt(b.n)} lights</small>`;
    bars.on('pointerenter', (e, b) => { select({ key: 'b:' + b.p, label: `Every ${b.p} seconds`, ids: b.ids, pat: -1, col: 0, note: `${X.fmt(b.n)} lights start their pattern over every ${b.p} seconds, ${mostly(b.ids)}` }); X.tip(tip(b), e.clientX, e.clientY); })
      .on('pointermove', (e, b) => X.tip(tip(b), e.clientX, e.clientY))
      .on('pointerleave', () => { X.tip(null); select(pinSel); })
      .on('click', (e, b) => toggle({ key: 'b:' + b.p, label: `Every ${b.p} seconds`, ids: b.ids, pat: -1, col: 0, note: `${X.fmt(b.n)} lights start their pattern over every ${b.p} seconds, ${mostly(b.ids)}` }));
  }

  // ---------- the map beside it all ----------
  function select(s) {
    sel = s;
    const cap = el.querySelector('.g-cap');
    if (!s) { cap.innerHTML = '<b>Point at anything</b><small>A row, a mark on the clock, a letter or a bar, and its lights flash here in their own rhythm.</small>'; return; }
    cap.innerHTML = `<b>${X.esc(s.label)}</b><small>${X.esc(s.note)}</small>` + (s.pat >= 0 ? `<span class="rh-row">${X.rhythmSvg(s.pat, s.col, 220, 9)}</span>` : '') + (pinSel && pinSel.key === s.key ? '<em>Kept. Click it again to let go.</em>' : '');
  }
  function mapLayout() {
    const W = Math.round(mp.cv.parentElement.getBoundingClientRect().width);
    if (!W) return false;
    if (mp.W === W) return true;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const merc = la => Math.log(Math.tan(Math.PI / 4 + la * RAD / 2));
    const k = (W - 4) / (2 * Math.PI), top = 2 + k * merc(76);
    const proj = d3.geoMercator().scale(k).translate([W / 2, top]);
    const H = Math.round(k * (merc(76) - merc(-56)) + 4);
    mp.W = W; mp.H = H; mp.dpr = dpr;
    mp.cv.width = W * dpr; mp.cv.height = H * dpr; mp.cv.style.height = H + 'px';
    mp.px = new Float32Array(N); mp.py = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = proj([X.lon[i], Math.max(-84, Math.min(84, X.lat[i]))]); mp.px[i] = p[0]; mp.py[i] = p[1]; }
    const b = mp.base || (mp.base = document.createElement('canvas')); b.width = W * dpr; b.height = H * dpr;
    const g = b.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mp.land) { g.beginPath(); d3.geoPath(proj, g)(mp.land); g.fillStyle = '#101217'; g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.13)';
    for (let i = 0; i < N; i++) g.fillRect(mp.px[i] - .4, mp.py[i] - .4, .8, .8);
    return true;
  }
  function drawMap(t) {
    if (!mapLayout()) return;
    const c = mp.c, dpr = mp.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, mp.cv.width, mp.cv.height);
    c.drawImage(mp.base, 0, 0);
    if (!sel) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ids = sel.ids, many = ids.length > 1500, few = ids.length < 250;
    const core = few ? 3.6 : many ? 2.2 : 2.8, halo = few ? 12 : 8;
    c.globalCompositeOperation = 'lighter';
    for (let q = 0; q < ids.length; q++) {
      const i = ids[q], st = X.lit(i, t), x = mp.px[i], y = mp.py[i];
      if (st >= 0) { c.fillStyle = X.COL_HEX[st]; c.globalAlpha = many ? .6 : .95; c.fillRect(x - core / 2, y - core / 2, core, core); c.globalAlpha = many ? .07 : few ? .2 : .15; c.fillRect(x - halo / 2, y - halo / 2, halo, halo); }
      else { c.fillStyle = X.COL_HEX[X.CODE[X.code[i]].col]; c.globalAlpha = few ? .5 : .3; c.fillRect(x - core / 3, y - core / 3, core / 1.5, core / 1.5); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  // ---------- loop and layout ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const t = now / 1000;
    drawScore(t); drawClock(t); drawMorse(t); drawMap(t);
  }
  let lastW = 0;
  function resize() {
    const W = el.querySelector('.g-wrap').getBoundingClientRect().width;
    if (!W || Math.abs(W - lastW) < 1) return;
    lastW = W; layoutScore(); mp.W = 0; drawBeat();
  }
  function show() {
    visible = true;
    lastW = 0; resize();
    select(pinSel);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function hide() { visible = false; cancelAnimationFrame(raf); X.tip(null); }
  X.views.grammar = { init, show, hide, state: () => ({ built, rows: list.length, groups: groups.length, sel: sel && sel.key, sound }) };
})();
