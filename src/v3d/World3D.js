// Desenha a partida da GameScene em 3D. Só LÊ o estado do jogo: posições,
// bola, estado da partida e os indicadores (anel, alvo do passe, medidor...).
import * as THREE from 'three';
import { Y_SCALE, PLAYER, SHOT, MID_Y, BASKET } from '../config.js';
import { buildCourt, VS, toZ } from './court3d.js';
import PlayerModel, { SIZE } from './PlayerModel.js';

const BALL_R = 2.6;
// Câmeras da partida (escolha no menu de pausa ou tecla V; fica salva).
//   fundo: atrás da linha de fundo, como no 16-bit · lateral: transmissão de TV · perto: atrás, mais baixa
// up/back = altura e distância atrás do ponto que ela olha; yaw = quanto a tela está girada
// em relação à quadra (o controle acompanha: "para cima" é sempre para cima na tela).
export const CAM_MODES = [
  { id: 'fundo', name: 'FUNDO', up: 118, back: 262, yaw: 0 },
  { id: 'lateral', name: 'TV LATERAL', up: 170, back: 330, yaw: Math.PI / 2 },
  { id: 'perto', name: 'PERTO', up: 78, back: 178, yaw: 0 },
];
// Textura da bola: laranja com gomos pretos (o giro fica visível).
function ballTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 32;
  const c = cv.getContext('2d');
  c.fillStyle = '#e8722a';
  c.fillRect(0, 0, 64, 32);
  c.fillStyle = '#2a1408';
  for (const x of [0, 16, 32, 48]) c.fillRect(x, 0, 2, 32);
  c.fillRect(0, 15, 64, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}
// Céu/neblina do ginásio e luzes (sol com sombra). Devolve o sol.
function addLights(s) {
  s.background = new THREE.Color(0x0b0b14);
  s.fog = new THREE.Fog(0x0b0b14, 520, 1150);
  s.add(new THREE.HemisphereLight(0xcfdcff, 0x3a2a22, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -280;
  sc.right = sc.top = 280;
  sc.near = 10;
  sc.far = 900;
  sun.shadow.bias = -0.0008;
  s.add(sun, sun.target);
  return sun;
}
// ponte aérea: quem vai receber sobe para pegar a bola no ar (e enterra)
function alleyTakeoff(b, p) {
  if (b.state !== 'pass' || !b.wasLob || b.passTo !== p) return null;
  return Math.hypot(b.x - p.x, b.y - p.y) < 50 ? 'dunk' : null;
}
const hexCss = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
const tintOf = (img) => (img && img.isTinted ? img.tintTopLeft : 0xffffff);

export default class World3D {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(44, 16 / 9, 1, 3000);
    this.look = new THREE.Vector3(240, 12, toZ(MID_Y));
    this.game = null;
    this.ball = null;
    this.floats = [];
    this.lastTime = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Resolução interna baixa (ampliada sem suavizar): visual "64-bit".
  resize() {
    const px = Math.max(1, Math.floor(window.innerHeight / 400));
    const w = Math.ceil(window.innerWidth / px);
    const h = Math.ceil(window.innerHeight / px);
    this.renderer.setSize(w, h, false);
    this.overlay.width = w;
    this.overlay.height = h;
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  attach(game) {
    this.detach();
    this.game = game;
    this.ball = game.ball;
    const s = (this.scene = new THREE.Scene());
    this.sun = addLights(s);
    this.courtObj = buildCourt(s, { street: !!game.street, paint: game.homeTeam && game.homeTeam.colors.dark });
    this.camId = null; // ginásio novo: reaplica a câmera (arquibancada escondida etc.)

    // bola
    const ballMat = new THREE.MeshLambertMaterial({ map: ballTexture(), flatShading: true });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 12, 8), ballMat);
    this.ballVel = new THREE.Vector3();
    this.squash = 0;
    this.ballMesh.castShadow = true;
    s.add(this.ballMesh);

    // anéis no chão: você, onde correr (jogada sem bola), melhor opção no replay
    const ring = (inner, outer) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      s.add(m);
      return m;
    };
    this.userRing = ring(6.5, 8.2);
    this.runRing = ring(8, 9.8);
    this.replayRing = ring(9, 11);

    this.models = new Map();
    this.prevPos = new Map();
    this.scoreSeen = { ...(game.score || { home: 0, away: 0 }) };
    this.cheer = 0;
    this.netFlash = 0;
    this.ball.on('scored', () => (this.netFlash = 0.6));

    const t = game.camTarget || game.pg;
    this.look.set(t.x, 12, toZ(t.y));
    this.prevBallState = null;
    this.smoothT = 0;
    this.canvas.style.display = 'block';
    this.canvas.style.filter = '';
    this.overlay.style.display = 'block';
  }

  detach() {
    this.canvas.style.display = 'none';
    this.overlay.style.display = 'none';
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      this.courtObj.dispose();
    }
    this.scene = null;
    this.game = null;
    this.ball = null;
    this.floats = [];
  }

  // Menus: o ginásio vazio ao fundo, câmera balançando devagar pela lateral.
  showcase(time) {
    if (!this.show) {
      const s = new THREE.Scene();
      const sun = addLights(s);
      const court = buildCourt(s, {});
      sun.position.set(160, 320, toZ(MID_Y) + 120);
      sun.target.position.set(240, 0, toZ(MID_Y));
      this.show = { scene: s, court };
    }
    this.canvas.style.display = 'block';
    this.canvas.style.filter = 'brightness(0.45) saturate(0.85)'; // fundo dos menus: escurecido
    this.overlay.style.display = 'none';
    const a = Math.sin(time / 9000) * 0.55;
    const cx = 240;
    const cz = toZ(MID_Y) - 120;
    this.camera.position.set(cx + Math.sin(a) * 430, 120 + Math.sin(time / 7000) * 25, cz + Math.cos(a) * 430);
    this.camera.lookAt(cx, 30, cz);
    this.renderer.render(this.show.scene, this.camera);
  }

  floatText(x, y, str, color = 0xffffff) {
    // o 2D passa y já "acima da cabeça" (y - altura - 6): volta para o chão
    this.floats.push({ x, y: y + 30, str: String(str), color, t: 0 });
  }

  // ---------------------------------------------------------------- quadro
  render(time) {
    const g = this.game;
    if (!g || !this.scene) return;
    const dt = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const paused = !g.scene.isActive('Game');
    const fdt = paused ? 0 : dt;

    const replay = g.state === 'replay' && g.replay ? g.replay.frames[Math.floor(g.replay.i)] : null;
    this.syncPlayers(g, replay, fdt, time);
    this.syncBall(g, replay, fdt);
    this.syncRings(g, time);
    this.syncCamera(g, fdt);
    this.syncCrowd(g, fdt, time);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(g, fdt, time);
  }

  syncPlayers(g, replay, dt, time) {
    const seen = new Set();
    this.handBall = null;
    this.dribbleBall = null;
    // aro da cesta atacada (bandeja e enterrada miram nele)
    const bk = g.basket || BASKET;
    const rim = new THREE.Vector3(bk.x, bk.rimZ * VS, toZ(bk.y));
    const now = g.time.now;
    g.all.forEach((p, k) => {
      seen.add(p);
      let m = this.models.get(p);
      if (!m || m.info !== p.info) {
        if (m) this.scene.remove(m.root);
        const colors = p.team === 'away' ? g.awayColors : g.homeTeam.colors;
        m = new PlayerModel(p.info || { cm: p.cm }, colors, p.index);
        m.info = p.info;
        this.models.set(p, m);
        this.scene.add(m.root);
      }
      let x = p.x;
      let y = p.y;
      let lift = p.lift;
      let vx;
      let vy;
      if (replay && replay.p[k]) {
        [x, y, , , lift] = replay.p[k];
        const prev = this.prevPos.get(p) || { x, y };
        vx = dt > 0 ? (x - prev.x) / dt : 0;
        vy = dt > 0 ? (y - prev.y) / dt : 0;
      } else {
        const v = p.body.velocity;
        vx = v.x;
        vy = v.y;
      }
      this.prevPos.set(p, { x, y });
      const spd = Math.hypot(vx, vy / PLAYER.verticalFactor);
      let fx = p.facing.x;
      let fz = p.facing.y;
      if (replay && spd > 10) {
        fx = vx;
        fz = vy / PLAYER.verticalFactor;
      }

      const b = g.ball;
      const holding = !replay && b.state === 'held' && b.holder === p && p.pose !== 'shoot';
      let dribble = null;
      let hold = false;
      let shoot = p.pose === 'shoot';
      let ballWorld = null;
      // você segurando o arremesso: o medidor comanda o pulo (recolhe -> agacha -> sobe -> solta no alto)
      const gather = !replay && g.gathering && p === g.user && b.holder === p ? (g.meterValue || 0) / SHOT.sweetSpot : null;
      if (gather != null && gather < 0.3) {
        shoot = false;
        hold = true; // bola no peito enquanto recolhe
      }
      if (holding) {
        // passe/reposição, passadas da bandeja, ameaça tripla ou de costas: bola na mão
        if (b.z >= 18 || p.layupT > 0 || p.triple > 0 || p.post) hold = true;
        else {
          // O 2D desloca a bola para o lado no eixo da TELA (não do corpo): virado de lado, ela ia
          // parar atrás dele. Aqui a bola fica ao lado e um pouco à frente do CORPO; o lado vem do
          // drible do jogo (sideCur: -1..1, muda no crossover).
          const yaw = m.yaw;
          const side = b.sideCur || 1;
          const ps = m.heightUnits / SIZE;
          const lx = side * 5.5 * ps; // para o lado (mão do drible)
          const lz = 3.2 * ps; // um pouco à frente
          dribble = { side: side >= 0 ? 1 : -1, z: b.z };
          // altura do quique proporcional ao tamanho do jogador (chão -> cintura)
          ballWorld = new THREE.Vector3(
            x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
            Math.max(0, b.z - 2) * 1.05 * ps + BALL_R,
            toZ(y) - lx * Math.sin(yaw) + lz * Math.cos(yaw),
          );
          this.dribbleBall = ballWorld;
        }
      }
      if (p.lunge > 0 && !replay) ballWorld = this.ballMesh.position.clone();
      m.update(
        {
          x,
          z3: toZ(y),
          vx,
          vz: vy * Y_SCALE, // velocidade real na tela 3D (passada pela distância)
          facingX: fx,
          facingZ: fz,
          lift,
          shoot,
          stun: p.stun,
          lunge: p.lunge,
          defending: !replay && g.offSide && p.team !== g.offSide && g.state === 'live',
          dribble,
          hold,
          ballWorld,
          gather,
          // a bola acabou de sair da mão dele: 'jump' | 'layup' | 'floater' | 'dunk'
          shotStart: !replay && b.state === 'shot' && this.prevBallState !== 'shot' && b.shot && b.shot.shooter === p ? b.shot.kind : null,
          ballDrop: !replay && b.state === 'drop' && b.shot && b.shot.shooter === p,
          rim,
          sprinting: !!p.sprinting,
          // últimas passadas da bandeja: já sai do chão (enterrada se você pediu com o sprint)
          takeoff: !replay && p.layupT > 0 && p.layupT < 0.16 ? (p.wantDunk ? 'dunk' : 'layup') : alleyTakeoff(b, p),
          // (64) ameaça tripla, de costas, contato e jab: poses próprias
          triple: !replay && holding && p.triple > 0,
          post: !replay && holding && !!p.post,
          bump: !replay && now - (p.bumpAt ?? -1e9) < 280,
          jab: !replay && now - (p.jabAt ?? -1e9) < 220 ? p.jabSide || 1 : 0,
        },
        dt,
        time,
      );
      // de costas: a bola fica na mão de fora (a outra segura o marcador)
      if (!replay && holding && p.post) {
        this.handBall = m.handPos();
        return;
      }
      // enterrada: a bola fica na mão até chegar ao aro
      if (!replay && b.state === 'shot' && b.shot && b.shot.shooter === p && b.shot.kind === 'dunk') {
        const h = m.handPos();
        h.y += BALL_R * 0.6;
        this.handBall = h;
      }
      // arremesso/passe: a bola fica entre as mãos do modelo
      if (!replay && b.state === 'held' && b.holder === p && (shoot || hold)) {
        const c = m.handsCenter();
        if (shoot) c.y += BALL_R * 0.9;
        else c.add(new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw)).multiplyScalar(BALL_R * 0.7));
        this.handBall = c;
      }
    });
    for (const [p, m] of this.models) {
      if (seen.has(p)) continue;
      this.scene.remove(m.root);
      this.models.delete(p);
    }
  }

  syncBall(g, replay, dt) {
    const b = g.ball;
    let [x, y, z] = [b.x, b.y, b.z];
    if (replay) [x, y, z] = replay.b;
    const hoops = this.courtObj.hoops;
    const hoop = b.basket && b.basket.y > MID_Y ? hoops.bottom : hoops.top;
    const rimY = (b.basket || { rimZ: 30 }).rimZ * VS;

    // altura na tela: no drible a bola fica na altura da mão (escala menor)
    let Y = z * VS + BALL_R * 0.8;
    // bola na mão (arremesso, passe, enterrada) ou no drible
    if (!replay && this.handBall) {
      x = this.handBall.x;
      Y = this.handBall.y;
      y = this.handBall.z / Y_SCALE;
    } else if (!replay && b.state === 'held' && this.dribbleBall) Y = this.dribbleBall.y;

    // (visual) bola de TABELA: arremesso certo da diagonal às vezes beija a tabela antes de cair
    const s = b.shot;
    if (!replay && b.state === 'shot' && s && s.kind === 'jump' && s.made && b.basket) {
      if (this.bankShotRef !== s) {
        this.bankShotRef = s;
        const ax = Math.abs(s.sx - s.tx);
        const ay = Math.abs(s.sy - s.ty);
        s.bank = ax > 25 && ax < 120 && ay > 8 && ay < 90 && Math.random() < 0.4;
      }
      if (s.bank && s.t > 0.7) {
        const u = (s.t - 0.7) / 0.3;
        const dir = b.basket.y > MID_Y ? -1 : 1; // cesta de cima: a tabela fica ao norte
        const P0 = new THREE.Vector3(
          s.sx + (s.tx - s.sx) * 0.7,
          (s.sz + (b.basket.rimZ - s.sz) * 0.7 + s.arc * 4 * 0.7 * 0.3) * VS + BALL_R * 0.8,
          toZ(s.sy + (s.ty - s.sy) * 0.7),
        );
        const board = new THREE.Vector3(s.tx + Math.sign(s.sx - s.tx) * 4, rimY + 8, toZ(b.basket.y - dir * 5));
        const rimC = new THREE.Vector3(s.tx, rimY + BALL_R, toZ(s.ty));
        const p = u < 0.55 ? P0.lerp(board, u / 0.55) : board.lerp(rimC, (u - 0.55) / 0.45);
        x = p.x;
        Y = p.y;
        y = p.z / Y_SCALE;
      }
    }

    // cesta: a bola atravessa a rede devagar (no jogo ela cai rápido demais para ver)
    if (b.state === 'drop' && !replay) {
      if (this.prevBallState !== 'drop') {
        if (s && s.bank) this.floatText(b.basket.x, b.basket.y - 30, 'TABELA!', 0x6fa0ff);
        this.dropT = 0;
        hoop.userData.swish = 0.55;
      }
      this.dropT += dt;
      const netLen = 7 * 1.3;
      Y = Math.max(Y, rimY + BALL_R * 0.5 - netLen * Math.min(1, (this.dropT / 0.3) ** 1.6));
      this.dropEndY = Y;
      this.smoothT = 0;
    } else if (this.prevBallState === 'drop') {
      this.smoothT = 0.25; // depois da cesta a bola "desce" até onde o jogo a colocou
    }
    if (this.smoothT > 0 && !replay) {
      this.smoothT = Math.max(0, this.smoothT - dt);
      const k = this.smoothT / 0.25;
      const p = this.ballMesh.position;
      x = p.x + (x - p.x) * (1 - k * 0.7);
      Y = p.y + (Y - p.y) * (1 - k * 0.7);
      y = p.z / Y_SCALE + (y - p.z / Y_SCALE) * (1 - k * 0.7);
    }
    // errou: bateu no aro (o jogo passa de 'shot' direto para 'loose')
    if (this.prevBallState === 'shot' && b.state === 'loose' && b.shot && b.shot.t >= 1) hoop.userData.rimHit = 0.3;
    this.prevBallState = replay ? 'replay' : b.state;

    this.ballMesh.visible = true;
    this.ballPhysics(new THREE.Vector3(x, Y, toZ(y)), b, dt);

    // rede balança no "chuá"; aro treme quando a bola bate; tudo acende verde na cesta
    for (const h of new Set([hoops.top, hoops.bottom])) {
      const u = h.userData;
      u.netMat.color.setHex(this.netFlash > 0 ? 0x6dff6d : 0xffffff);
      u.swish = Math.max(0, u.swish - dt);
      const s = u.swish > 0 ? Math.sin(Math.PI * (1 - u.swish / 0.55)) : 0;
      u.net.scale.set(1 - 0.18 * s, 1 + 0.45 * s, 1 - 0.18 * s);
      u.net.position.y = u.netY - (u.net.scale.y - 1) * 4.5;
      u.rimHit = Math.max(0, (u.rimHit || 0) - dt);
      u.rim.position.y = rimY + (u.rimHit > 0 ? Math.sin(u.rimHit * 90) * 0.5 : 0);
    }
  }

  // Giro e quique da bola, a partir do movimento que aparece na tela.
  ballPhysics(pos, b, dt) {
    const m = this.ballMesh;
    if (dt > 0) {
      const v = pos.clone().sub(m.position).divideScalar(dt);
      const teleport = v.length() > 900; // reposição/troca de posse: sem giro
      if (!teleport) {
        // quicou no chão: amassa um instante
        if (this.ballVel.y < -25 && v.y >= 0 && pos.y < BALL_R + 2) this.squash = 0.09;
        const h = Math.hypot(v.x, v.z);
        if (h > 1) {
          // rola na direção do movimento; no arremesso, efeito para trás
          const axis = new THREE.Vector3(v.z, 0, -v.x).normalize();
          const back = b.state === 'shot' ? -1.4 : 1;
          m.rotateOnWorldAxis(axis, (back * h * dt) / BALL_R);
        }
        this.ballVel.copy(v);
      } else this.ballVel.set(0, 0, 0);
    }
    this.squash = Math.max(0, this.squash - dt);
    const q = this.squash > 0 ? Math.sin((this.squash / 0.09) * Math.PI) : 0;
    m.scale.set(1 + 0.18 * q, 1 - 0.25 * q, 1 + 0.18 * q);
    m.position.copy(pos);
    if (q > 0) m.position.y -= BALL_R * 0.25 * q;
  }

  syncRings(g, time) {
    const u = g.user;
    const live = g.state === 'live';
    const r = this.userRing;
    r.visible = !!u && g.state !== 'replay';
    if (u) {
      r.position.set(u.x, 0.3, toZ(u.y));
      r.material.color.setHex(tintOf(g.ring));
    }
    const rm = g.runMarker;
    this.runRing.visible = !!(rm && rm.visible && live);
    if (this.runRing.visible) {
      this.runRing.position.set(rm.x, 0.35, toZ(rm.y));
      this.runRing.material.color.setHex(0x3ad6ff);
      this.runRing.material.opacity = 0.5 + 0.4 * Math.abs(Math.sin(time / 160));
    }
    const rr = g.replayRing;
    this.replayRing.visible = !!(rr && rr.visible);
    if (this.replayRing.visible) {
      this.replayRing.position.set(rr.x, 0.35, toZ(rr.y));
      this.replayRing.material.color.setHex(0x6dff6d);
    }
  }

  // Câmera de "transmissão" atrás da linha de fundo de baixo, como no 16-bit:
  // segue o mesmo alvo da câmera 2D (entre você e a bola).
  syncCamera(g, dt) {
    const t = g.camTarget || g.user;
    const cam = CAM_MODES.find((c) => c.id === g.camMode) || CAM_MODES[0];
    g.camYaw = cam.yaw; // a GameScene gira o controle por esse ângulo
    const lateral = cam.id === 'lateral';
    // lateral: a câmera fica na lateral esquerda e corre ao longo da quadra; a arquibancada dela some
    if (this.camId !== cam.id) {
      this.camId = cam.id;
      this.courtObj.arena.userData.hideSide(lateral ? 'left' : null);
    }
    const want = lateral
      ? new THREE.Vector3(240 + (t.x - 240) * 0.35, 22, toZ(t.y))
      : new THREE.Vector3(240 + (t.x - 240) * 0.7, 26, toZ(t.y) - 6);
    const k = dt > 0 ? 1 - Math.exp(-4 * dt) : 0;
    this.look.lerp(want, k);
    if (lateral) this.camera.position.set(this.look.x - cam.back, this.look.y + cam.up, this.look.z);
    else this.camera.position.set(this.look.x, this.look.y + cam.up, this.look.z + cam.back);
    this.camera.lookAt(this.look);
    // sombra acompanha o centro da cena (mapa de sombra mais nítido)
    this.sun.position.set(this.look.x - 90, 320, this.look.z + 110);
    this.sun.target.position.copy(this.look);
  }

  syncCrowd(g, dt, time) {
    this.netFlash = Math.max(0, this.netFlash - dt);
    const sc = g.score || { home: 0, away: 0 };
    if (sc.home > this.scoreSeen.home) this.cheer = 1.6;
    this.scoreSeen = { ...sc };
    const { crowd, fans } = this.courtObj.arena.userData;
    if (this.cheer <= 0 && !this.cheerDirty) return;
    this.cheer = Math.max(0, this.cheer - dt);
    this.cheerDirty = this.cheer > 0;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    fans.forEach((f, i) => {
      if (f.hidden) return; // lado escondido pela câmera lateral
      f.m.decompose(pos, q, scl);
      if (this.cheer > 0) pos.y += Math.max(0, Math.sin(time / 90 + f.phase)) * 3;
      m.compose(pos, q, scl);
      crowd.setMatrixAt(i, m);
    });
    crowd.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- indicadores 2D
  project(x, y, h) {
    const v = new THREE.Vector3(x, h, toZ(y)).project(this.camera);
    return { x: Math.round((v.x * 0.5 + 0.5) * this.W), y: Math.round((-v.y * 0.5 + 0.5) * this.H), ok: v.z < 1 };
  }

  headOf(p) {
    const m = this.models.get(p);
    return (m ? m.heightUnits : 30) + p.lift * VS;
  }

  drawOverlay(g, dt, time) {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    this.drawRoutes(g, time);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const live = g.state === 'live';

    // pontos coloridos sobre os jogadores (livre, opção da jogada, seu homem...)
    if (g.dots) {
      g.all.forEach((p, i) => {
        const d = g.dots[i];
        if (!d || !d.visible) return;
        const s = this.project(p.x, p.y, this.headOf(p) + 5);
        const bob = Math.round(Math.sin(time / 150 + i) * 1.5);
        c.fillStyle = '#10101a';
        c.fillRect(s.x - 3, s.y - 3 + bob, 6, 6);
        c.fillStyle = hexCss(tintOf(d));
        c.fillRect(s.x - 2, s.y - 2 + bob, 4, 4);
      });
    }

    // alvo do passe (seta) sobre o recebedor
    const tm = g.targetMarker;
    if (tm && tm.visible && g.passTarget) {
      const p = g.passTarget;
      const s = this.project(p.x, p.y, this.headOf(p) + 9);
      const bob = Math.round(Math.sin(time / 120) * 2);
      c.globalAlpha = tm.alpha;
      c.fillStyle = '#10101a';
      this.tri(s.x, s.y + bob, 7);
      c.fillStyle = hexCss(tintOf(tm));
      this.tri(s.x, s.y + bob - 1, 5);
      c.globalAlpha = 1;
    }

    // ícones de passe (segure J): 1..4
    if (g.icons) {
      c.font = '800 11px "Barlow Condensed", sans-serif';
      for (const [i, ic] of g.icons.entries()) {
        if (!ic.bg.visible) continue;
        const s = this.project(ic.p.x, ic.p.y, this.headOf(ic.p) + 14);
        c.fillStyle = '#10101a';
        c.fillRect(s.x - 6, s.y - 6, 12, 12);
        c.fillStyle = '#ffe14d';
        c.fillRect(s.x - 5, s.y - 5, 10, 10);
        c.fillStyle = '#1a1222';
        c.fillText(String(i + 1), s.x, s.y + 1);
      }
    }

    // medidor de arremesso sobre a cabeça (modo PULO: sem barra, solte no topo do pulo)
    const u = g.user;
    if (g.gathering && u && g.meterMode !== 'pulo') {
      const s = this.project(u.x, u.y, this.headOf(u) + 10);
      const W = 34;
      const x = s.x - W / 2;
      const y = s.y;
      // janela verde do jogo (no 64 encolhe com defensor perto, gás baixo e arremesso em movimento)
      const win = g.greenWindow ? g.greenWindow(u) : SHOT.perfectWindow * u.skills.perfectWindow;
      c.fillStyle = '#10101a';
      c.fillRect(x - 1, y - 1, W + 2, 7);
      c.fillStyle = '#3a3352';
      c.fillRect(x, y, W, 5);
      c.fillStyle = '#2e8b3a';
      c.fillRect(x + Math.round(W * (SHOT.sweetSpot - win)), y, Math.max(2, Math.round(W * win * 2)), 5);
      const v = g.meterValue || 0;
      const over = v > SHOT.sweetSpot + win;
      c.fillStyle = v > 1 ? (Math.floor(time / 60) % 2 ? '#ff5a4d' : '#ffffff') : over ? '#ff9a4d' : '#ffe14d';
      c.fillRect(x, y + 1, Math.round(W * Math.min(1, v)), 3);
    }

    // textos flutuantes
    c.font = '800 13px "Barlow Condensed", sans-serif';
    this.floats = this.floats.filter((f) => (f.t += dt) < 0.9);
    for (const f of this.floats) {
      const s = this.project(f.x, f.y, 34 + f.t * 20);
      c.globalAlpha = 1 - Math.max(0, (f.t / 0.9 - 0.6) / 0.4);
      c.fillStyle = '#10101a';
      c.fillText(f.str, s.x + 1, s.y + 1);
      c.fillStyle = hexCss(f.color);
      c.fillText(f.str, s.x, s.y);
      c.globalAlpha = 1;
    }
    this.drawReplayInfo(g);
  }

  // Rotas da jogada chamada, desenhadas NO CHÃO (projetadas em perspectiva).
  // Mesma lógica do 16-bit (GameScene.drawPlayRoutes).
  drawRoutes(g, time) {
    const play = g.play;
    if (!play || play.done || g.offSide !== 'home' || g.state !== 'live') return;
    const ph = play.phase;
    if (!ph) return;
    const c = this.ctx;
    const COLORS = { PG: '#3ad6ff', SG: '#6fa0ff', SF: '#6dff6d', PF: '#ff9a4d', C: '#ff6bd5' };
    const screens = [].concat(ph.screen || []);
    const pulse = 0.55 + 0.35 * Math.abs(Math.sin(time / 220));
    const P = (x, y) => this.project(x, y, 0.4);
    const line = (pts, color, width, alpha) => {
      c.globalAlpha = alpha;
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
    };
    const arrow = (from, to, color, alpha, width) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len < 10) return;
      const ux = dx / len;
      const uy = dy / len;
      // tracejado que "anda" na direção da rota, com contorno escuro
      const off = (time / 40) % 9;
      for (const [w, col, al] of [[width + 2, '#000000', 0.45], [width, color, alpha]]) {
        for (let t = off; t < len - 6; t += 9) {
          const e = Math.min(t + 5, len - 6);
          line([P(from.x + ux * t, from.y + uy * t), P(from.x + ux * e, from.y + uy * e)], col, w, al);
        }
      }
      // ponta da seta (no chão)
      const a = 0.5;
      const hx = to.x - ux * 2;
      const hy = to.y - uy * 2;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      const pts = [P(hx, hy), P(hx - 8 * (ux * cs - uy * sn), hy - 8 * (uy * cs + ux * sn)), P(hx - 8 * (ux * cs + uy * sn), hy - 8 * (uy * cs - ux * sn))];
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      c.fill();
    };
    const u = g.user;
    for (const role of Object.keys(ph.spots)) {
      const p = play.byRole(role);
      const to = play.target(role);
      if (!p || !to) continue;
      const mine = p === u;
      if (screens.includes(role)) {
        const s = 6;
        line([P(to.x - s, to.y - s), P(to.x + s, to.y - s), P(to.x + s, to.y + s), P(to.x - s, to.y + s), P(to.x - s, to.y - s)], '#ffe14d', 2, pulse);
      }
      if (play.holds(role)) continue;
      arrow({ x: p.x, y: p.y }, to, mine ? COLORS.PG : COLORS[role] || '#ffffff', mine ? 1 : 0.85, mine ? 3 : 2);
    }
    if (g.ball.holder === u && screens.length && !ph.spots.PG) {
      const s = play.target(screens[0]);
      if (s) arrow({ x: u.x, y: u.y }, { x: s.x + play.mid * 16, y: s.y + 8 * g.dir }, COLORS.PG, 1, 3);
    }
    // quem é a leitura (opção): anel pulsando no chão
    for (const t of play.options()) {
      if (t === u) continue;
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        pts.push(P(t.x + Math.cos(a) * 11, t.y + Math.sin(a) * 8));
      }
      line(pts, '#6dff6d', 1.5, pulse);
    }
    c.globalAlpha = 1;
  }

  // Replay: título e análise da decisão (no 16-bit ficam na tela 2D, escondida aqui).
  drawReplayInfo(g) {
    if (g.state !== 'replay' || !g.replayTitle) return;
    const c = this.ctx;
    const rows = [g.replayTitle, ...(g.replayInfo || [])].filter((t) => t && t.main && t.main.visible && t.main.text);
    if (!rows.length) return;
    const fs = Math.round(this.H / 26);
    c.font = `600 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // logo abaixo do placar do HUD e dos avisos (que ficam no canvas do Phaser, com tarjas pretas se a janela não for 16:9)
    const cv = document.querySelector('#game canvas');
    const r = cv ? cv.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    const y0 = Math.round(((r.top + r.height * 0.25) / window.innerHeight) * this.H);
    rows.forEach((t, i) => {
      const str = t.main.text;
      const w = c.measureText(str).width + fs * 1.4;
      const y = y0 + i * fs * 1.6;
      c.globalAlpha = 0.85;
      c.fillStyle = '#0c1322';
      c.fillRect(this.W / 2 - w / 2, y - fs * 0.7, w, fs * 1.4);
      c.globalAlpha = 1;
      c.fillStyle = hexCss(t.main.tintTopLeft ?? 0xffffff);
      c.fillText(str, this.W / 2, y + 1);
    });
  }

  tri(x, y, r) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x - r, y - r);
    c.lineTo(x + r, y - r);
    c.lineTo(x, y + r * 0.6);
    c.closePath();
    c.fill();
  }
}
