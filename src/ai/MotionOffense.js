import { BASKET, OFFENSE } from '../config.js';
import { courtDist, distToBasket, rand, canon } from '../utils/math.js';
import { SLOTS, PERIMETER, BASE_SLOTS } from '../plays/spots.js';

// =====================================================================
//  MOVIMENTAÇÃO SEM BOLA ("motion offense")
//  Cada jogador sem bola escolhe uma ação a cada OFFENSE.motionMin..Max s:
//    spot      ocupar/segurar uma vaga de spacing
//    cut       corte para a cesta (vira "corte pelas costas" se o defensor
//              estiver negando por cima), depois sai para o lado oposto
//    relocate  trocar para uma vaga vizinha livre ("drift")
//    screen    bloqueio sem bola para um companheiro, que sai do bloqueio
//    ballscreen (pivôs) bloqueio na bola e depois rola para a cesta
//    post      (pivôs) brigar por posição no bloco do lado da bola
//  Reações: se o condutor infiltra, quem está perto abre para o canto.
// =====================================================================


export default class MotionOffense {
  constructor(game) {
    this.game = game;
  }

  reset(team) {
    for (const p of team) {
      p.motion = { action: 'spot', slot: BASE_SLOTS[p.role], t: rand(0.8, 2.2) };
    }
  }

  handler() {
    const g = this.game;
    const b = g.ball;
    return b.state === 'held' && b.holder.team === g.offSide ? b.holder : null;
  }

  // Vagas ocupadas pelos outros (e a vizinhança do condutor).
  slotFree(name, p) {
    const g = this.game;
    const s = this.game.slot(name);
    const h = this.handler();
    if (h && Math.hypot(h.x - s.x, h.y - s.y) < 50) return false;
    for (const o of g.offTeam) {
      if (o === p || o === h) continue;
      if (o.motion && o.motion.slot === name) return false;
      if (Math.hypot(o.x - s.x, o.y - s.y) < 26) return false;
    }
    return true;
  }

  nearestFree(p, list = PERIMETER, exclude = null) {
    let best = null;
    let bd = Infinity;
    for (const n of list) {
      if (n === exclude || !this.slotFree(n, p)) continue;
      const s = this.game.slot(n);
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  // Escolhe a próxima ação do jogador p.
  choose(p) {
    const g = this.game;
    const m = p.motion;
    const big = p.role === 'C' || p.role === 'PF';
    const h = this.handler();
    const d = g.defenderOf(p);
    // Defensor negando por cima (mais longe da cesta que o atacante) = corte pelas costas
    const overplayed = d && courtDist(d, g.basket) > courtDist(p, g.basket) + 4;
    // só um bloqueio na bola por vez
    const screenBusy = g.offTeam.some((o) => o !== p && o.motion && o.motion.action === 'ballscreen');

    const opts = [
      ['spot', 2],
      ['relocate', 1.2],
      ['cut', big ? 0.5 : 1.2 + (overplayed ? 2.5 : 0)],
      ['screen', big ? 1.1 : 0.4],
      ['ballscreen', big && h && !screenBusy ? (h === g.user ? 0.35 : 0.8) : 0],
      ['post', big ? 1.2 : 0],
    ];
    const total = opts.reduce((s, o) => s + o[1], 0);
    let r = Math.random() * total;
    let action = 'spot';
    for (const [a, w] of opts) {
      r -= w;
      if (r <= 0) {
        action = a;
        break;
      }
    }

    m.t = rand(OFFENSE.motionMin, OFFENSE.motionMax);
    m.action = action;
    m.phase = 0;
    m.mate = null;
    m.holdT = undefined;
    m.cutting = false;
    if (action === 'spot') {
      if (!m.slot || !this.slotFree(m.slot, p)) m.slot = this.nearestFree(p) || m.slot;
    } else if (action === 'relocate') {
      const i = PERIMETER.indexOf(m.slot);
      const neigh = [PERIMETER[i - 1], PERIMETER[i + 1]].filter((n) => n && this.slotFree(n, p));
      m.slot = neigh.length ? neigh[Math.floor(Math.random() * neigh.length)] : this.nearestFree(p) || m.slot;
    } else if (action === 'cut') {
      m.backdoor = overplayed;
      m.t = 2.4;
      m.slot = null;
    } else if (action === 'screen') {
      // bloqueio para um companheiro de perímetro (não o condutor)
      const mates = g.offTeam.filter((o) => o !== p && o !== h && o.role !== 'C');
      if (!mates.length) return this.choose(p);
      m.mate = mates[Math.floor(Math.random() * mates.length)];
      m.t = 2.6;
    } else if (action === 'ballscreen') {
      m.t = 3.5;
    } else if (action === 'post') {
      const side = h && h.x < BASKET.x ? 'L' : 'R';
      m.slot = 'block' + side;
      if (!this.slotFree(m.slot, p)) m.slot = 'block' + (side === 'L' ? 'R' : 'L');
    }
  }

  // Destino do jogador sem bola neste frame. Retorna { x, y, fast, hold }.
  target(p, dt) {
    const g = this.game;
    const m = p.motion;
    m.t -= dt;
    const h = this.handler();

    // Reação à infiltração: perto do condutor que ataca a cesta -> abre para o canto
    if (h && h !== p && distToBasket(h, g.dir) < 100 && Math.hypot(h.x - p.x, h.y - p.y) < 55 && m.action !== 'cut') {
      const corner = h.x < BASKET.x ? 'cornerL' : 'cornerR';
      const alt = h.x < BASKET.x ? 'wingL' : 'wingR';
      m.slot = this.slotFree(corner, p) ? corner : this.slotFree(alt, p) ? alt : this.nearestFree(p) || m.slot;
      m.action = 'spot';
    }
    if (m.t <= 0) this.choose(p);

    switch (m.action) {
      case 'cut': {
        if (m.phase === 0) {
          const RIM = g.slot('rim');
          if (Math.hypot(p.x - RIM.x, p.y - RIM.y) < 12 || m.t < 1.0) {
            m.phase = 1;
            m.slot = this.nearestFree(p, p.x < BASKET.x ? ['cornerR', 'wingR', 'slotR'] : ['cornerL', 'wingL', 'slotL']) || this.nearestFree(p);
            m.cutting = false;
          } else {
            m.cutting = true;
            return { ...RIM, fast: true, label: m.backdoor ? 'backdoor' : 'cut' };
          }
        }
        return { ...g.slot(m.slot || 'top'), fast: true };
      }
      case 'screen': {
        const mate = m.mate;
        const md = mate && g.defenderOf(mate);
        if (!md || m.phase > 1) return { ...g.slot(m.slot || this.nearestFree(p, ['elbowL', 'elbowR', 'blockL', 'blockR']) || 'blockR') };
        // fica entre o defensor do companheiro e a cesta (bloqueio "pin-down")
        const spot = { x: md.x + (BASKET.x - md.x) * 0.15, y: md.y + 6 * g.dir };
        const close = Math.hypot(p.x - spot.x, p.y - spot.y) < 7;
        if (close && m.phase === 0) {
          m.phase = 1;
          m.holdT = 1.1;
          p.body.pushable = false;
          // o companheiro sai do bloqueio para outra vaga
          if (mate.motion) {
            mate.motion.action = 'spot';
            mate.motion.slot = this.nearestFree(mate, PERIMETER, mate.motion.slot) || mate.motion.slot;
            mate.motion.t = 2;
            mate.motion.fastT = 1.2;
          }
        }
        if (m.phase === 1) {
          m.holdT -= dt;
          if (m.holdT <= 0) {
            m.phase = 2;
            p.body.pushable = true;
            m.slot = this.nearestFree(p, ['blockL', 'blockR', 'elbowL', 'elbowR', 'dunkerL', 'dunkerR']);
          }
          return { x: p.x, y: p.y, hold: true };
        }
        return spot;
      }
      case 'ballscreen': {
        const hd = h && g.defenderOf(h);
        if (!h || !hd || m.phase > 0) {
          // rola para a cesta depois do bloqueio
          if (m.phase === 1 && m.t > 0.8) return { ...g.toWorld({ x: BASKET.x + (p.x < BASKET.x ? -10 : 10), y: BASKET.y + 22 }), fast: true };
          return { ...g.slot(m.slot || 'blockR') };
        }
        const mid = h.x < BASKET.x ? 1 : -1;
        const spot = { x: hd.x + mid * 10, y: hd.y + 3 * g.dir };
        if (Math.hypot(p.x - spot.x, p.y - spot.y) < 7) {
          p.body.pushable = false;
          m.holdT = (m.holdT ?? 1.4) - dt;
          const used = Math.hypot(h.x - p.x, h.y - p.y) < 20 && (h.x - p.x) * mid > 3;
          if (used || m.holdT <= 0) {
            p.body.pushable = true;
            m.phase = 1;
            m.t = 2.2;
            m.slot = this.nearestFree(p, ['blockL', 'blockR', 'dunkerL', 'dunkerR']);
          }
          return { x: p.x, y: p.y, hold: true };
        }
        return spot;
      }
      default: {
        const fast = m.fastT > 0;
        if (m.fastT > 0) m.fastT -= dt;
        return { ...g.slot(m.slot || BASE_SLOTS[p.role]), fast };
      }
    }
  }

  // Libera bloqueios (usado ao mudar de posse/jogada).
  release(team) {
    for (const p of team) {
      p.body.pushable = true;
      if (p.motion) {
        p.motion.holdT = undefined;
        if (p.motion.action === 'screen' || p.motion.action === 'ballscreen') p.motion.t = 0;
      }
    }
  }
}
