/* All Roads: view switching and deep links. */
(function () {
  'use strict';
  const X = window.RD, D = X.D;
  const DESC = {
    rome: 'Walking time spreading out from Rome along every road. Press play, point at any place for its route, or start from anywhere else.',
    known: 'How much of the map anyone is sure of, who built which roads, and the ancient itineraries that list them.',
    trip: 'Pick any two places and walk between them, day by day.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;
  let certainKm = 0, totalKm = 0;
  for (let s = 0; s < X.NS; s++) { const k = X.segKm(s); totalKm += k; if (X.certOf(s) === 0) certainKm += k; }
  document.getElementById('uStats').textContent = `${X.fmt(totalKm)} km of road, from Britain to Egypt, in ${X.fmt(X.NS)} stretches. Only ${X.fmt1(certainKm / totalKm * 100)}% of it lies where anyone is certain.`;

  function go(name, keepUrl, opts) {
    if (!views[name]) name = 'rome';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!keepUrl) X.setParams({ view: name === 'rome' ? null : name, from: null, to: null, days: null, lens: null, tag: null, by: null, cert: null });
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show(opts);
    // each view keeps its state across tab switches, so it writes that state back into the address
    if (!keepUrl && X.views[name].sync) X.views[name].sync();
    if (opts) scrollTo({ top: 0, behavior: X.reduced ? 'auto' : 'smooth' });
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
  go(X.params().get('view') || 'rome', true);
})();
