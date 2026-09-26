/* The Slow Clock: view switching and deep links. */
(function () {
  'use strict';
  const X = window.CX;
  const DESC = {
    clock: 'Four records of the year, kept for centuries, on one clock. Point anywhere to read a year, or wind it forward.',
    kyoto: 'Every full bloom in Kyoto since 812, and the diaries, poems and newspapers each date was taken from.',
    four: 'The four records on one timeline, as days early or late against their own old average.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;
  const total = X.K.reduce((s, k) => s + k.n, 0);
  document.getElementById('uStats').textContent = `${X.fmt(total)} dates, from 812 to 2026: when the cherries bloomed in Kyoto, when the grapes were picked in Burgundy, when Lake Suwa froze and when the ice broke on the Torne.`;

  function go(name, keepUrl) {
    if (!views[name]) name = 'clock';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show();
    if (!keepUrl) X.setParams({ view: name === 'clock' ? null : name });
  }
  X.go = go;
  tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.view)));
  document.querySelector('.u-tabs').addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.dataset.view === current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopPropagation();
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); go(n.dataset.view);
    }
  });
  go(X.params().get('view') || 'clock', true);
})();
