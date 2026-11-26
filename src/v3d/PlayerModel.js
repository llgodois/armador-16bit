// Jogador da partida 3D: corpo cartoon estilo "arcade" (CartoonModel) + animação procedural.
// O corpo é escalado para a altura do jogador (exagerada: baixinho x pivô bem visível).
//
// Animação:
//  - passada pela DISTÂNCIA percorrida (o pé não escorrega); andar / trotar / sprint
//  - passo lateral (defesa) e passo para trás; tronco gira contra o quadril; inclina nas curvas
//  - arremesso: recolhe/agacha, sobe com o medidor, solta no alto e mantém o braço (finalização)
//  - bandeja: joelho de impulso sobe, braço vai ao aro · enterrada: pulo alto e fica pendurado no aro
//  - tudo suavizado (as pernas e braços giram até a pose-alvo, sem saltos)
import * as THREE from 'three';
import { VS } from './court3d.js';
import CartoonModel, { STYLES } from './CartoonModel.js';

export const SIZE = 38; // altura (unidades 3D) de um jogador de 1,98 m; o aro fica a 60

const STYLE = STYLES.arcade;
const DOWN = new THREE.Vector3(0, -1, 0);
// pulo (unidades 3D): altura do arremesso, velocidades de saída e gravidade
const JUMP = 11;
const JUMP_V = 82; // arremesso da IA
const LAYUP_V = 92;
const DUNK_V = 122;
const GRAVITY = 300;
const DIP_END = 0.3; // até 30% do medidor: recolhe a bola e agacha; depois sobe
const eulerQ = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (cur, target, k) => cur + (target - cur) * k;

// colors: { jersey, dark, trim, shorts, shoes } (mesmo formato de data/teams.js)
export default class PlayerModel {
  constructor(info, colors, index) {
    const c = new CartoonModel(info, colors, index, STYLE);
    this.root = c.root;
    this.body = c.body;
    this.torso = c.torso;
    this.head = c.head;
    this.legs = c.legs; // [{ hip, knee }]
    this.arms = c.arms; // [{ sh, elbow }]
    this.armLen = STYLE.armLen;

    // Altura perto da real (só um pouco exagerada): 1,88 m x 2,13 m = ~20% de diferença.
    const cm = info.cm || 198;
    const target = SIZE * Math.max(0.85, Math.min(1.15, 1 + (cm - 198) * 0.006));
    this.root.scale.setScalar(target / c.totalH);
    this.heightUnits = target;

    this.yaw = 0;
    this.phase = Math.random() * 6;
    this.jumpY = 0;
    this.jumpV = 0;
    this.landT = 0;
    this.finish = null; // 'layup' | 'dunk' (pose no ar)
    this.finishT = 0;
    this.hangT = 0; // enterrada: pendurado no aro
    this.followT = 0; // finalização do arremesso (braço no alto)
    this.amp = 0; // intensidade suavizada da passada
  }

  // Atualiza pose a partir do estado do jogador do jogo.
  // s = { x, z3, vx, vz, facingX, facingZ, lift, shoot, hold, stun, lunge, defending, sprinting,
  //       gather: medidor/ponto ideal (você segurando o arremesso) | null,
  //       shotStart: 'jump' | 'layup' | 'floater' | 'dunk' | null (a bola acabou de sair da mão),
  //       ballDrop: a bola dele está passando pela rede, rim: Vector3 (aro atacado),
  //       dribble: { side } | null, ballWorld: Vector3 (posição da bola na tela 3D) }
  update(s, dt, time) {
    // ---------------------------------------------------------------- pulos
    let dip = 0;
    // impulso já nas últimas passadas da bandeja/enterrada: na hora de soltar ele está no ar
    if (s.takeoff && this.jumpY < 1 && this.jumpV <= 0) {
      this.finish = s.takeoff;
      this.finishT = s.takeoff === 'dunk' ? 0.85 : 0.65;
      this.jumpV = s.takeoff === 'dunk' ? DUNK_V : LAYUP_V;
    }
    if (s.shotStart) {
      if (s.shotStart === 'dunk') {
        this.finish = 'dunk';
        this.finishT = 0.75;
        if (this.jumpY < 4) this.jumpV = DUNK_V;
      } else if (s.shotStart === 'layup' || s.shotStart === 'floater') {
        this.finish = 'layup';
        this.finishT = 0.55;
        if (this.jumpY < 4) this.jumpV = LAYUP_V;
      } else {
        this.followT = 0.6;
        if (this.jumpY < 1) this.jumpV = JUMP_V; // IA (você já está no ar pelo medidor)
      }
    }
    // enterrada: quando a bola passa pela rede, fica pendurado no aro um instante
    if (s.ballDrop && this.finish === 'dunk' && this.hangT === 0 && this.jumpY > 6) this.hangT = 0.38;

    if (s.gather != null) {
      const rise = clamp((s.gather - DIP_END) / (1 - DIP_END), 0, 1);
      const target = Math.sin((rise * Math.PI) / 2) * JUMP;
      this.jumpY = approach(this.jumpY, target, Math.min(1, dt * 22));
      this.jumpV = 0;
      if (rise === 0) dip = Math.sin(Math.min(1, s.gather / DIP_END) * Math.PI * 0.5);
    } else if (this.hangT > 0) {
      this.hangT = Math.max(0, this.hangT - dt);
      this.jumpV = 0;
      // sobe até a mão alcançar o aro (ombro ~78% da altura + braço esticado)
      if (s.rim) {
        const hangY = s.rim.y - this.heightUnits * 0.78 - this.armLen * this.root.scale.x * 0.85;
        this.jumpY = approach(this.jumpY, Math.max(this.jumpY, hangY), Math.min(1, dt * 18));
      }
      if (this.hangT === 0) this.hangT = -1; // solta do aro e cai
    } else if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= GRAVITY * dt;
      this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpV = 0;
        this.landT = 0.18; // flexiona ao aterrissar
        this.finish = null;
        this.hangT = 0;
      }
    }
    this.landT = Math.max(0, this.landT - dt);
    this.finishT = Math.max(0, this.finishT - dt);
    this.followT = Math.max(0, this.followT - dt);
    if (this.finishT === 0 && this.jumpY === 0) this.finish = null;
    const liftY = Math.max(s.lift * VS, this.jumpY);
    this.root.position.set(s.x, liftY, s.z3);
    const air = liftY > 3;

    // ---------------------------------------------------------------- direção e velocidade
    const want = Math.atan2(s.facingX, s.facingZ);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = d * Math.min(1, dt * 14);
    this.yaw += turn;
    const yawRate = dt > 0 ? turn / dt : 0;
    const spd = Math.hypot(s.vx, s.vz);
    // velocidade no referencial do corpo: para frente e para o lado
    const fwd = s.vx * Math.sin(this.yaw) + s.vz * Math.cos(this.yaw);
    const side = s.vx * Math.cos(this.yaw) - s.vz * Math.sin(this.yaw);
    let gait = 'idle';
    if (spd > 8) gait = Math.abs(side) > Math.abs(fwd) * 1.15 ? 'shuffle' : fwd < -6 ? 'back' : 'run';
    const sprint = !!s.sprinting || spd > 88;
    // passo pela distância: cada passo (meio ciclo) cobre "stride" unidades
    const run01 = clamp(spd / 90, 0, 1);
    const stride = gait === 'run' ? 8 + 10 * run01 : gait === 'shuffle' ? 7 : 6;
    if (!air) this.phase += (dt * spd * Math.PI) / stride;
    const k = (r) => (dt > 0 ? 1 - Math.exp(-r * dt) : 1);
    this.amp = approach(this.amp, gait === 'idle' ? 0 : gait === 'run' ? 0.3 + 0.6 * run01 + (sprint ? 0.15 : 0) : 0.55, k(10));
    const A = this.amp;

    // ---------------------------------------------------------------- pernas
    const land = this.landT > 0 ? this.landT / 0.18 : 0;
    const bend =
      (s.defending && !air ? 0.75 : 0) +
      dip * 0.9 +
      land * 0.8 +
      (gait === 'shuffle' ? 0.35 : 0) +
      (s.triple && !air ? 0.35 : 0) + // ameaça tripla: base baixa
      (s.post && !air ? 0.6 : 0); // de costas: bem agachado
    const kl = k(26);
    for (const [i, leg] of this.legs.entries()) {
      const ph = this.phase + (i ? Math.PI : 0);
      let hx;
      let kx;
      let hz = (i ? 1 : -1) * (s.defending && !air ? 0.16 : 0.04);
      if (air) {
        if (this.finish === 'layup') {
          // joelho de impulso sobe (perna 0), a outra estica
          hx = i ? 0.25 : -1.35;
          kx = i ? 0.25 : 1.7;
        } else if (this.hangT > 0 && this.finish === 'dunk') {
          hx = 0.15; // pendurado: pernas soltas
          kx = 0.35 + (i ? 0.15 : 0);
        } else {
          hx = i ? -0.25 : -0.8;
          kx = i ? 0.6 : 1.25;
        }
        hz = (i ? 1 : -1) * 0.06;
      } else if (gait === 'shuffle') {
        // passo lateral: as pernas abrem e fecham, sem cruzar
        const open = 0.12 + 0.24 * (0.5 + 0.5 * Math.sin(this.phase * 2));
        hz = (i ? 1 : -1) * open;
        hx = -bend * 0.5;
        kx = bend * 1.0 + 0.1;
      } else if (gait === 'back') {
        hx = -Math.sin(ph) * A * 0.65 - bend * 0.5;
        kx = Math.max(0, Math.cos(ph)) * 0.9 * A + bend + 0.1;
      } else {
        hx = Math.sin(ph) * A - bend * 0.55;
        // o joelho dobra quando a perna volta para frente (fase de recuperação)
        kx = Math.max(0, -Math.cos(ph)) * (0.5 + 0.9 * A) * (gait === 'run' ? 1 : 0) + bend + 0.08;
      }
      // jab step: a perna do lado do jab avança um passo curto
      if (s.jab && !air && i === (s.jab > 0 ? 1 : 0)) {
        hx = -0.75;
        kx = 0.45;
      }
      if (s.post && !air) hz = (i ? 1 : -1) * 0.22; // base larga de costas
      leg.hip.rotation.x = approach(leg.hip.rotation.x, hx, kl);
      leg.knee.rotation.x = approach(leg.knee.rotation.x, kx, kl);
      leg.hip.rotation.z = approach(leg.hip.rotation.z, hz, kl);
    }

    // ---------------------------------------------------------------- corpo
    const bob = gait === 'idle' || air ? 0 : Math.abs(Math.cos(this.phase)) * (gait === 'shuffle' ? 0.35 : 0.9) * A;
    const breathe = gait === 'idle' && !air ? Math.sin(time / 650) * 0.12 : 0;
    this.body.position.y = approach(this.body.position.y, bob + breathe - bend * 2.2, k(20));
    // quadril gira com a passada; o tronco compensa ao contrário
    const twist = gait === 'run' && !air ? Math.sin(this.phase) * 0.1 * A : 0;
    this.body.rotation.y = this.yaw + twist;
    this.torso.rotation.y = approach(this.torso.rotation.y, -twist * 2.2, k(20));
    // inclina para dentro da curva; balança se desequilibrado
    const roll = -clamp(yawRate * 0.045, -0.3, 0.3) * clamp(spd / 60, 0, 1);
    this.body.rotation.z = s.stun > 0 ? Math.sin(time * 0.03) * 0.25 : approach(this.body.rotation.z, roll, k(8));
    const lean =
      (gait === 'run' ? 0.12 + 0.18 * A + (sprint ? 0.12 : 0) : 0) * (air ? 0.3 : 1) +
      (s.defending ? 0.22 : 0) +
      (s.lunge > 0 ? 0.45 : 0) +
      dip * 0.15 +
      (gait === 'back' ? -0.08 : 0) +
      (s.triple ? 0.18 : 0) +
      (s.post ? 0.35 : 0) +
      (s.bump ? -0.45 : 0); // contato: o tronco vai para trás
    this.torso.rotation.x = approach(this.torso.rotation.x, lean, k(14));
    this.torso.scale.y = 1 + (gait === 'idle' ? Math.sin(time / 650) * 0.012 : 0); // respiração
    this.head.rotation.x = -this.torso.rotation.x * 0.6; // a cabeça compensa: olha para frente

    // ---------------------------------------------------------------- braços
    // cada pose vira uma rotação-alvo no ombro + ângulo de cotovelo; com a bola, as mãos MIRAM nela.
    this.root.updateMatrixWorld(true);
    const [L, R] = this.arms;
    const sw = Math.sin(this.phase) * (0.25 + 0.75 * A + (sprint ? 0.2 : 0));
    let qL;
    let qR;
    let eL = -0.5;
    let eR = -0.5;
    let fast = false;
    if (this.finish === 'dunk' && air && s.rim) {
      // enterrada: braço da bola vai por cima do aro; pendurado = mão no aro
      const r = s.rim.clone();
      r.y += this.hangT > 0 ? 1 : 5;
      qR = this.aimWorld(R, r);
      eR = -0.1;
      if (this.hangT > 0) {
        qL = this.aimWorld(L, s.rim.clone().add(new THREE.Vector3(3, 1, 0)));
        eL = -0.15;
      } else {
        qL = eulerQ(-1.2, 0, -0.5);
        eL = -0.6;
      }
      fast = true;
    } else if (this.finish === 'layup' && air && s.rim) {
      // bandeja: o braço do lado do aro estica até ele (vindo pela esquerda, mão esquerda); o outro protege
      const leftSide = this.torso.worldToLocal(s.rim.clone()).x < 0;
      const qReach = this.aimWorld(leftSide ? L : R, s.rim.clone().add(new THREE.Vector3(0, 2, 0)));
      const qGuard = eulerQ(-1.0, 0, leftSide ? 0.55 : -0.55);
      [qL, qR] = leftSide ? [qReach, qGuard] : [qGuard, qReach];
      [eL, eR] = leftSide ? [-0.15, -0.8] : [-0.8, -0.15];
      fast = true;
    } else if (s.post) {
      // de costas: braço de dentro segura o marcador (para trás), o de fora protege a bola
      qL = this.aimLocal(L, -6, 5, -9);
      eL = -0.35;
      qR = this.aimLocal(R, 6, 3, 5);
      eR = -0.8;
      fast = true;
    } else if (s.shoot) {
      // as duas mãos juntas acima da cabeça
      qL = this.aimLocal(L, 0.6, 21, 2.5);
      qR = this.aimLocal(R, -0.6, 21, 2.5);
      eL = eR = -0.35;
      fast = true;
    } else if (this.followT > 0) {
      // finalização: braço do arremesso fica no alto com o "punho" caído
      qR = this.aimLocal(R, -1, 22, 7);
      eR = -1.15;
      qL = eulerQ(-0.5, 0, -0.35);
      eL = -0.6;
    } else if (s.hold) {
      // bola no peito, mãos juntas na frente
      qL = this.aimLocal(L, 1, 4, 8);
      qR = this.aimLocal(R, -1, 4, 8);
      eL = eR = -0.7;
      fast = true;
    } else if (s.defending) {
      // mãos ativas: uma alta (contestar o passe), outra baixa na bola; trocam devagar
      const hi = Math.sin(time / 260 + this.phase * 0.05) > 0;
      qL = this.aimLocal(L, -10, hi ? 11 : 1, 6 + Math.sin(time / 140) * 0.8);
      qR = this.aimLocal(R, 10, hi ? 1 : 11, 6 + Math.cos(time / 150) * 0.8);
      eL = eR = -0.35;
      if (s.lunge > 0 && s.ballWorld) {
        qR = this.aimWorld(R, s.ballWorld); // bote no roubo
        eR = -0.05;
      }
    } else if (gait === 'shuffle') {
      qL = eulerQ(-0.4, 0, -0.45);
      qR = eulerQ(-0.4, 0, 0.45);
      eL = eR = -0.7;
    } else {
      // corrida/andar: braços balançam opostos às pernas; no sprint, mais soltos
      qL = eulerQ(-sw, 0, -0.1);
      qR = eulerQ(sw, 0, 0.1);
      eL = -0.45 - A * 0.7 + Math.max(0, sw) * 0.3;
      eR = -0.45 - A * 0.7 + Math.max(0, -sw) * 0.3;
      if (s.dribble && s.ballWorld) {
        // a mão empurra o topo da bola; o outro braço protege
        const top = s.ballWorld.clone();
        top.y += 2;
        if (s.dribble.side > 0) {
          qR = this.aimWorld(R, top);
          eR = -0.2;
          qL = eulerQ(-0.8, 0, -0.5);
          eL = -0.9;
        } else {
          qL = this.aimWorld(L, top);
          eL = -0.2;
          qR = eulerQ(-0.8, 0, 0.5);
          eR = -0.9;
        }
      }
    }
    const ka = k(fast ? 30 : 16);
    L.sh.quaternion.slerp(qL, ka);
    R.sh.quaternion.slerp(qR, ka);
    L.elbow.rotation.x = approach(L.elbow.rotation.x, eL, ka);
    R.elbow.rotation.x = approach(R.elbow.rotation.x, eR, ka);
    this.root.updateMatrixWorld(true);
  }

  // Rotação que aponta o braço (eixo -Y) para um ponto no espaço do tronco.
  aimLocal(arm, x, y, z) {
    return new THREE.Quaternion().setFromUnitVectors(DOWN, new THREE.Vector3(x, y, z).sub(arm.sh.position).normalize());
  }

  aimWorld(arm, world) {
    const local = this.torso.worldToLocal(world.clone());
    return new THREE.Quaternion().setFromUnitVectors(DOWN, local.sub(arm.sh.position).normalize());
  }

  // Posição (mundo) entre as duas mãos: onde a bola fica no arremesso/passe.
  // Posição (mundo) da mão direita (a da bola na bandeja/enterrada).
  handPos() {
    return this.arms[1].elbow.localToWorld(new THREE.Vector3(0, -this.armLen * 0.5, 0));
  }

  handsCenter() {
    const h = -this.armLen * 0.5;
    const a = this.arms[0].elbow.localToWorld(new THREE.Vector3(0, h, 0));
    const b = this.arms[1].elbow.localToWorld(new THREE.Vector3(0, h, 0));
    return a.add(b).multiplyScalar(0.5);
  }

  dispose() {
    this.root.traverse((o) => o.isMesh && o.geometry.dispose());
  }
}
