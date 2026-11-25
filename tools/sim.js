
const G = window.__game;
let T = performance.now();
const step = (n) => { for (let i = 0; i < n; i++) { T += 16.67; G.step(T, 16.67); } };
const CODES = { w: 87, a: 65, s: 83, d: 68, j: 74, k: 75, l: 76, e: 69, Shift: 16, '1': 49, '2': 50, '3': 51, '4': 52 };
const key = (k, type) => window.dispatchEvent(new KeyboardEvent(type, { key: k, keyCode: CODES[k], bubbles: true }));
const down = (k) => key(k, 'keydown');
const up = (k) => key(k, 'keyup');
const tap = (k) => { down(k); step(2); up(k); };
const release = () => ['w', 'a', 's', 'd', 'Shift', 'j', 'k', 'l'].forEach(up);
window.__step = step; window.__tap = tap; window.__down = down; window.__up = up;
window.__sim = (maxSec = 900) => {
  const g = G.scene.getScene('Game');
  const errs = [];
  let frames = 0;
  try {
    while (G.scene.isActive('Game') && frames < 60 * maxSec) {
      if (g.state === 'ft' && g.ft && g.ft.shooter === g.user && !g.ft.flying) { down('k'); step(42); up('k'); step(5); frames += 47; continue; }
      if (g.state !== 'live') { step(10); frames += 10; continue; }
      const u = g.user;
      const b = g.ball;
      if (!g.userOnDefense) {
        if (b.holder === u && b.state === 'held') {
          const goX = u.x < g.basket.x - 20 ? 'd' : u.x > g.basket.x + 20 ? 'a' : null;
          const goY = g.dir > 0 ? 'w' : 's';
          down(goY); if (goX) down(goX); if (Math.random() < 0.5) down('Shift');
          const n = 12 + (Math.random() * 25 | 0);
          step(n); frames += n; release();
          if (b.holder !== u || g.state !== 'live') continue;
          const r = Math.random();
          if (r < 0.4) { tap('j'); step(3); tap(String(1 + (Math.random() * 2 | 0))); step(8); frames += 13; }
          else if (r < 0.75) { down('k'); const hold = 38 + (Math.random() * 10 | 0); step(hold); up('k'); step(20); frames += hold + 20; }
          else { step(10); frames += 10; }
        } else { step(10); frames += 10; }
      } else {
        const h = b.state === 'held' ? b.holder : null;
        const tgt = h || b;
        const k1 = tgt.x < u.x - 6 ? 'a' : tgt.x > u.x + 6 ? 'd' : null;
        const k2 = tgt.y < u.y - 6 ? 'w' : tgt.y > u.y + 6 ? 's' : null;
        if (k1) down(k1); if (k2) down(k2);
        step(10); frames += 10; release();
        if (h && Math.hypot(h.x - u.x, h.y - u.y) < 20 && Math.random() < 0.2) { tap('k'); frames += 2; }
      }
    }
  } catch (e) { errs.push(e.message + ' ' + (e.stack || '').slice(0, 300)); }
  release();
  return { ended: !G.scene.isActive('Game'), errs, score: { ...g.score } };
};
