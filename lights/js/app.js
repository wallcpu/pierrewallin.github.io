/* Night Coast: view switching and deep links. */
(function () {
  'use strict';
  const X = window.LX;
  const DESC = {
    night: 'Every charted light flashes here in its own rhythm and color. Zoom into a harbor and switch on Listen to hear it.',
    grammar: 'Lights say who they are by how they flash. These are the rhythms the world\u2019s coasts use, and how often.',
    rules: 'The sea has two rulebooks for which side of a channel is red. The lights show where each one holds.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;
  const rhythmic = X.N - [...Array(X.N).keys()].filter(i => X.isFixed(i)).length;
  document.getElementById('uStats').textContent = `${X.fmt(X.N)} lights mark the world's coasts, lakes and rivers here, and ${X.fmt(rhythmic)} of them flash in a rhythm of their own.`;

  function go(name, opts, keepUrl) {
    if (!views[name]) name = 'night';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show(opts || {});
    if (!keepUrl) { const s = name === 'night' ? X.views.night.state() : null; X.setParams({ view: name === 'night' ? null : name, at: s && s.preset !== 'world' ? s.preset : null }); }
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
  const p = X.params();
  go(p.get('view') || 'night', { at: p.get('at'), initial: true }, true);
})();
