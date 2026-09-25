/* The Whale Road: view switching and deep links. */
(function () {
  'use strict';
  const X = window.WX, W = X.W;
  const firstYear = Math.min(...W.v.filter(r => r[6]).map(r => r[6])), lastYear = Math.max(...W.v.map(r => r[6]));
  const DESC = {
    grounds: 'Every noon in the logbooks, replayed. The hunt moves from ocean to ocean as each kind of whale gets scarce.',
    voyage: 'One ship and one voyage, day by day. Where she went, what she saw and struck, and how she ended.',
    fleet: `Every American whaling voyage on record, from the first in ${firstYear} to the last in ${lastYear}, and how the ships ended.`,
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;

  document.getElementById('uStats').textContent =
    `${X.fmt(X.LOGS.reduce((s, r) => s + r[2], 0))} noon positions from ${X.fmt(X.NL)} whaling logbooks, 1784 to 1920, and all ${X.fmt(X.NV)} American whaling voyages on record.`;
  const note = document.getElementById('uNote');
  if (note) note.textContent = `${X.fmt(W.meta.spikes)} single-day jumps of more than six degrees, farther than a whaleship could sail in a day, are left out, as are ${W.meta.logsNoMatch} logs with no matching voyage.`;

  function go(name, opts, keepUrl) {
    if (!views[name]) name = 'grounds';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show(opts || {});
    if (!keepUrl) X.setParams({ view: name === 'grounds' ? null : name, voyage: name === 'voyage' && opts && opts.voyage ? opts.voyage : (name === 'voyage' ? X.params().get('voyage') : null) });
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
  go(p.get('view') || (p.get('voyage') ? 'voyage' : 'grounds'), { voyage: p.get('voyage'), year: p.get('year'), initial: true }, true);
})();
