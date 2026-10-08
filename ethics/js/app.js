/* Hard Cases: view switching and deep links. */
(function () {
  'use strict';
  const X = window.HC;
  const DESC = {
    gates: 'Three trolley problems, answered by 65,175 people. They fall through the cases as grains and land in the bin of the theory their answers match.',
    faults: 'Nineteen theories of right and wrong, placed by how often they agree. Every line is a case that splits them. Pick a case, a theory, or two theories.',
    old: 'The same hard cases, posed again and again for 2,500 years. Each arc joins one telling of a dilemma to the next.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;

  function go(name, keepUrl) {
    if (!views[name]) name = 'gates';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    X.tip(null);
    if (!keepUrl) X.setParams({ view: name === 'gates' ? null : name, c: null, mode: null, case: null, a: null, b: null, d: null, dials: null, sort: null });
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show();
    // each view keeps its state across tab switches, so it writes that state back into the address
    if (!keepUrl && X.views[name].sync) X.views[name].sync();
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
  go(X.params().get('view') || 'gates', true);
})();
