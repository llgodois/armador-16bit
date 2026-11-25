// =====================================================================
//  TORNEIOS DO FIM DE SEMANA DAS ESTRELAS (rodam dentro da GameScene)
//   three: 5 carrinhos x 5 bolas, 60 s; a última bola de cada carrinho vale 2.
//   dunk:  3 enterradas; segure K no garrafão e solte no ponto certo (nota 30-50).
//  Os outros participantes têm notas sorteadas pelos ratings.
// =====================================================================
import { BASKET } from '../config.js';
import { toWorld, isLayupZone, rand, clamp } from '../utils/math.js';
import { THREE_SHOOTERS, DUNKERS } from '../data/allstar.js';
import { sfx } from '../audio/sfx.js';

const RACKS = [{ x: 66, y: 66 }, { x: 108, y: 158 }, { x: 240, y: 214 }, { x: 372, y: 158 }, { x: 414, y: 66 }];

export default class Contest {
  constructor(game, kind) {
    this.g = game;
    this.kind = kind;
    this.time = kind === 'three' ? 60 : 0;
    this.rack = 0;
    this.ballN = 0;
    this.points = 0;
    this.dunks = [];
    this.waiting = false;
    this.done = false;
  }

  start() {
    const g = this.g;
    // só você em quadra
    for (const p of g.all) {
      if (p === g.pg) continue;
      p.body.enable = false;
      p.zone.setPosition(-500, -500);
      p.sprite.setVisible(false);
      p.shadow.setVisible(false);
    }
    g.state = 'contest';
    this.reset();
    const msg = this.kind === 'three' ? ['Torneio de 3 pontos', '5 carrinhos - a ultima bola vale 2'] : ['Torneio de enterradas', 'Segure K no garrafao e solte no verde'];
    g.events.emit('banner', msg[0], msg[1], 0xffe14d, 2);
  }

  spot() {
    return toWorld(RACKS[this.rack], 1);
  }

  reset() {
    const g = this.g;
    const u = g.pg;
    if (this.kind === 'three') u.setPosition(this.spot().x, this.spot().y);
    else u.setPosition(BASKET.x, 230);
    u.stop();
    g.ball.give(u);
    this.waiting = false;
    this.dunkGather = false;
  }

  // chamado pela GameScene quando o arremesso termina (cesta ou aro)
  shotDone(made) {
    if (this.kind !== 'three' || this.waiting || this.done) return;
    this.waiting = true;
    const money = this.ballN === 4;
    if (made) {
      this.points += money ? 2 : 1;
      this.g.floatText(this.g.pg.x, this.g.pg.y - 40, money ? '+2 BOLA DE OURO' : '+1', 0xffe14d);
    }
    this.ballN++;
    if (this.ballN >= 5) {
      this.ballN = 0;
      this.rack++;
    }
    this.g.time.delayedCall(250, () => {
      if (this.rack >= RACKS.length) return this.finish();
      this.reset();
    });
  }

  update(dt, time) {
    const g = this.g;
    if (this.done) return;
    if (this.kind === 'three') {
      this.time -= dt;
      g.shotClock = Math.max(0, this.time);
      if (this.time <= 0) return this.finish();
      const s = this.spot();
      g.updateUserOffense(dt);
      g.pg.setPosition(s.x, s.y); // preso no carrinho
      g.events.emit('contestHud', `CARRINHO ${Math.min(5, this.rack + 1)}/5  BOLA ${this.ballN + 1}/5  PONTOS ${this.points}`);
    } else this.updateDunk(dt);
    g.ball.update(dt);
    for (const p of g.all) if (p === g.pg) p.updateVisual(dt, time);
    g.updateIndicators(time);
    g.updateCamera();
  }

  updateDunk(dt) {
    const g = this.g;
    const u = g.pg;
    g.shotClock = 0;
    g.events.emit('contestHud', `ENTERRADA ${Math.min(3, this.dunks.length + 1)}/3  TOTAL ${this.dunks.reduce((a, b) => a + b, 0)}`);
    if (this.waiting) {
      u.moveDir(0, 0, 0, dt);
      return;
    }
    const { ix, iy, moving } = g.readInput();
    const speed = g.sprintAndStamina(u, moving, dt);
    if (this.dunkGather) {
      this.meter += dt / 0.8;
      g.gathering = true;
      g.meterValue = this.meter;
      u.moveDir(0, 0, 0, dt);
      if (!g.btn.K.isDown || this.meter >= 1.2) {
        g.gathering = false;
        g.meter.clear();
        // nota: acertar o ponto (0,8) + chegar correndo
        const q = clamp(1 - Math.abs(this.meter - 0.8) / 0.4, 0, 1);
        const score = Math.round(30 + 18 * q + (this.sprintIn ? 2 : 0));
        const made = q > 0.15;
        u.setPose('shoot', 0.5);
        u.lift = 14;
        g.ball.shoot(u, made, 'dunk', g.basket, g.dir);
        this.dunks.push(made ? score : 25);
        g.floatText(u.x, u.y - u.headY - 16, made ? `NOTA ${score}` : 'ERROU! NOTA 25', made ? 0xffe14d : 0xff7b6b);
        sfx.play(made ? 'cheer' : 'aww');
        this.waiting = true;
        g.time.delayedCall(1600, () => (this.dunks.length >= 3 ? this.finish() : this.reset()));
      }
      return;
    }
    if (moving) u.moveDir(ix, iy, speed, dt);
    else u.moveDir(0, 0, 0, dt);
    if (g.btn.K.just && !isLayupZone(u, 1)) g.floatText(u.x, u.y - u.headY - 10, 'ENTRE NO GARRAFAO', 0xff9a4d);
    if (g.btn.K.just && isLayupZone(u, 1)) {
      this.dunkGather = true;
      this.meter = 0;
      this.sprintIn = u.sprinting;
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.g;
    const you = this.kind === 'three' ? this.points : this.dunks.reduce((a, b) => a + b, 0);
    const field = (this.kind === 'three' ? THREE_SHOOTERS : DUNKERS).filter((p) => p.name !== g.pg.info.name).slice(0, 3).map((p) => ({
      name: p.name,
      score: this.kind === 'three' ? Math.round(rand(8, 14) + (p.r.three - 80) * 0.5) : Math.round(3 * (rand(36, 44) + (p.r.fin - 85) * 0.3)),
    }));
    const all = [{ name: `${g.pg.info.name} (VOCE)`, score: you, you: true }, ...field].sort((a, b) => b.score - a.score);
    g.time.delayedCall(800, () => {
      g.scene.stop('HUD');
      g.scene.start('AllStar', { result: { kind: this.kind, ranking: all } });
    });
  }
}
