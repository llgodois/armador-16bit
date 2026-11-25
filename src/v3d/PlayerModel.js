// Jogador da partida 3D: corpo cartoon estilo "arcade" (CartoonModel) + animação procedural.
// O corpo é escalado para a altura do jogador (exagerada: baixinho x pivô bem visível).
import * as THREE from 'three';
import { VS } from './court3d.js';
import CartoonModel, { STYLES } from './CartoonModel.js';

export const SIZE = 38; // altura (unidades 3D) de um jogador de 1,98 m; o aro fica a 60

const STYLE = STYLES.arcade;
const DOWN = new THREE.Vector3(0, -1, 0);
// pulo do arremesso (unidades 3D): altura no topo, velocidade de saída da IA e gravidade
const JUMP = 11;
const JUMP_V = 82;
const GRAVITY = 300;
const DIP_END = 0.3; // até 30% do medidor: recolhe a bola e agacha; depois sobe
const eulerQ = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

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

    // Altura exagerada (estilo cartoon/TV): 1,83 m fica bem menor que um pivô de 2,13 m.
    const cm = info.cm || 198;
    const target = SIZE * Math.max(0.72, Math.min(1.3, 1 + (cm - 198) * 0.013));
    this.root.scale.setScalar(target / c.totalH);
    this.heightUnits = target;

    this.yaw = 0;
    this.phase = Math.random() * 6;
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
      if (rise === 0) dip = Math.sin(Math.min(1, s.gather / DIP_END) * Math.PI * 0.5);
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
    const air = liftY > 3;

    // ---- pernas: quadril balança, joelho dobra na passada; agachar = joelhos dobrados
    const land = this.landT > 0 ? this.landT / 0.16 : 0;
    const bend = (s.defending && !air ? 1 : 0) * 0.7 + dip * 0.9 + land * 0.8; // 0..~1
    for (const [i, leg] of this.legs.entries()) {
      const ph = this.phase + (i ? Math.PI : 0);
      if (air) {
        leg.hip.rotation.x = i ? -0.2 : -0.75;
        leg.knee.rotation.x = i ? 0.5 : 1.2;
      } else {
        const sw = Math.sin(ph) * 0.85 * run;
        leg.hip.rotation.x = sw - bend * 0.55;
        // o joelho dobra quando a perna volta (passada) e no agachamento
        leg.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 1.1 * run + bend * 1.0 + 0.08;
      }
      leg.hip.rotation.z = (i ? 1 : -1) * (s.defending && !air ? 0.16 : 0.04);
    }
    // corpo desce com os joelhos dobrados; balança na corrida
    this.body.position.y = (run > 0.05 && !air ? Math.abs(Math.cos(this.phase)) * 0.8 * run : 0) - bend * 2.2;
    this.torso.rotation.x = 0.22 * run * (air ? 0.3 : 1) + (s.defending ? 0.22 : 0) + (s.lunge > 0 ? 0.45 : 0) + dip * 0.15;
    this.body.rotation.z = s.stun > 0 ? Math.sin(time * 0.03) * 0.25 : 0;
    this.head.rotation.x = -this.torso.rotation.x * 0.6; // a cabeça compensa: olha para frente

    // ---- braços: cada pose vira uma rotação-alvo no ombro (o braço gira suave até ela)
    // e um ângulo de cotovelo. Com a bola, as mãos MIRAM nela.
    this.root.updateMatrixWorld(true);
    const [L, R] = this.arms;
    const sw = Math.sin(this.phase) * 0.8 * run;
    let qL;
    let qR;
    let eL = -0.5;
    let eR = -0.5;
    if (s.shoot) {
      // as duas mãos juntas acima da cabeça
      qL = this.aimLocal(L, 0.6, 21, 2.5);
      qR = this.aimLocal(R, -0.6, 21, 2.5);
      eL = eR = -0.35;
    } else if (s.hold) {
      // bola no peito, mãos juntas na frente
      qL = this.aimLocal(L, 1, 4, 8);
      qR = this.aimLocal(R, -1, 4, 8);
      eL = eR = -0.7;
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
    } else {
      // corrida: braços balançam opostos às pernas, cotovelo dobrado
      qL = eulerQ(-sw, 0, -0.12);
      qR = eulerQ(sw, 0, 0.12);
      eL = eR = -0.55 - run * 0.5;
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
    const k = dt > 0 ? 1 - Math.exp(-(s.shoot || s.hold ? 30 : 18) * dt) : 1;
    L.sh.quaternion.slerp(qL, k);
    R.sh.quaternion.slerp(qR, k);
    L.elbow.rotation.x += (eL - L.elbow.rotation.x) * k;
    R.elbow.rotation.x += (eR - R.elbow.rotation.x) * k;
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
