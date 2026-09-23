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
  const THEME_KEY = 'pw-theme';
  const root = document.documentElement;

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    $$('.js-theme-icon').forEach(el => { el.textContent = t === 'light' ? '☾' : '☀'; });
  }
  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (document.startViewTransition && !reduced) document.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  }
  (function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved || 'dark');
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

  /* ---------- Typed subtitle ---------- */
  const typedEl = $('[data-typed]');
  if (typedEl && !reduced) {
    const words = JSON.parse(typedEl.getAttribute('data-typed'));
    let wi = 0, ci = 0, deleting = false;
    (function tick() {
      const w = words[wi];
      ci += deleting ? -1 : 1;
      typedEl.textContent = w.slice(0, ci);
      let delay = deleting ? 38 : 72;
      if (!deleting && ci === w.length) { delay = 1900; deleting = true; }
      else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 320; }
      setTimeout(tick, delay);
    })();
  } else if (typedEl) {
    typedEl.textContent = JSON.parse(typedEl.getAttribute('data-typed'))[0];
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

  /* ---------- Custom cursor + magnetic ---------- */
  if (fine && !reduced) {
    const dot = document.createElement('div'); dot.className = 'cursor';
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    document.body.append(dot, ring);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

    window.addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener('pointerover', e => {
      ring.classList.toggle('hot', !!e.target.closest('a, button, input, textarea, .chip, .card, .post'));
    });

    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Hero memory-graph canvas ---------- */
  const canvas = $('#graph');
  if (canvas && !reduced) {
    const ctx = canvas.getContext('2d');
    let w, h, dpr, nodes = [], raf;
    const pointer = { x: -9999, y: -9999 };

    function palette() {
      return root.getAttribute('data-theme') === 'light'
        ? { node: '109, 77, 214', line: '109, 77, 214' }
        : { node: '185, 166, 255', line: '160, 190, 255' };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const density = Math.round((w * h) / 17000);
      const count = Math.max(34, Math.min(110, density));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.7,
        pulse: Math.random() * Math.PI * 2
      }));
    }

    function draw() {
      const pal = palette();
      ctx.clearRect(0, 0, w, h);
      const LINK = 132, PULL = 168;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy; n.pulse += 0.017;
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;

        const dx = pointer.x - n.x, dy = pointer.y - n.y;
        const pd = Math.hypot(dx, dy);
        if (pd < PULL) {
          const f = (1 - pd / PULL) * 0.018;
          n.x += dx * f; n.y += dy * f;
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < LINK) {
            const near = Math.min(pd, Math.hypot(pointer.x - m.x, pointer.y - m.y));
            const boost = near < PULL ? 1 - near / PULL : 0;
            ctx.strokeStyle = `rgba(${pal.line}, ${(1 - d / LINK) * (0.10 + boost * 0.45)})`;
            ctx.lineWidth = 0.6 + boost * 0.6;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        const glow = pd < PULL ? 1 - pd / PULL : 0;
        const a = 0.26 + Math.sin(n.pulse) * 0.14 + glow * 0.6;
        ctx.fillStyle = `rgba(${pal.node}, ${a})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + glow * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    const hero = canvas.closest('.hero') || canvas.parentElement;
    hero.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });

    window.addEventListener('resize', () => { resize(); }, { passive: true });
    resize(); draw();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { cancelAnimationFrame(raf); draw(); }
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
      { i: '✎', t: 'Writing',       s: '/blog.html',                    k: 'writing blog articles essays linkedin' },
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
