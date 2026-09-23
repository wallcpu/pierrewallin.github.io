/* Album Atlas — shared core. Exposes window.Atlas. */
(function () {
  'use strict';
  const D = window.ATLAS;
  const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];
  const albums = D.albums;
  const byId = new Map(albums.map(a => [a.id, a]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- time ----------
  const seasonOf = t => { const y = Math.floor(t + 1e-6); return { y, s: SEASONS[Math.min(3, Math.floor((t - y) * 4 + 1e-6))] }; };
  const seasonLabel = t => { const { y, s } = seasonOf(t); return `${s} ${y}`; };
  function spanLabel(sp) {
    const a = seasonLabel(sp.t0), b = seasonLabel(sp.t1 - 0.25);
    return a === b ? a : `${a} → ${b}`;
  }
  const phaseAt = t => D.phases.find(p => p.t0 <= t && t < p.t1) || (t < D.phases[0].t0 ? D.phases[0] : D.phases[D.phases.length - 1]);
  function homeAt(t) {
    for (const [a, b, n] of D.home) if (a <= t && t < b) return n;
    return t < D.home[0][0] ? D.home[0][2] : D.home[D.home.length - 1][2];
  }
  const activeAt = (a, t) => a.spans.some(s => s.t0 <= t && t < s.t1);
  const spanAt = (a, t) => a.spans.find(s => s.t0 <= t && t < s.t1) || null;
  function anchorAt(a, t) {
    let best = a.anchors[0], bd = Infinity;
    for (const an of a.anchors) { const d = Math.abs(an.t - t); if (d < bd) { bd = d; best = an; } }
    return best;
  }
  const placeLabel = k => (D.places[k] ? D.places[k].label : k);

  // ---------- private layer: empty until atlas-lock.js decrypts it ----------
  let locked = true;
  const priv = { notes: {} };
  const note = k => priv.notes[k] || '';
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const shapeLine = a => `${a.role ? cap(a.role) + '. ' : ''}${cap(placeLabel(anchorAt(a, a.t0 + 0.125).place))}, ${seasonLabel(a.t0).toLowerCase()}.`;
  const memsOf = a => (locked ? (a.nm ? [shapeLine(a)] : []) : (a.mems || []));

  // ---------- colour ----------
  const major = a => a.fn === 'anchor' || a.fn === 'turning-point' || a.fn === 'hinge';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hslHex = (h, s, l) => d3.hsl(h, s, l).formatHex();
  const vivid = a => hslHex(a.hue, clamp(a.sat / 100 + .16, 0, .74), clamp(a.lig / 100 + .23, 0, .64));
  const muted = a => hslHex(a.hue, a.sat / 100 * .45, clamp(a.lig / 100 + .1, 0, .46));
  const tone = a => a.silent ? '#5f6675' : major(a) ? vivid(a) : muted(a);
  const glow = a => hslHex(a.hue, clamp(a.sat / 100 + .25, 0, .85), clamp(a.lig / 100 + .34, 0, .74));

  // ---------- tiny event bus ----------
  const handlers = {};
  const on = (e, f) => { (handlers[e] = handlers[e] || []).push(f); };
  const emit = (e, p) => (handlers[e] || []).forEach(f => f(p));

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  // ---------- images (shared cache for canvas views) ----------
  const imgs = new Map();
  function img(a) {
    if (!a.cover) return null;
    let im = imgs.get(a.id);
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = a.cover; imgs.set(a.id, im); }
    return im.complete && im.naturalWidth ? im : null;
  }
  const preload = list => list.forEach(a => img(a));

  // ---------- escaping ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- tooltip ----------
  const tipEl = document.getElementById('atlasTip');
  function tip(a, x, y, extra) {
    if (!a) { tipEl.classList.remove('show'); return; }
    const pic = a.cover ? `<img src="${esc(a.cover)}" alt="">` : `<span class="sw" style="background:${tone(a)}"></span>`;
    tipEl.innerHTML = `${pic}<span><b>${esc(a.title)}</b><small>${esc(a.artist)}</small><em>${esc(extra || spanLabel(a.spans[0]))}</em></span>`;
    const w = tipEl.offsetWidth || 260, h = tipEl.offsetHeight || 60;
    let left = x + 16, top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + h > innerHeight - 8) top = y - h - 16;
    tipEl.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    tipEl.classList.add('show');
  }

  // ---------- memory panel ----------
  const memEl = document.getElementById('mem');
  const memInner = memEl.querySelector('.mem-inner');
  const scrim = document.getElementById('memScrim');
  let openId = null;
  const INT_LABEL = { medium: 'medium rotation', high: 'high rotation', obsessive: 'obsessive rotation' };
  const MED_LABEL = { stereo: 'stereo', ipod: 'iPod', streaming: 'streaming', youtube: 'YouTube', 'car-stereo': 'car stereo' };
  const FN_LABEL = { anchor: 'anchor', 'turning-point': 'turning point', hinge: 'hinge', texture: 'texture' };
  const lockBlock = n => `
      <div class="mem-lock">
        <p><b>${n} ${n === 1 ? 'memory' : 'memories'}</b> written for this album. They’re private.</p>
        <form class="lock-form" data-lock-form>
          <input type="password" name="pass" placeholder="Passphrase" aria-label="Passphrase" autocomplete="current-password" autocapitalize="off" spellcheck="false">
          <button type="submit" class="ctl">Unlock</button>
        </form>
        <p class="lock-msg" aria-live="polite"></p>
      </div>`;

  function whereLine(a) {
    const bits = a.spans.map((s, i) => {
      const home = homeAt(s.t0 + 0.01);
      const an = anchorAt(a, s.t0 + 0.125);
      const anchorsInSpan = a.anchors.filter(x => x.t >= s.t0 && x.t < s.t1);
      const list = anchorsInSpan.length ? anchorsInSpan : [an];
      const away = list.filter(x => x.away);
      let line = `Home base <b>${esc(placeLabel(home))}</b>`;
      if (away.length) line += ` · memory anchored in <b>${away.map(x => esc(placeLabel(x.place)) + (x.label ? ` (${esc(x.label)})` : '')).join('</b> and <b>')}</b>`;
      else if (list.some(x => x.label)) line += ` · ${list.filter(x => x.label).map(x => esc(x.label)).join(', ')}`;
      return a.spans.length > 1 ? `<span>${esc(spanLabel(s))}: ${line}</span>` : line;
    });
    return bits.join('<br>');
  }

  function openPanel(id, opts = {}) {
    const a = byId.get(+id);
    if (!a) return;
    openId = a.id;
    const phase = D.phases.find(p => p.n === a.phase);
    const when = a.spans.map(spanLabel).join(' and ');
    const cover = a.cover
      ? `<div class="mem-cover"><img src="${esc(a.cover)}" alt="Cover of ${esc(a.title)}"></div>`
      : `<div class="mem-cover none" style="background:${tone(a)}">${esc(a.title.slice(0, 1))}</div>`;
    const tags = [];
    if (a.role) tags.push(`<li class="hot" style="background:${vivid(a)}">${esc(a.role)}</li>`);
    if (a.intensity) tags.push(`<li>${esc(INT_LABEL[a.intensity])}</li>`);
    if (a.fn) tags.push(`<li>${esc(FN_LABEL[a.fn] || a.fn)}</li>`);
    tags.push(`<li>influence ${a.rank}</li>`);
    if (a.channel && a.channel !== 'unknown') tags.push(`<li>via ${esc(a.channel.replace(/-/g, ' '))}</li>`);
    if (a.medium) tags.push(`<li>${esc(MED_LABEL[a.medium] || a.medium)}</li>`);
    tags.push(`<li>date confidence ${esc(a.conf || 'not recorded')}</li>`);
    const empty = `<p class="mem-empty">Nothing written about this one yet.</p>`;
    const mems = !locked
      ? ((a.mems || []).length ? `<ol class="mem-mems">${a.mems.map(m => `<li>${esc(m)}</li>`).join('')}</ol>` : empty)
      : a.nm ? lockBlock(a.nm) : empty;
    const provisional = a.anchors.some(x => x.provisional) ? `<p class="mem-flag">Place not recorded, so it sits at the home base for now.</p>` : '';
    memInner.innerHTML = `
      <button class="mem-close" aria-label="Close">✕</button>
      ${cover}
      <div class="mem-kicker">${esc(when)} · ${esc(phase ? phase.name : '')}</div>
      <h2>${esc(a.title)}</h2>
      <div class="mem-artist">${esc(a.artist)}</div>
      <div class="mem-where">${whereLine(a)}</div>
      ${provisional}
      <ul class="mem-tags">${tags.join('')}</ul>
      ${mems}
      ${!locked && a.setting ? `<p class="mem-setting">${esc(a.setting)}</p>` : ''}
      ${!locked && a.context ? `<details><summary>More context</summary><p>${esc(a.context)}</p></details>` : ''}
      <div class="mem-actions">
        <button class="ctl" data-act="rotation">Hear its voice</button>
        <button class="ctl" data-act="crossing">Find it in The Crossing</button>
        <button class="ctl" data-act="tree">Find it in the Tree</button>
        <button class="ctl" data-act="link">Copy link</button>
      </div>`;
    memEl.classList.add('open');
    memEl.setAttribute('aria-hidden', 'false');
    if (innerWidth < 640) scrim.classList.add('show');
    memInner.scrollTop = 0;
    setParams({ album: a.id });
    emit('open', a);
    if (!opts.silent) memEl.querySelector('.mem-close').focus({ preventScroll: true });
  }
  function closePanel() {
    if (openId === null) return;
    const id = openId;
    openId = null;
    memEl.classList.remove('open');
    memEl.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('show');
    setParams({ album: null });
    emit('close', id);
  }
  memEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('mem-close')) return closePanel();
    const act = b.dataset.act, id = openId;
    if (act === 'link') {
      const u = new URL(location.href); u.searchParams.set('album', id);
      navigator.clipboard && navigator.clipboard.writeText(u.toString());
      b.textContent = 'Link copied';
      return;
    }
    if (act) emit('goto', { view: act, id });
  });
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  // ---------- derived series (shared) ----------
  function rotationAt(t) {
    let n = 0, w = 0;
    for (const a of albums) if (activeAt(a, t)) { n++; w += a.w; }
    return { n, w };
  }

  // merge the decrypted payload into the albums, then tell every view
  function applyPrivate(P) {
    for (const [id, p] of Object.entries(P.albums || {})) {
      const a = byId.get(+id);
      if (!a) continue;
      a.mems = p.mems || [];
      a.setting = p.setting || '';
      a.context = p.context || '';
      (p.labels || []).forEach((l, i) => { if (l && a.anchors[i]) a.anchors[i].label = l; });
      if (p.channel) a.channel = p.channel;
    }
    priv.notes = P.notes || {};
    locked = false;
    document.documentElement.classList.add('atlas-open');
    if (openId !== null) openPanel(openId, { silent: true });
    emit('unlock', P);
  }

  window.Atlas = {
    D, albums, byId, reduced, SEASONS,
    seasonOf, seasonLabel, spanLabel, phaseAt, homeAt, activeAt, spanAt, anchorAt, placeLabel,
    major, vivid, muted, tone, glow, hslHex,
    on, emit, params, setParams, img, preload, esc, tip, openPanel, closePanel,
    get openId() { return openId; }, rotationAt, views: {},
    get locked() { return locked; }, note, memsOf, shapeLine, applyPrivate,
  };
})();
