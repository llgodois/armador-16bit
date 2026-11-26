import Phaser from 'phaser';
import { PLAYER } from '../config.js';
import { FRAME_LAYOUT } from '../art/sprites.js';

// Um jogador = corpo físico invisível (Zone com círculo Arcade) + sprite visual + sombra.
// Separar física e visual permite "pular" (lift) sem mexer na colisão.
export default class Player {
  // team: 'home' | 'away'. info: dados do jogador (nome, altura, ratings) de data/teams.js
  // skills: multiplicadores { speed, three, mid, finishing, passing, defense, rebounding, ... }
  constructor(scene, group, x, y, { team, role, index, texKey, skills, info, hp = 0 }) {
    this.scene = scene;
    this.team = team;
    this.role = role;
    this.index = index;
    this.texKey = texKey;
    this.skills = skills;
    this.info = info;
    this.cm = info ? info.cm : 195;
    this.r = info ? info.r : null;
    this.hp = hp;              // pixels extras de altura do sprite
    this.headY = 24 + hp;      // altura do topo da cabeça (para ícones)
    this.speed = PLAYER.baseSpeed * skills.speed;
    this.slowT = 0;            // "pesado" depois de errar um roubo
    this.motion = null;        // estado da movimentação sem bola (ai/MotionOffense.js)

    // Corpo de colisão (círculo nos pés)
    const r = PLAYER.radius;
    this.zone = scene.add.zone(x, y, r * 2, r * 2);
    group.add(this.zone);
    this.body = this.zone.body;
    this.body.setCircle(r);
    this.body.setCollideWorldBounds(true);
    this.zone.player = this;

    this.shadow = scene.add.image(x, y, 'shadow').setDepth(1);
    this.sprite = scene.add.sprite(x, y, texKey, 0).setOrigin(0.5, 1);

    this.facing = new Phaser.Math.Vector2(0, -1);
    this.lookAt = null;        // ponto para onde olhar quando parado
    this.lookAlways = false;   // defensores sempre olham para o atacante
    this.pose = null;          // 'shoot' ou null
    this.poseTimer = 0;
    this.lift = 0;             // deslocamento visual para cima (pulo)
    this.stun = 0;             // tempo desequilibrado (crossover)
    this.lunge = 0;            // tempo de "bote" de roubo
    this.stealCooldown = 0;
    this.decideTimer = 0;      // IA: tempo até decidir com a bola
  }

  get x() {
    return this.zone.x;
  }
  get y() {
    return this.zone.y;
  }

  setPosition(x, y) {
    this.body.reset(x, y);
  }

  stop() {
    this.body.setVelocity(0, 0);
  }

  // Move numa direção (normalizada) com aceleração suave.
  moveDir(dx, dy, speed, dt) {
    if (this.slowT > 0) speed *= 0.45;
    if (this.protect) speed *= 0.72; // (só no 64) protegendo a bola: passo curto
    let tx = dx * speed;
    let ty = dy * speed * PLAYER.verticalFactor;
    let k = 1 - Math.exp(-PLAYER.accel * dt);
    const v = this.body.velocity;
    // (só no 64, só você) movimento com PESO, estilo 2K: rápido, a curva abre e a freada demora.
    // Dribles, bandeja e step-back ficam de fora (são arrancadas de propósito).
    const sc = this.scene;
    if (sc.v64 && this === sc.user && !(this.crossTimer > 0) && !(this.layupT > 0)) {
      const vf = PLAYER.verticalFactor;
      const cur = Math.hypot(v.x, v.y / vf);
      const want = Math.hypot(tx, ty / vf);
      if (cur > 45 && want > 10) {
        // gira a direção atual no máximo "turn" rad/s rumo à desejada (mais rápido = curva mais aberta)
        const agil = Math.min(1.25, Math.max(0.8, this.skills.speed || 1));
        const turn = (15 - 7 * Math.min(1, (cur - 45) / 80)) * agil * dt; // rad/s: ~15 trotando, ~8 em sprint
        const a0 = Math.atan2(v.y / vf, v.x);
        let da = Math.atan2(ty / vf, tx) - a0;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const a = a0 + Math.max(-turn, Math.min(turn, da));
        tx = Math.cos(a) * want;
        ty = Math.sin(a) * want * vf;
        if (Math.abs(da) > 2.2) k *= 0.55; // cortar para trás em alta: freia antes de virar
      } else if (want < 10 && cur > 70) k *= 0.6; // freada em sprint: escorrega um pouco
    }
    v.x += (tx - v.x) * k;
    v.y += (ty - v.y) * k;
  }

  // IA: velocidade com ou sem sprint. O sprint gasta o GÁS do jogador (cada um tem o seu).
  run(base, want) {
    const gas = this.gas ?? 100;
    if (want && gas > 12) {
      this.aiSprint = true;
      return base * PLAYER.sprintMult;
    }
    return base;
  }

  // Steering: seek + arrive (desacelera perto do alvo) + força extra (separação).
  // Se ficar "preso" em outro corpo (andando bem mais devagar do que queria),
  // dá um passo para o lado por um instante para contornar.
  seek(target, speed, dt, extra = null, arrive = 12) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy);
    const k = d < 1.5 ? 0 : Math.min(1, d / arrive);
    let ux = d > 0 ? (dx / d) * k : 0;
    let uy = d > 0 ? (dy / d) * k : 0;
    if (extra) {
      ux += extra.x;
      uy += extra.y;
    }
    const m = Math.hypot(ux, uy);
    if (m < 0.001) return this.moveDir(0, 0, 0, dt);
    let nx = ux / m;
    let ny = uy / m;
    const want = speed * Math.min(1, m);
    const v = this.body.velocity;
    const actual = Math.hypot(v.x, v.y / PLAYER.verticalFactor);
    if (want > 30 && d > 8 && actual < want * 0.35) this.stuckT = (this.stuckT || 0) + dt;
    else this.stuckT = Math.max(0, (this.stuckT || 0) - dt * 2);
    if (this.stuckT > 0.18 && !(this.sideStepT > 0)) {
      this.sideStepT = 0.35;
      this.sideSign = -(this.sideSign || (this.index % 2 ? 1 : -1));
      this.stuckT = 0;
    }
    if (this.sideStepT > 0) {
      this.sideStepT -= dt;
      const a = this.sideSign * 1.2; // ~70 graus para o lado
      const c = Math.cos(a);
      const s = Math.sin(a);
      [nx, ny] = [nx * c - ny * s, nx * s + ny * c];
    }
    this.moveDir(nx, ny, want, dt);
  }

  // Força de separação dos companheiros (evita amontoar).
  separation(others) {
    const out = { x: 0, y: 0 };
    const R = PLAYER.separationRadius;
    for (const o of others) {
      if (o === this) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < R) {
        const f = ((R - d) / R) * PLAYER.separationForce;
        out.x += (dx / d) * f;
        out.y += (dy / d) * f;
      }
    }
    return out;
  }

  faceToward(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    if (dx || dy) this.facing.set(dx, dy).normalize();
  }

  setPose(pose, time = 0) {
    this.pose = pose;
    this.poseTimer = time;
  }

  // Atualiza animação, profundidade, sombra. Chamado todo frame.
  updateVisual(dt, time) {
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) this.pose = null;
    }
    this.lift = Math.max(0, this.lift - dt * (this.lift > 4 ? 22 : 14));
    this.stun = Math.max(0, this.stun - dt);
    this.lunge = Math.max(0, this.lunge - dt);
    this.stealCooldown = Math.max(0, this.stealCooldown - dt);
    this.slowT = Math.max(0, this.slowT - dt);

    const v = this.body.velocity;
    const spd = Math.hypot(v.x, v.y);
    if (this.lookAt && (this.lookAlways || spd < 25)) this.faceToward(this.lookAt.x, this.lookAt.y);
    else if (spd > 12) this.facing.set(v.x, v.y / PLAYER.verticalFactor).normalize();

    const view = this.facing.y < -0.35 ? 1 : 0; // 1 = de costas
    const base = view * FRAME_LAYOUT.perView;
    this.sprite.setFlipX(this.facing.x < -0.15);

    if (this.pose === 'shoot') {
      this.sprite.anims.stop();
      this.sprite.setFrame(base + FRAME_LAYOUT.shoot);
    } else if (spd > 10) {
      const key = `${this.texKey}-run-${view ? 'up' : 'down'}`;
      this.sprite.anims.play(key, true);
      this.sprite.anims.timeScale = Phaser.Math.Clamp(spd / 70, 0.6, 1.8);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(base + FRAME_LAYOUT.idle);
    }

    // Desequilibrado: balança e pisca
    if (this.stun > 0) {
      this.sprite.setRotation(Math.sin(time * 0.03) * 0.25);
      this.sprite.setTint(Math.floor(time / 80) % 2 ? 0xffb0b0 : 0xffffff);
    } else {
      this.sprite.setRotation(0);
      this.sprite.clearTint();
    }

    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + 1 - this.lift));
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    this.sprite.setDepth(this.y);
  }

  distTo(p) {
    return Math.hypot(this.x - p.x, this.y - p.y);
  }

  distToBasket() {
    return 0; // não usado (a distância depende de qual cesta o time ataca: utils/math.distToBasket)
  }
}
