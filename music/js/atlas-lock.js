/* Album Atlas: unlocks the private memories in the browser (PBKDF2-SHA256 + AES-256-GCM via WebCrypto).
   Nothing is sent anywhere. The passphrase only ever lives in this browser. */
(function () {
  'use strict';
  const A = window.Atlas, L = window.ATLAS_LOCKED;
  const KEY = 'pw-atlas-pass';
  const wrap = document.getElementById('atlasLock');
  const btn = document.getElementById('lockBtn');
  const pop = document.getElementById('lockPop');
  const label = btn && btn.querySelector('.lock-label');
  const norm = p => String(p || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
  const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } },
    drop() { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } },
  };

  async function decrypt(pass) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(pass)), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(L.salt), iterations: L.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(L.iv) }, key, bytes(L.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  let pending = null;
  function unlock(pass) {
    if (!A.locked) return Promise.resolve('ok');
    if (!L || !(window.crypto && crypto.subtle)) return Promise.resolve('unsupported');
    if (!norm(pass)) return Promise.resolve('empty');
    if (!pending) {
      pending = decrypt(pass)
        .then(P => { A.applyPrivate(P); store.set(norm(pass)); return 'ok'; }, () => 'wrong')
        .finally(() => { pending = null; });
    }
    return pending;
  }
  const MSG = {
    wrong: 'That passphrase didn’t work.',
    empty: 'Type the passphrase first.',
    unsupported: 'This browser can’t unlock them. A recent Chrome, Safari, Edge or Firefox can.',
  };

  function setPop(open) {
    if (!pop) return;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open && A.locked) setTimeout(() => { const i = pop.querySelector('input'); if (i) i.focus(); }, 30);
  }
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); setPop(pop.hidden); });
  document.addEventListener('click', e => { if (pop && !pop.hidden && !wrap.contains(e.target)) setPop(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) setPop(false); });

  document.addEventListener('submit', async e => {
    const f = e.target.closest('form[data-lock-form]');
    if (!f) return;
    e.preventDefault();
    const input = f.querySelector('input'), b = f.querySelector('button');
    const msg = f.parentElement.querySelector('.lock-msg');
    b.disabled = true;
    if (msg) msg.textContent = 'Unlocking…';
    const r = await unlock(input.value);
    b.disabled = false;
    if (r === 'ok') { if (msg) msg.textContent = ''; setPop(false); return; }
    if (msg) msg.textContent = MSG[r];
    input.select();
  });

  if (pop) pop.addEventListener('click', e => {
    if (!e.target.closest('[data-relock]')) return;
    store.drop();
    location.reload();
  });

  A.on('unlock', () => {
    if (label) label.textContent = 'Memories unlocked';
    if (wrap) wrap.classList.add('open');
  });

  // a link ending in #k=passphrase unlocks straight away; the part after # never reaches the server
  function fromHash() {
    const m = location.hash.match(/^#k=(.+)$/);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    unlock(decodeURIComponent(m[1]));
    return true;
  }
  addEventListener('hashchange', fromHash);
  if (!fromHash()) {
    const saved = store.get();
    if (saved) unlock(saved).then(r => { if (r === 'wrong') store.drop(); });
  }
})();
