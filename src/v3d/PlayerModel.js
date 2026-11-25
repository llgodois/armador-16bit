// Jogador low-poly feito só de caixas (estilo 64-bit), com animação procedural.
// O modelo é montado com 28 unidades de altura e depois escalado pela altura real.
import * as THREE from 'three';
import { VS } from './court3d.js';

export const SIZE = 38; // altura (unidades 3D) de um jogador de 1,98 m; o aro fica a 60

const SKINS = ['#f1c27d', '#8d5524', '#c68642', '#e0ac69', '#5c3a1e', '#a86b3c'];
const HAIRS = ['#3b2414', '#111111', '#1a1a1a', '#6b3e1f', '#0d0d0d', '#c9a26b'];
const BASE_H = 28;
const DOWN = new THREE.Vector3(0, -1, 0);
// pulo do arremesso (unidades 3D): altura no topo, velocidade de saída da IA e gravidade
const JUMP = 11;
const JUMP_V = 82;
const GRAVITY = 300;
const DIP_END = 0.3; // até 30% do medidor: recolhe a bola e agacha; depois sobe
const eulerQ = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

const mats = new Map();
function mat(color) {
  const key = String(color);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return mats.get(key);
}
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// colors: { jersey, dark, trim, shorts, shoes } (mesmo formato de data/teams.js)
export default class PlayerModel {
  constructor(info, colors, index) {
    const skin = SKINS[(info.skin ?? index * 3 + 1) % SKINS.length];
    const hair = HAIRS[(info.hair ?? index + 2) % HAIRS.length];
    this.root = new THREE.Group(); // posição no chão
    this.body = new THREE.Group(); // gira (para onde olha) e inclina
    this.root.add(this.body);
    const b = this.body;

    // pernas (pivô no quadril)
    this.legs = [-1, 1].map((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 1.6, 13, 0);
      leg.add(box(2.3, 12.4, 2.3, skin, 0, -6.4, 0));
      leg.add(box(2.6, 2.2, 2.6, '#f4f4f4', 0, -11, 0)); // meião
      leg.add(box(2.8, 1.6, 4.0, colors.shoes || '#222222', 0, -12.6, 0.6));
      b.add(leg);
      return leg;
    });
    // calção e camisa
    b.add(box(6.6, 5, 3.8, colors.shorts || colors.jersey, 0, 12, 0));
    b.add(box(6.8, 0.8, 3.9, colors.trim || '#ffffff', 0, 9.8, 0));
    this.torso = new THREE.Group();
    this.torso.position.set(0, 14.5, 0);
    b.add(this.torso);
    this.torso.add(box(6.6, 8, 3.6, colors.jersey, 0, 3.6, 0));
    this.torso.add(box(6.8, 1, 3.7, colors.trim || '#ffffff', 0, 7.2, 0));
    // cabeça
    this.head = new THREE.Group();
    this.head.position.set(0, 9.2, 0);
    this.torso.add(this.head);
    this.head.add(box(1.6, 1.2, 1.6, skin, 0, -0.2, 0));
    this.head.add(box(3.6, 3.8, 3.4, skin, 0, 2, 0));
    this.head.add(box(3.8, 1.3, 3.6, hair, 0, 4.3, -0.1));
    this.head.add(box(3.8, 2.6, 0.8, hair, 0, 2.8, -1.6));
    // braços (pivô no ombro)
    this.arms = [-1, 1].map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 4.2, 6.6, 0);
      arm.add(box(1.9, 8.6, 1.9, skin, 0, -4.1, 0));
      this.torso.add(arm);
      return arm;
    });

    // Altura exagerada (estilo cartoon/TV): 1,83 m fica bem menor que um pivô de 2,13 m.
    const cm = info.cm || 198;
    const scale = (SIZE / BASE_H) * Math.max(0.72, Math.min(1.3, 1 + (cm - 198) * 0.013));
    this.root.scale.setScalar(scale);
    this.heightUnits = BASE_H * scale;

    this.yaw = 0;
    this.phase = Math.random() * 6;
    this.prev = null;
    this.jumpY = 0;
    this.jumpV = 0;
    this.landT = 0;
  }

  // Atualiza pose a partir do estado do jogador do jogo.
  // s = { x, z3, vx, vz, facingX, facingZ, lift, shoot, hold, stun, lunge, defending,
  //       gather: medidor/ponto ideal (você segurando o arremesso) | null, shotStart: bola acabou de sair,
  //       dribble: { side } | null, ballWorld: Vector3 (posição da bola na tela 3D) }
  update(s, dt, time) {
    // ---- pulo do arremesso (só visual): recolhe/agacha, sobe com o medidor e solta no alto
    let dip = 0;
    if (s.gather != null) {
      const rise = Math.min(1, Math.max(0, (s.gather - DIP_END) / (1 - DIP_END)));
      const target = Math.sin((rise * Math.PI) / 2) * JUMP;
      this.jumpY += (target - this.jumpY) * Math.min(1, dt * 22);
      this.jumpV = 0;
      if (rise === 0) dip = Math.sin(Math.min(1, s.gather / DIP_END) * Math.PI * 0.5) * 2.4;
    } else {
      // IA arremessa sem medidor: dá um pulo de verdade na hora de soltar
      if (s.shotStart && this.jumpY < 1) this.jumpV = JUMP_V;
      if (this.jumpY > 0 || this.jumpV > 0) {
        this.jumpV -= GRAVITY * dt;
        this.jumpY += this.jumpV * dt;
        if (this.jumpY <= 0) {
          this.jumpY = 0;
          this.jumpV = 0;
          this.landT = 0.16; // flexiona ao aterrissar
        }
      }
    }
    this.landT = Math.max(0, this.landT - dt);
    const liftY = Math.max(s.lift * VS, this.jumpY);
    this.root.position.set(s.x, liftY, s.z3);

    // virar suave para onde olha
    const want = Math.atan2(s.facingX, s.facingZ);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 14);
    this.body.rotation.y = this.yaw;

    const spd = Math.hypot(s.vx, s.vz);
    const run = Math.min(1, spd / 70);
    this.phase += dt * (4 + spd * 0.1);
    const sw = Math.sin(this.phase) * 0.9 * run;
    const air = liftY > 3;

    // pernas: no ar, joelhos encolhidos; agachando, abrem um pouco
    this.legs[0].rotation.x = air ? -0.45 : sw - dip * 0.12;
    this.legs[1].rotation.x = air ? 0.15 : -sw + dip * 0.05;
    // corpo: balanço, inclinação na corrida, agachado na defesa / no arremesso / na queda
    const crouch = (s.defending && !air ? 1.4 : 0) + dip + (this.landT > 0 ? (this.landT / 0.16) * 1.8 : 0);
    this.body.position.y = (run > 0.05 && !air ? Math.abs(Math.cos(this.phase)) * 0.9 * run : 0) - crouch;
    this.torso.rotation.x = 0.25 * run * (air ? 0.3 : 1) + (s.defending ? 0.25 : 0) + (s.lunge > 0 ? 0.45 : 0) + dip * 0.06;
    const spread = (s.defending && !air ? 0.18 : 0) + dip * 0.05;
    this.legs[0].rotation.z = -spread;
    this.legs[1].rotation.z = spread;

    // braços: cada pose vira uma rotação-alvo; o braço gira suave até ela.
    // Com a bola, as mãos MIRAM nela (drible, arremesso, passe, roubo).
    this.body.rotation.z = s.stun > 0 ? Math.sin(time * 0.03) * 0.25 : 0;
    this.root.updateMatrixWorld(true);
    const [L, R] = this.arms;
    let qL;
    let qR;
    if (s.shoot) {
      // as duas mãos juntas acima da cabeça
      qL = this.aimLocal(L, 0.6, 18, 2.2);
      qR = this.aimLocal(R, -0.6, 18, 2.2);
    } else if (s.hold) {
      // bola no peito, mãos juntas na frente
      qL = this.aimLocal(L, 0.8, 4.5, 6.5);
      qR = this.aimLocal(R, -0.8, 4.5, 6.5);
    } else if (s.defending) {
      // mãos ativas: uma alta (contestar o passe), outra baixa na bola; trocam devagar
      const t = time / 260 + this.phase * 0.05;
      const hi = Math.sin(t) > 0;
      qL = this.aimLocal(L, -8.5, hi ? 9 : 1, 5.5 + Math.sin(time / 140) * 0.8);
      qR = this.aimLocal(R, 8.5, hi ? 1 : 9, 5.5 + Math.cos(time / 150) * 0.8);
      if (s.lunge > 0 && s.ballWorld) qR = this.aimWorld(R, s.ballWorld); // bote no roubo
    } else {
      qL = eulerQ(-sw * 0.9, 0, -0.1);
      qR = eulerQ(sw * 0.9, 0, 0.1);
      if (s.dribble && s.ballWorld) {
        // a mão empurra o topo da bola; o outro braço protege
        const top = s.ballWorld.clone();
        top.y += 2;
        if (s.dribble.side > 0) {
          qR = this.aimWorld(R, top);
          qL = eulerQ(-0.7, 0, -0.45);
        } else {
          qL = this.aimWorld(L, top);
          qR = eulerQ(-0.7, 0, 0.45);
        }
      }
    }
    const k = dt > 0 ? 1 - Math.exp(-(s.shoot || s.hold ? 30 : 18) * dt) : 1;
    L.quaternion.slerp(qL, k);
    R.quaternion.slerp(qR, k);
    this.root.updateMatrixWorld(true);
  }

  // Rotação que aponta o braço (eixo -Y) para um ponto no espaço do tronco.
  aimLocal(arm, x, y, z) {
    return new THREE.Quaternion().setFromUnitVectors(DOWN, new THREE.Vector3(x, y, z).sub(arm.position).normalize());
  }

  aimWorld(arm, world) {
    const local = this.torso.worldToLocal(world.clone());
    return new THREE.Quaternion().setFromUnitVectors(DOWN, local.sub(arm.position).normalize());
  }

  // Posição (mundo) entre as duas mãos: onde a bola fica no arremesso/passe.
  handsCenter() {
    const a = this.arms[0].localToWorld(new THREE.Vector3(0, -8.8, 0));
    const b = this.arms[1].localToWorld(new THREE.Vector3(0, -8.8, 0));
    return a.add(b).multiplyScalar(0.5);
  }

  dispose() {
    this.root.traverse((o) => o.isMesh && o.geometry.dispose());
  }
}
