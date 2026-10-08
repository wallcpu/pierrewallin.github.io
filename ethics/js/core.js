/* Hard Cases: shared helpers. */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (a, b) => b ? fmt1(a / b * 100) + '%' : '';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  function rng(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // the verdict colours: yes is warm, no is cool, torn is white
  const YES = '#f2a23c', NO = '#7db3ff', TORN = '#ffffff', MUTE = '#5e5a55';

  // a canvas that keeps its backing store in step with its css size and the screen's pixel ratio
  function sizeCanvas(cv, w, h) {
    const d = Math.min(devicePixelRatio || 1, 2.5);
    const W = Math.max(1, Math.round(w * d)), H = Math.max(1, Math.round(h * d));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
    return g;
  }
  function watchDpr(fn) {
    const arm = () => { const mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); mq.addEventListener('change', () => { fn(); arm(); }, { once: true }); };
    arm();
  }
  // calls fn when the element's width changes, at most once a frame
  function onWidth(el, fn) {
    let w = 0, raf = 0;
    new ResizeObserver(() => { const nw = Math.round(el.clientWidth); if (nw === w) return; w = nw; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fn(nw)); }).observe(el);
  }
  // Space plays and pauses, except when a control has focus: then Space belongs to that control
  const spaceFree = e => !(e.target.closest && e.target.closest('input, textarea, select, button, a, [role="button"], [role="tab"]'));

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
  addEventListener('scroll', () => tip(null), { passive: true });

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }

  const listWords = arr => arr.length <= 1 ? (arr[0] || '') : arr.length === 2 ? `${arr[0]} and ${arr[1]}` : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  window.HC = { reduced, fmt, fmt1, pct, esc, clamp, lerp, ease, rng, YES, NO, TORN, MUTE, sizeCanvas, watchDpr, onWidth, spaceFree, tip, params, setParams, listWords, el, views: {} };
})();
