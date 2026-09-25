/* The Whale Road: shared data, decoding, map, colour, sound and text helpers. */
(function () {
  'use strict';
  const W = window.WHALE;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DAY = 864e5;
  const EPOCH = Date.UTC(1650, 0, 1);
  const LOG_OFF = Math.round((Date.UTC(1780, 0, 1) - EPOCH) / DAY);   // log days count from 1780
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON3 = MONTHS.map(m => m.slice(0, 3));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;

  // ---------- dates: every day is counted from 1 January 1650 ----------
  const dateOf = d => new Date(EPOCH + d * DAY);
  const yearOf = d => dateOf(d).getUTCFullYear();
  const yearFrac = d => { const t = dateOf(d), y = t.getUTCFullYear(), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return y + (t - a) / (b - a); };
  const dayOfYearFrac = f => { const y = Math.floor(f), a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return Math.round((a + (f - y) * (b - a) - EPOCH) / DAY); };
  const fullDate = d => { const t = dateOf(d); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}, ${t.getUTCFullYear()}`; };
  const monthYear = d => { const t = dateOf(d); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
  const monthDay = d => { const t = dateOf(d); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`; };

  // ---------- voyages ----------
  // v row: id, vessel, port, out, in, exact-flags, yearOut, yearIn, returnCode, ground, sperm, oil, bone, masters, wife, rig, log, crew, lane
  const NV = W.v.length;
  const vesselOf = i => W.vessels[W.v[i][1]];
  const portOf = i => W.ports[W.v[i][2]];
  const shortPort = p => (p || '').replace(/, [A-Z]{2}(?= [A-Z])/g, ' and').replace(/, [A-Z]{2}$/, '').replace(/, ([A-Z][a-z]+)$/, '');
  const mastersOf = i => W.v[i][13].map(([m, f]) => ({ name: W.masters[m], died: !!(f & 1), killed: !!(f & 2), left: !!(f & 4), replaced: !!(f & 8) }));
  const captain = i => { const m = mastersOf(i); return m.length ? m[0].name : ''; };
  const byId = new Map(W.v.map((r, i) => [r[0], i]));
  const vesselEnd = new Map();                 // vessel index -> {cls, year, voyage}
  for (const [k, i, cls, y] of W.vend) vesselEnd.set(k, { cls, year: y, voyage: i });

  // each vessel's voyages in order
  const vesselVoyages = new Map();
  for (let i = 0; i < NV; i++) { const k = W.v[i][1]; if (!vesselVoyages.has(k)) vesselVoyages.set(k, []); vesselVoyages.get(k).push(i); }
  for (const a of vesselVoyages.values()) a.sort((x, y) => (W.v[x][6] - W.v[y][6]) || (W.v[x][3] - W.v[y][3]));

  // ---------- species and encounters ----------
  const SPECIES = W.meta.species;                         // index 0 is "none"
  const SP_HEX = ['#f4efe4', '#ffb44f', '#56d6c2', '#8ec9ff', '#ff7d8c', '#cfc6b2', '#7f95ff', '#c7a2ff', '#f4efe4'];
  const SP_PLURAL = ['', 'sperm whales', 'right whales', 'bowheads', 'humpbacks', 'gray whales', 'fin and blue whales', 'pilot whales, orcas and dolphins', 'whales of no named kind'];
  const SP_ONE = ['', 'a sperm whale', 'a right whale', 'a bowhead', 'a humpback', 'a gray whale', 'a fin or blue whale', 'a pilot whale, orca or dolphin', 'a whale'];
  const SP_SHORT = ['', 'Sperm', 'Right', 'Bowhead', 'Humpback', 'Gray', 'Fin and blue', 'Small whales', 'Unnamed'];

  // ---------- fates ----------
  const FATES = {
    shen: { name: 'Burned by the Shenandoah', hex: '#ff6a3d' },
    raider: { name: 'Burned by other Confederate raiders', hex: '#ff9a5c' },
    stone: { name: 'Sunk on purpose in the Stone Fleet', hex: '#b9b2a4' },
    ice: { name: 'Lost in Arctic ice', hex: '#9fd8ff' },
    whale: { name: 'Sunk by a whale', hex: '#ffb44f' },
    wreck: { name: 'Wrecked or foundered', hex: '#e4dccb' },
    fire: { name: 'Burned by accident or in port', hex: '#ffc38a' },
    taken: { name: 'Captured in war', hex: '#d7a0ff' },
    missing: { name: 'Sailed and never heard from', hex: '#ffffff' },
    condemned: { name: 'Condemned as unfit', hex: '#8f95a3' },
    retired: { name: 'Sold, broken up or put to other work', hex: '#5d6372' },
    kept: { name: 'Still afloat', hex: '#ffffff' },
  };

  // ---------- logbooks: decoded once, when first needed ----------
  const LOGS = W.logs;          // [voyage, start, n, firstDay, lastDay, sighted days, struck days, whales struck, max lat, min lat]
  const NL = LOGS.length;
  const L = { ready: false };
  for (const r of LOGS) { r[3] += LOG_OFF; r[4] += LOG_OFF; }
  let loading = null;
  function loadLogs() {
    if (loading) return loading;
    loading = (async () => {
      const res = await fetch('whaling/data/logs.bin.gz?v=1');
      if (!res.ok) throw new Error('logbooks ' + res.status);
      let buf = await res.arrayBuffer();
      let u8 = new Uint8Array(buf);
      if (u8[0] === 0x1f && u8[1] === 0x8b) {
        if (!('DecompressionStream' in window)) throw new Error('This browser cannot unpack the logbooks.');
        const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        buf = await new Response(ds).arrayBuffer(); u8 = new Uint8Array(buf);
      }
      const N = new DataView(buf).getUint32(4, true);
      let o = 8;
      const dLo = u8.subarray(o, o + N), dHi = u8.subarray(o + N, o + 2 * N); o += 2 * N;
      const aLo = u8.subarray(o, o + N), aHi = u8.subarray(o + N, o + 2 * N); o += 2 * N;
      const nLo = u8.subarray(o, o + N), nHi = u8.subarray(o + N, o + 2 * N); o += 2 * N;
      const code = u8.slice(o, o + N); o += N;
      const nst = u8.slice(o, o + N);
      const day = new Int32Array(N), lat = new Float32Array(N), lon = new Float32Array(N), voy = new Uint16Array(N);
      const s16 = (l, h) => { const v = l | (h << 8); return v >= 32768 ? v - 65536 : v; };
      for (let li = 0; li < NL; li++) {
        const [, start, n, d0] = LOGS[li];
        let pd = d0, pa = 0, po = 0;
        for (let j = start; j < start + n; j++) {
          pd += dLo[j] | (dHi[j] << 8);
          pa += s16(aLo[j], aHi[j]);
          po += s16(nLo[j], nHi[j]);
          if (po > 18000) po -= 36000; else if (po < -18000) po += 36000;
          day[j] = pd; lat[j] = pa / 100; lon[j] = po / 100; voy[j] = li;
        }
      }
      Object.assign(L, { ready: true, N, day, lat, lon, code, nst, voy });
      L.place = new Map(); L.remark = new Map();
      for (const [li, j, p, rem] of W.notes) {
        const k = LOGS[li][1] + j;
        if (p >= 0) L.place.set(k, W.places[p]);
        if (rem) L.remark.set(k, rem);
      }
      return L;
    })();
    return loading;
  }
  const enc = j => L.code[j] >> 4;
  const spec = j => L.code[j] & 15;
  const logOfVoyage = i => W.v[i][16] ? W.v[i][16] - 1 : -1;
  // index of the last entry of a log at or before day d (or -1)
  function entryAt(li, d) {
    const start = LOGS[li][1], n = LOGS[li][2];
    let lo = start, hi = start + n - 1;
    if (L.day[lo] > d) return -1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L.day[m] <= d) lo = m; else hi = m - 1; }
    return lo;
  }

  // ---------- land ----------
  let landP = null;
  const land = () => landP || (landP = fetch('assets/vendor/world-land-50m.json').then(r => r.json()).then(t => topojson.feature(t, t.objects.land)));

  // ---------- tooltip ----------
  const tipEl = document.getElementById('uTip');
  function tip(html, x, y) {
    if (!html) { tipEl.classList.remove('show'); return; }
    tipEl.innerHTML = html;
    const w = tipEl.offsetWidth || 260, h = tipEl.offsetHeight || 60;
    let left = x + 16, top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + h > innerHeight - 8) top = y - h - 16;
    tipEl.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    tipEl.classList.add('show');
  }

  // ---------- sound, all synthesized: a spout and a low note for each whale struck, a ship's bell for the notes ----------
  let ac = null, bus = null, noiseBuf = null;
  function audio() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = new C();
      bus = ac.createGain(); bus.gain.value = .85;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 5;
      const delay = ac.createDelay(1.5); delay.delayTime.value = .42;
      const fb = ac.createGain(); fb.gain.value = .34; const wet = ac.createGain(); wet.gain.value = .3;
      const damp = ac.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1800;
      bus.connect(comp); comp.connect(ac.destination);
      bus.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(wet); wet.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.6, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const live = () => !!ac && ac.state === 'running';
  const panNode = pan => { if (!ac.createStereoPanner) return null; const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); return p; };
  // low notes in a minor pentatonic, one per kind of whale
  const SP_NOTE = [0, 73.42, 82.41, 65.41, 110.0, 98.0, 61.74, 146.83, 87.31];
  function strike(s, pan = 0, vel = .3) {
    if (!live()) return;
    const t = ac.currentTime, f = SP_NOTE[s] || 82.41;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.02, t); o.frequency.exponentialRampToValueAtTime(f, t + .25);
    o2.frequency.value = f * 2.003;
    const g2 = ac.createGain(); g2.gain.value = .18; o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
    o.connect(g);
    const p = panNode(pan); if (p) { g.connect(p); p.connect(bus); } else g.connect(bus);
    o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
    const n = ac.createBufferSource(); n.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .7;
    bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(2400, t + .35);
    const ng = ac.createGain(); ng.gain.setValueAtTime(.0001, t); ng.gain.exponentialRampToValueAtTime(vel * .5, t + .12); ng.gain.exponentialRampToValueAtTime(.0001, t + .9);
    n.connect(bp); bp.connect(ng);
    const p2 = panNode(pan); if (p2) { ng.connect(p2); p2.connect(bus); } else ng.connect(bus);
    n.start(t, Math.random() * .6); n.stop(t + 1);
  }
  function bell(freq = 587.33, vel = .16, when = 0, len = 3.2) {
    if (!live()) return;
    const t = ac.currentTime + when;
    for (const [m, a] of [[1, 1], [2.32, .42], [3.01, .2], [4.25, .1], [5.4, .05]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel * a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + len / Math.sqrt(m));
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + len);
    }
  }
  // a ship's bell strikes in pairs
  const bells = (pairs = 1, vel = .14) => { for (let i = 0; i < pairs; i++) { bell(587.33, vel, i * .9); bell(587.33, vel * .85, i * .9 + .28); } };

  // ---------- ships at sea, from every voyage with both dates known ----------
  // Many dates are known only to the year and sit on July 1, so single days spike. The peak is taken as the best yearly average.
  let seaCache = null;
  function atSea() {
    if (seaCache) return seaCache;
    let d0 = Infinity, d1 = -Infinity;
    for (const r of W.v) if (r[3] >= 0 && r[4] >= 0) { if (r[3] < d0) d0 = r[3]; if (r[4] > d1) d1 = r[4]; }
    const diff = new Int32Array(d1 - d0 + 2);
    for (const r of W.v) if (r[3] >= 0 && r[4] >= 0) { diff[r[3] - d0]++; diff[r[4] - d0]--; }
    const daily = new Int16Array(d1 - d0 + 1);
    const yr = new Map();
    let cur = 0;
    for (let i = 0; i < daily.length; i++) { cur += diff[i]; daily[i] = cur; const y = yearOf(d0 + i); const a = yr.get(y) || [0, 0]; a[0] += cur; a[1]++; yr.set(y, a); }
    let peakYear = 0, peak = 0;
    for (const [y, [s, k]] of yr) { const v = s / k; if (v > peak) { peak = v; peakYear = y; } }
    const on = d => { d = Math.round(d); if (d < d0 || d > d1) return 0; let s = 0, k = 0; for (let i = Math.max(d0, d - 15); i <= Math.min(d1, d + 15); i++) { s += daily[i - d0]; k++; } return Math.round(s / k); };
    seaCache = { d0, d1, daily, peak: Math.round(peak), peakYear, on };
    return seaCache;
  }

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  // ---------- words ----------
  const yearsText = i => { const r = W.v[i], y0 = r[6], y1 = r[7]; return y0 ? `${y0}${y1 && y1 !== y0 ? ' to ' + y1 : ''}` : ''; };
  const RIG = { Ship: 'ship', Bark: 'bark', Schr: 'schooner', Brig: 'brig', Sloop: 'sloop', 'Ship / Bark': 'ship', 'Bark / Ship': 'bark', SBark: 'steam bark', Str: 'steamer', SSchr: 'steam schooner', Bgtn: 'brigantine', Snow: 'snow', Gall: 'galliot', GSchr: 'gas schooner', DSchr: 'diesel schooner', Scow: 'scow', SBktn: 'steam barkentine', SBgtn: 'steam brigantine', GYawl: 'gas yawl' };
  const rigWord = s => RIG[s] || (s ? s.toLowerCase().replace(/\s*\/.*$/, '') : 'vessel');
  const catchText = i => {
    const r = W.v[i], parts = [];
    if (r[10]) parts.push(`${fmt(r[10])} barrels of sperm oil`);
    if (r[11]) parts.push(`${fmt(r[11])} barrels of whale oil`);
    if (r[12]) parts.push(`${fmt(r[12])} pounds of whalebone`);
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : (parts[0] || '');
  };
  const latText = v => `${Math.abs(v).toFixed(1)}\u00B0${v < 0 ? 'S' : 'N'}`;
  const wifeName = w => (w || '').replace(/\s*\(?\b1[6-9]\d\d\s*[-\u2013]\s*1[6-9]\d\d\)?\s*$/, '').trim();
  const lonText = v => `${Math.abs(v).toFixed(1)}\u00B0${v < 0 ? 'W' : 'E'}`;
  const endText = k => {
    const t = W.vessels[k][5] || '';
    return t.replace(/\bAband\b/g, 'Abandoned').replace(/\bCond\b/g, 'Condemned').replace(/\bCapt\b/g, 'Captured').replace(/\bWithdr\b/g, 'Withdrawn')
      .replace(/\bprob\b/g, 'probably').replace(/\bPt\b/g, 'Point').replace(/,(\d{4})/g, ', $1')
      .replace(/\bby (CSS )?(Shenandoah|Alabama|Florida|Sumter|Tallahassee|Chickamauga|Nashville)\b/g, 'by the $2');
  };
  const LOST_AT_SEA = new Set(['shen', 'raider', 'ice', 'wreck', 'whale', 'missing', 'taken']);
  function fateLabel(k) {
    const e = vesselEnd.get(k); if (!e || !FATES[e.cls]) return '';
    const txt = W.vessels[k][5] || '';
    if (e.cls === 'raider') { const m = txt.match(/Alabama|Florida|Sumter|Tallahassee|Chickamauga|Nashville|Jeff Davis/); return `${m ? 'Burned by the ' + m[0] : FATES.raider.name}, ${e.year}`; }
    return ['shen', 'ice', 'whale', 'stone', 'missing'].includes(e.cls) ? `${FATES[e.cls].name}, ${e.year}` : FATES[e.cls].name;
  }

  window.WX = {
    W, reduced, DAY, EPOCH, LOG_OFF, MONTHS, MON3, fmt, esc, plural,
    dateOf, yearOf, yearFrac, dayOfYearFrac, fullDate, monthYear, monthDay,
    NV, vesselOf, portOf, shortPort, mastersOf, captain, byId, vesselEnd, vesselVoyages,
    SPECIES, SP_HEX, SP_PLURAL, SP_ONE, SP_SHORT, FATES,
    LOGS, NL, L, loadLogs, enc, spec, logOfVoyage, entryAt,
    land, tip, audio, strike, bell, bells, params, setParams, atSea,
    yearsText, rigWord, catchText, latText, lonText, endText, wifeName, fateLabel, LOST_AT_SEA, views: {},
  };
})();
