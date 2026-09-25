/* Fifty Seasons: shared data, colour, sound and text helpers. */
(function () {
  'use strict';
  const D = window.SURV;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, D.C.' };
  const year = s => (s.premiered || '').slice(0, 4);

  // ---------- colour: real buff colours, lifted when they would disappear on black ----------
  const shown = new Map();
  function disp(hex) {
    if (!hex) return '#9aa3b5';
    if (shown.has(hex)) return shown.get(hex);
    const c = d3.hsl(hex);
    let out;
    if (!(c.s > .12) || isNaN(c.h)) out = c.l < .5 ? '#d6dbe4' : hex;          // black or grey buffs read as pale grey
    else { const l = Math.max(c.l, .56); out = d3.hsl(c.h, Math.min(1, Math.max(c.s, .55)), l).formatHex(); }
    shown.set(hex, out); return out;
  }
  const rgba = (hex, a) => { const c = d3.rgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };
  const tribeColour = (S, name) => disp(S.tribes[name]);
  const castColour = (S, i) => tribeColour(S, S.cast[i].tribe);

  // ---------- words ----------
  function tally(tr) {
    const n = new Map();
    for (const [, t, nul] of tr.v) if (!nul) n.set(t, (n.get(t) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  }
  const tallyText = tr => tally(tr).map(e => e[1]).join('-');
  function exitText(S, i) {
    const c = S.cast[i], r = c.result || '';
    if (c.win) return `Sole Survivor, winning ${S.finalVote}`;
    if (/runner-up/i.test(r)) return `${/2nd/.test(r) ? 'Second runner-up' : 'Runner-up'} on day ${c.day}`;
    if (/medically/i.test(r)) return `Medically evacuated on day ${c.day}`;
    if (/^quit|withdrew/i.test(r) || /\(quit\)/i.test(r)) return `Quit on day ${c.day}`;
    if (/ejected/i.test(r)) return `Removed from the game on day ${c.day}`;
    if (/fire/i.test(r)) return `Lost the fire-making challenge on day ${c.day}`;
    const m = r.match(/^(\d+)\w\w voted out/);
    if (m) return `The ${ord(+m[1])} person voted out, on day ${c.day}`;
    return `${r} on day ${c.day}`;
  }
  const home = c => [c.city, STATES[c.state] || c.state].filter(Boolean).join(', ');

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

  // ---------- sound, all synthesized: a drum for tribal council, a snuff for a torch, a bell for the winner ----------
  let ac = null, bus = null, noiseBuf = null;
  function audio() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = new C();
      bus = ac.createGain(); bus.gain.value = .9;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 5;
      const delay = ac.createDelay(1); delay.delayTime.value = .23;
      const fb = ac.createGain(); fb.gain.value = .25; const wet = ac.createGain(); wet.gain.value = .22;
      bus.connect(comp); comp.connect(ac.destination);
      bus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const live = () => ac && ac.state === 'running';
  function drum(vel = .6, when = 0) {
    if (!live()) return;
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(44, t + .32);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + .55);
    const n = ac.createBufferSource(); n.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const ng = ac.createGain(); ng.gain.setValueAtTime(vel * .25, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .08);
    n.connect(f); f.connect(ng); ng.connect(bus); n.start(t); n.stop(t + .1);
  }
  function snuff(vel = .5, pan = 0) {
    if (!live()) return;
    const t = ac.currentTime, n = ac.createBufferSource(); n.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .9;
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(260, t + .55);
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
    n.connect(f); f.connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus); } else g.connect(bus);
    n.start(t); n.stop(t + .65);
  }
  function bell(freq = 523.25, vel = .25, when = 0, len = 2.4) {
    if (!live()) return;
    const t = ac.currentTime + when;
    for (const [m, a] of [[1, 1], [2.01, .35], [3.02, .16], [4.17, .08]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel * a, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + len / m);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + len);
    }
  }
  const tick = (vel = .12, when = 0) => bell(1318.5, vel, when, .35);

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  const seasonByN = n => D.seasons.find(s => s.n === +n);
  window.SX = {
    D, reduced, fmt, esc, ord, MONTHS, STATES, year, disp, rgba, tribeColour, castColour,
    tally, tallyText, exitText, home, tip, audio, drum, snuff, bell, tick, params, setParams, seasonByN, views: {},
  };
})();
