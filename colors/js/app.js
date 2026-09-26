/* Bluish Green: view switching and deep links. */
(function () {
  'use strict';
  const X = window.CO, D = X.D;
  const DESC = {
    map: 'Every color on a screen, and the name most people gave it. Drag sideways to turn the wheel, and point anywhere to see every name a color got.',
    name: 'Type a color\u2019s name to see all the colors people meant by it, or lay two names over each other.',
    words: 'What light, dark and dusty do to a color, why bluish green isn\u2019t greenish blue, and how people spell fuchsia.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;
  document.getElementById('uStats').textContent = `In 2010, xkcd showed people random colors and asked them to type a name. ${X.fmt(D.users)} people typed ${X.fmt(D.n)} names, ${X.fmt(D.distinct)} of them different.`;

  function go(name, keepUrl) {
    if (!views[name]) name = 'map';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    if (!keepUrl) X.setParams({ view: name === 'map' ? null : name, band: null, level: null });
    X.views[name].show();
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
  go(X.params().get('view') || 'map', true);
})();
