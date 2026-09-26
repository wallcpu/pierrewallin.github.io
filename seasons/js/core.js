/* The Slow Clock: shared data, dates, colours and helpers. */
(function () {
  'use strict';
  const D = window.CAL;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS.map(m => m.slice(0, 3));
  const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  // day of year (1-based, may be fractional, or zero and below for a December freeze) to a calendar date
  function dateOf(y, d) {
    let yy = y, dd = Math.round(d);
    if (dd < 1) { yy = y - 1; dd += leap(yy) ? 366 : 365; }
    const L = leap(yy) ? 1 : 0;
    let m = 11; while (m > 0 && dd <= CUM[m] + (m >= 2 ? L : 0)) m--;
    return { y: yy, m, d: dd - CUM[m] - (m >= 2 ? L : 0) };
  }
  const dateText = (y, d, short) => { const t = dateOf(y, d); return `${short ? MON[t.m] : MONTHS[t.m]} ${t.d}`; };

  // ---------- the four keepers ----------
  const K = [
    { key: 'suwa', name: 'Lake Suwa freezes', short: 'Suwa', place: 'Lake Suwa, Japan', col: '#bfe3ff', verb: 'The lake froze', avg: 'the lake froze around' },
    { key: 'kyoto', name: 'The cherries bloom in Kyoto', short: 'Kyoto', place: 'Kyoto, Japan', col: '#ff9cc2', verb: 'Full bloom', avg: 'the cherries reached full bloom around' },
    { key: 'torne', name: 'The ice breaks on the Torne', short: 'Torne', place: 'Tornio, Finland', col: '#47d6c2', verb: 'The ice broke', avg: 'the ice broke around' },
    { key: 'burgundy', name: 'The grapes are picked in Burgundy', short: 'Burgundy', place: 'Burgundy, France', col: '#b08cff', verb: 'The harvest began', avg: 'the harvest began around' },
  ];
  const byKey = Object.fromEntries(K.map(k => [k.key, k]));
  // a smooth average: each year weighs the records near it by a bell curve 12 years wide, and is drawn only where there are enough of them
  function runMean(k, sigma, minW) {
    const out = [], h = Math.ceil(sigma * 3);
    for (let y = k.first; y <= k.last; y++) {
      let s = 0, w = 0;
      for (let q = y - h; q <= y + h; q++) { const i = k.at.get(q); if (i !== undefined && k.d[i] !== null) { const g = Math.exp(-((q - y) ** 2) / (2 * sigma * sigma)); s += g * k.d[i]; w += g; } }
      out.push([y, w >= minW ? s / w : null]);
    }
    return out;
  }
  for (const k of K) {
    const s = D[k.key];
    k.y = s.y; k.d = s.d.map(v => v === -999 ? null : v);
    k.n = k.y.length; k.first = k.y[0]; k.last = k.y[k.n - 1];
    k.at = new Map(k.y.map((y, i) => [y, i]));
    const vals = k.d.filter((v, i) => v !== null && k.y[i] >= 1400 && k.y[i] < 1900);
    k.base = vals.reduce((a, b) => a + b, 0) / vals.length;            // the 1400 to 1899 average, the yardstick for early and late
    k.mean = runMean(k, 12, 4);
    k.meanAt = new Map(k.mean.filter(p => p[1] !== null));
    // where the hand points now: the average of the last 30 years on record
    const recent = k.d.filter((v, i) => v !== null && k.y[i] > k.last - 30);
    k.now = recent.reduce((a, b) => a + b, 0) / recent.length;
    k.froze = recent.length / k.y.filter(y => y > k.last - 30).length;      // for Suwa, the share of recent winters that froze at all
    k.shift = Math.round(k.now - k.base);
  }
  // Suwa's freeze is counted from 1 January, so a December freeze is zero or below; on the clock it sits before New Year
  const angleDay = d => d === null ? null : (d < 1 ? d + 365.2425 : d);

  // ---------- Kyoto's sources ----------
  const KY = D.kyoto;
  const TYPE = {
    0: ['Observed', 'Observed and reported in modern times', '#f4f1ea'],
    1: ['Bloom', 'A diary notes the trees in full bloom', '#ff9cc2'],
    2: ['Party', 'A diary records a blossom-viewing party', '#ff5e9a'],
    3: ['Branches', 'A diary records gifts of blossoming branches', '#9ad97a'],
    4: ['Poem', 'The date comes from the title of a poem', '#ffd27a'],
    8: ['Wisteria', 'Estimated from when the wisteria bloomed', '#b99cff'],
    9: ['Kerria', 'Estimated from when the kerria bloomed', '#ffe45c'],
  };

  // ---------- tooltip and URL ----------
  const tipEl = document.getElementById('uTip');
  let tipAt = 0;
  function tip(html, x, y) {
    if (!html) { tipEl.classList.remove('show'); return; }
    tipAt = performance.now();
    tipEl.innerHTML = html;
    const w = tipEl.offsetWidth || 260, h = tipEl.offsetHeight || 60;
    let left = x + 16, top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + h > innerHeight - 8) top = y - h - 16;
    tipEl.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    tipEl.classList.add('show');
  }
  // on a touch screen a tip stays up after the finger lifts, until the next touch somewhere else or a scroll
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && performance.now() - tipAt > 120) tip(null); }, true);
  addEventListener('scroll', () => { if (performance.now() - tipAt > 300) tip(null); }, { passive: true });
  const untip = e => { if (!e || e.pointerType !== 'touch') tip(null); };
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  // ---------- words ----------
  function offText(k, d) {
    if (d === null) return '';
    const o = Math.round(d - k.base);
    return o === 0 ? 'right on the old average' : `${Math.abs(o)} ${Math.abs(o) === 1 ? 'day' : 'days'} ${o < 0 ? 'earlier' : 'later'} than the old average`;
  }
  const when = (k, y) => k.key === 'suwa' ? `The winter of ${y - 1} to ${y}` : String(y);
  function recordHtml(k, i) {
    const y = k.y[i], d = k.d[i];
    if (d === null) return `<b>${when(k, y)}</b><small>Lake Suwa did not freeze.</small>`;
    let extra = '';
    if (k.key === 'kyoto') { const t = TYPE[KY.t[i]]; extra = `<small>${esc(t ? t[1] : '')}.</small>` + (KY.r[i] >= 0 ? `<em class="ref">${esc(KY.refs[KY.r[i]])}</em>` : ''); }
    return `<b>${when(k, y)}: ${dateText(y, d)}</b><small>${esc(k.verb)}, ${esc(k.place)}. ${esc(offText(k, d).replace(/^./, c => c.toUpperCase()))}.</small>${extra}`;
  }

  window.CX = { D, K, byKey, KY, TYPE, reduced, fmt, esc, leap, MONTHS, MON, CUM, dateOf, dateText, angleDay, offText, when, recordHtml, tip, untip, params, setParams, views: {} };
})();
