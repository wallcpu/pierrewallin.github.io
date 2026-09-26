/* The Slow Clock: Side by Side.
   The four records on one timeline, each as days early or late against its own average from 1400 to 1900.
   The same years stand out in more than one place. */
(function () {
  'use strict';
  const X = window.CX;
  const Y0 = 1350, Y1 = 2030;
  const NOTES = [
    [1740, 'A famously cold year in Europe', 'The harvest came 23 days late and the ice on the Torne broke 16 days late.'],
    [1816, 'The year without a summer', 'The year after the eruption of Tambora, Burgundy picked its grapes on October 26, among the latest ever.'],
    [1867, 'A famine spring in Finland', 'The ice on the Torne broke on June 9, the latest in its record.'],
    [2003, 'The European heat wave', 'Burgundy began its harvest on August 19, 40 days early and the earliest in 634 years.'],
    [2023, 'The earliest bloom in Kyoto', 'Full bloom came on March 25, the earliest of 838 springs.'],
  ];
  const SUB = { suwa: 'lake freezes', kyoto: 'cherries bloom', torne: 'river ice breaks', burgundy: 'harvest begins' };
  let el, built = false, visible = false, W = 0, svg, xs, hoverY = null, pinY = null;

  function init(root) {
    el = root;
    el.innerHTML = `
      <div class="f-wrap">
        <p class="s-big f-lede">Line the four records up and the same years stand out. Each bar is one year, drawn up when the date came later than its old average and down when it came earlier.</p>
        <div class="f-notes">${NOTES.map(([y, t]) => `<button class="f-note" data-y="${y}"><b>${y}</b><span>${X.esc(t)}</span></button>`).join('')}</div>
        <div class="f-read" id="fRead" aria-live="polite"></div>
        <div class="f-chart"><svg aria-label="The four records as days early or late, by year"></svg></div>
        <p class="s-key">Kyoto's first five centuries are in 838 Springs. A hollow mark on Lake Suwa's row is a winter the lake didn't freeze. A late freeze there means a mild winter, the opposite of the other three.</p>
      </div>`;
    svg = d3.select(el.querySelector('.f-chart svg'));
    const notes = el.querySelector('.f-notes');
    notes.addEventListener('click', e => { const b = e.target.closest('[data-y]'); if (!b) return; const y = +b.dataset.y; pinY = pinY === y ? null : y; paint(); });
    notes.addEventListener('pointerover', e => { const b = e.target.closest('[data-y]'); if (b) { hoverY = +b.dataset.y; paint(); } });
    notes.addEventListener('pointerleave', () => { hoverY = null; paint(); });
    new ResizeObserver(() => { if (visible) draw(); }).observe(el.querySelector('.f-chart'));
    built = true;
  }

  function draw() {
    const w = Math.round(el.querySelector('.f-chart').getBoundingClientRect().width); if (!w || w === W) return; W = w;
    const narrow = W < 640, RH = narrow ? 104 : 128, GAP = 18, m = { l: narrow ? 8 : 150, r: 10, t: 10, b: 26 };
    const H = m.t + X.K.length * (RH + GAP) + m.b;
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    svg.selectAll('*').remove();
    xs = d3.scaleLinear().domain([Y0, Y1]).range([m.l, W - m.r]);
    const bw = Math.max(1, (xs(1) - xs(0)) * .72);
    const root = svg.append('g');
    for (let y = 1400; y <= 2000; y += narrow ? 200 : 100) {
      root.append('line').attr('class', 's-grid').attr('x1', xs(y)).attr('x2', xs(y)).attr('y1', m.t).attr('y2', H - m.b);
      root.append('text').attr('class', 's-ax').attr('x', xs(y)).attr('y', H - 8).attr('text-anchor', 'middle').text(y);
    }
    for (const [y] of NOTES) root.append('line').attr('class', 'f-guide').attr('data-y', y).attr('x1', xs(y)).attr('x2', xs(y)).attr('y1', m.t).attr('y2', H - m.b);
    X.K.forEach((k, ri) => {
      const top = m.t + ri * (RH + GAP), mid = top + RH / 2;
      const ys = d3.scaleLinear().domain([-45, 45]).range([top + RH, top]).clamp(true);
      const g = root.append('g').attr('class', 'f-row');
      g.append('line').attr('class', 'f-zero').attr('x1', m.l).attr('x2', W - m.r).attr('y1', mid).attr('y2', mid);
      if (!narrow) {
        g.append('text').attr('class', 'f-name').attr('x', 0).attr('y', mid - 6).attr('fill', k.col).text(k.short);
        g.append('text').attr('class', 'f-sub').attr('x', 0).attr('y', mid + 11).text(SUB[k.key]);
        g.append('text').attr('class', 'f-tick').attr('x', m.l - 8).attr('y', ys(30) + 4).attr('text-anchor', 'end').text('30 days later');
        g.append('text').attr('class', 'f-tick').attr('x', m.l - 8).attr('y', ys(-30) + 4).attr('text-anchor', 'end').text('30 days earlier');
      } else {
        g.append('text').attr('class', 'f-name').attr('x', m.l).attr('y', top + 10).attr('fill', k.col).text(`${k.short}, ${SUB[k.key]}`);
      }
      const idx = k.y.map((y, i) => i).filter(i => k.y[i] >= Y0);
      g.append('g').selectAll('rect').data(idx.filter(i => k.d[i] !== null)).join('rect')
        .attr('x', i => xs(k.y[i]) - bw / 2).attr('width', bw)
        .attr('y', i => Math.min(mid, ys(k.d[i] - k.base))).attr('height', i => Math.max(.8, Math.abs(ys(k.d[i] - k.base) - mid)))
        .attr('fill', k.col).attr('opacity', .78);
      g.append('g').selectAll('circle').data(idx.filter(i => k.d[i] === null)).join('circle')
        .attr('cx', i => xs(k.y[i])).attr('cy', top + 6).attr('r', 2.6).attr('class', 'f-none').attr('stroke', k.col);
      const line = d3.line().defined(p => p[1] !== null && p[0] >= Y0).x(p => xs(p[0])).y(p => ys(p[1] - k.base)).curve(d3.curveBasis);
      g.append('path').attr('class', 'f-mean').attr('d', line(k.mean));
    });
    svg.append('line').attr('class', 'f-cross').attr('y1', m.t).attr('y2', H - m.b).attr('opacity', 0);
    const yearOf = e => { const [mx] = d3.pointer(e); return Math.max(Y0, Math.min(2026, Math.round(xs.invert(mx)))); };
    svg.append('rect').attr('x', m.l).attr('y', 0).attr('width', W - m.l - m.r).attr('height', H - m.b).attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('pointermove', e => { hoverY = yearOf(e); paint(); })
      .on('pointerleave', e => { if (e.pointerType === 'touch') return; hoverY = null; paint(); })
      // a tap sends no pointermove first, so the click reads its own position
      .on('click', e => { const y = yearOf(e); hoverY = null; pinY = pinY === y ? null : y; paint(); });
    paint();
  }
  function paint() {
    if (!xs) return;
    const y = hoverY ?? pinY;
    const cross = svg.select('.f-cross');
    if (y === null) cross.attr('opacity', 0); else cross.attr('x1', xs(y)).attr('x2', xs(y)).attr('opacity', 1);
    svg.selectAll('.f-guide').attr('opacity', function () { return +this.dataset.y === y ? .9 : .3; });
    el.querySelectorAll('.f-note').forEach(b => b.classList.toggle('on', +b.dataset.y === y));
    const box = el.querySelector('#fRead');
    if (y === null) { box.innerHTML = '<span class="f-hint">Point along the chart to read any year across all four.</span>'; return; }
    const note = NOTES.find(n => n[0] === y);
    box.innerHTML = `<b class="f-y">${y}</b>` + X.K.map(k => {
      const i = k.at.get(y);
      let t;
      if (i === undefined) t = y < k.first ? 'not yet recorded' : 'no record';
      else if (k.d[i] === null) t = 'did not freeze';
      else t = `${X.dateText(y, k.d[i])}, ${X.offText(k, k.d[i]).replace(' than the old average', '')}`;
      return `<span class="f-v" style="--c:${k.col}"><i></i><b>${X.esc(k.short)}</b> ${X.esc(t)}</span>`;
    }).join('') + (note ? `<span class="f-why">${X.esc(note[2])}</span>` : '');
  }

  function show() { visible = true; W = 0; draw(); }
  function hide() { visible = false; X.tip(null); }
  X.views.four = { init, show, hide, state: () => ({ built, W, hoverY, pinY }) };
})();
