/* =============================================================
   pierrewallin.com — interaction layer
   ============================================================= */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Theme ---------- */
  const THEME_KEY = 'pw-theme-v2';
  const root = document.documentElement;
  let paletteCache = null;

  function applyTheme(t, persist) {
    root.setAttribute('data-theme', t);
    paletteCache = null;
    if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
    $$('.js-theme-icon').forEach(el => { el.textContent = t === 'light' ? '☾' : '☀'; });
    window.dispatchEvent(new Event('pw-theme'));
  }
  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (document.startViewTransition && !reduced) { const vt = document.startViewTransition(() => applyTheme(next, true)); vt.ready.catch(() => {}); }
    else applyTheme(next, true);
  }
  (function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved || root.getAttribute('data-theme') || 'light');
  })();
  window.pwToggleTheme = toggleTheme;

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  window.pwToast = toast;

  /* ---------- Scroll progress + sticky nav ---------- */
  const progress = $('.progress');
  const nav = $('.nav');
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (nav) nav.classList.toggle('is-stuck', y > 24);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  const burger = $('.burger');
  const navLinks = $('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.addEventListener('click', e => {
      if (e.target.closest('a')) { burger.classList.remove('open'); navLinks.classList.remove('open'); }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  const revealables = $$('.rv');
  if ('IntersectionObserver' in window && revealables.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(el => io.observe(el));
  } else {
    revealables.forEach(el => el.classList.add('in'));
  }

  /* ---------- Spotlight cards ---------- */
  function trackSpotlight(el) {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
  $$('.card, .post').forEach(trackSpotlight);

  /* ---------- Active section in nav (single-page) ---------- */
  const sectionLinks = $$('.nav-links a[href^="#"]');
  if (sectionLinks.length && 'IntersectionObserver' in window) {
    const targets = sectionLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const so = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        sectionLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(t => so.observe(t));
  }

  /* ---------- Typed line (optionally tied to an album: its colour becomes the page accent) ---------- */
  const typedEl = $('[data-typed]');
  if (typedEl) {
    const words = JSON.parse(typedEl.getAttribute('data-typed')).map(w => (typeof w === 'string' ? { t: w } : w));
    const host = typedEl.parentElement;
    const cover = host.querySelector('.typed-cover');
    words.forEach(w => { if (w.c) { const im = new Image(); im.src = w.c; } });
    const tint = w => {
      if (w.a) { root.style.setProperty('--accent', w.a); root.style.setProperty('--accent-ink', w.k || w.a); }
      if (cover && w.c) { cover.classList.add('swap'); setTimeout(() => { cover.src = w.c; cover.classList.remove('swap'); }, 180); }
    };
    if (reduced) { typedEl.textContent = words[0].t; tint(words[0]); }
    else {
      let wi = 0, ci = 0, deleting = false;
      tint(words[0]);
      (function tick() {
        const w = words[wi].t;
        ci += deleting ? -1 : 1;
        typedEl.textContent = w.slice(0, ci);
        host.dataset.typing = 'on';
        let delay = deleting ? 26 : 46 + Math.random() * 38;
        if (!deleting && ci === w.length) { delay = 2600; deleting = true; host.dataset.typing = 'hold'; }
        else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; tint(words[wi]); delay = 380; host.dataset.typing = 'hold'; }
        setTimeout(tick, delay);
      })();
    }
  }

  /* ---------- Count up ---------- */
  const counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        const el = en.target;
        const target = parseFloat(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-suffix') || '';
        if (reduced) { el.textContent = target + suffix; return; }
        const dur = 1500, t0 = performance.now();
        (function step(now) {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.5 });
    counters.forEach(el => co.observe(el));
  }

  /* ---------- Custom cursor (with labels) + magnetic + weight-follows-cursor ---------- */
  window.pwCursor = () => {};
  if (fine && !reduced) {
    const dot = document.createElement('div'); dot.className = 'cursor';
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    const label = document.createElement('span'); label.className = 'cursor-label';
    ring.appendChild(label);
    document.body.append(dot, ring);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, forced = false;

    window.addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
      ring.classList.toggle('flip', mx > innerWidth - 360);
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    const setLabel = t => { label.textContent = t || ''; ring.classList.toggle('has-label', !!t); };
    document.addEventListener('pointerover', e => {
      if (forced) return;
      const tagged = e.target.closest('[data-cursor]');
      ring.classList.toggle('hot', !!e.target.closest('a, button, input, textarea, [data-cursor]'));
      setLabel(tagged ? tagged.dataset.cursor : '');
    });
    document.addEventListener('pointerleave', () => { ring.classList.add('away'); });
    document.addEventListener('pointerenter', () => { ring.classList.remove('away'); });
    window.pwCursor = t => {
      forced = !!t;
      ring.classList.toggle('hot', !!t);
      setLabel(t || '');
    };

    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    $$('[data-weight-hover]').forEach(el => {
      const letters = [];
      [...el.childNodes].forEach(node => {
        if (node.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        [...node.textContent].forEach(ch => { const s = document.createElement('span'); s.textContent = ch; s.className = 'wl'; frag.appendChild(s); letters.push(s); });
        node.replaceWith(frag);
      });
      el.setAttribute('aria-label', el.textContent);
      const lo = parseFloat(getComputedStyle(el).fontWeight) || 500, hi = 900, reach = 260;
      let pending = false;
      window.addEventListener('pointermove', () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          for (const s of letters) {
            const r = s.getBoundingClientRect();
            const d = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2));
            const k = Math.max(0, 1 - d / reach);
            s.style.fontWeight = Math.round(lo + (hi - lo) * k * k);
          }
        });
      }, { passive: true });
    });
  }

  /* ---------- Hero canvas: the albums as a drifting network that leans toward the pointer ---------- */
  const canvas = $('#graph');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const hero = canvas.closest('.hero') || canvas.parentElement;
    const albums = JSON.parse(canvas.dataset.albums || '[]');
    let w, h, dpr, nodes = [], raf, hover = null, quiet = [];
    const pointer = { x: -9999, y: -9999, live: false };
    const inQuiet = n => quiet.some(q => n.x > q[0] && n.x < q[2] && n.y > q[1] && n.y < q[3]);
    function measureQuiet() {
      const c = canvas.getBoundingClientRect();
      quiet = $$('.hero-sub, .hero-copy, .btn-row, .hero-hint', hero).map(el => {
        const r = el.getBoundingClientRect();
        return [r.left - c.left - 14, r.top - c.top - 12, r.right - c.left + 14, r.bottom - c.top + 12];
      });
    }

    function palette() {
      if (paletteCache) return paletteCache;
      const v = k => getComputedStyle(root).getPropertyValue(k).trim().replace(/^["']|["']$/g, '');
      paletteCache = { line: v('--graph-line') || '255, 255, 255', alpha: parseFloat(v('--graph-alpha')) || 1, light: root.getAttribute('data-theme') === 'light' };
      return paletteCache;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const src = albums.length ? albums : Array.from({ length: 80 }, (_, i) => [0, '#888888', 3, '']);
      const small = w < 700;
      nodes = src.filter((a, i) => !small || a[2] <= 2 || i % 3 === 0).map(([id, col, rank, name, colL]) => ({
        id, col, colL: colL || col, name,
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24, vy: (Math.random() - 0.5) * 0.24,
        r: rank === 1 ? 4.6 : rank === 2 ? 3.5 : rank === 3 ? 2.7 : 2.1,
        pulse: Math.random() * Math.PI * 2,
      }));
    }

    let frame = 0;
    function step() {
      const pal = palette();
      if ((frame++ & 31) === 0) measureQuiet();
      ctx.clearRect(0, 0, w, h);
      const LINK = 118, PULL = 170;
      for (const n of nodes) {
        if (!reduced) {
          n.x += n.vx; n.y += n.vy; n.pulse += 0.016;
          if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
          const dx = pointer.x - n.x, dy = pointer.y - n.y, pd = Math.hypot(dx, dy);
          if (pd < PULL && n !== hover) { const f = (1 - pd / PULL) * 0.016; n.x += dx * f; n.y += dy * f; }
        }
        n.pd = Math.hypot(pointer.x - n.x, pointer.y - n.y);
        n.q = n.q === undefined ? (inQuiet(n) ? 1 : 0) : n.q + ((inQuiet(n) ? 1 : 0) - n.q) * 0.08;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j], d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d > LINK) continue;
          const near = Math.min(n.pd, m.pd), boost = near < PULL ? 1 - near / PULL : 0;
          const hush = 1 - Math.max(n.q, m.q) * 0.9;
          ctx.strokeStyle = `rgba(${pal.line}, ${(1 - d / LINK) * (0.07 + boost * 0.38) * pal.alpha * hush})`;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        }
      }
      for (const n of nodes) {
        const glow = n.pd < PULL ? 1 - n.pd / PULL : 0;
        ctx.globalAlpha = Math.min(1, (pal.light ? 0.8 : 0.55) + Math.sin(n.pulse) * 0.12 + glow * 0.45) * (1 - n.q * 0.86);
        ctx.fillStyle = pal.light ? n.colL : n.col;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + glow * 1.6 + (n === hover ? 3 : 0), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (hover) {
        ctx.strokeStyle = `rgba(${pal.line}, .9)`;
        ctx.beginPath(); ctx.arc(hover.x, hover.y, hover.r + 8, 0, Math.PI * 2); ctx.stroke();
      }
      if (!reduced) raf = requestAnimationFrame(step);
    }

    function pick(e) {
      if (!pointer.live || e.target.closest('h1, p, a, button')) return null;
      let best = null, bd = 16;
      for (const n of nodes) { if (!n.name) continue; const d = Math.hypot(pointer.x - n.x, pointer.y - n.y) - n.r; if (d < bd) { bd = d; best = n; } }
      return best;
    }
    const track = e => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.live = true;
      const n = pick(e);
      if (n !== hover) { hover = n; window.pwCursor(n ? n.name : ''); hero.classList.toggle('on-node', !!n); if (reduced) step(); }
    };
    hero.addEventListener('pointermove', track, { passive: true });
    hero.addEventListener('pointerdown', track, { passive: true });
    hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; pointer.live = false; if (hover) { hover = null; window.pwCursor(''); hero.classList.remove('on-node'); } });
    hero.addEventListener('click', e => { if (hover && hover.id && !e.target.closest('a, button')) location.href = `music/?album=${hover.id}`; });

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); measureQuiet(); if (reduced) step(); }, 120); }, { passive: true });
    window.addEventListener('pw-theme', () => { if (reduced) step(); });
    resize(); measureQuiet(); step();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureQuiet(); if (reduced) step(); });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) step();
    });
  }

  /* ---------- Portfolio filter ---------- */
  const filters = $$('.filter');
  if (filters.length) {
    filters.forEach(btn => btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const f = btn.dataset.filter;
      $$('.proj').forEach(p => {
        const match = f === 'all' || (p.dataset.cat || '').split(' ').includes(f);
        p.classList.toggle('gone', !match);
      });
    }));
  }

  /* ---------- Copy to clipboard ---------- */
  $$('[data-copy]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const txt = el.dataset.copy;
      navigator.clipboard?.writeText(txt).then(
        () => toast('Copied: ' + txt),
        () => toast('Copy failed — ' + txt)
      );
    });
  });

  /* ---------- Contact form → real mail draft (no fake success) ---------- */
  const form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      const subject = encodeURIComponent(`Hello from ${name || 'your website'}`);
      const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
      window.location.href = `mailto:hello@pierrewallin.com?subject=${subject}&body=${body}`;
      toast('Opening your mail app…');
    });
  }

  /* ---------- Command palette ---------- */
  const cmdk = $('.cmdk');
  if (cmdk) {
    const input = $('.cmdk-box input', cmdk);
    const list = $('.cmdk-list', cmdk);
    let sel = 0, results = [];

    const base = [
      { i: '◈', t: 'Home',          s: '/',                             k: 'home start top' },
      { i: '◐', t: 'The Album Atlas', s: '/music/',                     k: 'music albums atlas data viz visualization rotation crossing tree' },
      { i: '◌', t: 'Unidentified: 76 years of UFO reports', s: '/ufo/', k: 'ufo ufos reports sightings data viz visualization sky calendar average nuforc' },
      { i: '▲', t: 'Fifty Seasons: Survivor in data', s: '/survivor/', k: 'survivor tv show seasons castaways votes tribal council jury torches edit confessionals data viz visualization' },
      { i: '✎', t: 'Writing',       s: '/blog.html',                    k: 'writing blog articles essays linkedin' },
      { i: '¶', t: 'The Weight of Stones (written by AI)', s: '/writing/the-weight-of-stones/', k: 'story fiction ai written by ai experiment stones japan kumano trail' },
      { i: '☺', t: 'About',         s: '/about.html',                   k: 'about bio who pierre' },
      { i: '✉', t: 'Email Pierre',  s: 'mailto:hello@pierrewallin.com', k: 'email mail contact reach hello' },
      { i: 'in', t: 'LinkedIn',     s: 'https://www.linkedin.com/in/pierre-e-wallin', k: 'linkedin social connect profile' },
      { i: '☀', t: 'Toggle theme',  s: 'action:theme',                  k: 'theme dark light mode appearance' },
      { i: '↗', t: 'Some Features My AI Assistant Does for Me, Ranked', s: 'https://www.linkedin.com/pulse/some-features-my-ai-assistant-does-me-ranked-pierre-wallin-mba-10oae', k: 'essay article pearl features ranked' },
      { i: '↗', t: 'The Night I Realized My AI Assistant Wasn’t Broken, My Instructions Were', s: 'https://www.linkedin.com/pulse/night-i-realized-my-ai-assistant-wasnt-broken-were-pierre-wallin-mba-pbcye', k: 'essay article pearl instructions prompt' },
      { i: '↗', t: 'Why My AI Assistant Keeps Forgetting I Don’t Drink Coffee', s: 'https://www.linkedin.com/pulse/why-my-ai-assistant-keeps-forgetting-i-dont-drink-pierre-wallin-mba-xwzae', k: 'essay article pearl memory coffee' },
      { i: '↗', t: 'Version 3.0 Is Loading: A Brief History of Underestimating Microsoft', s: 'https://www.linkedin.com/pulse/version-30-loading-brief-history-underestimating-pierre-wallin-mba-m3hxe', k: 'essay article microsoft copilot history' },
      { i: '↗', t: 'How I Used Three AIs to Build the Soul of a Fourth', s: 'https://www.linkedin.com/pulse/how-i-used-three-ais-build-soul-fourth-pierre-wallin-mba-puete', k: 'essay article pearl soul three ais' }
    ];

    function render(q) {
      const term = q.trim().toLowerCase();
      results = term
        ? base.filter(x => (x.t + ' ' + x.k).toLowerCase().includes(term))
        : base.slice();
      sel = 0;
      if (!results.length) { list.innerHTML = '<div class="cmdk-empty">Nothing here. Try “music” or “writing”.</div>'; return; }
      list.innerHTML = results.map((r, i) => {
        const hint = r.s.startsWith('action:') ? 'action' : r.s.startsWith('http') ? 'external' : r.s.startsWith('mailto') ? 'mail' : 'page';
        return `<button class="cmdk-item${i === sel ? ' sel' : ''}" data-i="${i}">
          <span class="ic">${r.i}</span><span>${r.t}</span><small>${hint}</small></button>`;
      }).join('');
    }

    function run(r) {
      close();
      if (!r) return;
      if (r.s === 'action:theme') return toggleTheme();
      if (r.s.startsWith('http')) return window.open(r.s, '_blank', 'noopener');
      window.location.href = r.s;
    }

    function open() {
      cmdk.classList.add('open');
      render('');
      input.value = '';
      setTimeout(() => input.focus(), 60);
    }
    function close() { cmdk.classList.remove('open'); }
    window.pwPalette = open;

    input.addEventListener('input', () => render(input.value));
    list.addEventListener('click', e => {
      const b = e.target.closest('.cmdk-item');
      if (b) run(results[+b.dataset.i]);
    });
    cmdk.addEventListener('click', e => { if (e.target === cmdk) close(); });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        $$('.cmdk-item', list).forEach((el, i) => el.classList.toggle('sel', i === sel));
        $$('.cmdk-item', list)[sel]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
      else if (e.key === 'Escape') close();
    });

    $$('[data-palette]').forEach(b => b.addEventListener('click', open));

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.classList.contains('open') ? close() : open(); }
      if (e.key === 'Escape') close();
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
    });
  }

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
