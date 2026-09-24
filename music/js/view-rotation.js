/* Heavy Rotation — the novel view.
   Albums "in rotation" literally rotate. Speed = repeat intensity. Inner orbit = more influential.
   Each lap under the needle plays that album's note: pitch belongs to the artist, timbre to the feeling.
   Every lap is also burned into a long exposure, so the piece ends as a photograph of 27 years. */
(function () {
  'use strict';
  const A = window.Atlas;
  const V = { init, show, hide, focus };
  A.views.rotation = V;

  const T0 = 1997.9, T1 = 2026.0;
  const BASE = 0.14;                                   // years per second at 1x (~200 s end to end)
  const REV = { medium: 0.8, high: 1.6, obsessive: 3.2 }; // laps per year
  const SPEEDS = [0.5, 1, 2, 4];
  const TAU = Math.PI * 2;
  const NEEDLE = -Math.PI / 2 + Math.PI / 6;           // one o'clock
  const GOLD = 2.399963;
  const albums = A.albums;

  let el, cv, cx2, W = 0, H = 0, DPR = 1, CX = 0, CY = 0, R = 0;
  let bgLayer, expLayer, expCtx, stripCv, stripCx, stripBase;
  let t = T1, tPrev = T1, playing = false, speedIx = 1, vel = 0, raf = 0, lastNow = 0;
  let expT = T0, exposureMode = true, started = false, ended = false, solo = null, resumeOnClose = false;
  let hover = null, device = 'stereo', deviceFade = 1, prevDevice = 'stereo';
  const flash = new Map();
  let ui = {};

  // ---------- orbit geometry ----------
  const tierOf = a => (a.rank <= 1 ? 0 : a.rank === 2 ? 1 : 2);
  const BANDS = [[0.25, 0.45], [0.50, 0.70], [0.745, 0.955]];
  const lanes = new Map();
  (function assignLanes() {
    for (let tier = 0; tier < 3; tier++) {
      const list = albums.filter(a => tierOf(a) === tier).sort((p, q) => p.t0 - q.t0);
      const ends = [];
      for (const a of list) {
        let k = ends.findIndex(e => e < a.t0 - 0.35);
        if (k === -1) { k = ends.length; ends.push(0); }
        ends[k] = a.t1;
        lanes.set(a.id, { tier, k });
      }
      for (const a of list) lanes.get(a.id).n = ends.length;
    }
  })();
  const laneR = a => { const L = lanes.get(a.id), [b0, b1] = BANDS[L.tier]; return R * (b0 + (b1 - b0) * (L.k + 0.5) / L.n); };
  const discR = a => Math.max([11, 8, 6][tierOf(a)], R * [0.068, 0.05, 0.036][tierOf(a)]);
  const omega = a => REV[a.intensity] || REV.medium;
  const phase0 = a => (a.id * GOLD) % TAU;
  const theta = (a, tt) => phase0(a) + TAU * omega(a) * (tt - a.t0);
  const ss = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  function vis(a, tt) {
    let v = 0;
    for (const s of a.spans) v = Math.max(v, Math.min(ss((tt - (s.t0 - 0.06)) / 0.12), ss(((s.t1 + 0.06) - tt) / 0.12)));
    return v;
  }
  const soloOn = a => !solo || a.artist === solo;

  // ---------- music ----------
  const PCS = [2, 4, 6, 9, 11];                        // D major pentatonic: nothing can clash
  const PRESET = {
    warm:   { a: .012, d: 1.9, cut: 2600, p: [[1, 'sine', 1, 1], [2, 'triangle', .22, .6], [3, 'sine', .06, .35]] },
    bright: { a: .004, d: 2.4, cut: 5200, p: [[1, 'sine', 1, 1], [2.76, 'sine', .22, .35], [5.4, 'sine', .08, .18], [8.93, 'sine', .03, .1]] },
    drive:  { a: .003, d: .75, cut: 3200, p: [[1, 'triangle', 1, 1], [2, 'square', .05, .5], [.5, 'sine', .3, 1]] },
    dark:   { a: .05, d: 2.8, cut: 950, p: [[.5, 'sawtooth', .42, 1], [1, 'sine', .7, 1], [1.5, 'sine', .08, .6]] },
    deep:   { a: .26, d: 3.2, cut: 1900, p: [[1, 'sine', .8, 1], [1.004, 'sine', .6, 1], [1.5, 'sine', .12, .8], [2, 'sine', .08, .6]] },
    none:   { a: .02, d: 1.3, cut: 520, p: [[1, 'sine', .5, 1], [2, 'sine', .08, .5]] },
  };
  const Synth = {
    ctx: null, muted: false, voices: 0,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 3.2; comp.attack.value = .01; comp.release.value = .3;
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : .9;
      this.master.connect(comp); comp.connect(c.destination);
      const tame = c.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 7000;
      tame.connect(this.master);
      this.bus = c.createGain();
      const dry = c.createGain(); dry.gain.value = .72;
      const conv = c.createConvolver(); conv.buffer = this.impulse(3.6, 2.4);
      const wet = c.createGain(); wet.gain.value = .46;
      this.bus.connect(dry); dry.connect(tame);
      this.bus.connect(conv); conv.connect(wet); wet.connect(tame);
      this.crackleStart();
    },
    impulse(sec, decay) {
      const c = this.ctx, rate = c.sampleRate, len = Math.floor(rate * sec), pre = Math.floor(rate * .022);
      const buf = c.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i - pre) / (len - pre), decay) * .9;
      }
      return buf;
    },
    crackleStart() {
      const c = this.ctx, rate = c.sampleRate, len = rate * 4;
      const buf = c.createBuffer(1, len, rate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * .004;
      for (let k = 0; k < 90; k++) {
        const at = Math.floor(Math.random() * (len - 60)), amp = (Math.random() * .5 + .12) * (Math.random() < .5 ? -1 : 1);
        for (let j = 0; j < 40; j++) d[at + j] += amp * Math.exp(-j / 5);
      }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = .6;
      this.crackleGain = c.createGain(); this.crackleGain.gain.value = 0;
      src.connect(bp); bp.connect(this.crackleGain); this.crackleGain.connect(this.master);
      src.start();
    },
    crackle(on) {
      if (!this.ctx) return;
      this.crackleGain.gain.setTargetAtTime(on ? .09 : 0, this.ctx.currentTime, .25);
    },
    mute(m) {
      this.muted = m;
      if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : .9, this.ctx.currentTime, .08);
    },
    note(a, laneFrac, density) {
      const c = this.ctx;
      if (!c || this.muted || this.voices > 28) return;
      const tier = tierOf(a);
      const pc = PCS[Math.floor(((a.hue % 360) / 360) * 5) % 5];
      const midi = 48 + 12 * tier + pc;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const P = PRESET[a.family || 'none'] || PRESET.none;
      const lvl = [.2, .14, .1][tier] * (a.intensity === 'obsessive' ? 1.2 : 1) * (a.silent ? .55 : 1) / Math.sqrt(Math.max(1, density / 4));
      const now = c.currentTime + .005;
      const out = c.createGain(); out.gain.value = lvl;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = P.cut; lp.Q.value = .7;
      lp.connect(out);
      let node = out;
      if (c.createStereoPanner) {
        const pan = c.createStereoPanner();
        pan.pan.value = (lanes.get(a.id).k % 2 ? 1 : -1) * (.12 + .5 * laneFrac);
        out.connect(pan); node = pan;
      }
      node.connect(this.bus);
      const low = (a.spans.find(s => s.t0 <= t && t < s.t1) || a.spans[0]).conf === 'low';
      let lfo = null;
      if (low) {
        lfo = c.createOscillator(); lfo.frequency.value = 5.2;
        const lg = c.createGain(); lg.gain.value = 14; lfo.connect(lg); lfo._g = lg; lfo.start(now);
      }
      let endAt = now;
      for (const [ratio, type, g, dm] of P.p) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f * ratio;
        if (low) { o.detune.value = (Math.random() - .5) * 24; lfo._g.connect(o.detune); }
        const eg = c.createGain();
        const stop = now + P.a + P.d * dm;
        eg.gain.setValueAtTime(0, now);
        eg.gain.linearRampToValueAtTime(g, now + P.a);
        eg.gain.exponentialRampToValueAtTime(.0001, stop);
        o.connect(eg); eg.connect(lp);
        o.start(now); o.stop(stop + .05);
        endAt = Math.max(endAt, stop + .05);
      }
      this.voices++;
      setTimeout(() => { this.voices--; out.disconnect(); if (lfo) lfo.stop(); }, (endAt - now) * 1000 + 80);
    },
  };

  // ---------- DOM ----------
  function init(root) {
    el = root;
    el.innerHTML = `
      <canvas class="hr-canvas" aria-label="Albums orbiting the listening device of each year"></canvas>
      <div class="hr-read"><div class="hr-year">1998–2025</div><div class="hr-season">one long exposure</div>
        <div class="hr-phase">125 albums, 27 years</div><div class="hr-count"></div></div>
      <div class="hr-map"><svg viewBox="0 0 300 150" aria-hidden="true"></svg></div>
      <div class="hr-legend"><b>Each disc is an album in rotation.</b><br>Faster means played harder.<br>Closer to the centre means it mattered more.<br>Each lap under the needle plays its note:<br>the pitch belongs to the artist,<br>the tone to the feeling.</div>
      <div class="hr-notes"></div>
      <div class="hr-start">
        <button class="hr-play" aria-label="Play 27 years"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg></button>
        <b>Play 27 years</b><small>About three minutes, sound on</small>
        <button class="quiet">or watch without sound</button>
      </div>
      <div class="hr-end"><b>Twenty-seven years, one exposure.</b><span>Every ring is an album. Brighter means it came around more often.</span></div>
      <div class="hr-dock">
        <div class="hr-strip"><canvas></canvas></div>
        <div class="hr-ctls">
          <button class="ctl" data-c="play" aria-label="Play or pause"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><span>Play</span></button>
          <button class="ctl" data-c="speed">1×</button>
          <button class="ctl" data-c="sound" aria-pressed="true">Sound on</button>
          <button class="ctl" data-c="exposure" aria-pressed="true">Long exposure</button>
          <button class="ctl" data-c="restart">↺ From 1998</button>
          <button class="ctl" data-c="solo" hidden></button>
          <span class="spacer"></span>
          <span class="hint"><kbd>Space</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd></span>
        </div>
      </div>`;
    cv = el.querySelector('.hr-canvas'); cx2 = cv.getContext('2d');
    stripCv = el.querySelector('.hr-strip canvas'); stripCx = stripCv.getContext('2d');
    ui = {
      year: el.querySelector('.hr-year'), season: el.querySelector('.hr-season'), phase: el.querySelector('.hr-phase'),
      count: el.querySelector('.hr-count'), notes: el.querySelector('.hr-notes'), start: el.querySelector('.hr-start'),
      end: el.querySelector('.hr-end'), map: el.querySelector('.hr-map svg'), play: el.querySelector('[data-c=play]'),
      speed: el.querySelector('[data-c=speed]'), sound: el.querySelector('[data-c=sound]'), exposure: el.querySelector('[data-c=exposure]'),
      solo: el.querySelector('[data-c=solo]'), strip: el.querySelector('.hr-strip'),
    };
    bgLayer = document.createElement('canvas');
    expLayer = document.createElement('canvas'); expCtx = expLayer.getContext('2d');
    stripBase = document.createElement('canvas');
    A.preload(albums);
    buildMap();
    wire();
    new ResizeObserver(resize).observe(el);
    resize();
    if (document.fonts) document.fonts.ready.then(() => { buildBackground(); buildStrip(); if (!playing) frame(true); });
  }

  function wire() {
    el.querySelector('.hr-play').addEventListener('click', () => begin(false));
    el.querySelector('.quiet').addEventListener('click', () => begin(true));
    el.querySelector('.hr-ctls').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const c = b.dataset.c;
      if (c === 'play') { if (!started) return begin(Synth.muted); playing ? pause() : play(); }
      if (c === 'speed') { speedIx = (speedIx + 1) % SPEEDS.length; b.textContent = SPEEDS[speedIx] + '×'; }
      if (c === 'sound') { Synth.mute(!Synth.muted); if (!Synth.muted) Synth.init(); b.setAttribute('aria-pressed', String(!Synth.muted)); b.textContent = Synth.muted ? 'Sound off' : 'Sound on'; }
      if (c === 'exposure') { exposureMode = !exposureMode; b.setAttribute('aria-pressed', String(exposureMode)); }
      if (c === 'restart') { if (!started) return begin(Synth.muted); seek(T0); play(); }
      if (c === 'solo') setSolo(null);
    });
    // strip scrubbing
    const toT = ev => { const r = ui.strip.getBoundingClientRect(); return T0 + (T1 - T0) * Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); };
    let dragging = false, wasPlaying = false;
    ui.strip.addEventListener('pointerdown', ev => {
      dragging = true; wasPlaying = playing; pause(); hideStart(); started = true; ui.strip.setPointerCapture(ev.pointerId); seek(toT(ev));
    });
    ui.strip.addEventListener('pointermove', ev => { if (dragging) seek(toT(ev)); });
    ui.strip.addEventListener('pointerup', () => { dragging = false; if (wasPlaying) play(); });
    // canvas picking
    cv.addEventListener('pointermove', ev => {
      const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      hover = pick(mx, my);
      cv.style.cursor = hover ? 'pointer' : 'default';
      A.tip(hover, ev.clientX, ev.clientY, hover ? A.seasonLabel(Math.max(hover.t0, Math.min(t, hover.t1 - .01))) + ', ' + (hover.intensity || 'medium') + ' rotation' : '');
    });
    cv.addEventListener('pointerleave', () => { hover = null; A.tip(null); });
    cv.addEventListener('click', () => {
      if (!hover) return;
      resumeOnClose = playing; pause(); A.tip(null); A.openPanel(hover.id);
    });
    A.on('close', () => { if (resumeOnClose && el.classList.contains('on')) play(); resumeOnClose = false; });
    document.addEventListener('keydown', e => {
      if (!el.classList.contains('on') || /input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); if (!started) begin(Synth.muted); else playing ? pause() : play(); }
      if (e.key === 'ArrowRight') { hideStart(); started = true; seek(Math.min(T1, t + .25)); }
      if (e.key === 'ArrowLeft') { hideStart(); started = true; seek(Math.max(T0, t - .25)); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) { pause(); resumeOnClose = true; } });
  }

  function hideStart() { ui.start.classList.add('gone'); }
  function begin(muted) {
    Synth.mute(muted);
    ui.sound.setAttribute('aria-pressed', String(!muted)); ui.sound.textContent = muted ? 'Sound off' : 'Sound on';
    if (!muted) Synth.init();
    started = true; ended = false; hideStart(); ui.end.classList.remove('show');
    exposureMode = true; ui.exposure.setAttribute('aria-pressed', 'true');
    el.scrollIntoView({ behavior: A.reduced ? 'auto' : 'smooth', block: 'start' });
    seek(T0); play();
  }
  function play() {
    if (t >= T1 - .01) seek(T0);
    playing = true; ended = false; ui.end.classList.remove('show');
    if (!Synth.muted) Synth.init();
    Synth.crackle(true);
    ui.play.querySelector('span').textContent = 'Pause';
    ui.play.querySelector('svg').innerHTML = '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>';
    loop();
  }
  function pause() {
    playing = false;
    Synth.crackle(false);
    if (ui.play) { ui.play.querySelector('span').textContent = 'Play'; ui.play.querySelector('svg').innerHTML = '<path d="M7 4.5v15l12.5-7.5z"/>'; }
  }
  function setSolo(artist) {
    solo = artist;
    ui.solo.hidden = !artist;
    ui.solo.textContent = artist ? `Solo: ${artist}  ✕` : '';
  }

  // ---------- layout ----------
  function resize() {
    const r = el.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(480, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, bgLayer, expLayer]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const dock = 132, top = W < 640 ? 118 : 26;
    R = Math.min(W * (W < 640 ? .46 : .5), (H - dock - top - 20) / 2) * .96;
    CX = W / 2; CY = top + (H - dock - top) / 2;
    if (W < 640) CY = top + R + 8;
    ui.notes.style.bottom = 'auto';
    if (W >= 900) {
      const left = CX + R + 48;
      Object.assign(ui.notes.style, { left: left + 'px', transform: 'none', width: Math.max(220, Math.min(420, W - left - 32)) + 'px', top: (CY - 10) + 'px', textAlign: 'left' });
    } else {
      Object.assign(ui.notes.style, { left: '50%', transform: 'translateX(-50%)', width: '92vw', top: Math.min(H - dock - 76, CY + R + 10) + 'px', textAlign: 'center' });
    }
    const sr = ui.strip.getBoundingClientRect();
    stripCv.width = Math.round(sr.width * DPR); stripCv.height = Math.round(sr.height * DPR);
    buildBackground(); buildStrip(); rebuildExposure(started ? t : T1);
    if (!playing) frame(true);
  }

  function buildBackground() {
    const c = bgLayer.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
    const g = c.createRadialGradient(CX, CY, R * .1, CX, CY, R * 1.25);
    g.addColorStop(0, 'rgba(26,28,38,.55)'); g.addColorStop(1, 'rgba(7,8,12,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // grooves
    for (let rr = R * .2; rr < R * .985; rr += 2.6) {
      c.beginPath(); c.arc(CX, CY, rr, 0, TAU);
      c.strokeStyle = `rgba(255,255,255,${.012 + (Math.sin(rr * .7) + 1) * .006})`; c.lineWidth = 1; c.stroke();
    }
    c.beginPath(); c.arc(CX, CY, R, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.stroke();
    for (const [b0, b1] of BANDS) for (const f of [b0, b1]) {
      c.beginPath(); c.arc(CX, CY, R * f, 0, TAU); c.setLineDash([2, 6]); c.strokeStyle = 'rgba(255,255,255,.07)'; c.stroke(); c.setLineDash([]);
    }
    // needle rail + tonearm
    const nx = r => CX + Math.cos(NEEDLE) * r, ny = r => CY + Math.sin(NEEDLE) * r;
    c.beginPath(); c.moveTo(nx(R * .2), ny(R * .2)); c.lineTo(nx(R * .99), ny(R * .99));
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1; c.stroke();
    const px = CX + Math.cos(-Math.PI / 4.6) * R * 1.13, py = CY + Math.sin(-Math.PI / 4.6) * R * 1.13;
    c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(nx(R * 1.08), ny(R * 1.08) + 6, nx(R * .99), ny(R * .99));
    c.strokeStyle = 'rgba(210,214,224,.55)'; c.lineWidth = 2.2; c.stroke();
    c.beginPath(); c.arc(px, py, 7, 0, TAU); c.fillStyle = '#11141c'; c.fill(); c.strokeStyle = 'rgba(210,214,224,.6)'; c.lineWidth = 1.4; c.stroke();
    c.save(); c.translate(nx(R * .99), ny(R * .99)); c.rotate(NEEDLE + Math.PI / 2);
    c.fillStyle = 'rgba(210,214,224,.7)'; c.fillRect(-4, -3, 8, 12); c.restore();
    c.font = `500 ${Math.max(9, R * .026)}px "JetBrains Mono", monospace`; c.fillStyle = 'rgba(169,176,192,.55)'; c.textAlign = 'left';
    if (W >= 640) c.fillText('THE NEEDLE', px + 12, py + 4);
  }

  // ---------- long exposure ----------
  function expStroke(a, th0, th1, alpha) {
    const r = laneR(a);
    expCtx.beginPath(); expCtx.arc(CX, CY, r, th0, th1);
    expCtx.strokeStyle = A.major(a) ? A.vivid(a) : A.tone(a);
    expCtx.globalAlpha = alpha; expCtx.lineWidth = Math.max(1.1, discR(a) * .3); expCtx.stroke();
  }
  function expAlpha(a) { return (A.major(a) ? .095 : .06) * (a.silent ? .6 : 1); }
  function rebuildExposure(upto) {
    expCtx.setTransform(DPR, 0, 0, DPR, 0, 0); expCtx.clearRect(0, 0, W, H);
    expCtx.globalCompositeOperation = 'lighter'; expCtx.lineCap = 'butt';
    for (const a of albums) for (const s of a.spans) {
      if (s.t0 >= upto) continue;
      let th0 = theta(a, s.t0), th1 = theta(a, Math.min(upto, s.t1));
      const al = expAlpha(a) * (s.conf === 'low' ? .6 : 1);
      while (th1 - th0 > TAU) { expStroke(a, th0, th0 + TAU, al); th0 += TAU; }
      if (th1 > th0) expStroke(a, th0, th1, al);
    }
    expCtx.globalAlpha = 1; expCtx.globalCompositeOperation = 'source-over';
    expT = upto;
  }
  function advanceExposure(from, to) {
    expCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    expCtx.globalCompositeOperation = 'lighter'; expCtx.lineCap = 'butt';
    for (const a of albums) for (const s of a.spans) {
      const lo = Math.max(from, s.t0), hi = Math.min(to, s.t1);
      if (hi > lo) expStroke(a, theta(a, lo), theta(a, hi), expAlpha(a) * (s.conf === 'low' ? .6 : 1));
    }
    expCtx.globalAlpha = 1; expCtx.globalCompositeOperation = 'source-over';
    expT = to;
  }

  // ---------- life strip ----------
  function buildStrip() {
    const w = stripCv.width / DPR, h = stripCv.height / DPR;
    stripBase.width = stripCv.width; stripBase.height = stripCv.height;
    const c = stripBase.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, w, h);
    const X = tt => (tt - T0) / (T1 - T0) * w, mid = h * .56, k = (h * .42 - 4) / 31;
    for (let tt = T0; tt < T1; tt += .05) {
      const act = albums.filter(a => A.activeAt(a, tt)).sort((p, q) => tierOf(p) - tierOf(q));
      let up = 0;
      for (const a of act) {
        const hh = a.w * k;
        c.fillStyle = A.tone(a);
        c.fillRect(X(tt), mid - up - hh, Math.max(1, X(tt + .05) - X(tt)) + .4, hh);
        c.fillRect(X(tt), mid + up, Math.max(1, X(tt + .05) - X(tt)) + .4, hh * .55);
        up += hh;
      }
    }
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(0, mid, w, 1);
    c.font = '500 9.5px "JetBrains Mono", monospace'; c.textBaseline = 'top';
    for (const p of A.D.phases) {
      const x0 = X(p.t0), x1 = X(Math.min(T1, p.t1));
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0, 0, 1, h);
      const label = p.name.toUpperCase();
      if (c.measureText(label).width < x1 - x0 - 10) { c.fillStyle = 'rgba(169,176,192,.75)'; c.fillText(label, x0 + 5, 2); }
    }
    for (let y = 2000; y <= 2025; y += 5) { c.fillStyle = 'rgba(107,114,130,.9)'; c.textBaseline = 'bottom'; c.fillText(String(y), X(y) + 3, h); c.textBaseline = 'top'; }
  }
  function drawStrip() {
    if (!stripBase.width || !stripBase.height || !stripCv.width) return;
    const w = stripCv.width / DPR, h = stripCv.height / DPR;
    stripCx.setTransform(1, 0, 0, 1, 0, 0); stripCx.clearRect(0, 0, stripCv.width, stripCv.height);
    const px = Math.max(1, Math.min(stripCv.width - 1, Math.round((t - T0) / (T1 - T0) * stripCv.width)));
    stripCx.globalAlpha = 1; stripCx.drawImage(stripBase, 0, 0, px, stripCv.height, 0, 0, px, stripCv.height);
    stripCx.globalAlpha = .33; stripCx.drawImage(stripBase, px, 0, stripCv.width - px, stripCv.height, px, 0, stripCv.width - px, stripCv.height);
    stripCx.globalAlpha = 1; stripCx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (started) {
      const x = (t - T0) / (T1 - T0) * w;
      stripCx.fillStyle = '#f2f4f8'; stripCx.fillRect(x - .75, 0, 1.5, h);
      stripCx.beginPath(); stripCx.arc(x, h * .56, 3.5, 0, TAU); stripCx.fill();
    }
  }

  // ---------- mini map ----------
  const MX = lon => (lon + 128) / 136 * 300, MY = lat => (52 - lat) / 22 * 150;
  let mapNodes = {};
  function buildMap() {
    const s = d3.select(ui.map);
    s.append('text').attr('x', 150).attr('y', 146).attr('text-anchor', 'middle').attr('class', 'm-ocean').text('A T L A N T I C');
    s.append('path').attr('class', 'm-route-all');
    s.append('path').attr('class', 'm-route');
    s.append('g').attr('class', 'm-away');
    const g = s.append('g');
    const show = { Paris: 'Paris', Northfield: 'Minnesota', 'New York': 'New York', Fargo: 'Fargo', Atlanta: 'Atlanta', Seattle: 'Seattle', 'Santa Barbara': 'Santa Barbara', Douarnenez: 'Douarnenez' };
    for (const [k, p] of Object.entries(A.D.places)) {
      const x = MX(p.lon), y = MY(p.lat);
      mapNodes[k] = { x, y };
      g.append('circle').attr('cx', x).attr('cy', y).attr('r', 1.8).attr('class', 'm-dot');
      if (show[k]) g.append('text').attr('x', x + (k === 'Paris' || k === 'Douarnenez' ? -5 : 5)).attr('y', y + (k === 'Douarnenez' ? 11 : k === 'Paris' ? -5 : k === 'Fargo' ? -5 : 3))
        .attr('text-anchor', k === 'Paris' || k === 'Douarnenez' ? 'end' : 'start').attr('class', 'm-lbl').text(show[k]);
    }
    s.append('circle').attr('class', 'm-here').attr('r', 5).attr('opacity', 0);
    s.append('text').attr('x', 0).attr('y', 9).attr('class', 'm-title').text('WHERE');
    const all = A.D.home.map(h => mapNodes[h[2]]);
    s.select('.m-route-all').attr('d', 'M' + all.map(p => `${p.x},${p.y}`).join('L'));
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `.m-dot{fill:#6b7282}.m-lbl{font:500 8.5px "JetBrains Mono",monospace;fill:#8a91a0}.m-title{font:500 8px "JetBrains Mono",monospace;letter-spacing:.2em;fill:#6b7282}
      .m-ocean{font:500 7px "JetBrains Mono",monospace;letter-spacing:.3em;fill:rgba(120,170,230,.35)}
      .m-route-all{fill:none;stroke:rgba(255,255,255,.08);stroke-width:1}.m-route{fill:none;stroke:rgba(242,244,248,.6);stroke-width:1.2}
      .m-here{fill:none;stroke:#f2f4f8;stroke-width:1.5}.m-away line{stroke-width:1;stroke-dasharray:2 3}.m-away circle{fill:none;stroke-width:1.2}
      .m-away text{font:500 8.5px "JetBrains Mono",monospace}`;
    ui.map.prepend(style);
  }
  let lastMapKey = '';
  function drawMap(active) {
    const home = A.homeAt(t);
    const done = A.D.home.filter(h => h[0] <= t).map(h => mapNodes[h[2]]);
    const away = [];
    for (const a of active) { const an = A.anchorAt(a, t); if (an.away && an.place !== home) away.push([an.place, a]); }
    const key = home + '|' + done.length + '|' + away.map(x => x[0] + x[1].id).join(',');
    const here = mapNodes[home];
    const s = d3.select(ui.map);
    const pulse = 5 + Math.sin(performance.now() / 260) * 1.2;
    s.select('.m-here').attr('cx', here.x).attr('cy', here.y).attr('r', pulse).attr('opacity', 1);
    if (key === lastMapKey) return;
    lastMapKey = key;
    s.select('.m-route').attr('d', done.length ? 'M' + done.map(p => `${p.x},${p.y}`).join('L') : null);
    const seen = new Set();
    const rows = away.filter(([p]) => !seen.has(p) && seen.add(p));
    const g = s.select('.m-away').selectAll('g').data(rows, d => d[0]);
    g.exit().remove();
    const e = g.enter().append('g');
    e.append('line'); e.append('circle').attr('r', 3.5); e.append('text');
    g.merge(e).each(function ([p, a]) {
      const n = mapNodes[p], col = A.vivid(a), sel = d3.select(this);
      const off = { Douarnenez: [-7, 24, 'end'], Sologne: [-7, 35, 'end'], 'Outside Paris': [-7, 46, 'end'], Paris: [-7, 14, 'end'] }[p] || [6, 13, 'start'];
      sel.select('line').attr('x1', here.x).attr('y1', here.y).attr('x2', n.x).attr('y2', n.y).attr('stroke', col);
      sel.select('circle').attr('cx', n.x).attr('cy', n.y).attr('stroke', col);
      sel.select('text').attr('x', n.x + off[0]).attr('y', n.y + off[1]).attr('text-anchor', off[2]).attr('fill', col).text(A.placeLabel(p));
    });
  }

  // ---------- liner notes ----------
  const queue = [];
  let noteBusyUntil = 0, noteFlip = 0;
  const shownMem = new Map();
  function enqueueNote(a, force) {
    const list = A.memsOf(a);
    if (!list.length) return;
    const i = shownMem.get(a.id) || 0;
    if (i >= list.length && !force) return;
    shownMem.set(a.id, i + 1);
    const pr = (a.rank === 1 ? 3 : a.rank === 2 ? 2 : 1) + (A.major(a) ? 1 : 0);
    queue.push({ a, text: list[i % list.length], pr, shape: A.locked });
    queue.sort((p, q) => q.pr - p.pr);
    if (queue.length > 3) queue.length = 3;
  }
  A.on('unlock', () => { queue.length = 0; shownMem.clear(); });
  function runNotes(now) {
    if (now < noteBusyUntil || !queue.length) return;
    const n = queue.shift();
    const box = document.createElement('div');
    box.className = 'hr-note';
    box.innerHTML = `${n.shape ? `<em>${A.esc(n.text)}</em>` : `<q>${A.esc(n.text)}</q>`}<span>${A.esc(n.a.title)}, ${A.esc(n.a.artist)}</span>`;
    ui.notes.appendChild(box);
    requestAnimationFrame(() => box.classList.add('show'));
    const hold = 3600 / Math.sqrt(SPEEDS[speedIx]);
    setTimeout(() => { box.classList.remove('show'); setTimeout(() => box.remove(), 1000); }, hold);
    noteBusyUntil = now + hold + 400;
  }

  // ---------- picking ----------
  function pick(mx, my) {
    let best = null, bd = Infinity;
    for (const a of albums) {
      const v = vis(a, t); if (v < .3) continue;
      const r = laneR(a) + (1 - v) * R * .35, th = theta(a, t);
      const x = CX + Math.cos(th) * r, y = CY + Math.sin(th) * r;
      const d = Math.hypot(mx - x, my - y);
      if (d < discR(a) + 5 && d < bd) { bd = d; best = a; }
    }
    return best;
  }

  // ---------- devices ----------
  const MED = ['stereo', 'ipod', 'streaming', 'youtube', 'car-stereo'];
  const withMedium = albums.filter(a => a.medium).sort((p, q) => p.t0 - q.t0);
  let deviceInferred = false;
  function deviceAt(tt) {
    const w = {};
    for (const a of albums) if (a.medium && A.activeAt(a, tt)) w[a.medium] = (w[a.medium] || 0) + a.w;
    let best = null, bv = 0;
    for (const m of MED) if ((w[m] || 0) > bv) { bv = w[m]; best = m; }
    deviceInferred = !best;
    if (!best) { const prev = withMedium.filter(a => a.t0 <= tt).pop(); best = prev ? prev.medium : 'stereo'; }
    return best;
  }
  function drawDevice(c, kind, s, alpha) {
    c.save(); c.translate(CX, CY); c.globalAlpha = alpha;
    c.strokeStyle = 'rgba(214,218,228,.85)'; c.lineWidth = 1.5; c.lineJoin = 'round';
    const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.stroke(); };
    if (kind === 'stereo') {
      rr(-s, -s * .5, s * 2, s, s * .12);
      for (const dx of [-.55, .55]) { c.beginPath(); c.arc(dx * s, 0, s * .3, 0, TAU); c.stroke(); c.beginPath(); c.arc(dx * s, 0, s * .1, 0, TAU); c.stroke(); }
      c.beginPath(); c.moveTo(-s * .12, -s * .2); c.lineTo(s * .12, -s * .2); c.stroke();
    } else if (kind === 'ipod') {
      rr(-s * .55, -s * .9, s * 1.1, s * 1.8, s * .18);
      rr(-s * .38, -s * .72, s * .76, s * .6, s * .06);
      c.beginPath(); c.arc(0, s * .42, s * .32, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, s * .42, s * .1, 0, TAU); c.stroke();
    } else if (kind === 'streaming') {
      rr(-s * .5, -s * .92, s, s * 1.84, s * .18);
      for (const [dx, hh] of [[-.22, .35], [0, .6], [.22, .45]]) { c.beginPath(); c.moveTo(dx * s, s * .3); c.lineTo(dx * s, s * (.3 - hh)); c.stroke(); }
    } else if (kind === 'youtube') {
      rr(-s * .95, -s * .62, s * 1.9, s * 1.24, s * .3);
      c.beginPath(); c.moveTo(-s * .25, -s * .3); c.lineTo(s * .38, 0); c.lineTo(-s * .25, s * .3); c.closePath(); c.stroke();
    } else if (kind === 'car-stereo') {
      c.beginPath(); c.arc(0, 0, s * .85, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, s * .22, 0, TAU); c.stroke();
      for (const an of [Math.PI / 2, Math.PI * 7 / 6, -Math.PI / 6]) { c.beginPath(); c.moveTo(Math.cos(an) * s * .22, Math.sin(an) * s * .22); c.lineTo(Math.cos(an) * s * .85, Math.sin(an) * s * .85); c.stroke(); }
    }
    c.restore();
  }
  const MED_NAME = { stereo: 'DAD’S STEREO', ipod: 'IPOD', streaming: 'STREAMING', youtube: 'YOUTUBE', 'car-stereo': 'CAR STEREO' };

  // ---------- frame ----------
  function seek(nt) {
    const back = nt < expT - 1e-6, jump = Math.abs(nt - t) > .3;
    tPrev = t = Math.max(T0, Math.min(T1, nt));
    if (back || jump) rebuildExposure(t); else advanceExposure(expT, t);
    queue.length = 0;
    for (const a of albums) if (a.t1 < t || a.t0 > t) shownMem.delete(a.id);
    ended = false; ui.end.classList.remove('show');
    if (!playing) frame(true);
  }

  function loop() {
    cancelAnimationFrame(raf);
    lastNow = performance.now();
    const step = now => {
      const dt = Math.min(.25, (now - lastNow) / 1000); lastNow = now;
      const target = playing ? BASE * SPEEDS[speedIx] * (hover ? .08 : 1) : 0;
      vel += (target - vel) * Math.min(1, dt * (hover ? 9 : 4));
      if (playing) {
        tPrev = t; t = Math.min(T1, t + vel * dt);
        tick(tPrev, t);
        advanceExposure(expT, t);
        if (t >= T1) finish();
      }
      frame(false, now);
      if (playing || vel > .002 || flash.size) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function tick(t0, t1) {
    const active = albums.filter(a => A.activeAt(a, t1));
    const dens = active.length;
    for (const a of albums) {
      if (a.spans.some(s => s.t0 > t0 && s.t0 <= t1)) {
        enqueueNote(a);
        if (soloOn(a)) Synth.note(a, laneR(a) / R, solo ? 1 : dens);
        flash.set(a.id, performance.now());
      }
      if (!A.activeAt(a, t1)) continue;
      const l0 = Math.floor((theta(a, t0) - NEEDLE) / TAU), l1 = Math.floor((theta(a, t1) - NEEDLE) / TAU);
      if (l1 > l0 && vis(a, t1) > .6) {
        if (soloOn(a)) Synth.note(a, laneR(a) / R, solo ? 1 : dens);
        flash.set(a.id, performance.now());
        if (a.intensity === 'obsessive' && l1 % 2 === 0) enqueueNote(a, true);
      }
    }
    const nowMs = performance.now();
    if (!queue.length && nowMs > noteBusyUntil + 5000) primeNotes(t1);
    runNotes(nowMs);
  }
  function primeNotes(tt) {
    const act = albums.filter(a => A.activeAt(a, tt) && A.memsOf(a).length).sort((p, q) => p.rank - q.rank || (A.major(q) - A.major(p)));
    for (const a of act.slice(0, 2)) enqueueNote(a, true);
  }

  function finish() {
    pause(); ended = true; exposureMode = true; ui.exposure.setAttribute('aria-pressed', 'true');
    ui.end.classList.add('show');
    A.emit('rotation-ended');
  }

  let lastRead = 0, lastPhase = null;
  function readout(active, force) {
    const now = performance.now();
    if (!force && now - lastRead < 90) return;
    lastRead = now;
    if (!started) {
      ui.year.textContent = '1998–2025'; ui.season.textContent = 'one long exposure';
      ui.phase.textContent = `${A.D.stats.albums} albums, 27 years`; ui.count.innerHTML = '';
      return;
    }
    const { y, s } = A.seasonOf(Math.min(t, T1 - .001));
    const ph = A.phaseAt(t), home = A.placeLabel(A.homeAt(t));
    ui.year.textContent = y;
    ui.season.textContent = `${s}, ${home}`;
    ui.phase.textContent = ph.name;
    ui.count.innerHTML = `<b>${active.length}</b> ${active.length === 1 ? 'album' : 'albums'} in rotation`;
    if (lastPhase !== ph.n) { lastPhase = ph.n; document.getElementById('atlasLive').textContent = `${ph.name}, ${home}, ${y}`; }
  }

  function frame(force, now = performance.now()) {
    const c = cx2;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = '#07080c'; c.fillRect(0, 0, W, H);
    // giant home-base name
    const homes = {};
    for (const [a0, b0, n] of A.D.home) { const w = 1 / (1 + Math.exp(-(t - a0) / .04)) / (1 + Math.exp(-(b0 - t) / .04)); homes[n] = (homes[n] || 0) + w; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `400 ${Math.min(W * .2, R * .62)}px "Instrument Serif", Georgia, serif`;
    if (started) for (const [n, w] of Object.entries(homes)) if (w > .02) { c.fillStyle = `rgba(242,244,248,${.045 * w})`; c.fillText(A.placeLabel(n), CX, CY + R * .02); }
    c.drawImage(bgLayer, 0, 0, W, H);
    // long exposure underneath
    c.globalAlpha = !started ? .95 : exposureMode ? (playing ? .5 : .8) : .22;
    c.drawImage(expLayer, 0, 0, W, H);
    c.globalAlpha = 1;
    const active = started && !ended ? albums.filter(a => vis(a, t) > 0) : [];
    // hub device
    if (started) {
      const d = deviceAt(t);
      if (d !== device) { prevDevice = device; device = d; deviceFade = 0; }
      deviceFade = Math.min(1, deviceFade + .04);
      const s = R * .085, dimDev = deviceInferred ? .42 : 1;
      c.beginPath(); c.arc(CX, CY, R * .2, 0, TAU); c.fillStyle = 'rgba(12,14,20,.92)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.1)'; c.stroke();
      if (deviceFade < 1) drawDevice(c, prevDevice, s, (1 - deviceFade) * dimDev);
      drawDevice(c, device, s, deviceFade * dimDev);
      c.font = `500 ${Math.max(8, R * .024)}px "JetBrains Mono", monospace`; c.fillStyle = `rgba(169,176,192,${.8 * dimDev})`;
      c.fillText(MED_NAME[device] || '', CX, CY + R * .14);
      if (deviceInferred) { c.font = `500 ${Math.max(7, R * .019)}px "JetBrains Mono", monospace`; c.fillText('LAST RECORDED', CX, CY + R * .168); }
    }
    // discs
    const spin = vel / BASE;
    for (const a of active) {
      const v = vis(a, t), r0 = laneR(a), r = r0 + (1 - v) * R * .35, th = theta(a, t), dr = discR(a);
      const x = CX + Math.cos(th) * r, y = CY + Math.sin(th) * r;
      const dim = soloOn(a) ? 1 : .18;
      const col = A.tone(a), lit = A.major(a) ? A.vivid(a) : col;
      const low = (A.spanAt(a, t) || a.spans[0]).conf === 'low';
      // trail
      const L = Math.min(TAU * .85, TAU * omega(a) * vel * .45);
      if (L > .02) for (let i = 0; i < 12; i++) {
        const f0 = i / 12, f1 = (i + 1) / 12;
        c.beginPath(); c.arc(CX, CY, r, th - L * (1 - f0), th - L * (1 - f1));
        c.strokeStyle = lit; c.globalAlpha = f1 * f1 * .55 * v * dim; c.lineWidth = dr * (.35 + .55 * f1); c.stroke();
      }
      c.globalAlpha = v * dim;
      // flash ring
      const fl = flash.get(a.id);
      if (fl) {
        const age = (now - fl) / 700;
        if (age >= 1) flash.delete(a.id);
        else { c.beginPath(); c.arc(x, y, dr * (1.15 + age * 1.9), 0, TAU); c.strokeStyle = A.glow(a); c.lineWidth = 2 * (1 - age); c.globalAlpha = (1 - age) * .8 * v * dim; c.stroke(); c.globalAlpha = v * dim; }
      }
      // vinyl + label
      c.beginPath(); c.arc(x, y, dr, 0, TAU); c.fillStyle = '#0b0c10'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.09)';
      c.beginPath(); c.arc(x, y, dr * .82, 0, TAU); c.stroke();
      const im = A.img(a);
      const lr = dr * .64;
      if (im) {
        c.save(); c.beginPath(); c.arc(x, y, lr, 0, TAU); c.clip();
        c.translate(x, y); c.rotate(th * 2.2 * (spin > .05 ? 1 : 1));
        c.globalAlpha = v * dim * (a.silent ? .4 : low ? .65 : 1);
        c.drawImage(im, -lr, -lr, lr * 2, lr * 2); c.restore();
        c.globalAlpha = v * dim;
      } else { c.beginPath(); c.arc(x, y, lr, 0, TAU); c.fillStyle = col; c.fill(); }
      c.beginPath(); c.arc(x, y, dr, 0, TAU);
      c.strokeStyle = a.silent ? '#7c8391' : lit; c.lineWidth = A.major(a) ? 2 : 1.2;
      c.setLineDash(low || a.silent ? [2.5, 2.5] : []); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fillStyle = '#07080c'; c.fill();
      if (A.anchorAt(a, t).away) { c.beginPath(); c.arc(x + dr * .72, y - dr * .72, 2.6, 0, TAU); c.fillStyle = lit; c.fill(); }
      if (hover === a) { c.beginPath(); c.arc(x, y, dr + 4, 0, TAU); c.strokeStyle = '#f2f4f8'; c.lineWidth = 1.4; c.stroke(); }
      c.globalAlpha = 1;
    }
    readout(active.filter(a => A.activeAt(a, t)), force);
    if (started) drawMap(active.filter(a => A.activeAt(a, t)));
    drawStrip();
  }

  // ---------- public ----------
  V.discs = () => albums.filter(a => started && vis(a, t) > .6).map(a => {
    const r = laneR(a), th = theta(a, t), b = cv.getBoundingClientRect();
    return { id: a.id, title: a.title, x: b.left + CX + Math.cos(th) * r, y: b.top + CY + Math.sin(th) * r };
  });
  V.state = () => ({ t, playing, started, muted: Synth.muted, audio: Synth.ctx ? Synth.ctx.state : 'none', voices: Synth.voices });
  function show() { if (W) { resize(); } }
  function hide() { pause(); A.tip(null); }
  function focus(id) {
    const a = A.byId.get(+id);
    if (!a) return;
    setSolo(a.artist);
    Synth.mute(false); Synth.init();
    ui.sound.setAttribute('aria-pressed', 'true'); ui.sound.textContent = 'Sound on';
    started = true; hideStart();
    const first = albums.filter(x => x.artist === a.artist).sort((p, q) => p.t0 - q.t0)[0];
    seek(Math.max(T0, first.t0 - .15));
    A.closePanel();
    play();
  }
})();
