/* Fifty Seasons: view switching and deep links. */
(function () {
  'use strict';
  const X = window.SX, D = X.D;
  const DESC = {
    season: 'One season at a time. Every castaway is a thread, as thick as their confessionals, and every vote is a stitch.',
    everyone: 'Every castaway who ever played, by season and by finish, with a line for everyone who came back.',
    edit: 'Who the show lets talk, and whether that tells you who wins.',
  };
  const tabs = [...document.querySelectorAll('.u-tabs [data-view]')];
  const views = Object.fromEntries([...document.querySelectorAll('.u-stage .u-view')].map(v => [v.dataset.view, v]));
  const inited = new Set();
  let current = null;

  const votes = D.seasons.reduce((s, S) => s + S.tribals.reduce((a, t) => a + t.v.length, 0), 0);
  const cast = D.seasons.reduce((s, S) => s + S.cast.length, 0);
  document.getElementById('uStats').textContent =
    `${X.fmt(cast)} castaways, ${X.fmt(D.seasons.reduce((s, S) => s + S.tribals.length, 0))} tribal councils and ${X.fmt(votes)} votes from fifty seasons of Survivor, ${X.year(D.seasons[0])} to ${X.year(D.seasons[D.seasons.length - 1])}.`;

  function go(name, opts, keepUrl) {
    if (!views[name]) name = 'season';
    if (current && current !== name) { X.views[current].hide(); views[current].classList.remove('on'); }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    views[name].classList.add('on');
    document.getElementById('uDesc').textContent = DESC[name];
    if (!inited.has(name)) { X.views[name].init(views[name]); inited.add(name); }
    current = name;
    X.views[name].show(opts || {});
    if (!keepUrl) X.setParams({ view: name === 'season' ? null : name });
  }
  X.go = go;
  tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.view)));
  document.querySelector('.u-tabs').addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.dataset.view === current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); go(n.dataset.view); }
  });
  const p = X.params();
  go(p.get('view') || 'season', { season: p.get('season'), who: p.get('who'), initial: true }, true);
})();
