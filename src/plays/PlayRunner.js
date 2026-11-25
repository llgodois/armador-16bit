import { BASKET } from '../config.js';
import { mirrorX, toWorld } from '../utils/math.js';
import { SLOTS, mirrorSlot } from './spots.js';

// Executa uma jogada do playbook para o time que está atacando.
export default class PlayRunner {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.name = def.name;
    this.i = 0;
    this.t = 0;
    this.done = false;
    const h = this.handler();
    this.side = h && h.x < BASKET.x ? -1 : 1; // lado da bola
    this.mid = -this.side;                    // direção do meio da quadra
    this.set = {};                            // bloqueios já armados nesta fase
    this.passed = {};                         // passes de entrada já feitos (por fase)
  }

  // Jogada sem bola: quem recebeu segura e devolve para o armador quando ele se livrar
  get offBall() {
    return !!this.def.offBall && !this.done;
  }

  get phase() {
    return this.def.phases[this.i];
  }

  // canônico (lado direito) -> mundo
  world(p) {
    return toWorld(mirrorX(p, this.side), this.game.dir);
  }

  handler() {
    const g = this.game;
    const b = g.ball;
    if (b.state === 'held' && b.holder.team === g.offSide) return b.holder;
    return g.offTeam[0];
  }

  byRole(role) {
    return this.game.offTeam.find((p) => p.role === role);
  }

  screens() {
    const s = this.phase.screen;
    return s ? [].concat(s) : [];
  }

  update(dt) {
    if (this.done) return;
    const g = this.game;
    const ph = this.phase;
    this.t += dt;
    const h = this.handler();

    for (const role of this.screens()) {
      const s = this.byRole(role);
      const spot = this.resolve(ph.spots[role]);
      if (!s || !spot || s === h || this.set[role]) continue;
      if (Math.hypot(s.x - spot.x, s.y - spot.y) < 7) {
        this.set[role] = true;
        s.body.pushable = false;
        g.floatText(s.x, s.y - s.headY - 6, 'BLOQUEIO', 0xffe14d);
      }
    }

    // passe de entrada (ex.: você passa para a ala e corre pelos bloqueios)
    if (ph.pass && !this.passed[this.i] && this.t > 0.15) {
      const to = this.byRole(ph.pass);
      const b = g.ball;
      if (to && b.state === 'held' && b.holder === h && h !== to && !g.inbound) {
        this.passed[this.i] = true;
        g.doPass(h, to);
        g.floatText(h.x, h.y - h.headY - 6, 'ENTRADA', 0x6fa0ff);
      } else if (!to || b.holder === to) this.passed[this.i] = true;
    }

    let next = this.t >= ph.dur;
    // fase "do armador": termina quando ele chega no destino (ou no tempo máximo)
    if (ph.until === 'pg') {
      const pg = this.byRole('PG');
      const spot = this.resolve(ph.spots.PG);
      if (pg && spot && Math.hypot(pg.x - spot.x, pg.y - spot.y) < 14) next = true;
    }
    const primary = this.screens()[0];
    if (ph.until === 'used' && primary && this.set[primary]) {
      const s = this.byRole(primary);
      if (Math.hypot(h.x - s.x, h.y - s.y) < 20 && (h.x - s.x) * this.mid > 3) next = true;
    }
    if (next) this.advance();
  }

  advance() {
    // A reação ao bloqueio (trocar, hedge, blitz, drop) é do esquema defensivo: DefenseAI.updatePnr
    this.releaseScreens();
    this.i++;
    this.t = 0;
    if (this.i >= this.def.phases.length) this.done = true;
  }

  releaseScreens() {
    for (const role of Object.keys(this.set)) {
      const s = this.byRole(role);
      if (s) s.body.pushable = true;
    }
    this.set = {};
  }

  finish() {
    if (!this.done) this.releaseScreens();
    this.done = true;
  }

  resolve(spot) {
    if (!spot) return null;
    if (typeof spot === 'function') return spot(this.game, this);
    if (typeof spot === 'string') return toWorld(SLOTS[this.side >= 0 ? spot : mirrorSlot(spot)], this.game.dir);
    return this.world(spot);
  }

  target(role) {
    if (this.done) return null;
    return this.resolve(this.phase.spots[role]);
  }

  holds(role) {
    return !this.done && !!this.set[role];
  }

  isFast(role) {
    return !this.done && (this.phase.fast || []).includes(role);
  }

  options() {
    if (this.done) return [];
    const roles = new Set(this.phase.option || []);
    // jogada sem bola: depois que o armador virou opção, ele continua sendo (não perde o passe na troca de fase)
    if (this.def.offBall && this.def.phases.slice(0, this.i + 1).some((ph) => (ph.option || []).includes('PG'))) roles.add('PG');
    return [...roles].map((r) => this.byRole(r)).filter(Boolean);
  }
}
