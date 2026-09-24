/* Album Atlas — view switching, deep links, cross-view navigation. */
(function () {
  'use strict';
  const A = window.Atlas;
  const DESC = {
    rotation: 'Every album in rotation, orbiting whatever it played on. Each lap under the needle plays its note.',
    crossing: 'Twenty-seven years drawn as one migration, after Minard.',
    tree: 'Where the music came from: one stereo, then everyone else.',
  };
  const tabs = [...document.querySelectorAll('.atlas-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.stage .view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;

  const s = A.D.stats;
  document.getElementById('atlasStats').textContent =
    `${s.albums} albums, 27 years, ${A.D.phases.length} chapters, ${s.places} places and ${s.memories} memories.`;
  const stage = document.getElementById('stage');
  const fit = () => document.documentElement.style.setProperty('--hr-top', Math.round(stage.getBoundingClientRect().top + scrollY) + 'px');
  fit(); addEventListener('resize', fit); document.fonts && document.fonts.ready.then(fit);

  function go(name, opts = {}) {
    if (!views[name]) name = 'rotation';
    if (current && current !== name) { A.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('atlasDesc').textContent = DESC[name];
    if (!inited.has(name)) { A.views[name].init(views[name]); inited.add(name); }
    current = name;
    A.views[name].show();
    if (!opts.keepUrl) A.setParams({ view: name === 'rotation' ? null : name });
  }

  tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.view)));
  document.querySelector('.atlas-tabs').addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.dataset.view === current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); go(n.dataset.view);
    }
  });

  A.on('goto', ({ view, id }) => {
    go(view);
    requestAnimationFrame(() => A.views[view].focus(id));
    if (view !== 'rotation') A.openPanel(id, { silent: true });
  });

  const p = A.params();
  go(p.get('view') || 'rotation', { keepUrl: true });
  const id = +p.get('album');
  if (id && A.byId.has(id)) setTimeout(() => { A.openPanel(id, { silent: true }); if (current !== 'rotation') A.views[current].focus(id); }, 400);
})();
