/* Unidentified: view switching and deep links. */
(function () {
  'use strict';
  const X = window.UFOX;
  const DESC = {
    sky: 'Every report, replayed where it was made, in the shape and color the witness gave.',
    shape: 'Every shape reported in a year, laid over each other by how often it was named.',
    calendar: 'The day of the year and the hour of the day, for every report.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;

  document.getElementById('uStats').textContent =
    `${X.fmt(X.N)} UFO reports from ${X.fmt(new Set(X.pid).size)} towns across the United States, ${Math.floor(X.tf[0])} to ${Math.floor(X.tf[X.N - 1])}.`;

  function go(name, keepUrl) {
    if (!views[name]) name = 'sky';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show();
    if (!keepUrl) X.setParams({ view: name === 'sky' ? null : name });
  }
  tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.view)));
  document.querySelector('.u-tabs').addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.dataset.view === current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); go(n.dataset.view); }
  });
  go(X.params().get('view') || 'sky', true);
})();
