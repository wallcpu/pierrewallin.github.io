/* Hard Cases: Old Questions. The same dilemmas, posed again and again across 2,500 years. Each arc joins
   one telling of a dilemma to the next, like Martin Wattenberg's Shape of Song joins a melody to its repeats. */
(function () {
  'use strict';
  const X = window.HC, O = window.HC_OLD;
  if (!O) { X.views.old = { init() {}, show() {}, hide() {} }; return; }
  const DS = O.dilemmas, LANES = O.lanes, WORDS = O.words || {};
  const PAL = ['#f2a23c', '#62a9ee', '#ee6a5c', '#9bd47c', '#b9a1ff', '#ecd35a', '#5fd3c6', '#f293c4', '#d9a77c', '#a8c8ff', '#ffb48a', '#c8c3bb', '#e98fff', '#7fe0a0', '#ff8f6b'];
  DS.forEach((d, i) => { d.color = PAL[i % PAL.length]; d.tellings.sort((a, b) => a.year - b.year); });
  const ALL = DS.flatMap((d, di) => d.tellings.map((t, ti) => ({ ...t, di, ti })));
  const laneIdx = Object.fromEntries(LANES.map((l, i) => [l, i]));
  // the timeline: three stretches at different scales, so the crowded centuries get room
  const SEGS = [[-650, 250, .36], [250, 1650, .16], [1650, 2025, .48]];
  const fmtYear = y => y < 0 ? `${-y} BCE` : y < 1000 ? `${y} CE` : String(y);
  const span = d => d.tellings[d.tellings.length - 1].year - d.tellings[0].year;

  let root, svgWrap, legendEl, readEl, W = 0, X0 = 0, XW = 0, sel = -1, focusT = null, hot = -1, shown = false, drawn = false;
  const xOf = y => { let x = X0; for (const [a, b, f] of SEGS) { if (y <= b) return x + (Math.max(y, a) - a) / (b - a) * f * XW; x += f * XW; } return x; };

  function build() {
    const mob = innerWidth < 700, w = Math.max(W, mob ? 920 : 0);
    X0 = mob ? 112 : 150; XW = w - X0 - 24;
    const laneH = 17, base = mob ? 330 : 380, maxH = base - 26, lanesTop = base + 44, wordsTop = lanesTop + LANES.length * laneH + 40;
    const wordKeys = Object.keys(WORDS), wordH = 19, height = wordsTop + (wordKeys.length ? 26 + wordKeys.length * wordH : 0) + 10;
    let s = `<svg class="o-svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-label="Arcs joining each telling of a dilemma to the next, from 500 BCE to today">`;
    // axis
    s += `<line x1="${X0}" x2="${X0 + XW}" y1="${base}" y2="${base}" class="o-axis"/>`;
    [[-600, '600 BCE'], [-400, '400 BCE'], [-200, '200 BCE'], [1, '1 CE'], [1000, '1000'], [1700, '1700'], [1800, '1800'], [1900, '1900'], [2000, '2000']].forEach(([y, t]) => { const x = xOf(y); s += `<line x1="${x}" x2="${x}" y1="${base - 3}" y2="${base + 3}" class="o-axis"/><text x="${x}" y="${base + 18}" class="o-tick" text-anchor="middle">${t}</text>`; });
    [250, 1650].forEach(y => { const x = xOf(y); s += `<path d="M${x - 4} ${base + 5}L${x} ${base - 5}M${x + 1} ${base + 5}L${x + 5} ${base - 5}" class="o-brk"/>`; });
    s += `<text x="${xOf(950)}" y="${base + 32}" class="o-tick dim" text-anchor="middle">${mob ? '' : 'the scale changes at 250 and 1650'}</text>`;
    // arcs, longest first so the short ones sit on top
    const arcs = [];
    DS.forEach((d, di) => d.tellings.forEach((t, i) => { if (i) arcs.push({ di, a: d.tellings[i - 1], b: t }); }));
    arcs.sort((p, q) => (q.b.year - q.a.year) - (p.b.year - p.a.year));
    arcs.forEach(({ di, a, b }) => {
      const x1 = xOf(a.year), x2 = Math.max(xOf(b.year), x1 + 2), rx = (x2 - x1) / 2, ry = Math.min(maxH, 6 + rx * .7);
      s += `<path class="o-arc" data-d="${di}" d="M${x1} ${base}A${rx} ${ry} 0 0 1 ${x2} ${base}" stroke="${DS[di].color}"><title>${X.esc(DS[di].name)}: ${X.esc(a.who)}, ${X.esc(a.when)}, to ${X.esc(b.who)}, ${X.esc(b.when)}</title></path>`;
    });
    // lanes and the tellings on them
    LANES.forEach((l, i) => { const y = lanesTop + i * laneH; s += `<text x="${X0 - 10}" y="${y + 4}" text-anchor="end" class="o-lane">${X.esc(l)}</text><line x1="${X0}" x2="${X0 + XW}" y1="${y}" y2="${y}" class="o-lline"/>`; });
    ALL.forEach((t, k) => {
      const x = xOf(t.year), y = lanesTop + (laneIdx[t.lane] ?? 0) * laneH;
      s += `<g class="o-node" data-k="${k}" data-d="${t.di}"><line x1="${x}" x2="${x}" y1="${base}" y2="${y}" class="o-stem"/><circle cx="${x}" cy="${base}" r="2.2" class="o-dot"/><circle cx="${x}" cy="${y}" r="3.4" fill="${DS[t.di].color}"/><rect x="${x - 6}" y="${base - 6}" width="12" height="${y - base + 12}" fill="transparent"/></g>`;
    });
    // when the words arrived, on the same timeline
    if (wordKeys.length) {
      s += `<text x="${xOf(1800) - 10}" y="${wordsTop + 2}" text-anchor="end" class="o-lane b">When the words arrived</text><text x="${xOf(1800)}" y="${wordsTop + 2}" class="o-tick dim">Each phrase in English books, against its own peak</text>`;
      wordKeys.forEach((k, i) => {
        const ws = WORDS[k], y0 = wordsTop + 26 + i * wordH, h = wordH - 4;
        let p = `M${xOf(1800)} ${y0}`;
        ws.s.forEach((v, j) => { p += `L${xOf(1800 + j * 2).toFixed(1)} ${(y0 - v * h).toFixed(1)}`; });
        p += `L${xOf(1800 + (ws.s.length - 1) * 2)} ${y0}Z`;
        s += `<path d="${p}" class="o-word"/><text x="${xOf(1800) - 10}" y="${y0 - 2}" text-anchor="end" class="o-wl">${X.esc(k)}</text>`;
        if (ws.first) s += `<line x1="${xOf(ws.first)}" x2="${xOf(ws.first)}" y1="${y0 - h}" y2="${y0}" class="o-wf"/><text x="${xOf(ws.first) + 4}" y="${y0 - 3}" class="o-wy">${ws.first}</text>`;
      });
    }
    s += '</svg>';
    svgWrap.innerHTML = s;
    paint();
  }

  // ---------- state on the chart ----------
  function paint() {
    const on = hot >= 0 ? hot : sel;
    svgWrap.querySelectorAll('.o-arc').forEach(p => { const d = +p.dataset.d; p.classList.toggle('on', d === on); p.classList.toggle('off', on >= 0 && d !== on); });
    svgWrap.querySelectorAll('.o-node').forEach(g => { const d = +g.dataset.d; g.classList.toggle('on', d === on); g.classList.toggle('off', on >= 0 && d !== on); g.classList.toggle('focus', focusT !== null && +g.dataset.k === focusT); });
    legendEl.querySelectorAll('[data-d]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.d === sel)));
  }
  function drawIn() {
    if (drawn || X.reduced) { drawn = true; return; }
    drawn = true;
    const paths = [...svgWrap.querySelectorAll('.o-arc')];
    // arcs appear in the order their second telling was written
    const end = p => { const m = p.getAttribute('d').match(/ ([\d.]+) [\d.]+$/); return m ? +m[1] : 0; };
    const xs = paths.map(end), lo = Math.min(...xs), hi = Math.max(...xs);
    paths.forEach((p, i) => {
      const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
      const delay = (xs[i] - lo) / (hi - lo || 1) * 2600;
      p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 900, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished.then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }).catch(() => {});
    });
  }

  // ---------- reading ----------
  function read(di, k) {
    sel = di; focusT = k ?? null; paint();
    if (di < 0) { intro(); sync(); return; }
    const d = DS[di], first = d.tellings[0], last = d.tellings[d.tellings.length - 1];
    readEl.innerHTML = `<div class="o-head"><span class="o-sw" style="background:${d.color}"></span><div><h3>${X.esc(d.name)}</h3><p class="o-q">${X.esc(d.question)}</p><p class="o-span">${d.tellings.length} tellings over ${X.fmt(span(d))} years, from ${X.esc(first.who)} to ${X.esc(last.who)}.</p></div><button class="ctl" data-clear>All dilemmas</button></div>
      <ol class="o-list">${d.tellings.map((t, i) => {
        const kk = ALL.findIndex(a => a.di === di && a.ti === i);
        const q = t.quote ? (t.quoteKind === 'verbatim' ? `<blockquote>\u201c${X.esc(t.quote)}\u201d</blockquote>` : `<p class="o-para">${X.esc(t.quote)} <span>(in summary)</span></p>`) : '';
        return `<li class="o-t${kk === focusT ? ' focus' : ''}" data-k="${kk}"><div class="o-when"><b>${X.esc(t.when)}</b><span>${X.esc(t.place || t.lane)}</span></div><div class="o-body"><div class="o-who"><b>${X.esc(t.who)}</b>${t.work ? `<span>${X.esc(t.work)}</span>` : ''}</div>${q}${t.translator && t.quoteKind === 'verbatim' ? `<p class="o-tr">Translated by ${X.esc(t.translator)}</p>` : ''}<p class="o-ans">${X.esc(t.answer)}</p>${t.note ? `<p class="o-note">${X.esc(t.note)}</p>` : ''}${t.url ? `<a class="o-src" href="${X.esc(t.url)}" target="_blank" rel="noopener">Source</a>` : ''}</div></li>`;
      }).join('')}</ol>`;
    sync();
  }
  function intro() {
    let gap = null;
    DS.forEach(d => d.tellings.forEach((t, i) => { if (i && (!gap || t.year - d.tellings[i - 1].year > gap.n)) gap = { n: t.year - d.tellings[i - 1].year, d, a: d.tellings[i - 1], b: t }; }));
    const n = ALL.length;
    readEl.innerHTML = `<div class="o-intro"><p>${DS.length} dilemmas and ${n} tellings, from ${X.esc(fmtYear(Math.min(...ALL.map(t => t.year))))} to ${X.esc(fmtYear(Math.max(...ALL.map(t => t.year))))}. The higher an arc, the longer a dilemma waited to be told again. The longest wait is ${X.fmt(gap.n)} years, from ${X.esc(gap.a.who)} to ${X.esc(gap.b.who)}, for ${X.esc(gap.d.name.charAt(0).toLowerCase() + gap.d.name.slice(1))}.</p><p>Pick a dilemma to read every telling of it in order, in the authors\u2019 own words wherever the text could be checked.</p></div>`;
  }
  function sync() { X.setParams({ d: sel >= 0 ? DS[sel].id : null }); }

  function init(el) {
    root = el;
    root.innerHTML = `<div class="o-legend" role="group" aria-label="Dilemmas">${DS.map((d, i) => `<button class="o-lg" data-d="${i}" aria-pressed="false"><i style="background:${d.color}"></i>${X.esc(d.name)}</button>`).join('')}</div>
      <div class="o-scroll"><div class="o-chart"></div></div>
      <div class="o-read" aria-live="polite"></div>`;
    legendEl = root.querySelector('.o-legend'); svgWrap = root.querySelector('.o-chart'); readEl = root.querySelector('.o-read');
    legendEl.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; read(sel === d ? -1 : d); });
    legendEl.addEventListener('pointerover', e => { const b = e.target.closest('[data-d]'); hot = b ? +b.dataset.d : -1; paint(); });
    legendEl.addEventListener('pointerleave', () => { hot = -1; paint(); });
    svgWrap.addEventListener('pointerover', e => {
      const n = e.target.closest('.o-node'), a = e.target.closest('.o-arc');
      if (n) { const t = ALL[+n.dataset.k]; hot = t.di; paint(); if (e.pointerType !== 'touch') X.tip(`<b>${X.esc(t.who)}</b><small>${X.esc(t.work || '')}${t.work ? ', ' : ''}${X.esc(t.when)}. ${X.esc(DS[t.di].name)}.</small><small>${X.esc(t.answer)}</small>`, e.clientX, e.clientY); return; }
      if (a) { hot = +a.dataset.d; paint(); return; }
    });
    svgWrap.addEventListener('pointermove', e => { const n = e.target.closest('.o-node'); if (n && e.pointerType !== 'touch') { const t = ALL[+n.dataset.k]; X.tip(`<b>${X.esc(t.who)}</b><small>${X.esc(t.work || '')}${t.work ? ', ' : ''}${X.esc(t.when)}. ${X.esc(DS[t.di].name)}.</small><small>${X.esc(t.answer)}</small>`, e.clientX, e.clientY); } else X.tip(null); });
    svgWrap.addEventListener('pointerleave', () => { hot = -1; paint(); X.tip(null); });
    svgWrap.addEventListener('click', e => {
      const n = e.target.closest('.o-node'), a = e.target.closest('.o-arc');
      if (n) { const k = +n.dataset.k; read(ALL[k].di, k); const li = readEl.querySelector(`[data-k="${k}"]`); if (li) li.scrollIntoView({ behavior: X.reduced ? 'auto' : 'smooth', block: 'center' }); return; }
      if (a) { read(+a.dataset.d); return; }
      read(-1);
    });
    readEl.addEventListener('click', e => { if (e.target.closest('[data-clear]')) read(-1); });
    X.onWidth(root, () => { if (!shown) return; W = Math.round(svgWrap.clientWidth); build(); });
    const qd = X.params().get('d'); const di = DS.findIndex(d => d.id === qd); if (di >= 0) sel = di;
  }
  function show() {
    shown = true; W = Math.round(svgWrap.clientWidth);
    build();
    if (sel >= 0) read(sel); else intro();
    drawIn();
  }
  function hide() { shown = false; X.tip(null); }

  X.views.old = { init, show, hide, sync };
})();
