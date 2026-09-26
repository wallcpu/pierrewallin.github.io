/* All Roads: shared data, projection, geometry, the road graph, and helpers. */
(function () {
  'use strict';
  const D = window.ROADS, NN = D.nn, NS = D.ns;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RAD = Math.PI / 180;

  // ---------- places ----------
  const qlo = new Int32Array(NN), qla = new Int32Array(NN), nlon = new Float64Array(NN), nlat = new Float64Array(NN);
  { let a = 0, b = 0; for (let i = 0; i < NN; i++) { a += D.nlo[i]; b += D.nla[i]; qlo[i] = a; qla[i] = b; nlon[i] = a / 1e5; nlat[i] = b / 1e5; } }
  const SU = Int32Array.from(D.su), SV = Int32Array.from(D.sv);
  const other = (s, u) => SU[s] === u ? SV[s] : SU[s];

  // ---------- projection: an equal-area conic laid over the Mediterranean, scaled so the empire is 1 wide ----------
  const P1 = 30 * RAD, P2 = 50 * RAD, P0 = 38 * RAD, L0 = 15 * RAD;
  const cn = (Math.sin(P1) + Math.sin(P2)) / 2, cc = Math.cos(P1) ** 2 + 2 * cn * Math.sin(P1), rho0 = Math.sqrt(cc - 2 * cn * Math.sin(P0)) / cn;
  function rawProj(lon, lat) {
    const rho = Math.sqrt(Math.max(0, cc - 2 * cn * Math.sin(lat * RAD))) / cn, th = cn * (lon * RAD - L0);
    return [rho * Math.sin(th), rho0 - rho * Math.cos(th)];
  }
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let i = 0; i < NN; i++) { const [x, y] = rawProj(nlon[i], nlat[i]); if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const BW = bx1 - bx0;
  // screen y runs down, so north is the smaller number
  const toUnit = (lon, lat) => { const [x, y] = rawProj(lon, lat); return [(x - bx0) / BW, (by1 - y) / BW]; };
  const UH = (by1 - by0) / BW;
  const PX = new Float32Array(NN), PY = new Float32Array(NN);
  for (let i = 0; i < NN; i++) { const [x, y] = toUnit(nlon[i], nlat[i]); PX[i] = x; PY[i] = y; }
  // unit length per km, near the middle of the map, for scale bars
  const KM = (() => { const [a] = toUnit(15, 40), [b] = toUnit(16, 40); return (b - a) / (111.32 * Math.cos(40 * RAD)); })();

  // ---------- segment attributes ----------
  const flags = Uint8Array.from(D.sf);
  const isMain = s => flags[s] & 1;
  const certOf = s => (flags[s] >> 1) & 3;          // 0 certain, 1 conjectured, 2 hypothetical
  const isFerry = s => (flags[s] >> 3) & 1;
  const CERT = ['certain', 'conjectured', 'hypothetical'];
  const segKm = s => D.sm[s] / 1000;
  const segSlope = s => D.sl[s] / 100;
  const tagsOf = s => D.st[s] < 0 ? [] : D.combos[D.st[s]];
  const segName = s => D.segnames[D.sn[s]];
  const descOf = new Map(D.desc.map(([s, k]) => [s, D.descs[k]]));
  const dateOf = new Map(D.dates.map(([s, a, b]) => [s, [a, b]]));
  // walking time: Tobler's hiking function on the road's average slope, taken both ways and averaged, six hours a day
  const HOURS = D.hours;
  const segDays = new Float64Array(NS);
  for (let s = 0; s < NS; s++) {
    const t = Math.tan(segSlope(s) * RAD), up = 6 * Math.exp(-3.5 * Math.abs(t + .05)), dn = 6 * Math.exp(-3.5 * Math.abs(-t + .05));
    segDays[s] = segKm(s) * ((1 / up + 1 / dn) / 2) / HOURS;
  }
  const flatKmDay = 6 * Math.exp(-3.5 * .05) * HOURS;

  // ---------- the graph ----------
  const adjOff = new Int32Array(NN + 1);
  for (let s = 0; s < NS; s++) { adjOff[SU[s] + 1]++; adjOff[SV[s] + 1]++; }
  for (let i = 0; i < NN; i++) adjOff[i + 1] += adjOff[i];
  const adjN = new Int32Array(NS * 2), adjS = new Int32Array(NS * 2);
  { const fill = adjOff.slice(0, NN); for (let s = 0; s < NS; s++) { let k = fill[SU[s]]++; adjN[k] = SV[s]; adjS[k] = s; k = fill[SV[s]]++; adjN[k] = SU[s]; adjS[k] = s; } }
  const degree = n => adjOff[n + 1] - adjOff[n];
  // the pieces of the network that are joined by road
  const comp = new Int32Array(NN).fill(-1), compSize = [];
  for (let i = 0, c = 0; i < NN; i++) {
    if (comp[i] >= 0) continue;
    const st = [i]; comp[i] = c; let n = 0;
    while (st.length) { const u = st.pop(); n++; for (let k = adjOff[u]; k < adjOff[u + 1]; k++) { const v = adjN[k]; if (comp[v] < 0) { comp[v] = c; st.push(v); } } }
    compSize.push(n); c++;
  }
  // fastest walking routes out of one place, by Dijkstra over the whole network
  const hD = new Float64Array(NS * 2 + 16), hN = new Int32Array(NS * 2 + 16);
  function paths(src, cost = segDays) {
    const dist = new Float64Array(NN).fill(Infinity), prev = new Int32Array(NN).fill(-1), order = new Int32Array(NN), done = new Uint8Array(NN);
    let hs = 0, no = 0;
    const push = (d, n) => { let i = hs++; while (i > 0) { const p = (i - 1) >> 1; if (hD[p] <= d) break; hD[i] = hD[p]; hN[i] = hN[p]; i = p; } hD[i] = d; hN[i] = n; };
    dist[src] = 0; push(0, src);
    while (hs) {
      const u = hN[0], du = hD[0];
      const ld = hD[--hs], ln = hN[hs];
      let i = 0;
      while (true) { let l = 2 * i + 1; if (l >= hs) break; if (l + 1 < hs && hD[l + 1] < hD[l]) l++; if (hD[l] >= ld) break; hD[i] = hD[l]; hN[i] = hN[l]; i = l; }
      hD[i] = ld; hN[i] = ln;
      if (done[u] || du > dist[u]) continue;
      done[u] = 1; order[no++] = u;
      for (let k = adjOff[u]; k < adjOff[u + 1]; k++) {
        const v = adjN[k], s = adjS[k], nd = du + cost[s];
        if (nd < dist[v]) { dist[v] = nd; prev[v] = s; push(nd, v); }
      }
    }
    let far = src;
    for (let k = 0; k < no; k++) if (dist[order[k]] > dist[far]) far = order[k];
    return { src, dist, prev, order: order.subarray(0, no), n: no, far, max: dist[far] };
  }
  // how many places route through each road on their fastest way to the source
  function flows(R) {
    const cnt = new Float64Array(NN), f = new Float32Array(NS);
    for (let k = R.n - 1; k >= 0; k--) {
      const u = R.order[k]; cnt[u] += 1;
      const s = R.prev[u]; if (s < 0) continue;
      f[s] = cnt[u]; cnt[other(s, u)] += cnt[u];
    }
    return f;
  }
  function route(R, n) {
    const segs = [], nodes = [n];
    if (!(R.dist[n] < Infinity)) return null;
    let u = n;
    while (u !== R.src) { const s = R.prev[u]; segs.push(s); u = other(s, u); nodes.push(u); }
    return { segs: segs.reverse(), nodes: nodes.reverse(), days: R.dist[n], km: segs.reduce((a, s) => a + segKm(s), 0) };
  }

  // ---------- names ----------
  const nameOf = n => D.nm[n] >= 0 ? D.names[D.nm[n]] : null;
  const imp = Int32Array.from(D.imp);
  const alts = new Map();
  for (const [n, t] of D.alt) { if (!alts.has(n)) alts.set(n, []); alts.get(n).push(t); }
  // "Emmaus-Jerusalem" reads as "Emmaus to Jerusalem"; numbered survey labels are not place names
  const roadWords = s => { const nm = segName(s) || ''; const parts = nm.split(/\s*-\s*|,\s+/).filter(Boolean); return parts.length >= 2 ? `${parts[0]} to ${parts[parts.length - 1]}` : nm; };
  function describe(n) {
    const nm = nameOf(n); if (nm) return nm;
    for (let k = adjOff[n]; k < adjOff[n + 1]; k++) { const w = roadWords(adjS[k]); if (w.includes(' to ') && !/\d/.test(w)) return `A fork on the road from ${w}`; }
    return 'A fork in the road';
  }
  function hav(lo1, la1, lo2, la2) {
    const p1 = la1 * RAD, p2 = la2 * RAD, dl = (lo2 - lo1) * RAD;
    return 2 * 6371 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2));
  }
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  function bearingWord(a, b) {
    const p1 = nlat[a] * RAD, p2 = nlat[b] * RAD, dl = (nlon[b] - nlon[a]) * RAD;
    const th = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
    return COMPASS[Math.round(((th / RAD + 360) % 360) / 45) % 8];
  }
  // a searchable list of every named place; places that share a name are told apart by where they lie from Rome
  const ROME = D.rome;
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const SEARCH = (() => {
    const out = [], count = new Map();
    for (let n = 0; n < NN; n++) { const t = nameOf(n); if (t) count.set(t, (count.get(t) || 0) + 1); }
    for (let n = 0; n < NN; n++) {
      const t = nameOf(n); if (!t) continue;
      let hint = '';
      if (count.get(t) > 1 && n !== ROME) hint = `${fmt(Math.round(hav(nlon[ROME], nlat[ROME], nlon[n], nlat[n]) / 10) * 10)} km ${bearingWord(ROME, n)} of Rome`;
      out.push({ t, n, hint, imp: imp[n], k: norm(t) });
      for (const a of alts.get(n) || []) out.push({ t: a, n, hint: `also ${t}`, imp: imp[n] - .5, k: norm(a) });
    }
    return out;
  })();
  function search(q, limit = 8) {
    q = norm(q.trim());
    if (!q) return [];
    const hits = [];
    for (const e of SEARCH) {
      const i = e.k.indexOf(q); if (i < 0) continue;
      const fam = famousRank.has(e.n) ? 60 - famousRank.get(e.n) : 0;
      hits.push([(i === 0 ? 0 : e.k[i - 1] === ' ' ? 1 : 2) * 1000 - fam * 10 - e.imp * 10 + e.k.length / 100, e]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    const seen = new Set(), res = [];
    for (const [, e] of hits) { if (seen.has(e.n)) continue; seen.add(e.n); res.push(e); if (res.length >= limit) break; }
    return res;
  }
  // find a place by name, or by node number, for links like ?from=Carthago
  function lookup(q, near) {
    if (q == null || q === '') return -1;
    if (/^\d+$/.test(q)) { const n = +q; return n >= 0 && n < NN ? n : -1; }
    const k = norm(q);
    let best = -1, bs = -Infinity;
    for (const e of SEARCH) {
      if (e.k !== k) continue;
      const sc = near ? -hav(near[0], near[1], nlon[e.n], nlat[e.n]) : e.imp + (famousRank.has(e.n) ? 1000 : 0);
      if (sc > bs) { bs = sc; best = e.n; }
    }
    return best;
  }

  // the famous places, with rough positions to pick the right one among namesakes. Order is label priority.
  const famousRank = new Map();
  const FAMOUS = [
    ['Rome', 12.49, 41.89], ['Constantinopolis', 28.98, 41.01], ['Alexandria', 29.92, 31.2], ['Carthago', 10.32, 36.85], ['Antioch', 36.16, 36.2],
    ['Londinium', -.09, 51.51], ['Jerusalem', 35.23, 31.78], ['Lugdunum', 4.83, 45.76], ['Athens', 23.73, 37.98], ['Mediolanum', 9.19, 45.46],
    ['Gades', -6.29, 36.53], ['Tingi', -5.8, 35.78], ['Septem', -5.32, 35.89], ['Brundisium', 17.94, 40.64], ['Ephesus', 27.34, 37.94],
    ['Colonia Augusta Treverorum', 6.64, 49.75], ['Ankyra', 32.86, 39.93], ['Damascus', 36.3, 33.51], ['Lepcis Magna', 14.29, 32.64], ['Olisipo', -9.14, 38.71],
    ['Tarraco', 1.25, 41.12], ['Burdigala', -.58, 44.84], ['Massalia', 5.37, 43.3], ['Aquileia', 13.37, 45.77], ['Sirmium', 19.61, 44.97],
    ['Thessalonike', 22.94, 40.64], ['Vindobona', 16.37, 48.21], ['Aquincum', 19.05, 47.56], ['Colonia Claudia Ara Agrippinensium', 6.96, 50.94], ['Eburacum', -1.08, 53.96],
    ['Emerita Augusta', -6.34, 38.92], ['Cyrene', 21.86, 32.82], ['Palmyra', 38.27, 34.55], ['Petra', 35.44, 30.33], ['Berenike', 35.47, 23.91],
    ['Nicomedia', 29.92, 40.77], ['Tarsus', 34.9, 36.92], ['Serdica', 23.32, 42.7], ['Neapolis', 14.25, 40.85], ['Ravenna', 12.2, 44.42],
    ['Caesaraugusta', -.88, 41.65], ['Carthago Nova', -.98, 37.6], ['Volubilis', -5.55, 34.07], ['Cirta', 6.61, 36.37], ['Pergamum', 27.18, 39.13],
    ['Corinth', 22.88, 37.91], ['Sparta', 22.43, 37.07], ['Caesarea Maritima', 34.89, 32.5], ['Gaza', 34.46, 31.5], ['Arelate', 4.63, 43.68],
    ['Narbone', 3.0, 43.18], ['Augusta Vindelicum', 10.9, 48.37], ['Carnuntum', 16.86, 48.11], ['Singidunum', 20.46, 44.82], ['Durocortorum', 4.03, 49.26],
    ['Lutetia', 2.35, 48.85], ['Mogontiacum', 8.27, 50.0], ['Hippo Regius', 7.75, 36.88], ['Capua', 14.25, 41.08], ['Ostia', 12.29, 41.75],
    ['Coptos', 32.8, 26.0], ['Iol Caesarea', 2.19, 36.6], ['Caralis', 9.11, 39.22], ['Gortyn', 24.95, 35.06], ['Deva', -2.89, 53.19], ['Sagres', -8.94, 37.01],
  ].map(([t, lo, la], rank) => ({ t, n: lookup(t, [lo, la]), rank, lo, la })).filter(f => f.n >= 0 && hav(f.lo, f.la, nlon[f.n], nlat[f.n]) < 90);
  FAMOUS.forEach(f => famousRank.set(f.n, f.rank));
  // shorter names for map labels, where the full Latin runs long
  const SHORT = { 'Colonia Claudia Ara Agrippinensium': 'Colonia Agrippina', 'Colonia Augusta Treverorum': 'Augusta Treverorum' };
  FAMOUS.forEach(f => { f.label = SHORT[f.t] || f.t; });
  const shortName = n => { const t = nameOf(n); return t ? SHORT[t] || t : null; };

  // ---------- geometry ----------
  async function bin(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    const buf = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return new Int16Array(buf);
  }
  function decode(arr, counts) {
    let tot = 0; for (let i = 0; i < NS; i++) tot += counts[i];
    const x = new Float32Array(tot), y = new Float32Array(tot), frac = new Float32Array(tot), off = new Int32Array(NS + 1), box = new Float32Array(NS * 4);
    let k = 0, p = 0;
    for (let s = 0; s < NS; s++) {
      off[s] = k;
      const u = SU[s];
      let qx = Math.floor(qlo[u] / 10 + .5), qy = Math.floor(qla[u] / 10 + .5);
      let x0 = 9, y0 = 9, x1 = -9, y1 = -9, len = 0, px = 0, py = 0;
      const k0 = k;
      for (let j = 0; j < counts[s]; j++) {
        if (j) { qx += arr[p++]; qy += arr[p++]; }
        const [ux, uy] = toUnit(qx / 1e4, qy / 1e4);
        x[k] = ux; y[k] = uy;
        if (j) len += Math.hypot(ux - px, uy - py);
        frac[k] = len; px = ux; py = uy;
        if (ux < x0) x0 = ux; if (ux > x1) x1 = ux; if (uy < y0) y0 = uy; if (uy > y1) y1 = uy;
        k++;
      }
      for (let j = k0; j < k; j++) frac[j] = len > 0 ? frac[j] / len : (j === k - 1 ? 1 : 0);
      box[4 * s] = x0; box[4 * s + 1] = y0; box[4 * s + 2] = x1; box[4 * s + 3] = y1;
    }
    off[NS] = k;
    return { x, y, frac, off, box, n: tot };
  }
  const geoCache = {};
  const geometry = which => geoCache[which] || (geoCache[which] = bin(`roads/data/${which}.bin.gz?v=1`).then(a => decode(a, which === 'lo' ? D.lo_n : D.hi_n)));
  // traces one road onto the current path, dropping points that land within a fraction of a pixel of the last
  function trace(g, G, s, tx, ty, K, X = G.x, Y = G.y) {
    const o0 = G.off[s], o1 = G.off[s + 1] - 1;
    let lx = tx + K * X[o0], ly = ty + K * Y[o0];
    g.moveTo(lx, ly);
    for (let j = o0 + 1; j <= o1; j++) {
      const x = tx + K * X[j], y = ty + K * Y[j];
      if (j !== o1 && Math.abs(x - lx) + Math.abs(y - ly) < .6) continue;
      g.lineTo(x, y); lx = x; ly = y;
    }
  }
  // traces a road from its start (or from its end, when rev) up to a fraction f of its length; returns the point reached
  function tracePart(g, G, s, tx, ty, K, rev, f, X = G.x, Y = G.y) {
    const o0 = G.off[s], o1 = G.off[s + 1] - 1, F = G.frac;
    let j = rev ? o1 : o0; const step = rev ? -1 : 1;
    g.moveTo(tx + K * X[j], ty + K * Y[j]);
    let px = X[j], py = Y[j], pf = 0;
    for (j += step; rev ? j >= o0 : j <= o1; j += step) {
      const fj = rev ? 1 - F[j] : F[j];
      if (fj >= f) {
        const r = fj > pf ? (f - pf) / (fj - pf) : 1;
        const ex = px + (X[j] - px) * r, ey = py + (Y[j] - py) * r;
        g.lineTo(tx + K * ex, ty + K * ey);
        return [ex, ey];
      }
      g.lineTo(tx + K * X[j], ty + K * Y[j]); px = X[j]; py = Y[j]; pf = fj;
    }
    return [px, py];
  }
  // the point a fraction f along a road, from its start (or end, when rev)
  function pointAt(G, s, rev, f, X = G.x, Y = G.y) {
    const o0 = G.off[s], o1 = G.off[s + 1] - 1, F = G.frac;
    let j = rev ? o1 : o0; const step = rev ? -1 : 1;
    let px = X[j], py = Y[j], pf = 0;
    for (j += step; rev ? j >= o0 : j <= o1; j += step) {
      const fj = rev ? 1 - F[j] : F[j];
      if (fj >= f) { const r = fj > pf ? (f - pf) / (fj - pf) : 1; return [px + (X[j] - px) * r, py + (Y[j] - py) * r]; }
      px = X[j]; py = Y[j]; pf = fj;
    }
    return [px, py];
  }
  const inView = (G, s, vx0, vy0, vx1, vy1) => { const b = G.box; return !(b[4 * s + 2] < vx0 || b[4 * s] > vx1 || b[4 * s + 3] < vy0 || b[4 * s + 1] > vy1); };
  // the nearest road to a point in unit coordinates, within a tolerance
  function nearestSeg(G, ux, uy, tol, keep) {
    let best = -1, bd = tol * tol;
    const b = G.box;
    for (let s = 0; s < NS; s++) {
      if (ux < b[4 * s] - tol || ux > b[4 * s + 2] + tol || uy < b[4 * s + 1] - tol || uy > b[4 * s + 3] + tol) continue;
      if (keep && !keep(s)) continue;
      for (let j = G.off[s]; j < G.off[s + 1] - 1; j++) {
        const ax = G.x[j], ay = G.y[j], dx = G.x[j + 1] - ax, dy = G.y[j + 1] - ay, L = dx * dx + dy * dy;
        let t = L > 0 ? ((ux - ax) * dx + (uy - ay) * dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx - ux, ey = ay + t * dy - uy, d = ex * ex + ey * ey;
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best;
  }
  function nearestNode(ux, uy, tol, keep, X = PX, Y = PY) {
    let best = -1, bd = tol * tol;
    for (let n = 0; n < NN; n++) {
      const dx = X[n] - ux, dy = Y[n] - uy, d = dx * dx + dy * dy;
      if (d < bd && (!keep || keep(n))) { bd = d; best = n; }
    }
    return best;
  }

  // ---------- land ----------
  const landCache = {};
  function landRings(fc) {
    const out = [];
    for (const f of fc.features || [fc]) {
      const g = f.geometry || f;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const pg of polys) {
        let a0 = 999, a1 = -999, b0 = 999, b1 = -999;
        for (const [lo, la] of pg[0]) { if (lo < a0) a0 = lo; if (lo > a1) a1 = lo; if (la < b0) b0 = la; if (la > b1) b1 = la; }
        if (a1 < -35 || a0 > 75 || b1 < 8 || b0 > 72) continue;
        const rings = [];
        let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
        for (const ring of pg) {
          const a = new Float32Array(ring.length * 2);
          for (let i = 0; i < ring.length; i++) {
            // points far outside the empire are pinned to a box well off screen, which changes nothing that shows
            const lo = Math.max(-80, Math.min(115, ring[i][0])), la = Math.max(-8, Math.min(84, ring[i][1]));
            const [x, y] = toUnit(lo, la);
            a[2 * i] = x; a[2 * i + 1] = y;
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          rings.push(a);
        }
        out.push({ box: [x0, y0, x1, y1], rings });
      }
    }
    return out;
  }
  const land = res => landCache[res] || (landCache[res] = fetch(`assets/vendor/world-land-${res}.json`).then(r => r.json()).then(t => landRings(topojson.feature(t, t.objects.land))));
  // the coast to draw at a zoom: the 50m coast is loaded at once, the 10m one only when someone zooms far in.
  // Views listen for 'rd-land' to redraw when either arrives.
  let l50 = null, l10 = null, l10asked = false;
  land('50m').then(l => { l50 = l; dispatchEvent(new Event('rd-land')); });
  function landAt(k) {
    if (k > 8) {
      if (l10) return l10;
      if (!l10asked) { l10asked = true; land('10m').then(l => { l10 = l; dispatchEvent(new Event('rd-land')); }); }
    }
    return l50;
  }
  function traceLand(g, polys, tx, ty, K, VW, VH) {
    const vx0 = -tx / K, vx1 = (VW - tx) / K, vy0 = -ty / K, vy1 = (VH - ty) / K;
    const M = 4, X0 = -M, X1 = VW + M, Y0 = -M, Y1 = VH + M;
    const code = (x, y) => (x < X0 ? 1 : x > X1 ? 2 : 0) | (y < Y0 ? 4 : y > Y1 ? 8 : 0);
    for (const p of polys) {
      const b = p.box; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      for (const a of p.rings) {
        let ex = tx + K * a[0], ey = ty + K * a[1], ec = code(ex, ey);
        g.moveTo(ex, ey);
        let px = 0, py = 0, pend = false, run = 0;
        for (let i = 2; i < a.length; i += 2) {
          const x = tx + K * a[i], y = ty + K * a[i + 1], c = code(x, y);
          if (pend) {
            if (run & c) { run &= c; px = x; py = y; continue; }
            g.lineTo(px, py); ex = px; ey = py; ec = code(px, py); pend = false;
          }
          if (ec & c) { pend = true; run = ec & c; px = x; py = y; continue; }
          if (Math.abs(x - ex) + Math.abs(y - ey) < .7) continue;
          g.lineTo(x, y); ex = x; ey = y; ec = c;
        }
        if (pend) g.lineTo(px, py);
        g.closePath();
      }
    }
  }
  function watchDpr(fn) {
    const arm = () => { const mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); mq.addEventListener('change', () => { fn(); arm(); }, { once: true }); };
    arm();
  }
  // after a canvas changes size, the transform that keeps the same place in the middle at the same zoom
  // (screen x = T.x + T.k * width * unit x, so the width is part of the scale)
  const recenter = (T, oW, oH, W, H) => { const f = W / oW; return d3.zoomIdentity.translate(W / 2 - (oW / 2 - T.x) * f, H / 2 - (oH / 2 - T.y) * f).scale(T.k); };
  // Space plays and pauses, except when a control has focus: then Space belongs to that control
  const spaceFree = e => !(e.target.closest && e.target.closest('input, textarea, select, button, a, [role="button"], [role="tab"]'));

  // ---------- colour: travel time, from pale near the start to deep red far away ----------
  const RAMP = [[0, [255, 244, 224]], [.18, [255, 208, 138]], [.4, [255, 146, 74]], [.66, [232, 69, 44]], [1, [158, 31, 31]]];
  function ramp(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], r = (t - a) / (b - a);
      return [0, 1, 2].map(k => Math.round(ca[k] + (cb[k] - ca[k]) * r));
    }
    return RAMP[RAMP.length - 1][1];
  }
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const daysText = d => d < 1.5 ? (d < .5 ? 'under a day' : 'a day') : `${fmt(d)} days`;

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

  // ---------- url state ----------
  const params = () => new URLSearchParams(location.search);
  function setParams(obj) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(obj)) { if (v === null || v === undefined || v === '') u.searchParams.delete(k); else u.searchParams.set(k, v); }
    history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : ''));
  }
  const urlName = n => { const t = nameOf(n); return t && lookup(t) === n ? t : String(n); };

  // ---------- a search box with a dropdown of places ----------
  function placeBox(input, list, onPick) {
    let hits = [], sel = -1;
    const render = () => {
      if (!input.value.trim()) { list.classList.remove('on'); return; }
      list.innerHTML = hits.length ? hits.map((e, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel}">${esc(e.t)}${e.hint ? `<small>${esc(e.hint)}</small>` : ''}</li>`).join('') : '<li class="none">No place by that name</li>';
      list.classList.add('on');
    };
    input.addEventListener('input', () => { hits = search(input.value); sel = hits.length ? 0 : -1; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (hits.length) { sel = (sel + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length; render(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (sel >= 0 && hits[sel]) pick(hits[sel]); }
      else if (e.key === 'Escape') { list.classList.remove('on'); input.blur(); }
    });
    const pick = e => { list.classList.remove('on'); input.value = ''; input.blur(); onPick(e.n); };
    list.addEventListener('pointerdown', e => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(hits[+li.dataset.i]); } });
    input.addEventListener('blur', () => setTimeout(() => list.classList.remove('on'), 120));
  }

  // the places along a route worth naming: the most famous first, spread along the way, then the biggest hubs
  function waypoints(nodes, max = 4) {
    const inner = nodes.slice(1, -1), L = nodes.length, pos = new Map(nodes.map((n, i) => [n, i]));
    const gap = L / (max + 2);
    const picked = [];
    const fam = inner.filter(n => famousRank.has(n)).sort((a, b) => famousRank.get(a) - famousRank.get(b));
    for (const n of fam) {
      if (picked.length >= max) break;
      if (picked.every(m => Math.abs(pos.get(m) - pos.get(n)) > gap)) picked.push(n);
    }
    const cand = inner.filter(n => nameOf(n) && !famousRank.has(n)).sort((a, b) => imp[b] - imp[a]);
    for (const n of cand) {
      if (picked.length >= Math.min(max, 3)) break;
      if (picked.every(m => Math.abs(pos.get(m) - pos.get(n)) > L / 5)) picked.push(n);
    }
    return picked.sort((a, b) => pos.get(a) - pos.get(b));
  }
  const listWords = arr => arr.length <= 1 ? (arr[0] || '') : arr.length === 2 ? `${arr[0]} and ${arr[1]}` : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

  window.RD = {
    D, NN, NS, reduced, fmt, fmt1, esc, RAD, KM, UH,
    nlon, nlat, PX, PY, SU, SV, other, toUnit,
    flags, isMain, certOf, isFerry, CERT, segKm, segSlope, tagsOf, segName, roadWords, descOf, dateOf, segDays, flatKmDay, HOURS,
    adjOff, adjN, adjS, degree, comp, compSize, paths, flows, route,
    nameOf, shortName, imp, alts, describe, hav, bearingWord, search, lookup, urlName, FAMOUS, famousRank, ROME, waypoints, listWords,
    geometry, trace, tracePart, pointAt, inView, nearestSeg, nearestNode,
    land, landAt, traceLand, watchDpr, recenter, spaceFree, ramp, rgb, daysText, tip, params, setParams, placeBox, views: {},
  };
})();
