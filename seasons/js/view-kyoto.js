/* The Slow Clock: 838 Springs.
   Every full bloom in Kyoto since 812, colored by the kind of record it came from, and underneath, the documents themselves:
   court histories, courtiers' and temples' diaries, poems, railway advertisements and newspapers. */
(function () {
  'use strict';
  const X = window.CX, KY = X.KY, K = X.byKey.kyoto;
  let el, built = false, visible = false, svg, W = 0, only = null, hotRef = -1;
  const GLOSS = {
    'NIHON-KOKI': 'one of the official histories of the imperial court',
    'MEIGETSUKI': 'the diary of the poet Fujiwara no Teika',
    'OYUDONONO-UENO-NIKKI': 'the diary kept by the ladies-in-waiting of the imperial palace',
    'OYUDONONO-UENO-NIKKI [EDA]': 'the diary kept by the ladies-in-waiting of the imperial palace, in a second copy',
    'DAIGOJI-ZATSUYO': 'records of Daigo-ji, a temple known for its cherry trees',
    'SANETAKA-KOKI': 'the diary of the courtier Sanjonishi Sanetaka',
    'SUGIURAKE-NIKKI': 'the diary of the Sugiura family',
    'NEWS-PAPER(ARASHIYAMA)': 'newspaper reports from Arashiyama',
    'KEIHAN RAILWAY ADV(ARASHIYAMA)': 'advertisements for the Keihan railway to Arashiyama',
  };
  const TYPES = [2, 1, 0, 4, 3, 8, 9];

  function init(root) {
    el = root;
    const cnt = {}; KY.t.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; });
    const iMin = KY.d.indexOf(Math.min(...KY.d)), iMax = KY.d.indexOf(Math.max(...KY.d));
    el.innerHTML = `
      <div class="s-wrap">
        <div class="s-lede">
          <p class="s-big">Kyoto has the longest record of its kind. Starting in 812, the day the city's cherries peaked was written into court histories, diaries and poems, most often as the day of a blossom-viewing party. Since the 1880s the newspapers have reported it.</p>
          <div class="s-facts">
            <div><b>${KY.y[iMin]}</b><span>${X.dateText(KY.y[iMin], KY.d[iMin])}, the earliest full bloom in the record</span></div>
            <div><b>${KY.y[iMax]}</b><span>${X.dateText(KY.y[iMax], KY.d[iMax])}, the latest</span></div>
            <div><b>${Math.abs(K.shift)} days</b><span>earlier, on average, over the last 30 years than from 1400 to 1900</span></div>
          </div>
        </div>
        <div class="s-types" role="group" aria-label="Kind of record">${TYPES.filter(t => cnt[t]).map(t => `<button class="s-type" data-t="${t}" aria-pressed="false" style="--c:${X.TYPE[t][2]}" title="${X.esc(X.TYPE[t][1])}"><i></i><b>${X.TYPE[t][0]}</b><small>${X.fmt(cnt[t])}</small></button>`).join('')}</div>
        <p class="s-key">Each dot is one spring, colored by the kind of record it came from. The white line is a smoothed average, and the dotted line is the average from 1400 to 1900, ${X.dateText(1801, K.base)}.</p>
        <div class="s-chart"><svg aria-label="Full-bloom dates in Kyoto by year, colored by the kind of record"></svg></div>
        <h3 class="s-h">Who kept the date</h3>
        <p class="s-p">Each line is one document, from the first year it gives a date to the last. Point at one to find its springs above.</p>
        <div class="s-docs"><svg aria-label="The documents Kyoto's dates were taken from, by the years they cover"></svg></div>
      </div>`;
    svg = d3.select(el.querySelector('.s-chart svg'));
    el.querySelector('.s-types').addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const t = +b.dataset.t; only = only === t ? null : t;
      el.querySelectorAll('.s-type').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.t === only)));
      paint();
    });
    new ResizeObserver(() => { if (visible) draw(); }).observe(el.querySelector('.s-chart'));
    built = true;
  }

  let xs, ys, dotSel, docSel;
  function draw() {
    const box = el.querySelector('.s-chart').getBoundingClientRect();
    const w = Math.round(box.width); if (!w || w === W) return; W = w;
    const narrow = W < 640, H = narrow ? 360 : 460, m = { l: narrow ? 44 : 60, r: narrow ? 8 : 16, t: 16, b: 28 };
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    svg.selectAll('*').remove();
    xs = d3.scaleLinear().domain([800, 2030]).range([m.l, W - m.r]);
    ys = d3.scaleLinear().domain([80, 127]).range([H - m.b, m.t]);
    const g = svg.append('g');
    for (const [d, lab] of [[81, 'March 22'], [91, 'April 1'], [101, 'April 11'], [111, 'April 21'], [121, 'May 1']]) {
      g.append('line').attr('class', 's-grid').attr('x1', m.l).attr('x2', W - m.r).attr('y1', ys(d)).attr('y2', ys(d));
      g.append('text').attr('class', 's-ax').attr('x', m.l - 8).attr('y', ys(d) + 4).attr('text-anchor', 'end').text(narrow ? lab.replace('April', 'Apr').replace('March', 'Mar') : lab);
    }
    for (let y = 800; y <= 2000; y += narrow ? 200 : 100) g.append('text').attr('class', 's-ax').attr('x', xs(y)).attr('y', H - 8).attr('text-anchor', 'middle').text(y);
    g.append('line').attr('class', 's-base').attr('x1', xs(1400)).attr('x2', xs(1900)).attr('y1', ys(K.base)).attr('y2', ys(K.base));
    const line = d3.line().defined(p => p[1] !== null).x(p => xs(p[0])).y(p => ys(p[1])).curve(d3.curveBasis);
    g.append('path').attr('class', 's-mean').attr('d', line(K.mean));
    const idx = KY.y.map((y, i) => i);
    dotSel = g.append('g').selectAll('circle').data(idx).join('circle')
      .attr('cx', i => xs(KY.y[i])).attr('cy', i => ys(KY.d[i])).attr('r', narrow ? 2.4 : 3.1)
      .attr('fill', i => (X.TYPE[KY.t[i]] || X.TYPE[0])[2]);
    dotSel.on('pointerenter', (e, i) => { X.tip(X.recordHtml(K, i) + gloss(i), e.clientX, e.clientY); hotRef = KY.r[i]; paint(); })
      .on('pointermove', (e, i) => X.tip(X.recordHtml(K, i) + gloss(i), e.clientX, e.clientY))
      .on('pointerleave', e => { X.untip(e); if (e.pointerType !== 'touch') { hotRef = -1; paint(); } });
    const note = (i, text, dx, dy, anchor) => {
      const x = xs(KY.y[i]), y = ys(KY.d[i]);
      g.append('line').attr('class', 's-lead').attr('x1', x).attr('y1', y).attr('x2', x + dx * .85).attr('y2', y + dy * .7);
      g.append('text').attr('class', 's-note').attr('x', x + dx).attr('y', y + dy).attr('text-anchor', anchor).text(text);
    };
    const iMin = KY.d.indexOf(Math.min(...KY.d)), iMax = KY.d.indexOf(Math.max(...KY.d));
    if (!narrow) {
      note(iMin, `${X.dateText(KY.y[iMin], KY.d[iMin])}, ${KY.y[iMin]}: the earliest`, -26, 10, 'end');
      note(iMax, `${X.dateText(KY.y[iMax], KY.d[iMax])}, ${KY.y[iMax]}: the latest`, 18, -4, 'start');
      note(0, `${KY.y[0]}: the first date, a blossom-viewing party`, 10, -30, 'start');
    }
    drawDocs();
    paint();
  }
  function gloss(i) { const r = KY.r[i]; const n = r >= 0 ? KY.refs[r] : ''; return GLOSS[n] ? `<em>That is ${X.esc(GLOSS[n])}.</em>` : ''; }

  // ---------- the documents ----------
  function drawDocs() {
    const s = d3.select(el.querySelector('.s-docs svg'));
    const docs = new Map();
    KY.r.forEach((r, i) => { if (r < 0) return; const o = docs.get(r) || { r, name: KY.refs[r], ys: [], t: {} }; o.ys.push(KY.y[i]); o.t[KY.t[i]] = (o.t[KY.t[i]] || 0) + 1; docs.set(r, o); });
    const list = [...docs.values()].map(o => ({ ...o, a: Math.min(...o.ys), b: Math.max(...o.ys), n: o.ys.length, type: +Object.entries(o.t).sort((p, q) => q[1] - p[1])[0][0] }));
    // lanes, packed by start year, so the documents read left to right like a relay
    list.sort((p, q) => p.a - q.a || q.n - p.n);
    const lanes = [], pad = W < 640 ? 10 : 18, labelled = o => o.n >= (W < 640 ? 15 : 8);
    for (const o of list) {
      const lw = labelled(o) ? labelW(o) : 0;
      o.left = lw && Math.max(xs(o.b), xs(o.a) + 2) + lw > W - 4;          // near the right edge the name goes before the line
      const start = xs(o.a) - (o.left ? lw : 0);
      let li = lanes.findIndex(end => start > end + pad);
      if (li < 0) { lanes.push(0); li = lanes.length - 1; }
      lanes[li] = Math.max(xs(o.b), xs(o.a) + 2) + (o.left ? 0 : lw);
      o.lane = li;
    }
    const LH = 11, H = lanes.length * LH + 30;
    s.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    s.selectAll('*').remove();
    const step = W < 640 ? 200 : 100;
    for (let y = 800; y <= 2000; y += step) { s.append('line').attr('class', 's-grid').attr('x1', xs(y)).attr('x2', xs(y)).attr('y1', 0).attr('y2', H - 22); s.append('text').attr('class', 's-ax').attr('x', xs(y)).attr('y', H - 6).attr('text-anchor', 'middle').text(y); }
    docSel = s.append('g').selectAll('g').data(list).join('g').attr('class', 's-doc').attr('transform', o => `translate(0,${o.lane * LH + 6})`);
    docSel.append('line').attr('x1', o => xs(o.a)).attr('x2', o => Math.max(xs(o.b), xs(o.a) + 2)).attr('y1', 0).attr('y2', 0).attr('stroke', o => X.TYPE[o.type][2]);
    docSel.selectAll('circle').data(o => o.ys.map(y => ({ y, o }))).join('circle').attr('cx', p => xs(p.y)).attr('cy', 0).attr('r', 1.6).attr('fill', p => X.TYPE[p.o.type][2]);
    docSel.filter(labelled).append('text').attr('class', 's-doc-l').attr('x', o => o.left ? xs(o.a) - 5 : Math.max(xs(o.b), xs(o.a) + 2) + 5).attr('text-anchor', o => o.left ? 'end' : 'start').attr('y', 3.5).text(o => o.name);
    docSel.append('rect').attr('x', o => xs(o.a) - 3).attr('width', o => Math.max(6, xs(o.b) - xs(o.a) + 6)).attr('y', -LH / 2).attr('height', LH).attr('fill', 'transparent');
    const tipHtml = o => `<b class="ref-b">${X.esc(o.name)}</b><small>${X.fmt(o.n)} ${o.n === 1 ? 'spring' : 'springs'}, ${o.a === o.b ? o.a : `${o.a} to ${o.b}`}. ${X.esc(X.TYPE[o.type][1])}${o.n > 1 ? ', most of the time' : ''}.</small>` + (GLOSS[o.name] ? `<em>That is ${X.esc(GLOSS[o.name])}.</em>` : '');
    docSel.on('pointerenter', (e, o) => { hotRef = o.r; paint(); X.tip(tipHtml(o), e.clientX, e.clientY); })
      .on('pointermove', (e, o) => X.tip(tipHtml(o), e.clientX, e.clientY))
      .on('pointerleave', e => { X.untip(e); if (e.pointerType !== 'touch') { hotRef = -1; paint(); } });
  }
  let measure = null;
  function labelW(o) { if (!measure) { measure = document.createElement('canvas').getContext('2d'); measure.font = '600 10px "Schibsted Grotesk", sans-serif'; } return measure.measureText(o.name).width + 8; }

  function paint() {
    if (!dotSel) return;
    const narrow = W < 640;
    dotSel.attr('opacity', i => (only === null || KY.t[i] === only) ? (hotRef < 0 || KY.r[i] === hotRef ? .95 : .16) : .07)
      .attr('r', i => (hotRef >= 0 && KY.r[i] === hotRef) ? 4.6 : (narrow ? 2.4 : 3.1))
      .attr('stroke', i => (hotRef >= 0 && KY.r[i] === hotRef) ? '#fff' : 'none');
    if (docSel) docSel.attr('opacity', o => (hotRef < 0 || o.r === hotRef) && (only === null || o.type === only) ? 1 : .2);
  }

  function show() { visible = true; W = 0; draw(); }
  function hide() { visible = false; X.tip(null); }
  X.views.kyoto = { init, show, hide, state: () => ({ built, W, only, hotRef }) };
})();
