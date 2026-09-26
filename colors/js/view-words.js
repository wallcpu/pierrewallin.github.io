/* Bluish Green: What Words Do.
   Light, dark, dusty, neon: what each word does to a color, drawn as a compass of lightness and colorfulness.
   Then the "-ish" rule (the last word pulls harder), and how people spell fuchsia. */
(function () {
  'use strict';
  const X = window.CO, D = X.D, GR = D.gram;
  let el, built = false, visible = false, mod = 'dusty', W = 0, showAll = false;
  const labOf = hex => { const [r, g, b] = X.hex2rgb(hex); return X.rgb2lab(r, g, b); };
  const chroma = l => Math.hypot(l[1], l[2]);
  const hueOf = l => (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360;
  const MODS = Object.keys(GR.mods);
  // each modifier's average effect on lightness and on colorfulness, across the colors it was used with
  const EFFECT = {};
  for (const m of MODS) {
    const rows = Object.entries(GR.mods[m]).map(([base, [hex, users]]) => {
      const B = labOf(GR.bases[base][0]), Mo = labOf(hex);
      let dh = hueOf(Mo) - hueOf(B); dh = ((dh + 540) % 360) - 180;
      return { base, hex, users, bhex: GR.bases[base][0], dL: Mo[0] - B[0], dC: chroma(Mo) - chroma(B), dh, bL: B[0], bC: chroma(B) };
    });
    const w = rows.reduce((s, r) => s + Math.sqrt(r.users), 0);
    EFFECT[m] = { rows, dL: rows.reduce((s, r) => s + r.dL * Math.sqrt(r.users), 0) / w, dC: rows.reduce((s, r) => s + r.dC * Math.sqrt(r.users), 0) / w, n: rows.reduce((s, r) => s + r.users, 0) };
  }
  const HUE_ORDER = ['red', 'maroon', 'rose', 'pink', 'salmon', 'peach', 'orange', 'sienna', 'umber', 'brown', 'tan', 'gold', 'yellow', 'olive', 'lime', 'green', 'teal', 'aqua', 'turquoise', 'cyan', 'blue', 'navy', 'indigo', 'violet', 'purple', 'lavender', 'lilac', 'mauve', 'magenta', 'gray'];

  function init(root) {
    el = root;
    const spell = D.spell, total = spell.reduce((s, x) => s + x[1], 0), right = (spell.find(x => x[0] === 'fuchsia') || [0, 0])[1];
    el.innerHTML = `
      <div class="w-wrap">
        <section class="w-sec">
          <p class="w-big">Put light, dark or dusty in front of a color and people agree on what happens to it. Each arrow here is one word, showing how much lighter or darker it makes a color and how much brighter or grayer.</p>
          <div class="w-mods" role="group" aria-label="Word">${MODS.map(m => `<button class="chip-btn" data-m="${m}" aria-pressed="${m === mod}">${m}</button>`).join('')}</div>
          <div class="w-grid">
            <div class="w-compass"><svg aria-label="What each word does to a color: up is lighter, right is more colorful"></svg></div>
            <div class="w-pairs"></div>
          </div>
        </section>
        <section class="w-sec">
          <h2 class="w-h">The last word pulls harder</h2>
          <p class="w-p">Bluish green is not greenish blue. Each bar runs from one color to another, and the dots show where people put the two names made from them. In every one of these ${GR.ish.length} pairs, the name that ends in a color sits closer to that color than its mirror image does. The small rings are the same two words without the -ish, like blue purple and purple blue, and for those the order hardly matters.</p>
          <div class="w-ish"></div>
          <button class="ctl w-more">${showAll ? 'Show fewer' : `Show all ${GR.ish.length}`}</button>
        </section>
        <section class="w-sec">
          <h2 class="w-h">Fuchsia, fuschia, fushia</h2>
          <p class="w-p">The flower, and then the color, is named after Leonhart Fuchs, a sixteenth-century German botanist, which is where the chs comes from. Of the ${X.fmt(total)} times people wrote the word, ${Math.round(right / total * 100)}% spelled it that way.</p>
          <div class="w-spell">${spell.map(([s, n]) => `<div class="w-sp${s === 'fuchsia' ? ' ok' : ''}"><span class="w-sp-l">${X.esc(s)}</span><span class="w-sp-b"><i style="width:${(n / spell[0][1] * 100).toFixed(1)}%"></i></span><span class="w-sp-n">${X.fmt(n)}</span></div>`).join('')}</div>
        </section>
      </div>`;
    el.querySelector('.w-mods').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) pick(b.dataset.m); });
    el.querySelector('.w-more').addEventListener('click', e => { showAll = !showAll; e.currentTarget.textContent = showAll ? 'Show fewer' : `Show all ${GR.ish.length}`; ish(); });
    new ResizeObserver(() => { if (visible) { const w = el.querySelector('.w-compass').getBoundingClientRect().width; if (Math.abs(w - W) > 1) { W = w; compass(); ish(); } } }).observe(el.querySelector('.w-wrap'));
    built = true;
  }
  function pick(m) {
    mod = m;
    el.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
    compass(); pairs();
  }

  // ---------- the compass ----------
  function compass() {
    const svg = d3.select(el.querySelector('.w-compass svg'));
    const S = Math.max(260, Math.min(520, el.querySelector('.w-compass').getBoundingClientRect().width || 420)), R = S / 2 - 34, cx = S / 2, cy = S / 2;
    svg.attr('width', S).attr('height', S).attr('viewBox', `0 0 ${S} ${S}`);
    svg.selectAll('*').remove();
    const E = EFFECT[mod];
    const lim = 34, sc = v => v / lim * R;
    const g = svg.append('g');
    [.5, 1].forEach(f => g.append('circle').attr('class', 'w-ring').attr('cx', cx).attr('cy', cy).attr('r', R * f));
    g.append('line').attr('class', 'w-axis').attr('x1', cx - R).attr('x2', cx + R).attr('y1', cy).attr('y2', cy);
    g.append('line').attr('class', 'w-axis').attr('x1', cx).attr('x2', cx).attr('y1', cy - R).attr('y2', cy + R);
    const ax = (x, y, t, anchor) => g.append('text').attr('class', 'w-ax').attr('x', x).attr('y', y).attr('text-anchor', anchor).text(t);
    ax(cx, cy - R - 12, 'lighter', 'middle'); ax(cx, cy + R + 20, 'darker', 'middle'); ax(cx + R + 6, cy - 6, 'more', 'start'); ax(cx + R + 6, cy + 8, 'colorful', 'start'); ax(cx - R - 6, cy + 4, 'grayer', 'end');
    // this word, one thin arrow for each color it was used with
    for (const r of E.rows) {
      const x2 = cx + sc(Math.max(-lim, Math.min(lim, r.dC))), y2 = cy - sc(Math.max(-lim, Math.min(lim, r.dL)));
      g.append('line').attr('class', 'w-thin').attr('x1', cx).attr('y1', cy).attr('x2', x2).attr('y2', y2).attr('stroke', r.hex);
      g.append('circle').attr('cx', x2).attr('cy', y2).attr('r', 5).attr('fill', r.hex).attr('class', 'w-tipdot')
        .on('pointerenter', e => X.tip(`<b>${X.esc(mod)} ${X.esc(r.base)}</b><small>${X.esc(describe(r))}</small>`, e.clientX, e.clientY))
        .on('pointerleave', () => X.tip(null));
    }
    // every word's average, faint, and this one bright; labels step aside when they would overlap
    const boxes = [];
    const order = MODS.slice().sort((p, q) => (p === mod ? -1 : q === mod ? 1 : EFFECT[q].n - EFFECT[p].n));
    for (const m of order) {
      const e = EFFECT[m], x2 = cx + sc(e.dC), y2 = cy - sc(e.dL), on = m === mod;
      const a = g.append('g').attr('class', 'w-mod' + (on ? ' on' : '')).style('cursor', 'pointer').on('click', () => pick(m));
      a.append('line').attr('x1', cx).attr('y1', cy).attr('x2', x2).attr('y2', y2);
      a.append('circle').attr('cx', x2).attr('cy', y2).attr('r', on ? 5 : 3);
      const ang = Math.atan2(y2 - cy, x2 - cx), anchor = Math.cos(ang) > .3 ? 'start' : Math.cos(ang) < -.3 ? 'end' : 'middle';
      const w = m.length * (on ? 7.4 : 6.2) + 4, h = on ? 15 : 13;
      let lx = x2 + Math.cos(ang) * 12, ly = y2 + Math.sin(ang) * 12 + 4, ok = false;
      for (const dy of [0, -13, 13, -26, 26]) {
        const x0 = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2, b = [x0, ly + dy - h + 3, x0 + w, ly + dy + 3];
        if (!boxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])) { boxes.push(b); ly += dy; ok = true; break; }
      }
      if (ok || on) a.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', anchor).text(m);
    }
    g.selectAll('.w-mod.on').raise();
    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 3).attr('class', 'w-center');
  }
  function describe(r) {
    const bits = [];
    if (Math.abs(r.dL) >= 4) bits.push(`${Math.round(Math.abs(r.dL))} points ${r.dL > 0 ? 'lighter' : 'darker'}`);
    if (Math.abs(r.dC) >= 4) bits.push(`${Math.round(Math.abs(r.dC))} points ${r.dC > 0 ? 'more colorful' : 'grayer'}`);
    if (Math.abs(r.dh) >= 12 && r.bC > 12) bits.push(`its hue turned ${Math.round(Math.abs(r.dh))} degrees`);
    return (bits.length ? bits.join(', ') : 'about the same color') + ` than plain ${r.base}. ${X.fmt(r.users)} people used it.`;
  }

  // ---------- the pairs ----------
  function pairs() {
    const E = EFFECT[mod], rows = E.rows.slice().sort((p, q) => HUE_ORDER.indexOf(p.base) - HUE_ORDER.indexOf(q.base));
    const summary = (() => {
      const bits = [];
      if (Math.abs(E.dL) >= 3) bits.push(`${E.dL > 0 ? 'lighter' : 'darker'} by ${Math.round(Math.abs(E.dL))}`);
      if (Math.abs(E.dC) >= 3) bits.push(`${E.dC > 0 ? 'more colorful' : 'grayer'} by ${Math.round(Math.abs(E.dC))}`);
      return bits.length ? `On average, ${mod} makes a color ${bits.join(' and ')}, on a scale where black to white is 100.` : `On average, ${mod} barely moves a color at all.`;
    })();
    el.querySelector('.w-pairs').innerHTML = `<p class="w-sum">${X.esc(summary)}</p><div class="w-chips">${rows.map(r => `
      <div class="w-pair"><span class="w-c" style="background:${r.bhex}"></span><span class="w-c" style="background:${r.hex}"></span>
        <span class="w-pl"><b>${X.esc(mod)} ${X.esc(r.base)}</b><small>${X.fmt(r.users)} people</small></span></div>`).join('')}</div>`;
  }

  // ---------- -ish ----------
  function ish() {
    const box = el.querySelector('.w-ish');
    const list = showAll ? GR.ish : GR.ish.slice(0, 8);
    const ISH = { red: 'reddish', orange: 'orangish', yellow: 'yellowish', green: 'greenish', blue: 'bluish', purple: 'purplish', pink: 'pinkish', brown: 'brownish', gray: 'grayish' };
    box.innerHTML = list.map(p => {
      const ab = `${ISH[p.a]} ${p.b}`, ba = `${ISH[p.b]} ${p.a}`;
      const pos = t => `${(Math.max(0, Math.min(1, t)) * 100).toFixed(1)}%`;
      const plain = [p.plain_ab && [`${p.a} ${p.b}`, ...p.plain_ab], p.plain_ba && [`${p.b} ${p.a}`, ...p.plain_ba]].filter(Boolean);
      return `<div class="w-row">
        <span class="w-end" style="--c:${p.A}">${X.esc(p.a)}</span>
        <div class="w-track" style="background:linear-gradient(90deg, ${p.A}, ${p.B})">
          <span class="w-dot up" style="left:${pos(p.ab[2])};--c:${p.ab[0]}" data-t="${X.esc(ab)}|${p.ab[1]}"><b>${X.esc(ab)}</b></span>
          <span class="w-dot dn" style="left:${pos(p.ba[2])};--c:${p.ba[0]}" data-t="${X.esc(ba)}|${p.ba[1]}"><b>${X.esc(ba)}</b></span>
          ${plain.map(([n, hex, users, t]) => `<span class="w-tick" style="left:${pos(t)};--c:${hex}" data-t="${X.esc(n)}|${users}"></span>`).join('')}
        </div>
        <span class="w-end r" style="--c:${p.B}">${X.esc(p.b)}</span>
        <span class="w-leg"><i style="background:${p.ab[0]}"></i>${X.esc(ab)}<i style="background:${p.ba[0]}"></i>${X.esc(ba)}</span>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-t]').forEach(s => {
      const [n, u] = s.dataset.t.split('|');
      const show = e => X.tip(`<b>${X.esc(n)}</b><small>${X.fmt(+u)} people used this name.</small>`, e.clientX, e.clientY);
      s.addEventListener('pointerenter', show); s.addEventListener('click', show);
      s.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') X.tip(null); });
    });
  }

  function show() { visible = true; W = el.querySelector('.w-compass').getBoundingClientRect().width; compass(); pairs(); ish(); }
  function hide() { visible = false; X.tip(null); }
  X.views.words = { init, show, hide, state: () => ({ built, mod, mods: MODS.length, ish: GR.ish.length }) };
})();
