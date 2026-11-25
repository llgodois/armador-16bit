import { BASKET, Y_SCALE, THREE, PAINT, LAYUP_ZONE, MID_Y } from '../config.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Distância "real" na quadra (compensa o achatamento da perspectiva 3/4).
export const courtDist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * Y_SCALE);

// ---------------------------------------------------------------------
// Coordenadas canônicas: o ataque sempre "para cima" (cesta em y=74).
// dir = +1 (casa, ataca a cesta de cima) ou -1 (visitante, ataca a de baixo).
// A conversão é um espelho em torno do meio da quadra, e serve nos dois sentidos.
// ---------------------------------------------------------------------
export const canon = (p, dir) => (dir >= 0 ? { x: p.x, y: p.y } : { x: p.x, y: 2 * MID_Y - p.y });
export const toWorld = canon;

export const distToBasket = (p, dir = 1) => courtDist(canon(p, dir), BASKET);
export const inBackcourt = (p, dir = 1) => canon(p, dir).y > MID_Y - 6;

export function isLayupZone(p, dir = 1) {
  const c = canon(p, dir);
  const m = LAYUP_ZONE.paintMargin;
  const inPaint = c.x >= PAINT.left - m && c.x <= PAINT.right + m && c.y <= PAINT.bottom + m;
  return inPaint || courtDist(c, BASKET) < LAYUP_ZONE.radius;
}

export function isThree(p, dir = 1) {
  const c = canon(p, dir);
  if (c.y < BASKET.y) return Math.abs(c.x - BASKET.x) > THREE.rx;
  return courtDist(c, BASKET) > THREE.rx;
}

export const mirrorX = (p, side) => (side >= 0 ? { x: p.x, y: p.y } : { x: 2 * BASKET.x - p.x, y: p.y });

export function curve(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0));
  }
  return table[table.length - 1][1];
}

export function closestOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1);
  const x = a.x + abx * t;
  const y = a.y + aby * t;
  return { x, y, t, d: Math.hypot(p.x - x, p.y - y) };
}
