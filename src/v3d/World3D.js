// Desenha a partida da GameScene em 3D. Só LÊ o estado do jogo: posições,
// bola, estado da partida e os indicadores (anel, alvo do passe, medidor...).
import * as THREE from 'three';
import { Y_SCALE, PLAYER, SHOT, MID_Y, BASKET, VISION, OFFENSE, COURT } from '../config.js';
import { buildCourt, VS, toZ } from './court3d.js';
import PlayerModel, { SIZE } from './PlayerModel.js';
import { MATE_ACTIONS } from '../game/mech64.js';

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
// Ankle breaker: o jogo marca "stun" no defensor que caiu no drible (0,68–0,85 s). Fintas e
// contato dão stun menor (≤ 0,5) e não derrubam. Devolve a duração da queda quando ela começa.
function fallStart(m, p, replay) {
  const st = p.stun || 0;
  const started = !replay && st >= 0.6 && (m.prevStun || 0) <= 0.05 && (p.lift || 0) < 1;
  m.prevStun = st;
  return started ? st : 0;
}

// peito do marcador (o braço de quem protege a bola encosta aqui)
function guardPoint(d) {
  return new THREE.Vector3(d.x, 22, toZ(d.y));
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
    this.courtObj = buildCourt(s, { street: !!game.street, paint: game.homeTeam && game.homeTeam.colors.dark, home: game.street ? null : game.homeTeam });
    this.camId = null; // ginásio novo: reaplica a câmera (arquibancada escondida etc.)
    this.camPos = this.camera.position.clone(); // a câmera de entrada/replay parte daqui (nunca indefinida)
    this.cinemaBlend = 0;
    this.blend = null;
    this.introShot = null;

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
    // reações: quem acertou comemora; quem errou leva as mãos à cabeça
    const shooterModel = () => {
      const s = this.ball && this.ball.shot;
      return s && s.shooter ? this.models.get(s.shooter) : null;
    };
    this.ball.on('scored', () => (this.netFlash = 0.6));
    // (no "scored" o jogo já entregou a bola para a reposição; quem arremessou ainda está no "rimIn")
    this.ball.on('rimIn', () => {
      const m = shooterModel();
      if (m) m.celebrate();
    });
    this.ball.on('rim', () => {
      const m = shooterModel();
      if (m) m.regret();
    });

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
    // visão de quadra: o jogo anda em câmera lenta, e as animações do 3D também
    const fdt = paused ? (g.huddle64 ? dt : 0) : dt * (g.visionOn ? VISION.timeScale : 1);
    // (64) tempo técnico: os times vão para a lateral e fazem a roda (com o jogo pausado)
    const hud = g.huddle64;
    if (hud) {
      if (hud.t == null) hud.t = 0;
      hud.t += dt;
    }
    if (this.hudRef !== hud) {
      this.hudRef = hud;
      this.hudFrom = new Map();
      this.hudShot = null;
    }

    const replay = g.state === 'replay' && g.replay ? g.replay.frames[Math.floor(g.replay.i)] : null;
    this.syncPlayers(g, replay, fdt, time);
    this.syncBall(g, replay, fdt);
    this.syncRings(g, time);
    this.syncCamera(g, fdt);
    this.syncCrowd(g, fdt, time);
    // telão: placar e cronômetro de posse
    if (this.courtObj.jumbo) {
      const sc = g.score || { home: 0, away: 0 };
      this.courtObj.jumbo.draw(g.homeTeam.name, g.awayTeam.name, sc.home, sc.away, Math.ceil(g.shotClock ?? 24));
    }
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
      const hp = !replay && g.huddle64 ? this.huddlePos(g, p, x, y) : null;
      if (hp) [x, y, vx, vy] = [hp.x, hp.y, hp.vx, hp.vy];
      this.prevPos.set(p, { x, y });
      const spd = Math.hypot(vx, vy / PLAYER.verticalFactor);
      let fx = hp ? hp.fx : p.facing.x;
      let fz = hp ? hp.fz : p.facing.y;
      if (replay && spd > 10) {
        fx = vx;
        fz = vy / PLAYER.verticalFactor;
      }
      // Voltando para a defesa (rápido e longe da bola): o jogo manda olhar para a bola, o que vira
      // uma corrida de costas esquisita. Como no 2K, ele vira e corre de frente; perto, volta a encarar.
      const ballD = Math.hypot(g.ball.x - x, g.ball.y - y);
      // (de costas OU de lado em velocidade: o passo lateral rápido parecia "pés parados")
      let backRun = false;
      if (!replay && g.offSide && p.team !== g.offSide && spd > 55 && ballD > 45) {
        const vz0 = vy / PLAYER.verticalFactor;
        const fl = Math.hypot(fx, fz) || 1;
        const ahead = (fx * vx + fz * vz0) / (fl * (Math.hypot(vx, vz0) || 1)); // 1 = correndo de frente
        if (ahead < 0.6 || ballD > 110) {
          backRun = true;
          fx = vx;
          fz = vz0;
        }
      }

      const b = g.ball;
      const holding = !replay && b.state === 'held' && b.holder === p && p.pose !== 'shoot';
      let dribble = null;
      let hold = false;
      // defensor com a pose de "braços para cima" (toco, contestação, pulo) não está arremessando
      const block = !replay && p.pose === 'shoot' && !!g.offSide && p.team !== g.offSide && b.holder !== p;
      let shoot = p.pose === 'shoot' && !block;
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
          // protegendo (LT): a bola vai para o lado do corpo oposto ao marcador
          let side = b.sideCur || 1;
          const dm = p.protect && g.defenderOf(p);
          if (dm) side = (dm.x - x) * Math.cos(yaw) - (dm.y - y) * Y_SCALE * Math.sin(yaw) > 0 ? -1 : 1;
          const ps = m.heightUnits / SIZE;
          let lx = side * 5.5 * ps; // para o lado (mão do drible)
          let lz = 3.2 * ps; // um pouco à frente
          let bh = Math.max(0, b.z - 2) * 1.05 * ps;
          // (64) entre as pernas / atrás das costas / snatch back: a bola cruza por baixo ou por trás
          const dmv = p.dribMove;
          const k = dmv ? (now - dmv.t0) / dmv.dur : 1;
          if (k >= 0 && k < 1) {
            const arc = Math.sin(Math.PI * k);
            const from = -side; // vem da mão de antes
            const mid = from + (side - from) * (k * k * (3 - 2 * k));
            if (dmv.kind === 'legs') {
              lx = mid * 5.5 * ps;
              lz = 3.2 * ps * (1 - arc); // passa no meio das pernas
              bh = Math.min(bh, 4 * ps) * (1 - 0.6 * arc);
            } else if (dmv.kind === 'behind') {
              lx = mid * 5.5 * ps;
              lz = 3.2 * ps - 8.5 * ps * arc; // por trás do quadril
              bh = Math.max(bh * (1 - arc), 9 * ps * arc);
            } else {
              lz = 3.2 * ps + 3 * ps * arc; // estica o braço e puxa a bola de volta
            }
          }
          dribble = { side: side >= 0 ? 1 : -1, z: b.z };
          // altura do quique proporcional ao tamanho do jogador (chão -> cintura)
          ballWorld = new THREE.Vector3(
            x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
            bh + BALL_R,
            toZ(y) - lx * Math.sin(yaw) + lz * Math.cos(yaw),
          );
          this.dribbleBall = ballWorld;
        }
      }
      if ((p.lunge > 0 || block || (p === g.user && g.userJumpT > 0)) && !replay) ballWorld = this.ballMesh.position.clone();
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
          defending: !replay && !hp && g.offSide && p.team !== g.offSide && g.state === 'live' && !backRun, // (correndo de volta: postura normal)
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
          // (64) estilo da finalização: two / 360 (enterrada) ou spin / floater... (bandeja)
          finishStyle: p.wantDunk || (b.shot && b.shot.shooter === p && b.shot.kind === 'dunk') ? p.dunkStyle : p.layupStyle,
          // (64) ameaça tripla, de costas, contato e jab: poses próprias
          triple: !replay && holding && p.triple > 0,
          post: !replay && holding && !!p.post,
          bump: !replay && now - (p.bumpAt ?? -1e9) < 280,
          protect: !replay && holding && !!p.protect,
          // (64) defesa: intensa, plantado (cavar falta), negando a linha (braço na linha do passe)
          intense: !replay && !!p.intenseD,
          planted: !replay && !!p.planted,
          denyWorld: !replay && p.denying && g.ball.holder ? guardPoint(g.ball.holder) : null,
          guardWorld: !replay && holding && p.protect && g.defenderOf(p) ? guardPoint(g.defenderOf(p)) : null,
          jab: !replay && now - (p.jabAt ?? -1e9) < 220 ? p.jabSide || 1 : 0,
          // (64) ankle breaker: o desequilíbrio forte (drible que quebra) derruba no chão
          fallStart: fallStart(m, p, replay),
          // rebote: você pulando (X) com a bola no ar -> as mãos vão nela
          reach: !replay && p === g.user && g.userJumpT > 0 && (b.state === 'loose' || b.state === 'shot'),
          block,
          // a bola acabou de sair da mão dele num passe
          passStart: !replay && b.state === 'pass' && this.prevBallState !== 'pass' && b.passFrom === p,
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
        // arremesso: a bola fica apoiada na mão do arremesso (a outra só encosta do lado)
        const c = shoot ? m.handsCenter().lerp(m.handPos(), 0.65) : m.handsCenter();
        if (shoot) c.y += BALL_R * 0.85;
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
    // (64) roubo na hora certa: a bola brilha quando está exposta para você
    const cue = !replay && g.stealCueOn && g.stealCueOn();
    this.ballMesh.material.emissive.setHex(cue ? 0x6a3a00 : 0x000000);
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
      // (64) takeover ativo: anel laranja pulsando
      const fire = g.tk64 && g.tk64.active > 0 && u === g.pg;
      if (fire) r.material.color.setHex(Math.floor(time / 120) % 2 ? 0xff8a2a : 0xffd04d);
      r.scale.setScalar(fire ? 1.15 + 0.1 * Math.sin(time / 90) : 1);
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
  // Entrada da partida (só no 64): voo pelo ginásio (2,6 s) e um close em cada titular da casa.
  introCamera(g, dt) {
    const T = 7.6 - g.stateT;
    const cz = toZ(MID_Y);
    let pos;
    let look;
    let shot;
    let shotStart;
    this.introCard = null;
    if (T < 2.6) {
      const a = -1.1 + T * 0.6;
      pos = new THREE.Vector3(240 + Math.sin(a) * 470, 230 - T * 30, cz + Math.cos(a) * 470);
      look = new THREE.Vector3(240, 30, cz);
      shot = -1;
      shotStart = 0;
    } else {
      const i = Math.min(4, Math.floor((T - 2.6) / 0.9));
      shot = i;
      shotStart = 2.6 + i * 0.9;
      const p = g.home[i] || g.home[0];
      const m = this.models.get(p);
      if (!m) return; // (ainda sem boneco: fica no plano anterior)
      const P = m.root.position;
      // na diagonal (o marcador fica bem na frente dele e taparia a câmera)
      const a = m.yaw - 0.75;
      const fwd = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      pos = P.clone().add(fwd.multiplyScalar(58)).add(new THREE.Vector3(0, m.heightUnits * 0.8, 0));
      look = P.clone().add(new THREE.Vector3(0, m.heightUnits * 0.62, 0));
      this.introCard = { name: p.info.name, role: p.role, cm: p.info.cm, nick: p.info.nick, color: g.homeTeam.colors.jersey };
    }
    // troca de plano: movimento com início e fim suaves e duração fixa (sem arrancada brusca)
    if (this.introShot !== shot) {
      this.introShot = shot;
      this.shotFrom = { pos: (shot === -1 ? pos : this.camPos).clone(), look: (shot === -1 ? look : this.look).clone() };
    }
    const dur = shot === 0 ? 0.6 : 0.4; // do voo para o 1º jogador, um pouco mais longo
    const u = Math.min(1, (T - shotStart) / dur);
    const e = u * u * (3 - 2 * u); // suave no começo e no fim
    this.camPos.copy(this.shotFrom.pos).lerp(pos, e);
    this.look.copy(this.shotFrom.look).lerp(look, e);
    this.camera.position.copy(this.camPos);
    this.cinemaBlend = 1; // ao voltar ao jogo, a câmera desliza daqui
    this.cinemaLook = this.look.clone();
    this.camera.lookAt(this.look);
    this.sun.position.set(this.look.x - 90, 320, this.look.z + 110);
    this.sun.target.position.copy(this.look);
  }

  // Replay de cinema: a cada replay um ângulo (atrás da cesta, girando em volta da bola, lateral baixa)
  replayCamera(g, dt) {
    if (this.replayRef !== g.replay) {
      this.replayRef = g.replay;
      this.replayShot = Math.floor(Math.random() * 3);
      this.replayT = 0;
      this.camPos = this.camera.position.clone();
    }
    this.replayT += dt;
    const b = this.ballMesh.position;
    const k = dt > 0 ? 1 - Math.exp(-4 * dt) : 1;
    const bk = g.basket || BASKET;
    const dir = bk.y > MID_Y ? -1 : 1;
    let pos;
    if (this.replayShot === 0) pos = new THREE.Vector3(bk.x + 20, 34, toZ(bk.y) - dir * 70); // atrás da cesta, baixo
    else if (this.replayShot === 1) {
      const a = this.replayT * 0.45;
      pos = new THREE.Vector3(b.x + Math.sin(a) * 120, 52, b.z + Math.cos(a) * 120); // girando em volta
    } else pos = new THREE.Vector3(b.x - 150, 30, b.z + 20); // lateral, bem baixo
    this.camPos.lerp(pos, k);
    this.look.lerp(new THREE.Vector3(b.x, Math.max(14, b.y * 0.8), b.z), k);
    this.camera.position.copy(this.camPos);
    this.cinemaBlend = 1; // ao voltar ao jogo, a câmera desliza daqui
    this.cinemaLook = this.look.clone();
    this.camera.lookAt(this.look);
    this.sun.position.set(this.look.x - 90, 320, this.look.z + 110);
    this.sun.target.position.copy(this.look);
  }

  // (64) roda do tempo técnico: cada time vai para a lateral esquerda, no seu lado da quadra,
  // e forma um círculo virado para dentro. Devolve posição/velocidade/direção do jogador.
  huddleCenter(team) {
    return { x: COURT.left + 30, y: MID_Y + (team === 'home' ? -62 : 62) };
  }
  huddlePos(g, p, x0, y0) {
    if (!this.hudFrom.has(p)) this.hudFrom.set(p, { x: x0, y: y0 });
    const from = this.hudFrom.get(p);
    const list = p.team === 'home' ? g.home : g.away;
    const i = Math.max(0, list.indexOf(p));
    const c = this.huddleCenter(p.team);
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 + (p.team === 'home' ? 0.4 : 0.9);
    const R = 13;
    const tx = c.x + Math.cos(a) * R;
    const ty = c.y + Math.sin(a) * R * PLAYER.verticalFactor;
    const dx = tx - from.x;
    const dy = ty - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const SPD = 115;
    const walked = Math.min(dist, SPD * Math.max(0, g.huddle64.t - 0.15 - i * 0.06));
    const arrived = walked >= dist - 0.5;
    const x = from.x + (dx / dist) * walked;
    const y = from.y + (dy / dist) * walked;
    const vx = arrived ? 0 : (dx / dist) * SPD;
    const vy = arrived ? 0 : (dy / dist) * SPD;
    // andando: olha para onde vai · na roda: para o centro
    const fx = arrived ? c.x - x : dx;
    const fz = arrived ? (c.y - y) / PLAYER.verticalFactor : dy / PLAYER.verticalFactor;
    return { x, y, vx, vy, fx, fz };
  }
  huddleCamera(g, dt) {
    const h = g.huddle64;
    const c = this.huddleCenter('home');
    const cz = toZ(c.y);
    const a = 0.35 + Math.sin(h.t * 0.25) * 0.18; // gira devagar em volta da roda
    const pos = new THREE.Vector3(c.x + Math.cos(a) * 125, 62, cz + Math.sin(a) * 125);
    const look = new THREE.Vector3(c.x, 18, cz);
    if (!this.hudShot) this.hudShot = { pos: this.camera.position.clone(), look: this.look.clone() };
    const u = Math.min(1, h.t / 1.3);
    const e = u * u * (3 - 2 * u);
    this.camPos = this.hudShot.pos.clone().lerp(pos, e);
    this.look.copy(this.hudShot.look.clone().lerp(look, e));
    this.camera.position.copy(this.camPos);
    this.cinemaBlend = 1; // ao voltar ao jogo, a câmera desliza daqui
    this.cinemaLook = this.look.clone();
    this.camera.lookAt(this.look);
    this.sun.position.set(this.look.x - 90, 320, this.look.z + 110);
    this.sun.target.position.copy(this.look);
  }
  // vinheta de TV do tempo técnico (entra deslizando da esquerda)
  drawHuddleCard(g, time) {
    const h = g.huddle64;
    if (!h || !h.card) return;
    const t = h.t - 0.5;
    if (t < 0) return;
    const c = this.ctx;
    const fs = Math.round(this.H / 11);
    const w = Math.round(this.W * 0.46);
    const u = Math.min(1, t / 0.45);
    const e = 1 - Math.pow(1 - u, 3);
    const x = Math.round(-w + (w + this.W * 0.05) * e);
    const y = Math.round(this.H * 0.6); // (embaixo: no topo fica o placar)
    const hh = fs * 2.5;
    const team = g.homeTeam;
    c.globalAlpha = 0.9;
    c.fillStyle = '#0a1120';
    c.fillRect(x, y, w, hh);
    c.globalAlpha = 1;
    c.fillStyle = team.colors.jersey;
    c.fillRect(x, y, Math.max(6, fs * 0.3), hh);
    c.fillStyle = team.colors.trim || '#ffffff';
    c.fillRect(x, y + hh - 4, w, 4);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = '#ffffff';
    c.font = `800 ${fs}px "Barlow Condensed", sans-serif`;
    c.fillText('TEMPO TECNICO', x + fs * 0.7, y + fs * 0.2);
    const sc = g.score || { home: 0, away: 0 };
    c.fillStyle = '#ffe14d';
    c.font = `600 ${Math.round(fs * 0.5)}px "Barlow Condensed", sans-serif`;
    const left = Math.max(0, (g.timeouts || 0) - 1);
    c.fillText(`${team.name.toUpperCase()}   ·   ${sc.home} X ${sc.away}   ·   RESTA${left === 1 ? '' : 'M'} ${left}`, x + fs * 0.7, y + fs * 1.45);
  }

  syncCamera(g, dt) {
    if (g.huddle64) return this.huddleCamera(g, dt);
    if (g.state === 'intro' && g.introLong && g.home) return this.introCamera(g, dt);
    this.introCard = null;
    if (g.state === 'replay' && g.replay && g.v64) return this.replayCamera(g, dt);
    this.replayRef = null;
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
    // saindo da entrada/replay: desliza da câmera de cinema até a de jogo (sem corte seco)
    // (duração fixa de 0,9 s, começo e fim suaves — posição e ponto de mira)
    if (this.cinemaBlend > 0) {
      this.cinemaBlend = 0;
      this.blend = { from: this.camPos.clone(), lookFrom: this.cinemaLook ? this.cinemaLook.clone() : this.look.clone(), t: 0 };
    }
    let lookAt = this.look;
    if (this.blend) {
      this.blend.t += dt;
      const u = Math.min(1, this.blend.t / 0.9);
      const e = u * u * (3 - 2 * u);
      this.camera.position.copy(this.blend.from.clone().lerp(this.camera.position, e));
      lookAt = this.blend.lookFrom.clone().lerp(this.look, e);
      if (u >= 1) this.blend = null;
    }
    this.camera.lookAt(lookAt);
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
    if (g.visionOn && g.user) this.drawVision(g, time);
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

    // (64) LB segurado: menu de companheiros (escolher -> ação)
    if (g.sel64) this.drawMateMenu(g, time);
    // ícones de passe (segure J): 1..4
    else if (g.icons) {
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

    // (64) barra do TAKEOVER embaixo do seu jogador (cheia: L3 + R3)
    const tk = g.tk64;
    if (tk && u && u === g.pg && tk.meter > 0.02 && live && g.state !== 'replay') {
      const s = this.project(u.x, u.y, -2);
      const W = 40;
      const x = Math.round(s.x - W / 2);
      const y = Math.round(s.y + 8);
      const full = tk.meter >= 1 || tk.active > 0;
      c.fillStyle = '#10101a';
      c.fillRect(x - 1, y - 1, W + 2, 6);
      c.fillStyle = full ? (Math.floor(time / 150) % 2 ? '#ff8a2a' : '#ffd04d') : '#ff8a2a';
      c.fillRect(x, y, Math.round(W * Math.min(1, tk.meter)), 4);
    }
    // (64) selo pequeno do TAKEOVER no canto, acima do gás: pronto (com o botão) ou ativo (contagem).
    // Nos primeiros 3 s depois de encher ele pisca forte — sem faixa no meio da tela.
    if (tk && u === g.pg && g.state !== 'replay' && (tk.active > 0 || tk.meter >= 1)) {
      const on = tk.active > 0;
      const fresh = !on && time - (tk.readyAt ?? -1e9) < 3000;
      const key = g.glyphMode === 'teclado' ? 'T' : 'L3 + R3';
      const lbl = on ? `TAKEOVER  ${Math.ceil(tk.active)}s` : `TAKEOVER PRONTO: ${key}`;
      c.font = `800 ${fresh ? 16 : 14}px "Barlow Condensed", sans-serif`;
      const tw = Math.round(c.measureText(lbl).width + 14);
      const px = Math.round(this.W * 0.01);
      const py = Math.round(this.H * 0.75);
      c.globalAlpha = 0.85;
      c.fillStyle = '#10101a';
      c.fillRect(px, py, tw, 20);
      c.globalAlpha = fresh ? 0.55 + 0.45 * Math.abs(Math.sin(time / 110)) : 1;
      c.fillStyle = '#ff8a2a';
      c.fillRect(px, py + 18, on ? Math.round(tw * Math.min(1, tk.active / 20)) : tw, 2);
      c.textAlign = 'left';
      c.fillStyle = on ? '#ffd04d' : '#ffb24d';
      c.fillText(lbl, px + 7, py + 10);
      c.textAlign = 'center';
      c.globalAlpha = 1;
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
    this.drawIntroCard();
    this.drawHuddleCard(g, time);
  }

  // Apresentação dos titulares: faixa de TV no canto de baixo
  drawIntroCard() {
    const ic = this.introCard;
    if (!ic) return;
    const c = this.ctx;
    const fs = Math.round(this.H / 14);
    const x = Math.round(this.W * 0.06);
    const y = Math.round(this.H * 0.62);
    const w = Math.round(this.W * 0.42);
    c.globalAlpha = 0.88;
    c.fillStyle = '#0a1120';
    c.fillRect(x, y, w, fs * 2.6);
    c.globalAlpha = 1;
    c.fillStyle = ic.color;
    c.fillRect(x, y, Math.max(4, fs * 0.25), fs * 2.6);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = '#ffffff';
    c.font = `800 ${fs}px "Barlow Condensed", sans-serif`;
    c.fillText(String(ic.name).toUpperCase(), x + fs * 0.6, y + fs * 0.25);
    c.fillStyle = '#ffe14d';
    c.font = `600 ${Math.round(fs * 0.6)}px "Barlow Condensed", sans-serif`;
    const pos = { PG: 'ARMADOR', SG: 'ALA-ARMADOR', SF: 'ALA', PF: 'ALA-PIVO', C: 'PIVO' }[ic.role] || ic.role;
    c.fillText(`${pos}  ·  ${(ic.cm / 100).toFixed(2).replace('.', ',')} M${ic.nick ? `  ·  "${String(ic.nick).toUpperCase()}"` : ''}`, x + fs * 0.6, y + fs * 1.5);
  }

  // Ícone de um botão de face (0=A/✕ 1=B/○ 2=X/□ 3=Y/△) no estilo escolhido (Xbox / PS / teclado)
  drawGlyph(x, y, face, r, mode) {
    const c = this.ctx;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (mode === 'teclado') {
      c.fillStyle = '#10101a';
      c.fillRect(x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2);
      c.fillStyle = '#ffe14d';
      c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.fillStyle = '#1a1222';
      c.font = `800 ${Math.round(r * 1.6)}px "Barlow Condensed", sans-serif`;
      c.fillText(String(face + 1), x, y + 1);
    } else if (mode === 'ps') {
      const col = ['#7fb2ff', '#ff6b6b', '#ff8fd0', '#5ee08a'][face];
      c.fillStyle = '#15171f';
      c.beginPath();
      c.arc(x, y, r + 1, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = Math.max(1.5, r * 0.25);
      const s = r * 0.5;
      c.beginPath();
      if (face === 0) {
        c.moveTo(x - s, y - s);
        c.lineTo(x + s, y + s);
        c.moveTo(x + s, y - s);
        c.lineTo(x - s, y + s);
      } else if (face === 1) c.arc(x, y, s, 0, Math.PI * 2);
      else if (face === 2) c.rect(x - s, y - s, 2 * s, 2 * s);
      else {
        c.moveTo(x, y - s * 1.1);
        c.lineTo(x + s, y + s * 0.8);
        c.lineTo(x - s, y + s * 0.8);
        c.closePath();
      }
      c.stroke();
    } else {
      const col = ['#3ddc5a', '#ff5a4d', '#3a8fff', '#ffd23d'][face];
      c.fillStyle = '#10101a';
      c.beginPath();
      c.arc(x, y, r + 1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = face === 3 ? '#1a1222' : '#ffffff';
      c.font = `800 ${Math.round(r * 1.4)}px "Barlow Condensed", sans-serif`;
      c.fillText('ABXY'[face], x, y + 1);
    }
    c.restore();
  }

  // LB segurado: botão sobre cada companheiro; escolhido um, o menu de ações sobre ele
  drawMateMenu(g, time) {
    const c = this.ctx;
    const sel = g.sel64;
    const mode = g.glyphMode || 'xbox';
    const r = Math.max(6, Math.round(this.H / 60));
    if (sel.stage === 'pick' || sel.stage === 'double') {
      for (let i = 0; i < 4; i++) {
        const p = g.home[i + 1];
        if (!p || p === g.user) continue;
        const s = this.project(p.x, p.y, this.headOf(p) + 12);
        // fora da tela: o ícone fica preso na borda (você ainda sabe quem é quem)
        const gx = Math.min(this.W - r - 3, Math.max(r + 3, s.x));
        const gy = Math.min(this.H - r - 3, Math.max(r + 3, s.y));
        this.drawGlyph(gx, gy + Math.sin(time / 160 + i) * 1.5, i, r, mode);
        if (sel.stage === 'double') {
          // defesa: LB + botão = esse colega dobra no homem da bola
          c.font = `800 ${Math.round(r * 1.1)}px "Barlow Condensed", sans-serif`;
          c.textAlign = 'center';
          c.fillStyle = '#ff9a4d';
          c.fillText('DOBRA', gx, gy + r * 2);
        }
      }
      return;
    }
    const p = sel.mate;
    const s = this.project(p.x, p.y, this.headOf(p) + 10);
    const rowH = r * 2.6;
    const w = r * 9;
    const h = rowH * 4 + r;
    // sempre dentro da tela
    const x0 = Math.round(Math.min(this.W - w - 4, Math.max(4, s.x - w / 2)));
    let y0 = Math.round(Math.min(this.H - h - 4, Math.max(4, s.y - h)));
    // na faixa do placar (topo), o menu vai para baixo dos pés dele
    const cv = document.querySelector('#game canvas');
    const rc = cv ? cv.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    const hudBottom = ((rc.top + rc.height * 0.13) / window.innerHeight) * this.H;
    if (y0 < hudBottom) y0 = Math.round(Math.min(this.H - h - 4, this.project(p.x, p.y, 0).y + r));
    c.globalAlpha = 0.9;
    c.fillStyle = '#0a1120';
    c.fillRect(x0, y0, w, h);
    c.globalAlpha = 1;
    c.fillStyle = '#ffe14d';
    c.fillRect(x0, y0, w, 2);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.font = `800 ${Math.round(r * 1.25)}px "Barlow Condensed", sans-serif`;
    MATE_ACTIONS.forEach((a, k) => {
      const yy = y0 + r * 0.5 + rowH * k + rowH / 2;
      this.drawGlyph(x0 + r * 1.6, yy, k, r * 0.85, mode);
      c.fillStyle = '#ffffff';
      c.fillText(a.label, x0 + r * 3.2, yy + 1);
    });
  }

  // Visão de quadra (LB segurado): linhas de passe até cada companheiro e quem nega a linha.
  //   verde = livre · amarelo = marcado · vermelho = linha arriscada (interceptação)
  drawVision(g, time) {
    const c = this.ctx;
    const u = g.user;
    // a tela escurece um pouco: você está "pausando para ler"
    c.fillStyle = 'rgba(6,12,28,0.22)';
    c.fillRect(0, 0, this.W, this.H);
    const from = this.project(u.x, u.y, this.headOf(u) * 0.62);
    for (const t of g.offTeam || []) {
      if (t === u) continue;
      const risk = g.laneRisk(u, t);
      const open = g.nearestDefenderDist(t);
      const col = risk < 9 ? '#ff5a4d' : open >= OFFENSE.openDist ? '#6dff6d' : '#ffe14d';
      const to = this.project(t.x, t.y, this.headOf(t) * 0.62);
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(to.x, to.y);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.arc(to.x, to.y, 4 + Math.abs(Math.sin(time / 200)) * 1.5, 0, Math.PI * 2);
      c.fill();
    }
    // defensores negando a linha de passe: marca laranja sobre a cabeça
    for (const d of g.defTeam || []) {
      if (!d.denying) continue;
      const s = this.project(d.x, d.y, this.headOf(d) + 6);
      c.fillStyle = '#ff9a4d';
      c.fillRect(s.x - 2, s.y - 6, 4, 8);
    }
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
