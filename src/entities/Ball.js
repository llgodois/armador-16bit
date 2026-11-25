import Phaser from 'phaser';
import { BALL, BASKET, COURT, PASS, SHOT } from '../config.js';
import { lerp, rand } from '../utils/math.js';

// A bola vive em 3D "falso": (x, y) é a posição no chão e z a altura.
// A sombra fica em (x, y); o sprite é desenhado em (x, y - z).
//
// Estados: 'held' (com alguém, quicando) | 'pass' | 'shot' (arco até a cesta)
//          'drop' (caindo pela rede) | 'loose' (solta, rebote) | 'dead'
//
// Eventos emitidos: bounce, caught(player), intercepted(defender), rim,
//                   rimIn, scored, out
export default class Ball extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.state = 'dead';
    this.holder = null;
    this.side = 1;      // lado do drible (+1 direita, -1 esquerda)
    this.sideCur = 1;   // valor suavizado (crossover visível)
    this.dribbleT = 0;
    this.shadow = scene.add.image(0, 0, 'ball_shadow').setDepth(1.5);
    this.sprite = scene.add.image(0, 0, 'ball');
  }

  give(player) {
    this.lastTouch = player.team;
    this.state = 'held';
    this.holder = player;
    this.passTo = null;
    this.interceptor = null;
    this.shot = null;
  }

  pass(from, to, interceptor = null, interceptPoint = null, speed = PASS.speed) {
    this.state = 'pass';
    this.passSpeed = speed;
    this.holder = null;
    this.passFrom = from;
    this.lastTouch = from.team;
    this.passTo = to;
    this.interceptor = interceptor;
    this.interceptPoint = interceptPoint;
    this.x = from.x + from.facing.x * 4;
    this.y = from.y + 1;
    this.z = 14;
    // ponte aérea: passe alto em arco (o recebedor finaliza no ar)
    this.wasLob = !!this.lob;
    this.lob = false;
    // passe quicado: a bola bate no chão no meio do caminho
    this.wasBounce = !!this.bounce && !this.wasLob;
    this.bounce = false;
    this.bounced = false;
    this.pass0 = Math.hypot(to.x - this.x, to.y - this.y) || 1;
  }

  // made: decidido no momento do arremesso (ver GameScene.shoot / layup).
  // kind: 'jump' (arremesso), 'layup' (bandeja) ou 'dunk' (enterrada)
  // basket = cesta atacada; dir = +1 (de cima) / -1 (de baixo)
  shoot(shooter, made, kind = 'jump', basket = BASKET, dir = 1) {
    this.basket = basket;
    this.dir = dir;
    this.lastTouch = shooter.team;
    const sx = shooter.x;
    const sy = shooter.y + 1;
    let tx = basket.x;
    let ty = basket.y;
    if (!made) {
      // erra batendo no aro: alvo levemente deslocado
      const a = rand(0, Math.PI * 2);
      tx += Math.cos(a) * rand(5, 8);
      ty += Math.sin(a) * rand(2, 4);
    }
    const d = Math.hypot(tx - sx, ty - sy);
    let sz = SHOT.releaseZ + (shooter.hp || 0);
    let dur = SHOT.flightBase + d * SHOT.flightPerPx;
    let arc = SHOT.arcBase + d * SHOT.arcPerPx;
    if (kind === 'layup') {
      sz = 28;
      dur = 0.32 + d * 0.004;
      arc = 8;
    } else if (kind === 'floater') {
      sz = 26;
      dur = 0.5 + d * 0.003;
      arc = 20;
    } else if (kind === 'dunk') {
      sz = 34;
      dur = 0.16;
      arc = 2;
    }
    this.state = 'shot';
    this.holder = null;
    this.shot = { shooter, made, kind, sx, sy, sz, tx, ty, t: 0, dur, arc };
    this.x = sx;
    this.y = sy;
    this.z = sz;
  }

  // Toco: a bola espirra da mão do arremessador.
  block(from, by = null) {
    if (by) this.lastTouch = by.team;
    const a = rand(0, Math.PI * 2);
    this.x = from.x;
    this.y = from.y;
    this.z = 26;
    this.loose(Math.cos(a) * rand(50, 90), Math.abs(Math.sin(a)) * rand(40, 90) * (this.dir || 1), rand(40, 70));
  }

  loose(vx, vy, vz) {
    this.state = 'loose';
    this.holder = null;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.outEmitted = false;
  }

  update(dt) {
    switch (this.state) {
      case 'held':
        this.updateHeld(dt);
        break;
      case 'pass':
        this.updatePass(dt);
        break;
      case 'shot':
        this.updateShot(dt);
        break;
      case 'drop':
        this.z -= (this.shot && this.shot.kind === 'dunk' ? 140 : 75) * dt;
        if (this.z <= 6) {
          this.state = 'dead';
          this.emit('scored'); // o jogo entrega a bola para a reposição aqui
          if (this.state === 'dead') this.loose(rand(-20, 20), rand(10, 30) * this.dir, 20);
        }
        break;
      case 'loose':
        this.updateLoose(dt);
        break;
      default:
        break;
    }
    this.render();
  }

  updateHeld(dt) {
    const h = this.holder;
    this.sideCur = lerp(this.sideCur, this.side, 1 - Math.exp(-22 * dt));
    if (h.pose === 'shoot') {
      // bola acima da cabeça
      this.x = h.x;
      this.y = h.y + 1;
      this.z = 23 + h.lift;
      return;
    }
    const v = h.body.velocity;
    const fast = Math.hypot(v.x, v.y) > 90;
    const prev = this.dribbleT % 1;
    this.dribbleT += (dt / BALL.dribblePeriod) * (fast ? 1.35 : 1);
    const phase = this.dribbleT % 1;
    if (phase < prev) this.emit('bounce', h);
    this.x = h.x + this.sideCur * 6 + h.facing.x * 2;
    this.y = h.y + 1 + h.facing.y * 2;
    this.z = 2 + BALL.dribbleHeight * 4 * phase * (1 - phase);
  }

  updatePass(dt) {
    const to = this.passTo;
    const dx = to.x - this.x;
    const dy = to.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = (this.passSpeed || PASS.speed) * dt;
    if (d <= Math.max(step, PASS.catchRadius)) {
      this.give(to);
      this.emit('caught', to);
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    const t = Math.min(1, 1 - d / this.pass0);
    if (this.wasLob) this.z = 14 + 26 * Math.sin(Math.PI * t);
    else if (this.wasBounce) {
      this.z = 12 * Math.abs(1 - 2 * t);
      if (!this.bounced && t >= 0.5) {
        this.bounced = true;
        this.emit('bounce', null);
      }
    }
    else this.z = lerp(this.z, PASS.height, 1 - Math.exp(-6 * dt));
    const i = this.interceptor;
    if (i && Math.hypot(i.x - this.x, i.y - this.y) < PASS.catchRadius + 4) {
      this.give(i);
      this.emit('intercepted', i);
    }
  }

  updateShot(dt) {
    const s = this.shot;
    s.t = Math.min(1, s.t + dt / s.dur);
    const t = s.t;
    this.x = lerp(s.sx, s.tx, t);
    this.y = lerp(s.sy, s.ty, t);
    this.z = lerp(s.sz, BASKET.rimZ, t) + s.arc * 4 * t * (1 - t);
    if (t >= 1) {
      if (s.made) {
        this.state = 'drop';
        this.x = this.basket.x;
        this.y = this.basket.y;
        this.emit('rimIn');
      } else {
        this.emit('rim');
        // espirra para fora do aro, em direção à quadra (bandeja espirra menos)
        const ax = this.x - this.basket.x;
        const soft = s.kind === 'jump' ? 1 : 0.6;
        // sobe menos e fica mais tempo na altura das mãos: dá para pegar o rebote no ar
        this.loose((ax * rand(6, 14) + rand(-50, 50)) * soft, rand(30, 95) * soft * this.dir, rand(35, 70) * soft);
      }
    }
  }

  updateLoose(dt) {
    this.vz -= BALL.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    if (this.z <= 0) {
      this.z = 0;
      if (this.vz < -30) {
        this.vz = -this.vz * BALL.bounceDamping;
        this.emit('bounce', null);
      } else {
        this.vz = 0;
      }
    }
    if (this.z === 0) {
      const k = Math.exp(-BALL.groundFriction * dt);
      this.vx *= k;
      this.vy *= k;
    }
    // Rua 3x3 (meia quadra): o limite de baixo é a linha do meio
    const bottom = this.scene.street ? this.scene.physics.world.bounds.bottom - 2 : COURT.bottom;
    const out = this.x < COURT.left || this.x > COURT.right || this.y < COURT.top || this.y > bottom;
    if (out && this.z < 20 && !this.outEmitted) {
      this.outEmitted = true;
      this.emit('out');
    }
  }

  render() {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - this.z - 3));
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    const sc = Math.max(0.45, 1 - this.z / 70);
    this.shadow.setScale(sc);
    this.shadow.setAlpha(0.5 + sc * 0.5);

    let depth;
    const bk = this.basket || BASKET;
    const nearRim = Math.hypot(this.x - bk.x, this.y - bk.y) < 14;
    const high = this.z > 26 ? 2000 : 0;
    switch (this.state) {
      case 'held':
        depth = this.holder.y + (this.holder.facing.y < -0.35 && this.holder.pose !== 'shoot' ? -0.5 : 0.5);
        break;
      case 'shot':
        depth = nearRim && this.z < BASKET.rimZ + 8 ? bk.y - 2 : this.y + 0.5 + high;
        break;
      case 'drop':
        depth = bk.y - 2;
        break;
      default:
        depth = this.y + 0.5 + high;
    }
    this.sprite.setDepth(depth);
  }
}
