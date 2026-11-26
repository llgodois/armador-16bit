import Phaser from 'phaser';
import {
  BALL, BASKET, BASKET_BOTTOM, COURT, CROSSOVER, DEBUG, GAME, HEIGHT, LAYUP, MID_Y, OFFENSE, PASS, PLAYER, SHOT,
  STAMINA, USER_DEFENSE, DEFENSE, WORLD, FOUL, FT, DIFFICULTY, MODES, READ, VISION, GRADE, THREE, Y_SCALE, REBOUND, COURT_OUT,
} from '../config.js';
import { readOf, letterGrade, COUNTERS } from '../data/reads.js';
import { addHoops, heightPixels, playerTexKey, legendTexKey } from '../art/sprites.js';
import { legendById } from '../data/legends.js';
import { makeSkills, SHOT_PROFILES } from '../game/skills.js';
import { benchOf } from '../data/teams.js';
import { generatePlayerTexture } from '../art/sprites.js';
import { BADGES } from '../data/badges.js';
import { LESSONS, CHALLENGES, MECHANICS, saveResult } from '../data/training.js';
import { loadControls } from '../data/keys.js';
import Commentary from '../game/commentary.js';
import Contest from '../game/contest.js';
import { DEF_SCHEMES, schemeById } from '../data/defense.js';
import { POS, ratingMult, teamById } from '../data/teams.js';
import { buildById } from '../data/builds.js';
import Player from '../entities/Player.js';
import Ball from '../entities/Ball.js';
import DefenseAI from '../ai/DefenseAI.js';
import OffenseAI from '../ai/OffenseAI.js';
import { BASE_SLOTS, SLOTS, createPlay, PLAY_LIBRARY, playbookFor, PLAYS_PER_PAGE } from '../plays/index.js';
import PixelText from '../ui/PixelText.js';
import { sfx } from '../audio/sfx.js';
import {
  onUserCatch, userOffense64, driveContact, windowMult, wantsPost, onOffensiveRebound,
  handContest, stealTiming, stealCue, blockingFoul, reachZ64, tipOut, remapButtons64,
} from '../game/mech64.js';
import {
  clamp, closestOnSegment, courtDist, curve, distToBasket, inBackcourt, isLayupZone, isThree, lerp, rand,
  toWorld as toWorldDir,
} from '../utils/math.js';

const JustDown = Phaser.Input.Keyboard.JustDown;
const JustUp = Phaser.Input.Keyboard.JustUp;
const NUM_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

// Jogo contínuo em quadra inteira. Casa ataca a cesta de cima, visitante a de baixo.
// Estados: intro -> live -> final. Depois de cesta há uma reposição curta (this.inbound).
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(data) {
    const setup = data && data.home ? data : this.registry.get('setup') || { home: 'ondas', away: 'astros', build: 'chutador' };
    this.registry.set('setup', setup);
    this.homeTeam = teamById(setup.home);
    // competitivo: sempre contra o Chicago Bulls 96 (mesmo adversário para todo mundo no ranking)
    this.awayTeam = teamById(setup.survival ? 'touros96' : setup.away);
    // Franquia: elencos montados pelo dono do time (trocas, draft, evolução)
    if (setup.roster) this.homeTeam = { ...this.homeTeam, players: setup.roster, bench: setup.bench };
    if (setup.awayRoster) this.awayTeam = { ...this.awayTeam, players: setup.awayRoster, bench: undefined };
    this.franchise = !!setup.franchise;
    this.build = buildById(setup.build);
    // armador: personagem da carreira, uma lenda ou o do time
    this.legend = setup.customPG || legendById(setup.legend);
    this.training = setup.training ? LESSONS.find((l) => l.id === setup.training) || MECHANICS.find((l) => l.id === setup.training) : null;
    this.mechDone = false;
    // insígnias: carreira (ponto de evolução) e franquia (títulos) começam com o medidor mais cheio
    this.badgeMeter = ((setup.customPG && setup.customPG.badge) || 0) * 1.5 + (setup.franchiseBadge || 0);
    this.badgeLvl = Math.min(4, Math.floor(this.badgeMeter / 3));
    this.zoneBonus = (setup.customPG && setup.customPG.zone) || 0;
    this.challenge = setup.challenge ? CHALLENGES.find((c) => c.id === setup.challenge) : null;
    this.careerGame = setup.career || null; // { plan: { plays, defense }, vis }
    this.visionStat = setup.customPG ? setup.customPG.vis || 60 : 0;
    this.box = new Map();
    this.shotLog = [];
    this.replayBuf = [];
    this.decisions = [];
    this.difficulty = DIFFICULTY[setup.diff] || DIFFICULTY.normal;
    this.mode = MODES[setup.mode] ? setup.mode : 'pontos';
    this.gameClock = this.mode === 'tempo' ? MODES.tempo.seconds : 0;
    this.suddenDeath = false;
    this.userScheme = DEF_SCHEMES[0];
    this.oppScheme = DEF_SCHEMES[0];
    this.oppDefPoss = 0;
    this.teamFouls = { home: 0, away: 0 };
    this.ft = null;
    this.prevBtn = {};
    this.vision = 100;
    this.visionOn = false;
    this.grade = GRADE.start;
    this.iq = { good: 0, bad: 0 };
    this.readBuff = null;
    this.oppDisguise = null;

    // a cena é reaproveitada entre partidas: zera tudo que não é recriado abaixo
    Object.assign(this, {
      contestCtl: null, replay: null, pendingEnd: false, lessonHold: false, lessonFired: false, lessonPassing: false, trainRead: false, userStreak: 0, lastPass: null,
      combo: 0, lastCross: 0, lastUserPlay: null, stepBack: 0, play: null, inbound: null, pendingShot: null, recTick: 0,
    });
    this.street = !!setup.street;
    // TREINO LIVRE: { mode: 'shots'|'1x1'|'2x2'|'3x3'|'5x5', play: índice da jogada ou null }
    this.practice = setup.practice || null;
    this.prac = { poss: 0, scored: 0, pts: 0, playTry: 0, playMade: 0, possPts: 0, playThis: false };
    // COMPETITIVO (Sobrevivência): só posses de ataque, 3 vidas
    this.survival = !!setup.survival;
    this.lives = 3;
    this.survStreak = 0; // (só no 64) sequência do estilo do armador que devolve vida
    this.survBonus = 0; // (só no 64) pontos de ranking do desafio de estilo
    this.styleChallenge = false;
    this.possAssist = false;
    this.survPoss = 0;
    this.survOk = 0;
    this.possPts = 0;
    // competitivo: sempre no DIFÍCIL (igual para todo mundo no ranking)
    if (this.survival) this.difficulty = { ...DIFFICULTY.dificil };
    this.contest = setup.contest || null; // 'three' | 'dunk' (fim de semana das estrelas)
    this.narrator = new Commentary(this);
    sfx.music('game');
    // Rua 3x3: meia quadra de asfalto com alambrado e uma cesta só (rede de corrente)
    this.add.image(0, 0, this.street ? 'court_street' : 'court').setOrigin(0).setDepth(0);
    this.nets = addHoops(this, { single: this.street });

    // há espaço FORA das linhas (reposição de fora de verdade)
    const O = COURT_OUT;
    if (this.street) this.physics.world.setBounds(COURT.left - O, COURT.top - O, COURT.right - COURT.left + 2 * O, MID_Y - 8 - (COURT.top - O));
    else this.physics.world.setBounds(COURT.left - O, COURT.top - O, COURT.right - COURT.left + 2 * O, COURT.bottom - COURT.top + 2 * O);
    this.bodies = this.physics.add.group();
    this.profile = SHOT_PROFILES[setup.profile] || SHOT_PROFILES.normal;
    // Uniforme alternativo (claro) para o visitante se as cores forem parecidas
    const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
    const [a, b2] = [hex(this.homeTeam.colors.jersey), hex(this.awayTeam.colors.jersey)];
    const close = Math.hypot(a[0] - b2[0], a[1] - b2[1], a[2] - b2[2]) < 110;
    this.awayColors = close
      ? { jersey: '#eeeeee', dark: '#bdbdbd', trim: this.awayTeam.colors.jersey, shorts: '#e2e2e2', shoes: this.awayTeam.colors.shoes }
      : this.awayTeam.colors;
    this.texFor = (side, team, info, i, bench = false) => {
      const alt = side === 'away' && close;
      if (!bench && !alt && !info.fr) return playerTexKey(team.id, i);
      const key = info.fr ? `fr_${info.fr}_${team.id}${alt ? '_alt' : ''}` : `${bench ? 'b' : 'p'}_${team.id}_${i}${alt ? '_alt' : ''}`;
      if (!this.textures.exists(key)) generatePlayerTexture(this, key, side === 'away' ? this.awayColors : team.colors, info.cm, info.skin ?? i * 3 + 1, info.hair ?? i + 2);
      return key;
    };
    const mk = (side, team, i, build) => {
      // seu armador pode ser uma lenda (vestindo o uniforme do seu time)
      const useLegend = side === 'home' && i === 0 && this.legend;
      const info = useLegend ? this.legend : team.players[i];
      const p = new Player(this, this.bodies, BASKET.x, MID_Y, {
        team: side,
        role: POS[i],
        index: i,
        texKey: useLegend ? legendTexKey(this, this.legend, team) : this.texFor(side, team, info, i),
        skills: makeSkills(info, build, side === 'home' && i === 0 ? this.profile : null),
        info,
        hp: heightPixels(info.cm),
      });
      p.energy = 100;
      p.heat = 0;
      p.baseSpeed = p.speed;
      return p;
    };
    this.home = POS.map((_, i) => mk('home', this.homeTeam, i, i === 0 ? this.build : null));
    this.away = POS.map((_, i) => mk('away', this.awayTeam, i, null));
    // Rua 3x3: só armador, ala e pivô em quadra
    // (treino livre: só arremessos = você sozinho; 1x1, 2x2, 3x3 ou 5x5)
    const KEEP = { shots: [[0], []], '1x1': [[0], [0]], '2x2': [[0, 4], [0, 4]], '3x3': [[0, 2, 4], [0, 2, 4]] };
    const keepSets = this.street ? [[0, 2, 4], [0, 2, 4]] : this.practice ? KEEP[this.practice.mode] : null;
    if (keepSets) {
      const [kh, ka] = keepSets;
      for (const p of this.home) if (!kh.includes(p.index)) [p.sprite, p.shadow, p.zone].forEach((o) => o.destroy());
      for (const p of this.away) if (!ka.includes(p.index)) [p.sprite, p.shadow, p.zone].forEach((o) => o.destroy());
      this.home = this.home.filter((p) => kh.includes(p.index));
      this.away = this.away.filter((p) => ka.includes(p.index));
    }
    // Banco de reservas (um por posição) com energia própria
    this.bench = {
      home: benchOf(this.homeTeam).map((info) => ({ info, energy: 100 })),
      away: benchOf(this.awayTeam).map((info) => ({ info, energy: 100 })),
    };
    // Estatísticas para o tempo técnico e ajustes escolhidos
    this.track = { userPoss: 0, doubledUser: 0, schemes: {}, plays: {}, oppPts: 0, homePts: 0 };
    this.adj = {};
    this.timeouts = 2;
    this.champ = !!setup.champ;
    this.oppFav = setup.oppFav || null;
    if (this.oppFav) this.oppScheme = schemeById(this.oppFav);
    if (this.careerGame && this.careerGame.plan) this.userScheme = schemeById(this.careerGame.plan.defense);
    this.autoSubHome = true;
    this.all = [...this.home, ...this.away];
    this.pg = this.home[0];
    for (const p of this.all) this.boxOf(p); // box score com todos os titulares
    this.physics.add.collider(this.bodies, this.bodies);

    this.ball = new Ball(this);
    this.wireBallEvents();
    this.defenseAI = new DefenseAI(this);
    this.offenseAI = new OffenseAI(this);

    // Indicadores
    this.ring = this.add.image(0, 0, 'ring').setDepth(2);
    this.targetMarker = this.add.image(0, 0, 'target').setDepth(3000).setVisible(false);
    // jogada sem bola: para onde VOCÊ deve correr (anel azul no chão)
    this.runMarker = this.add.image(0, 0, 'ring').setDepth(2).setTint(0x3ad6ff).setScale(1.4).setVisible(false);
    // setas da jogada chamada (rotas de cada um, bloqueios e o seu caminho)
    this.playG = this.add.graphics().setDepth(1.6);
    // playbook do jogo: jogadas de franquia do time primeiro, em páginas de 9
    this.playbook = playbookFor(this.homeTeam);
    this.oppPlaybook = playbookFor(this.awayTeam);
    this.playPage = 0;
    this.dots = this.all.map(() => this.add.image(0, 0, 'dot').setDepth(3000).setVisible(false));
    this.icons = this.home.slice(1).map((p, i) => ({
      bg: this.add.image(0, 0, 'icon').setDepth(3002).setVisible(false),
      num: this.add.bitmapText(0, 0, 'pixel', String(i + 1)).setTint(0x1a1222).setOrigin(0.5).setDepth(3003).setVisible(false),
      p,
    }));
    this.meter = this.add.graphics().setDepth(3001);
    this.visionG = this.add.graphics().setDepth(2999);
    // replay: título, análise da decisão e anel na melhor opção
    this.replayTitle = new PixelText(this, 240, 34, '', { origin: [0.5, 0], color: 0xffe14d, depth: 6000, scroll: 0 }).setVisible(false);
    this.replayInfo = [0, 1].map((i) => new PixelText(this, 240, 200 + i * 12, '', { origin: [0.5, 0], depth: 6000, scroll: 0 }).setVisible(false));
    this.replayRing = this.add.image(0, 0, 'ring').setTint(0x6dff6d).setDepth(5).setScale(1.5).setVisible(false);

    // teclas fixas + ações personalizáveis (Título -> Controles -> Personalizar)
    this.ctl = loadControls();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,P,ESC,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE');
    for (const [a, keyName] of Object.entries(this.ctl.keys)) this.keys[a] = this.input.keyboard.addKey(keyName);
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,TAB');
    // ícones mostram números (teclado) ou A/B/X/Y (controle), conforme o que você usou por último
    this.lastInputPad = false;
    this.input.keyboard.on('keydown', () => (this.lastInputPad = false));
    this.events.on('resume', () => {
      this.input.keyboard.resetKeys();
      // botões do controle que fecharam o menu não viram ação no jogo
      const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
      if (gp) {
        this.prevRaw = {};
        gp.buttons.forEach((b, i) => (this.prevRaw[i] = b.pressed));
        for (const k of Object.keys(this.prevBtn)) this.prevBtn[k] = true;
      }
    });

    const cam = this.cameras.main;
    // a câmera passa um pouco das bordas: no canto/linha de fundo o placar não tapa você nem o medidor
    const CAM_PAD = 30;
    cam.setBounds(0, -CAM_PAD, WORLD.W, (this.street ? MID_Y + 16 : WORLD.H) + 2 * CAM_PAD);
    cam.setRoundPixels(true);
    if (DEBUG.physics) this.physics.world.createDebugGraphic();

    this.score = this.challenge && this.challenge.start ? { ...this.challenge.start } : { home: 0, away: 0 };
    this.stats = { pts: 0, ast: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, stl: 0, blk: 0 };
    this.stamina = STAMINA.max;
    this.user = this.pg;
    this.pg.body.mass = PLAYER.userMass;
    // A câmera segue um ponto entre você e a bola (puxado para a cesta atacada)
    this.camTarget = this.add.zone(this.pg.x, this.pg.y, 1, 1);
    cam.startFollow(this.camTarget, true, 0.08, 0.08);

    this.scene.launch('HUD', { game: this });
    this.events.once('shutdown', () => {
      this.ball.removeAllListeners();
      this.scene.stop('HUD');
      this.scene.stop('Menu');
    });

    // Bola ao alto: começa com a casa no meio da quadra
    this.setOffense('home');
    // (na rua começa com a bola checada no topo do garrafão, fora do arco)
    this.pg.setPosition(BASKET.x, this.street ? BASKET.y + THREE.ry + 50 : MID_Y + 14);
    this.pg.facing.set(0, -1);
    for (const p of this.home.slice(1)) {
      const s = SLOTS[BASE_SLOTS[p.role]];
      p.setPosition(s.x, this.street ? s.y : lerp(s.y, MID_Y - 20, 0.35));
    }
    this.defenseAI.reset(false);
    this.ball.give(this.pg);
    this.state = 'intro';
    this.stateT = GAME.introTime;
    // (só no 64) entrada da partida: câmera pelo ginásio e apresentação dos titulares (A/X pula)
    this.introLong = !!(this.v64 && !this.training && !this.practice && !this.contest && !this.survival && !this.challenge && !this.street);
    if (this.introLong) this.stateT = 7.6;
    this.introArmed = false; // (64) pular só depois de soltar o botão que iniciou a partida
    cam.centerOn(this.pg.x, this.pg.y - 24);
    this.events.emit('banner', `${this.homeTeam.name} x ${this.awayTeam.name}`, this.street ? 'Rua 3x3 - primeiro a 21' : `Primeiro a ${GAME.targetScore} vence`, 0xffe14d, GAME.introTime);
    sfx.play('whistle');
    // lição de mecânica na DEFESA: começa com a bola do adversário
    this.lessonTries = 1;
    if (this.practice) {
      this.queuePracticePlay(GAME.introTime * 1000 + 300);
      const names = { shots: 'Treino de arremessos', '1x1': 'Treino 1 contra 1', '2x2': 'Treino 2 contra 2', '3x3': 'Treino 3 contra 3', '5x5': 'Treino 5 contra 5' };
      this.time.delayedCall(200, () => this.events.emit('banner', names[this.practice.mode], 'Sem placar e sem fim - ESC para sair', 0x6dff6d, 1.4));
    }
    if (this.training && this.training.def) this.resetDefLesson();
    if (this.training) this.time.delayedCall(300, () => this.events.emit('toast', this.training.tip, 0x6fa0ff));
    if (this.contest) {
      this.contestCtl = new Contest(this, this.contest);
      this.contestCtl.start();
    }
  }

  // ------------------------------------------------------------------ utilidades usadas pela IA
  toWorld(p) {
    return toWorldDir(p, this.dir);
  }
  slot(name) {
    return toWorldDir(SLOTS[name], this.dir);
  }
  defenderOf(p) {
    return this.defenseAI.defenderOf(p);
  }
  opponentsOf(p) {
    return p.team === 'home' ? this.away : this.home;
  }
  nearestDefender(p) {
    let best = null;
    let bd = Infinity;
    for (const d of this.opponentsOf(p)) {
      if (d.stun > 0) continue;
      const dd = courtDist(d, p);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return { d: best, dist: bd };
  }
  nearestDefenderDist(p) {
    return this.nearestDefender(p).dist;
  }
  laneRisk(from, to) {
    let best = Infinity;
    for (const d of this.opponentsOf(from)) {
      if (d.stun > 0) continue;
      const c = closestOnSegment(d, from, to);
      if (c.t > 0.1 && c.t < 0.92) best = Math.min(best, c.d);
    }
    return best;
  }
  // Esquema defensivo do time que está defendendo.
  defScheme() {
    if (this.defTeam === this.home) return this.userScheme;
    return this.oppDisguise ? this.oppDisguise.show : this.oppScheme;
  }

  // ------------------------------------------------------------------ estatísticas por jogador
  boxOf(p) {
    let b = this.box.get(p.info);
    if (!b) {
      b = { name: p.info.name, team: p.team, pos: p.role, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0 };
      this.box.set(p.info, b);
    }
    return b;
  }

  // Registro de arremesso (box score, mapa de arremessos, decisão para o replay).
  logShot(p, made, three) {
    this.boxOf(p).fga++;
    if (p === this.pg) {
      const c = toWorldDir({ x: p.x, y: p.y }, this.dir);
      this.shotLog.push({ x: c.x, y: c.y, made, three });
      this.markDecision(`arremesso (${three ? '3' : '2'} pts)`, this.nearestDefenderDist(p) >= OFFENSE.openDist);
    }
  }

  // ------------------------------------------------------------------ replay com análise
  // Guarda as decisões do armador para o replay apontar a melhor opção daquele momento.
  markDecision(took, good) {
    let best = null;
    let bo = -1;
    for (const t of this.offTeam) {
      if (t === this.pg) continue;
      const o = this.nearestDefenderDist(t);
      if (o > bo && this.laneRisk(this.pg, t) > 10) {
        bo = o;
        best = t;
      }
    }
    this.decisions.push({ frame: this.replayBuf.length - 1, took, good, best: best ? this.all.indexOf(best) : -1, bestName: best ? `${best.role} ${this.shortName(best)}` : '-', bestOpen: Math.round(bo) });
    if (this.decisions.length > 20) this.decisions.shift();
  }

  recordFrame() {
    if ((this.recTick = (this.recTick || 0) + 1) % 2) return;
    const f = {
      p: this.all.map((p) => [p.x, p.y, p.sprite.frame.name, p.sprite.flipX, p.lift]),
      b: [this.ball.x, this.ball.y, this.ball.z],
    };
    this.replayBuf.push(f);
    if (this.replayBuf.length > 150) {
      this.replayBuf.shift();
      for (const d of this.decisions) d.frame--;
    }
  }

  startReplay() {
    if (this.replayBuf.length < 20) return;
    const frames = this.replayBuf.slice();
    const dec = this.decisions.filter((d) => d.frame >= 0 && d.frame < frames.length).pop() || null;
    for (const p of this.all) p.stop();
    this.replay = { frames, i: 0, prev: this.state, dec, freeze: 0, shown: false };
    this.state = 'replay';
    this.replayTitle.setText('REPLAY  (R SAIR)').setVisible(true);
  }

  updateReplay(dt) {
    const r = this.replay;
    if (this.btn.PAUSE.just || this.btn.REPLAY.just || r.i >= r.frames.length - 1) {
      this.state = r.prev;
      this.replay = null;
      this.replayTitle.setVisible(false);
      this.replayInfo.forEach((t) => t.setVisible(false));
      this.replayRing.setVisible(false);
      this.ball.render();
      return;
    }
    const f = r.frames[Math.floor(r.i)];
    this.all.forEach((p, k) => {
      const [x, y, fr, flip, lift] = f.p[k];
      p.sprite.anims.stop();
      p.sprite.setFrame(fr).setFlipX(flip).setPosition(Math.round(x), Math.round(y + 1 - lift)).setDepth(y);
      p.shadow.setPosition(Math.round(x), Math.round(y));
    });
    this.ball.sprite.setPosition(Math.round(f.b[0]), Math.round(f.b[1] - f.b[2] - 3));
    this.ball.shadow.setPosition(Math.round(f.b[0]), Math.round(f.b[1]));
    this.camTarget.setPosition(f.b[0], f.b[1] - 20);
    // Análise: para no momento da sua decisão e mostra a melhor opção
    if (r.dec && !r.shown && Math.floor(r.i) >= r.dec.frame) {
      r.shown = true;
      r.freeze = 2.2;
      const d = r.dec;
      this.replayInfo[0].setText(`SUA DECISAO: ${d.took}`).setColor(d.good ? 0x6dff6d : 0xff7b6b).setVisible(true);
      this.replayInfo[1].setText(d.best >= 0 ? `MELHOR OPCAO: ${d.bestName} (LIVRE ${d.bestOpen})` : 'SEM OPCAO MELHOR').setVisible(true);
      if (d.best >= 0) {
        const [bx, by] = f.p[d.best];
        this.replayRing.setPosition(Math.round(bx), Math.round(by)).setVisible(true);
      }
    }
    if (r.freeze > 0) {
      r.freeze -= dt;
      return;
    }
    r.i += 0.45; // câmera lenta
  }

  // ------------------------------------------------------------------ treino (1 posse)
  endTraining(scored) {
    if (this.state === 'done') return;
    this.state = 'done';
    const lesson = this.training;
    if (lesson.mech) {
      // lição de mecânica: ** fez o movimento + * cesta (ou, na defesa, parou o ataque)
      const stars2 = (this.mechDone ? 2 : 0) + (scored ? 1 : 0);
      saveResult(lesson.id, stars2);
      const lines2 = [`${this.mechDone ? '**' : '..'} FEZ: ${lesson.mech.toUpperCase()}`, `${scored ? '*' : '.'} ${lesson.def ? 'PAROU O ATAQUE' : 'CESTA'}`];
      this.events.emit('banner', this.mechDone ? 'Mandou bem!' : 'Tente de novo', `${stars2} de 3 estrelas`, this.mechDone ? 0x6dff6d : 0xff9a4d, 1.4);
      this.time.delayedCall(1500, () => {
        this.scene.stop('HUD');
        this.scene.start('Training', { tab: 'mechanics', result: { ok: this.mechDone, title: `${stars2} ESTRELA${stars2 === 1 ? '' : 'S'}`, lines: lines2 } });
      });
      return;
    }
    const stars = (scored ? 1 : 0) + (this.trainRead ? 1 : 0) + (this.iq.good > this.iq.bad ? 1 : 0);
    saveResult(lesson.id, stars);
    const lines = [
      `${scored ? '*' : '.'} CESTA`,
      `${this.trainRead ? '*' : '.'} JOGADA CERTA PARA A DEFESA`,
      `${this.iq.good > this.iq.bad ? '*' : '.'} BOAS DECISOES (QI)`,
    ];
    this.events.emit('banner', stars >= 2 ? 'Boa leitura!' : 'Tente de novo', `${stars} de 3 estrelas`, stars >= 2 ? 0x6dff6d : 0xff9a4d, 1.4);
    this.time.delayedCall(1500, () => {
      this.scene.stop('HUD');
      this.scene.start('Training', { tab: 'lessons', result: { ok: stars > 0, title: `${stars} ESTRELA${stars === 1 ? '' : 'S'}`, lines } });
    });
  }

  // ------------------------------------------------------------------ TREINO LIVRE
  // Posses sem fim: errou, perdeu a bola ou fez a cesta -> nova posse com você no topo.
  // Só arremessos: a bola volta para você onde você estiver.
  updatePractice() {
    const pr = this.prac;
    const st = this.stats;
    const pct = st.fga ? Math.round((st.fgm / st.fga) * 100) : 0;
    const hasPlay = this.practice.play !== null && this.practice.play !== undefined;
    const playTxt = hasPlay ? `   JOGADA ${pr.playMade}/${pr.playTry}` : '';
    this.events.emit('contestHud', this.practice.mode === 'shots'
      ? `ACERTOS ${st.fgm}/${st.fga} (${pct}%)   DE 3: ${st.tpm}/${st.tpa}`
      : `POSSES ${pr.poss}   PONTOS ${pr.pts}   SEUS ARREMESSOS ${st.fgm}/${st.fga}${playTxt}`);
    if (this.practice.mode === 'shots') {
      const b = this.ball;
      if ((b.state === 'loose' || b.state === 'dead') && !this.pendingShot && !this.pracReturn) {
        this.pracReturn = true;
        this.time.delayedCall(500, () => {
          this.pracReturn = false;
          if (this.state === 'live' && (this.ball.state === 'loose' || this.ball.state === 'dead')) {
            this.ball.give(this.pg);
            this.prac.poss++;
          }
        });
      }
      return;
    }
    // a defesa pegou a bola: a posse acabou sem ponto
    if (this.offSide === 'away') this.endPracticePossession('Defesa pegou a bola');
  }

  endPracticePossession(why = null) {
    const pr = this.prac;
    if (this.practice.mode === 'shots') {
      this.setOffense('home');
      this.ball.give(this.pg);
      return;
    }
    pr.poss++;
    pr.pts += pr.possPts;
    if (pr.possPts > 0) pr.scored++;
    if (pr.playThis) {
      pr.playTry++;
      if (pr.possPts > 0) pr.playMade++;
    }
    if (why && pr.possPts === 0) this.events.emit('toast', why, 0xb8b0d0);
    pr.possPts = 0;
    pr.playThis = false;
    this.pendingShot = null;
    this.ft = null;
    this.inbound = null;
    this.setOffense('home');
    // todos voltam às posições: você no topo com a bola, cada defensor no seu homem
    this.pg.setPosition(BASKET.x, BASKET.y + THREE.ry + 50);
    for (const p of this.home) {
      p.stop();
      if (p === this.pg) continue;
      const sp = SLOTS[BASE_SLOTS[p.role]];
      p.setPosition(sp.x, sp.y);
    }
    this.defenseAI.reset(false);
    for (const d of this.away) {
      d.stop();
      const m = this.defenseAI.manOf(d);
      if (m) d.setPosition(m.x + (BASKET.x - m.x) * 0.15, m.y + (BASKET.y - m.y) * 0.15);
    }
    this.ball.give(this.pg);
    this.state = 'intro';
    this.stateT = 0.6;
    this.queuePracticePlay(700);
  }

  // jogada para aprimorar: chamada sozinha no começo de cada posse
  queuePracticePlay(ms) {
    if (this.practice.play === null || this.practice.play === undefined) return;
    this.time.delayedCall(ms, () => {
      if (this.state === 'live' && this.offSide === 'home') {
        this.callPlay(this.practice.play);
        this.prac.playThis = true;
      }
    });
  }

  // ------------------------------------------------------------------ lições de DEFESA: o jogo monta a situação
  // O ataque espera parado; aí o seu homem arremessa (mão alta), infiltra em você (falta de ataque)
  // ou um colega dele chuta (box out). Sem o movimento, a lição recomeça (até 3 tentativas).
  resetDefLesson() {
    this.pendingShot = null;
    this.setOffense('away');
    for (const p of this.away) {
      const sp = this.slot(BASE_SLOTS[p.role]);
      p.setPosition(sp.x, sp.y);
      p.stop();
      p.drive = null;
    }
    this.ball.give(this.away[0]);
    this.defenseAI.reset(false);
    const B = this.basket;
    for (const d of this.home) {
      d.stop();
      const m = this.defenseAI.manOf(d);
      if (m) d.setPosition(m.x + (B.x - m.x) * 0.15, m.y + (B.y - m.y) * 0.15);
    }
    this.lessonT = 0;
    this.lessonFired = false;
    this.lessonHold = true; // o ataque não decide nada até a situação ser montada
  }

  retryDefLesson() {
    this.lessonTries++;
    this.events.emit('toast', `DE NOVO! TENTATIVA ${this.lessonTries}/3 - ${this.training.tip}`, 0xff9a4d);
    this.resetDefLesson();
  }

  updateDefLesson(dt) {
    if (this.offSide !== 'away') return;
    this.lessonT = (this.lessonT || 0) + dt;
    const id = this.training.id;
    const u = this.user;
    const man = this.defenseAI.manOf(u);
    const b = this.ball;
    if (!man || this.lessonFired || this.lessonT < 1.2) return;
    const B = this.basket;
    if (id === 'm_troca') {
      this.lessonFired = true;
      this.lessonHold = false;
      return;
    }
    // a bola precisa estar com o seu homem (mão alta / falta de ataque) ou com outro (box out)
    const wantHolder = id === 'm_box' ? this.away.find((p) => p !== man && p.role !== 'C') : man;
    if (b.state !== 'held') return;
    if (b.holder !== wantHolder) {
      if (b.holder.team === 'away' && !this.lessonPassing) {
        this.lessonPassing = true;
        this.doPass(b.holder, wantHolder);
        this.time.delayedCall(800, () => (this.lessonPassing = false));
      }
      return;
    }
    this.lessonFired = true;
    if (id === 'm_mao') {
      // você colado nele; ele arremessa em seguida
      u.setPosition(man.x + (B.x - man.x) * 0.12, man.y + (B.y - man.y) * 0.12);
      this.events.emit('toast', 'ELE VAI ARREMESSAR: APERTE U (Y) AGORA!', 0xffe14d);
      this.floatText(man.x, man.y - man.headY - 14, '!', 0xff7b6b);
      this.time.delayedCall(1300, () => {
        if (this.ball.holder === man) {
          this.lessonHold = false;
          this.aiShoot(man);
        }
      });
    } else if (id === 'm_carga') {
      // você parado no caminho entre ele e a cesta; ele infiltra reto em você
      const dx = B.x - man.x;
      const dy = B.y - man.y;
      const l = Math.hypot(dx, dy) || 1;
      u.setPosition(man.x + (dx / l) * 26, man.y + (dy / l) * 26);
      u.stop();
      u.stillT = 0;
      this.events.emit('toast', 'FIQUE PARADO NA FRENTE DELE!', 0xffe14d);
      this.time.delayedCall(1300, () => {
        if (this.ball.holder === man) {
          this.lessonHold = false;
          man.drive = { t: 0, off: 0, moved: true };
        }
      });
    } else if (id === 'm_box') {
      // você perto do seu homem; um colega dele chuta de meia distância
      u.setPosition(man.x + (B.x - man.x) * 0.12, man.y + (B.y - man.y) * 0.12);
      this.events.emit('toast', 'VAI TER ARREMESSO: QUANDO A BOLA SUBIR, APERTE L (B)!', 0xffe14d);
      this.time.delayedCall(1300, () => {
        if (this.ball.holder === wantHolder) {
          this.lessonHold = false;
          this.aiShoot(wantHolder);
        }
      });
    }
  }

  // ------------------------------------------------------------------ takeover (pegando fogo)
  addHeat(p, amount) {
    const before = p.heat || 0;
    // você é a estrela: seu armador esquenta mais rápido
    p.heat = Math.min(6, before + amount * (p === this.pg ? 1.35 : 1));
    if (before < 1.2 && p.heat >= 1.2) this.floatText(p.x, p.y - p.headY - 18, 'AQUECENDO', 0xffb070);
    if (before < 2.5 && p.heat >= 2.5) {
      this.floatText(p.x, p.y - p.headY - 18, 'EM CHAMAS!', 0xff5a4d);
      this.narrator.say('fire', { name: this.shortName(p), home: p.team === 'home' }, true);
      this.events.emit('toast', `${this.shortName(p)} esta em chamas!`, 0xff9a4d);
    }
  }

  heatMult(p) {
    const h = p.heat || 0;
    return h >= 2.5 ? 1.12 : h >= 1.2 ? 1.05 : 1;
  }

  // ------------------------------------------------------------------ fadiga e substituições
  energyMult(p) {
    return p === this.user ? 1 : 0.9 + 0.1 * (p.energy / 100);
  }

  updateFatigue(dt) {
    for (const p of this.all) {
      // esfria devagar (posses são longas); em chamas dura mais
      p.heat = Math.max(0, (p.heat || 0) - (p.heat >= 2.5 ? 0.006 : 0.008) * dt);
      if (p === this.user) continue;
      // gás da IA: o sprint (p.run) gasta, andar recupera — no ritmo de cada jogador
      if (p.aiSprint) p.gas = Math.max(0, (p.gas ?? 100) - p.skills.gasDrain * dt);
      else p.gas = Math.min(100, (p.gas ?? 100) + p.skills.gasRegen * dt);
      p.sprinting = !!p.aiSprint;
      p.aiSprint = false;
      const v = Math.hypot(p.body.velocity.x, p.body.velocity.y);
      // cansaço de jogo (diferente do gás): sprint cansa mais, parado recupera; resistência de cada um conta
      const wear = (p.aiSprint || v > 85 ? 1.0 : v > 15 ? 0.32 : -0.6) / (p.skills.endurance || 1);
      p.energy = Math.min(100, Math.max(0, p.energy - dt * wear * (this.adj.run ? 1.3 : 1)));
      p.speed = p.baseSpeed * (0.85 + 0.15 * (p.energy / 100)) * (p.team === 'home' && this.adj.run ? 1.04 : 1);
    }
    for (const side of ['home', 'away']) for (const b of this.bench[side]) b.energy = Math.min(100, b.energy + 4 * dt);
  }

  // Troca o jogador em quadra pelo reserva da mesma posição (o corpo físico continua o mesmo).
  substitute(p) {
    if (p === this.user) return false;
    const side = p.team;
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    const slot = this.bench[side][p.index];
    const outInfo = p.info;
    const outEnergy = p.energy;
    const isBench = !!slot.info.bench;
    const info = slot.info;
    p.info = info;
    p.r = info.r;
    p.cm = info.cm;
    p.hp = heightPixels(info.cm);
    p.headY = 24 + p.hp;
    p.skills = makeSkills(info, null);
    p.baseSpeed = 64 * p.skills.speed;
    p.speed = p.baseSpeed;
    p.energy = slot.energy;
    p.heat = 0;
    p.texKey = this.texFor(side, team, info, p.index, isBench);
    p.sprite.setTexture(p.texKey, 0);
    this.bench[side][p.index] = { info: outInfo, energy: outEnergy };
    return true;
  }

  // IA troca automaticamente quem está muito cansado (nas bolas paradas)
  autoSubs(side) {
    for (const p of side === 'home' ? this.home : this.away) {
      if (p === this.user || (side === 'home' && !this.autoSubHome)) continue;
      // só troca quem está bem cansado, se o reserva estiver descansado e sem ficar trocando toda hora
      if (p.energy < 45 && this.bench[side][p.index].energy > 85 && this.time.now - (p.subAt || -1e9) > 45000) {
        p.subAt = this.time.now;
        this.substitute(p);
        this.events.emit('toast', `Substituicao: entra ${p.info.name}`, side === 'home' ? 0x6fa0ff : 0xff9a4d);
      }
    }
  }

  // ------------------------------------------------------------------ tempo técnico (ajustes)
  // Ajustes escolhidos no tempo técnico (até 2): multiplicadores para o resto do jogo.
  adjMult(shooter, kind) {
    const a = this.adj;
    let m = 1;
    if (shooter.team === 'home') {
      if (a.space && kind === 'three') m *= 1.06;
      if (a.paint && kind === 'fin') m *= 1.07;
    } else {
      if (a.protect && kind === 'fin') m *= 0.93;
      if (a.closeout && kind === 'three') m *= 0.92;
    }
    return m;
  }

  trackScore(team, pts) {
    if (team === 'home') {
      this.track.homePts += pts;
      if (this.play && this.lastUserPlay) {
        const t = this.track.plays[this.lastUserPlay] || (this.track.plays[this.lastUserPlay] = { uses: 0, pts: 0 });
        t.pts += pts;
      }
    } else this.track.oppPts += pts;
  }

  // ------------------------------------------------------------------ ponte aérea
  finishAlleyOop(p) {
    const contest = this.contestFactor(p, 22, 0.35);
    const chance = clamp(0.74 * p.skills.finishing * contest * this.heatMult(p), 0.1, 0.92);
    if (this.tryBlock(p, 1.3)) return;
    const made = Math.random() < chance;
    p.setPose('shoot', 0.45);
    p.lift = 12;
    p.stop();
    this.ball.shoot(p, made, 'dunk', this.basket, this.dir);
    this.pendingShot = { shooter: p, three: false, made, kind: 'dunk', alley: true };
    this.logShot(p, made, false);
    this.floatText(p.x, p.y - p.headY - 12, `ALLEY-OOP! ${Math.round(chance * 100)}%`, 0xffe14d);
  }

  // ------------------------------------------------------------------ leitura de jogo
  // Nota de companheiro (0..100) e QI do armador. delta > 0 = boa decisão.
  gradeAdd(delta, label = null) {
    const before = letterGrade(this.grade);
    this.grade = clamp(this.grade + delta, 0, 100);
    if (delta > 0) this.iq.good++;
    else if (delta < 0) this.iq.bad++;
    // roubos, tocos e boas leituras também esquentam o armador
    if (delta === GRADE.steal || delta === GRADE.block || label === 'BOA LEITURA!') this.addHeat(this.pg, 0.5);
    const after = letterGrade(this.grade);
    if (label) this.floatText(this.pg.x, this.pg.y - this.pg.headY - 22, label, delta > 0 ? 0x6dff6d : 0xff7b6b);
    if (after !== before) this.events.emit('toast', `Nota de companheiro: ${after}`, delta > 0 ? 0x6dff6d : 0xff7b6b);
  }

  iqScore() {
    const n = this.iq.good + this.iq.bad;
    return n ? Math.round(clamp(50 + (50 * (this.iq.good - this.iq.bad)) / n, 0, 100)) : 50;
  }

  // Defesa disfarçada: revela o esquema real (no 1º passe ou depois de um tempo).
  revealDisguise() {
    if (!this.oppDisguise) return;
    this.oppDisguise = null;
    this.events.emit('toast', `Defesa mudou: ${this.oppScheme.name}!`, 0xff9a4d);
  }

  // Multiplicador de leitura para os arremessos do seu time.
  readMult(shooter) {
    const b = this.readBuff;
    return b && b.t > 0 && shooter.team === 'home' ? b.mult : 1;
  }

  // Visão de quadra: segure Q com a bola (câmera lenta + linhas de passe). Retorna o dt do jogo.
  updateVision(dt) {
    const u = this.user;
    const can = this.state === 'live' && !this.userOnDefense && this.ball.state === 'held' && this.ball.holder === u;
    // (no 64, LT/Q perto do garrafão é o jogo de costas, não a visão)
    this.visionOn = can && this.btn.VISION.isDown && this.vision > 0 && !(this.v64 && (wantsPost(this) || this.gathering));
    // na carreira, o atributo VISAO deixa a barra durar mais e voltar mais rápido
    const vs = this.visionStat ? this.visionStat / 70 : 1;
    if (this.visionOn) this.vision = Math.max(0, this.vision - (VISION.drain / vs) * dt);
    else this.vision = Math.min(100, this.vision + VISION.regen * vs * dt);
    const g = this.visionG;
    g.clear();
    if (!this.visionOn) return dt;
    for (const t of this.offTeam) {
      if (t === u) continue;
      const risk = this.laneRisk(u, t);
      const open = this.nearestDefenderDist(t);
      const col = risk < 9 ? 0xff5a4d : open >= OFFENSE.openDist ? 0x6dff6d : 0xffe14d;
      g.lineStyle(1, col, 0.85).lineBetween(u.x, u.y - 8, t.x, t.y - 8);
    }
    // defensores negando passe / colados aparecem marcados
    for (const d of this.defTeam) if (d.denying) g.fillStyle(0xff9a4d, 1).fillRect(d.x - 1, d.y - d.headY - 10, 3, 5);
    // zonas quentes (vermelho) e frias (azul) de quem você está mirando (ou as suas)
    this.drawZones(g, this.passTarget || u);
    return dt * VISION.timeScale;
  }

  // O adversário escolhe a defesa: muda a cada poucas posses e reage se você estiver pontuando.
  chooseOppScheme() {
    this.oppDefPoss++;
    if (this.training) {
      this.oppScheme = schemeById(this.training.scheme);
      this.oppDisguise = null;
      return;
    }
    if (this.track) this.track.schemes[this.oppScheme.id] = (this.track.schemes[this.oppScheme.id] || 0) + 1;
    const hot = this.userStreak >= 2;
    this.oppDisguise = null;
    if (hot) this.oppScheme = schemeById(Math.random() < 0.5 ? 'blitz' : 'zone');
    else if (this.oppDefPoss % 3 === 0 || Math.random() < 0.15) {
      const w = { man: 3, switch: 2, hedge: 2, blitz: 1, zone: 1.5, press: 0.8 };
      if (this.oppFav) w[this.oppFav] += 3; // no campeonato, o time usa mais a defesa favorita (scout)
      let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
      for (const [id, v] of Object.entries(w)) {
        r -= v;
        if (r <= 0) {
          this.oppScheme = schemeById(id);
          break;
        }
      }
    }
    // Disfarce: mostra um esquema e usa outro depois do primeiro passe
    if (Math.random() < READ.disguiseChance * this.difficulty.dbl) {
      const others = DEF_SCHEMES.filter((s) => s !== this.oppScheme && !s.press);
      this.oppDisguise = { show: others[Math.floor(Math.random() * others.length)], t: READ.disguiseTime };
    }
  }

  // ------------------------------------------------------------------ entrada (teclado + gamepad)
  // Botões lógicos: K (arremesso/roubo), J (passe), L (crossover/deslize), E (comando),
  // SHIFT (sprint), PAUSE, BOOK. Gamepad: A=K, X=J, B=L, Y=E, RB/RT=sprint, START=pausa, SELECT/LB=playbook.
  pollInput() {
    const k = this.keys;
    // controle lido direto do navegador (funciona com Xbox/PlayStation no mapeamento padrão)
    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) || null : null;
    const raw = (i) => !!pad && !!pad.buttons[i] && pad.buttons[i].pressed;
    const P = this.ctl.pad;
    // Estilo 2K: segurar RB (ícone) ou LB (comando) transforma os botões A/B/X/Y em 1..4
    // e o direcional chama jogadas (1-4; com LB, 5-8). Fora disso, os botões fazem a ação normal.
    const prevRaw = this.prevRaw || {};
    const now = {};
    for (let i = 0; i < 16; i++) now[i] = raw(i);
    const hit = (i) => now[i] && !prevRaw[i];
    if (pad && (Object.values(now).some(Boolean) || Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0) > 0.4)) this.lastInputPad = true;
    this.prevRaw = now;
    const modIcon = now[P.ICON];
    // (só no 64) LB segurado com a bola = visão de quadra: aí o LB deixa de ser o "comando + botão"
    // e os botões fazem a ação normal (dá para passar com A durante a visão)
    const u64 = this.user;
    const lbVision64 = !!(this.v64 && u64 && !this.userOnDefense && this.ball && this.ball.holder === u64 && this.ball.state === 'held' &&
      now[P.SCREEN] && this.lbAt && this.time.now - this.lbAt > 180 && !this.lbUsed);
    this.lbVision64 = lbVision64;
    const modCmd = now[P.E] && !lbVision64;
    this.padMod = modIcon ? 'icon' : modCmd ? 'cmd' : null;
    this.padNum = null;
    this.padPlay = null;
    if (this.padMod) {
      const face = [0, 1, 2, 3].findIndex((i) => hit(i)); // A=1 B=2 X=3 Y=4
      if (face >= 0) this.padNum = face;
    }
    const dpad = [12, 15, 13, 14].findIndex((i) => hit(i)); // cima, direita, baixo, esquerda
    // LB sozinho: toque = chamar bloqueio (com a bola); segurar = você bloqueia (sem a bola)
    const lb = P.SCREEN;
    if (now[lb] && !prevRaw[lb]) {
      this.lbAt = this.time.now;
      this.lbUsed = false;
    }
    if (now[lb] && (this.padNum !== null || dpad >= 0)) this.lbUsed = true;
    // (no 64 o toque precisa ser curto: segurar é a visão de quadra)
    this.padScreenTap = !now[lb] && !!prevRaw[lb] && !this.lbUsed && this.time.now - (this.lbAt || 0) < (this.v64 ? 180 : 350);
    this.padScreenHold = now[lb] && !this.lbUsed && this.time.now - (this.lbAt || 0) > 120;
    if (dpad >= 0) this.padPlay = dpad + (modCmd ? 4 : 0);
    const pb = (i) => !this.padMod && now[i];
    const src = {
      K: [k.K, pb(P.K)],
      J: [k.J, pb(P.J)],
      L: [k.L, pb(P.L)],
      LOB: [k.LOB, pb(P.LOB)],
      E: [k.E, false],
      SHIFT: [k.SHIFT, now[P.SHIFT]],
      PAUSE: [null, now[9], k.ESC, k.P],
      BOOK: [k.TAB, now[P.TAB]],
      VISION: [k.Q, now[P.Q]],
      REPLAY: [k.R, now[P.R]],
      PAGE: [k.PAGE, now[P.PAGE]],
      SCREEN: [k.SCREEN, false],
    };
    this.btn = {};
    for (const [name, [key, padDown, ...extra]] of Object.entries(src)) {
      const keys = [key, ...extra].filter(Boolean);
      const isDown = keys.some((kk) => kk.isDown) || padDown;
      const kJust = keys.some((kk) => JustDown(kk));
      const kUp = keys.some((kk) => JustUp(kk));
      const prev = !!this.prevBtn[name];
      this.btn[name] = { isDown, just: kJust || (padDown && !prev), up: kUp || (!padDown && prev && !isDown) };
      this.prevBtn[name] = padDown;
    }
    this.pad = pad;
    if (this.v64) {
      remapButtons64(this); // LT = proteger · LB segurado = visão · LB toque = bloqueio
      this.readProStick(pad);
    }
  }

  // ------------------------------------------------------------------ (só no 64) PRO STICK, estilo 2K
  // Analógico direito, com a bola:
  //   para baixo e segurar = arremesso (medidor; toque rápido = finta)
  //   toque para o lado = crossover · para a cesta = hesitação (no garrafão: bandeja; + RT: enterrada)
  //   diagonal para baixo (ou para longe da cesta) = step-back · girar o analógico = giro
  // Na defesa: para cima = mão alta.
  readProStick(pad) {
    const ps = this.proStick || (this.proStick = { held: false, shoot: false, hands: false });
    const sx = pad ? pad.axes[2] || 0 : 0;
    const sy = pad ? pad.axes[3] || 0 : 0;
    const mag = Math.hypot(sx, sy);
    const now = this.time.now;
    const u = this.user;
    const withBall = !!u && !this.userOnDefense && this.ball.holder === u && this.ball.state === 'held';
    const prevShoot = ps.shoot;
    const prevHands = ps.hands;
    this.stickMove = null;
    if (mag > 0.75) {
      const ang = Math.atan2(sy, sx);
      if (!ps.held) {
        ps.held = true;
        ps.t0 = now;
        ps.sx = sx / mag;
        ps.sy = sy / mag;
        ps.sweep = 0;
        ps.lastAng = ang;
        ps.fired = false;
        ps.shoot = withBall && sy / mag > 0.92; // para baixo (reto): arremesso; na diagonal é step-back
        ps.hands = !withBall && this.userOnDefense && sy / mag < -0.7; // defesa, para cima: mão alta
      } else {
        let d = ang - ps.lastAng;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        ps.sweep += d;
        ps.lastAng = ang;
        // meia volta no analógico = giro
        if (!ps.fired && !ps.shoot && withBall && Math.abs(ps.sweep) > 2.4) {
          ps.fired = true;
          this.stickMove = { kind: 'spin' };
        }
      }
    } else if (mag < 0.35 && ps.held) {
      // soltou rápido: foi um "toque" naquela direção
      if (!ps.fired && !ps.shoot && !ps.hands && withBall && now - ps.t0 < 350) this.stickMove = { kind: 'flick', sx: ps.sx, sy: ps.sy };
      ps.held = false;
      ps.shoot = false;
      ps.hands = false;
    }
    // o analógico vira os botões de arremesso (K) e mão alta (LOB)
    const merge = (b, on, was) => {
      if (!on && !was) return;
      b.isDown = b.isDown || on;
      if (on && !was) b.just = true;
      if (!on && was && !b.isDown) b.up = true;
    };
    merge(this.btn.K, ps.shoot, prevShoot);
    merge(this.btn.LOB, ps.hands, prevHands);
  }

  // Direção da tela -> direção na quadra (a câmera do 3D pode estar girada: camYaw)
  screenToWorld(x, y) {
    if (!this.camYaw) return [x, y];
    const c = Math.cos(this.camYaw);
    const s = Math.sin(this.camYaw);
    return [x * c - y * s, x * s + y * c];
  }

  useStickMove(u, ix, iy) {
    const sm = this.stickMove;
    this.stickMove = null;
    if (sm.kind === 'spin') {
      if (u.crossCooldown > 0.15 || this.stamina < STAMINA.crossCost * 0.5) return;
      this.lastL = this.time.now - 100; // o giro do dribleMove é o "toque duplo"
      this.lastMove = null;
      return this.dribbleMove(ix || 0.001, iy, true);
    }
    const [fx, fy] = this.screenToWorld(sm.sx, sm.sy);
    const bx = this.basket.x - u.x;
    const by = this.basket.y - u.y;
    const bl = Math.hypot(bx, by) || 1;
    const toward = (fx * bx + fy * by) / bl;
    if (toward > 0.6 && isLayupZone(u, this.dir) && !this.inbound) return this.startLayup(u); // + RT segurado: enterrada
    if (u.crossCooldown > 0 || this.stamina < STAMINA.crossCost * 0.5) return;
    // diagonal para baixo na tela, ou para longe da cesta: step-back
    if (toward < -0.6 || sm.sy > 0.4) return this.dribbleStepBack(u, -bx / bl, -by / bl);
    this.lastL = -1e9; // um toque só (não vira giro)
    this.dribbleMove(fx, fy, true); // para a cesta = hesitação; para o lado = crossover
  }

  // step-back no drible: recua rápido e abre espaço para o arremesso
  dribbleStepBack(u, ax, ay) {
    u.crossDir = { x: ax, y: ay };
    u.crossTimer = 0.22;
    u.crossCooldown = CROSSOVER.cooldown;
    this.stamina = Math.max(0, this.stamina - STAMINA.crossCost * 0.8);
    this.floatText(u.x, u.y - u.headY - 18, 'STEP-BACK', 0x6fa0ff);
    sfx.play('cross');
    this.ankleCheck(0.6, 'RECUOU!');
  }

  isDoubled(p) {
    const dbl = this.defenseAI.double;
    return !!dbl && dbl.target === p && Math.hypot(dbl.by.x - p.x, dbl.by.y - p.y) < 26;
  }

  // ------------------------------------------------------------------ posse (sem parar o jogo)
  setOffense(side) {
    // treino: a lição acaba quando a posse passa para o adversário
    // lição de defesa: acabou bem quando a bola volta para você
    if (this.training && this.training.def && side === 'home' && this.offSide === 'away' && this.state === 'live') {
      if (!this.mechDone && this.lessonTries < 3) return this.retryDefLesson();
      this.endTraining(true);
      return;
    }
    if (this.training && !this.training.def && side === 'away' && this.offSide === 'home' && this.state === 'live') {
      this.endTraining(false);
      return;
    }
    this.offSide = side;
    this.offTeam = side === 'home' ? this.home : this.away;
    this.defTeam = side === 'home' ? this.away : this.home;
    // Rua 3x3: meia quadra, os dois times atacam a mesma cesta
    this.dir = this.street || side === 'home' ? 1 : -1;
    this.basket = this.street || side === 'home' ? BASKET : BASKET_BOTTOM;
    this.needClear = false;
    this.userOnDefense = side === 'away';
    this.shotClock = this.street ? 12 : GAME.shotClock;
    if (this.play) this.play.finish();
    this.play = null;
    this.passCount = 0;
    this.assist = null;
    this.gathering = false;
    this.jArmed = false;
    this.iconUsed = false;
    this.meterValue = 0;
    this.userCalling = false;
    this.userJumpT = 0;
    this.inbound = null;
    this.aiPlayT = rand(3.5, 6);
    this.meter.clear();
    for (const p of this.all) {
      p.body.pushable = true;
      p.drive = null;
      p.layupT = 0;
      p.catchShoot = false;
      p.holdCount = 0;
      p.pose = p.pose === 'shoot' ? p.pose : null;
      p.slideT = 0;
      p.crossTimer = p.crossTimer || 0;
      p.crossCooldown = p.crossCooldown || 0;
      p.reachCooldown = p.reachCooldown || 0;
    }
    if (side === 'home') {
      this.chooseOppScheme();
      this.time.delayedCall(700, () => this.state === 'live' && this.coachTip());
      if (this.track) this.track.userPoss++;
    }
    this.offenseAI.reset();
    this.defenseAI.reset(true);
  }

  updateCamera() {
    const u = this.user;
    const b = this.ball;
    // mantém você na tela: a bola puxa no máximo ~90px
    let x = lerp(u.x, b.x, 0.5);
    let y = lerp(u.y, b.y, 0.5);
    const dy = y - u.y;
    if (Math.abs(dy) > 90) y = u.y + Math.sign(dy) * 90;
    y -= 24 * this.dir;
    x = lerp(x, u.x, 0.3);
    this.camTarget.setPosition(x, y);
  }

  // Troca de posse com a bola indo para `holder` (rebote, roubo, interceptação...).
  turnover(holder, title, color) {
    if (holder.team === 'home' && this.offSide === 'away') this.gradeAdd(GRADE.stop);
    this.ball.give(holder);
    this.setOffense(holder.team);
    holder.decideTimer = rand(0.2, 0.5);
    if (title) this.events.emit('toast', title, color);
    // Rua 3x3: rebote de defesa ou roubo -> precisa levar a bola para fora do arco antes de pontuar
    if (this.street && !isThree(holder, this.dir)) {
      this.needClear = true;
      this.clearHintT = 0;
    }
  }

  // Quem está com a bola pisou fora da quadra: posse do adversário.
  checkStepOut() {
    const b = this.ball;
    const h = b.state === 'held' ? b.holder : null;
    if (!h || this.inbound || h.team !== this.offSide || h.layupT > 0) return;
    const m = 2;
    const bottom = this.street ? MID_Y + 4 : COURT.bottom;
    if (h.x < COURT.left - m || h.x > COURT.right + m || h.y < COURT.top - m || h.y > bottom + m) {
      sfx.play('whistle');
      if (h === this.pg) {
        this.stats.to++;
        this.gradeAdd(GRADE.turnover);
      }
      const other = this.offSide === 'home' ? 'away' : 'home';
      this.startInbound(other, { x: h.x, y: h.y }, 0.6, 'Pisou fora!', 0xd8d0ee);
    }
  }

  // Rua 3x3: a bola fica "limpa" quando o ataque a segura fora da linha de 3
  updateClear(dt) {
    if (!this.needClear) return;
    const b = this.ball;
    const h = b.state === 'held' ? b.holder : null;
    if (!h || h.team !== this.offSide) return;
    if (isThree(h, this.dir)) {
      this.needClear = false;
      this.floatText(h.x, h.y - h.headY - 10, 'BOLA LIMPA', 0x6dff6d);
      return;
    }
    this.clearHintT = (this.clearHintT || 0) - dt;
    if (this.clearHintT <= 0) {
      this.clearHintT = 1.6;
      this.floatText(h.x, h.y - h.headY - 10, 'LIMPE A BOLA: SAIA DO ARCO', 0xff9a4d);
    }
  }

  // Ponto logo fora da linha de 3 na direção de onde o jogador está (canônico -> mundo)
  clearSpot(p) {
    const c = toWorldDir(p, this.dir);
    let ux = c.x - BASKET.x;
    let uy = Math.max(10, c.y - BASKET.y) * Y_SCALE;
    const l = Math.hypot(ux, uy) || 1;
    ux /= l;
    uy /= l;
    const R = THREE.rx + 16;
    return toWorldDir({ x: clamp(BASKET.x + ux * R, COURT.left + 10, COURT.right - 10), y: BASKET.y + (uy * R) / Y_SCALE }, this.dir);
  }

  // Reposição: depois de cesta (linha de fundo) ou bola fora/estouro.
  startInbound(side, spot, time, title, color) {
    if (this.practice) return this.endPracticePossession(title);
    this.setOffense(side);
    // Rua 3x3: toda reposição é a "bola checada" no topo, fora do arco
    if (this.street) spot = { x: BASKET.x + rand(-20, 20), y: BASKET.y + THREE.ry + 50 };
    const cands = this.offTeam.slice(1);
    let by = cands[0];
    let bd = Infinity;
    for (const p of cands) {
      const d = Math.hypot(p.x - spot.x, p.y - spot.y);
      if (d < bd) {
        bd = d;
        by = p;
      }
    }
    this.autoSubs('home');
    this.autoSubs('away');
    // sem teletransporte: quem repõe pega a bola e caminha até o ponto (perto: só ajusta)
    const far = Math.hypot(by.x - spot.x, by.y - spot.y);
    if (far < 8) by.setPosition(spot.x, spot.y);
    by.stop();
    this.ball.give(by);
    this.inbound = { t: time, by, spot, walk: far >= 8, walkT: 0 };
    if (title) this.events.emit('toast', title, color);
  }

  finishInbound() {
    const by = this.inbound.by;
    this.inbound = null;
    if (this.ball.holder !== by) return;
    const pg = this.offTeam[0];
    let to = pg;
    if (this.laneRisk(by, pg) < 8) {
      // armador marcado: entrega para o mais livre
      let best = -1;
      for (const t of this.offTeam) {
        if (t === by) continue;
        const o = this.nearestDefenderDist(t);
        if (o > best) {
          best = o;
          to = t;
        }
      }
    }
    this.doPass(by, to);
  }

  // ------------------------------------------------------------------ loop
  update(time, delta) {
    const realDt = Math.min(delta / 1000, 1 / 20);
    this.pollInput();
    if (this.state === 'replay') return this.updateReplay(realDt);
    if (this.state === 'done') {
      for (const p of this.all) p.updateVisual(realDt, time);
      return;
    }
    // R logo depois de uma cesta/erro: replay com análise da sua decisão
    if (this.btn.REPLAY.just && (this.state === 'live' || this.state === 'ft')) return this.startReplay();
    // visão de quadra deixa o jogo em câmera lenta
    const dt = this.updateVision(realDt);
    // torneios do fim de semana das estrelas
    if (this.contestCtl) {
      if (this.btn.PAUSE.just) return this.openMenu('pause');
      return this.contestCtl.update(realDt, time);
    }
    if (this.readBuff) this.readBuff.t -= dt;
    if (this.oppDisguise && this.state === 'live' && this.offSide === 'home') {
      this.oppDisguise.t -= dt;
      if (this.oppDisguise.t <= 0) this.revealDisguise();
    }

    if (this.state !== 'final') {
      if (this.btn.PAUSE.just) return this.openMenu('pause');
      if (this.btn.BOOK.just) return this.openMenu('playbook');
    }

    if (this.state === 'intro') {
      // (64) A/X pula a apresentação dos titulares. Só vale um aperto NOVO: o A/Enter que confirmou
      // a partida ainda está apertado no começo e pulava tudo sem querer.
      if (this.introLong) {
        if (!this.btn.K.isDown && !this.btn.J.isDown) this.introArmed = true;
        else if (this.introArmed && (this.btn.K.just || this.btn.J.just)) {
          this.introLong = false; // volta direto para a câmera de jogo
          this.stateT = Math.min(this.stateT, 0.5);
        }
      }
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.state = 'live';
        this.introLong = false;
      }
    } else if (this.state === 'final') {
      this.stateT -= dt;
      if (this.stateT <= 0) return this.endGame();
    }

    if (this.state === 'live') {
      if (this.inbound) {
        const ib = this.inbound;
        if (ib.walk) {
          // caminhando até o ponto da reposição (a IA move o jogador); trava depois de 2,4 s
          ib.walkT += dt;
          if (Math.hypot(ib.by.x - ib.spot.x, ib.by.y - ib.spot.y) < 5 || ib.walkT > 2.4) {
            ib.walk = false;
            ib.by.setPosition(ib.spot.x, ib.spot.y);
            ib.by.stop();
          }
        } else {
          ib.t -= dt;
          if (ib.t <= 0) this.finishInbound();
        }
      }
      this.updateClear(dt);
      this.checkStepOut();
      if (this.survival) this.updateSurvival();
      if (this.training && this.training.def) this.updateDefLesson(dt);
      if (this.practice) this.updatePractice(dt);
      this.updateLayups(dt);
      if (this.userOnDefense) this.updateUserDefense(dt);
      else this.updateUserOffense(dt);
      if (this.play) {
        this.play.update(dt);
        if (this.play.done) this.play = null;
      }
      // O adversário também chama jogadas (leia no HUD o que ele está fazendo)
      if (this.offSide === 'away' && !this.play && this.ball.state === 'held' && !inBackcourt(this.ball.holder, this.dir)) {
        this.aiPlayT -= dt;
        if (this.aiPlayT <= 0) {
          this.aiPlayT = rand(5, 9);
          this.callPlay(this.oppPlaybook[Math.floor(Math.random() * this.oppPlaybook.length)], true);
        }
      }
      this.offenseAI.update(dt);
      this.defenseAI.update(dt);
      this.userJumpT = Math.max(0, this.userJumpT - dt);
      this.updateShotClock(dt);
      this.updateGameClock(dt);
      this.updateFatigue(dt);
    } else if (this.state === 'ft') {
      this.updateFT(dt);
    } else {
      for (const p of this.all) p.moveDir(0, 0, 0, dt);
    }

    this.ball.update(dt);
    if (this.state === 'live') this.checkPickups();
    for (const p of this.all) {
      p.updateVisual(dt, time);
      if (p.stun > 0) continue;
      if ((p.heat || 0) >= 2.5) p.sprite.setTint(Math.floor(time / 90) % 2 ? 0xffb070 : 0xffffff); // em chamas
      else if (p.energy < 35) p.sprite.setTint(0xb8c8ff); // cansado
    }
    this.updateIndicators(time);
    this.updateCamera();
    this.recordFrame();
  }

  openMenu(mode) {
    this.scene.launch('Menu', { game: this, mode });
    this.scene.pause();
  }

  // ------------------------------------------------------------------ COMPETITIVO: sobrevivência
  // Quando a bola vai para o adversário, a posse acabou: pontuou = segue; não pontuou = perde 1 vida.
  updateSurvival() {
    const score = this.stats.fgm + this.stats.ast + (this.survBonus || 0); // (bônus: só existe no 64)
    this.events.emit('contestHud', `VIDAS ${'O'.repeat(Math.max(0, this.lives))}${'-'.repeat(Math.max(0, 3 - this.lives))}   PONTOS ${score}   POSSE ${this.survPoss + 1}`);
    if (this.offSide !== 'away' || this.state !== 'live') return;
    this.survPoss++;
    const ok = this.possPts > 0;
    if (!this.possAssist) this.survStreakBreak('passador');
    this.possAssist = false;
    if (ok) this.survOk++;
    else {
      this.survStreakBreak('all');
      this.lives--;
      sfx.play('life');
      this.narrator.say('life', {}, true);
      this.events.emit('toast', this.lives > 0 ? `Posse perdida! Restam ${this.lives} vida(s)` : 'Sem vidas!', 0xff7b6b);
    }
    if (this.lives <= 0) return this.endSurvival();
    // a defesa endurece a cada 4 posses certas
    if (ok && this.survOk % 4 === 0) {
      for (const k of ['def', 'steal', 'dbl', 'shoot']) this.difficulty[k] = Math.min(1.6, (this.difficulty[k] || 1) * 1.06);
      this.events.emit('toast', 'A defesa apertou!', 0xff9a4d);
    }
    this.newSurvivalPossession();
  }

  // ---- (só no 64) Sobrevivência: 3 acertos SEGUIDOS do estilo do seu armador devolvem 1 vida (máx. 3)
  //   chutador: cestas de 3 · passador: assistências · infiltrador: bandejas/enterradas
  survStreakHit(kind) {
    if (!this.v64 || !this.survival || !kind || !this.build || kind !== this.build.id) return;
    // desafio de estilo (a cada 10 posses): fez a jogada do seu estilo nesta posse = +3 no ranking
    if (this.styleChallenge) {
      this.styleChallenge = false;
      this.survBonus = (this.survBonus || 0) + 3;
      sfx.play('green');
      this.events.emit('toast', 'DESAFIO CUMPRIDO! +3 NO RANKING', 0x3ad6ff);
    }
    this.survStreak = (this.survStreak || 0) + 1;
    if (this.survStreak < 3) {
      this.events.emit('toast', `SEQUENCIA ${this.survStreak}/3`, 0x6dff6d);
      return;
    }
    this.survStreak = 0;
    if (this.lives < 3) {
      this.lives++;
      sfx.play('green');
      this.events.emit('toast', '+1 VIDA!', 0x6dff6d);
    } else this.events.emit('toast', 'SEQUENCIA! VIDAS JA ESTAO CHEIAS', 0x6dff6d);
  }

  survStreakBreak(kind) {
    if (!this.v64 || !this.survival || !this.build) return;
    if (kind !== 'all' && kind !== this.build.id) return;
    if (this.survStreak > 0) this.events.emit('toast', 'SEQUENCIA ZERADA', 0xff9a4d);
    this.survStreak = 0;
  }

  newSurvivalPossession() {
    this.possPts = 0;
    this.pendingShot = null;
    this.ft = null;
    this.setOffense('home');
    this.pg.setPosition(BASKET.x, BASKET.y + THREE.ry + 50);
    for (const p of this.home) {
      p.stop();
      if (p === this.pg) continue;
      const s2 = SLOTS[BASE_SLOTS[p.role]];
      p.setPosition(s2.x, s2.y);
    }
    for (const d of this.away) d.stop();
    this.defenseAI.reset(false);
    for (const d of this.away) {
      const m = this.defenseAI.manOf(d);
      if (m) d.setPosition(m.x + (BASKET.x - m.x) * 0.15, m.y + (BASKET.y - m.y) * 0.15);
    }
    this.ball.give(this.pg);
    this.state = 'intro';
    this.stateT = 0.9;
    this.events.emit('banner', `POSSE ${this.survPoss + 1}`, `VIDAS: ${this.lives}`, this.lives > 1 ? 0xffe14d : 0xff7b6b, 0.9);
    if (this.v64) this.startStyleChallenge();
  }

  // (só no 64) a cada 10 posses vencidas, a seguinte é um DESAFIO DE ESTILO
  startStyleChallenge() {
    this.styleChallenge = false;
    if (!this.survPoss || this.survPoss % 10 !== 0 || !this.build) return;
    this.styleChallenge = true;
    const what = { chutador: 'CESTA DE 3', passador: 'ASSISTENCIA', infiltrador: 'BANDEJA OU ENTERRADA' }[this.build.id] || 'CESTA';
    this.events.emit('banner', 'DESAFIO DE ESTILO', `${what} NESTA POSSE: +3 NO RANKING`, 0x3ad6ff, 1.8);
  }

  endSurvival() {
    if (this.state === 'done') return;
    this.state = 'done';
    const st = this.stats;
    const result = { score: st.fgm + st.ast + (this.survBonus || 0), fgm: st.fgm, ast: st.ast, tpm: st.tpm, pts: st.pts, poss: this.survPoss, pg: this.pg.info.name, team: this.homeTeam.era ? null : this.homeTeam.id, teamName: this.homeTeam.name };
    this.events.emit('banner', 'FIM!', `${result.score} PONTOS`, 0xffe14d, 1.4);
    sfx.play('buzzer');
    this.time.delayedCall(1500, () => {
      this.scene.stop('HUD');
      this.scene.start('Competitive', { result });
    });
  }
  endGame() {
    this.scene.stop('HUD');
    this.scene.start('GameOver', {
      score: { ...this.score },
      stats: { ...this.stats },
      home: this.homeTeam.id,
      away: this.awayTeam.id,
      build: this.build.id,
      grade: letterGrade(this.grade),
      champ: this.champ,
      iq: this.iqScore(),
      pgName: this.pg.info.name,
      box: [...this.box.values()],
      shotLog: this.shotLog,
      challenge: this.challenge ? this.challenge.id : null,
      career: !!this.careerGame,
      franchise: this.franchise,
      win: this.score.home > this.score.away,
    });
  }

  // ------------------------------------------------------------------ você no ataque
  readInput() {
    const k = this.keys;
    let ix = (k.A.isDown || k.LEFT.isDown ? -1 : 0) + (k.D.isDown || k.RIGHT.isDown ? 1 : 0);
    let iy = (k.W.isDown || k.UP.isDown ? -1 : 0) + (k.S.isDown || k.DOWN.isDown ? 1 : 0);
    const pad = this.pad;
    if (pad) {
      const sx = pad.axes[0] || 0;
      const sy = pad.axes[1] || 0;
      if (Math.hypot(sx, sy) > 0.25) {
        ix += sx;
        iy += sy;
      }
      // (o direcional chama jogadas, como no 2K; mover é no analógico)

    }
    // (só no 64) a câmera pode estar girada: "para cima" no controle é sempre para cima na tela
    [ix, iy] = this.screenToWorld(ix, iy);
    const im = Math.hypot(ix, iy);
    if (im) {
      ix /= im;
      iy /= im;
    }
    return { ix, iy, moving: im > 0 };
  }

  sprintAndStamina(u, moving, dt) {
    u.sprinting = this.btn.SHIFT.isDown && moving && this.stamina > STAMINA.minToSprint && !u.protect; // (64: protegendo a bola, sem sprint)
    // seu gás também depende do jogador (resistência): uns aguentam mais, outros gastam mais
    if (u.sprinting) this.stamina = Math.max(0, this.stamina - u.skills.gasDrain * dt);
    else this.regenStamina(dt);
    return u.speed * (u.sprinting ? PLAYER.sprintMult : 1);
  }

  regenStamina(dt) {
    this.stamina = Math.min(STAMINA.max, this.stamina + (this.user ? this.user.skills.gasRegen : STAMINA.regen) * dt);
  }

  updateUserOffense(dt) {
    const k = this.keys;
    const u = this.user;
    const ball = this.ball;
    const hasBall = ball.state === 'held' && ball.holder === u;
    const { ix, iy, moving } = this.readInput();
    u.crossTimer = Math.max(0, u.crossTimer - dt);
    u.crossCooldown = Math.max(0, u.crossCooldown - dt);
    u.lookAt = hasBall ? null : ball;
    u.lookAlways = false;

    // J + 1..4 = passe por ícone · E + 1..4 = comando (alas cortam, grandes bloqueiam)
    // Sem J/E, 1..9 chamam jogadas.
    const jHeld = (this.btn.J.isDown && hasBall) || (this.padMod === 'icon' && hasBall);
    const eHeld = this.btn.E.isDown || this.padMod === 'cmd';
    if (this.btn.PAGE.just) this.nextPlayPage();
    if (this.padPlay !== null && this.padNum === null) this.callPlay(this.pageIndex(this.padPlay));
    NUM_KEYS.forEach((name, i) => {
      if (!JustDown(k[name]) && this.padNum !== i) return;
      if (jHeld && i < 4) {
        this.iconUsed = true;
        this.jArmed = false;
        this.doPass(u, this.home[i + 1]);
      } else if (eHeld && i < 4) this.commandMate(this.home[i + 1]);
      else if (!jHeld && !eHeld && i < GAME.quickPlays) this.callPlay(this.pageIndex(i));
    });

    if (u.layupT > 0) return;
    // (só no 64) ameaça tripla, jogo de costas, tapinha no rebote
    if (this.v64 && userOffense64(this, u, hasBall, ix, iy, moving, dt)) return;

    if (this.gathering) {
      if (!hasBall) {
        this.gathering = false;
        u.pose = null;
      } else {
        this.meterValue += dt / u.skills.meterTime;
        // L durante o arremesso = step-back (ganha espaço, arremesso um pouco mais difícil)
        if (this.btn.L.just && !this.stepBack) {
          this.stepBack = 0.2;
          this.stepBackUsed = true;
          const dx = u.x - this.basket.x;
          const dy = u.y - this.basket.y;
          const l = Math.hypot(dx, dy) || 1;
          u.stepDir = { x: dx / l, y: dy / l };
          this.floatText(u.x, u.y - u.headY - 18, 'STEP-BACK', 0x6fa0ff);
        }
        if (this.stepBack > 0) {
          this.stepBack -= dt;
          u.moveDir(u.stepDir.x, u.stepDir.y, u.speed * 2.2, dt * 3);
        } else u.moveDir(0, 0, 0, dt * (this.stepBackUsed ? 3 : this.gatherBrake || 3)); // 3 = freia na hora (o 3D usa menos: carrega o embalo; depois de step-back/fadeaway, freia firme)
        u.setPose('shoot', 0.1);
        u.lookAt = this.basket;
        this.regenStamina(dt);
        if (!this.btn.K.isDown || this.meterValue >= SHOT.autoRelease) this.releaseUserShot();
        return;
      }
    }
    // ALLEY-OOP: segure J (mirando um companheiro perto do aro) e aperte K
    if (hasBall && ((this.btn.K.just && this.btn.J.isDown) || this.btn.LOB.just) && this.passTarget && !this.inbound) {
      const t = this.passTarget;
      if (distToBasket(t, this.dir) < 85 && !inBackcourt(t, this.dir)) {
        this.iconUsed = true;
        this.jArmed = false;
        this.ball.lob = true;
        this.doPass(u, t);
        this.floatText(u.x, u.y - u.headY - 14, 'PONTE AEREA', 0x6fa0ff);
        return;
      }
      if (this.btn.LOB.just) {
        this.ball.lob = true;
        this.doPass(u, t);
        this.floatText(u.x, u.y - u.headY - 14, 'PASSE ALTO', 0x6fa0ff);
        return;
      }
      // J + K longe do aro = FINTA DE PASSE: quem lia a linha de passe morde
      this.passFake(u, t);
      return;
    }
    if (hasBall && this.btn.K.just && u.crossTimer <= 0 && !this.inbound) {
      if (isLayupZone(u, this.dir)) return this.startLayup(u);
      this.gathering = true;
      u.gatherSpeed = Math.hypot(u.body.velocity.x, u.body.velocity.y); // (64) arremesso em movimento: janela menor
      this.stepBackUsed = false;
      this.meterValue = 0;
      this.stepBack = 0;
      this.jArmed = false;
      u.setPose('shoot', 0.1);
      return;
    }

    // CHAMAR BLOQUEIO (C / toque no LB) com a bola: o grandalhão mais perto vem bloquear seu marcador
    const screenCall = this.v64 ? this.screenTap64 : this.btn.SCREEN.just || this.padScreenTap; // (64: toque curto)
    if (hasBall && screenCall && !this.inbound) this.callScreen();
    // VOCÊ BLOQUEIA (segure C / LB sem a bola): fica plantado e trava quem bater em você
    const screening = !hasBall && (this.btn.SCREEN.isDown || this.padScreenHold) && ball.state !== 'loose';
    this.userScreening(u, screening, dt);
    if (screening) return;
    // K / X sem a bola: manda o companheiro com a bola arremessar
    if (!hasBall && this.btn.K.just) this.urgeShot();

    const speed = this.sprintAndStamina(u, moving, dt);
    if (u.diveT > 0) {
      u.diveT -= dt;
      u.moveDir(u.diveDir.x, u.diveDir.y, u.speed * 2.3, dt * 4);
    } else if (u.hesiT > 0) {
      u.hesiT -= dt; // hesitação: freia...
      u.moveDir(0, 0, 0, dt * 4);
    } else if (u.crossTimer > 0) u.moveDir(u.crossDir.x, u.crossDir.y, u.speed * CROSSOVER.burstMult, dt * 3);
    else if (moving) {
      const m = this.slideAround(u, ix, iy);
      u.moveDir(m.x, m.y, speed * m.k, dt);
    } else u.moveDir(0, 0, 0, dt);
    if (this.v64 && hasBall) driveContact(this, u, dt); // (só no 64) contato na infiltração
    const aim = moving ? { x: ix, y: iy } : { x: u.facing.x, y: u.facing.y };

    // J segurado + L = passe QUICADO (mais difícil de interceptar)
    if (this.btn.L.just && hasBall && this.btn.J.isDown && this.passTarget && !this.inbound) {
      this.jArmed = false;
      this.iconUsed = true;
      this.doPass(u, this.passTarget, { bounce: true });
      return;
    }
    // L = movimento de drible (crossover, hesitação, giro, size-up), conforme a direção
    // (o giro é um toque duplo: vale mesmo durante a recarga do primeiro movimento)
    const spinTap = this.time.now - (this.lastL || -1e9) < 300 && this.lastMove !== 'spin';
    if (this.btn.L.just && hasBall && (u.crossCooldown <= 0 || spinTap) && this.stamina >= STAMINA.crossCost * 0.5) this.dribbleMove(ix, iy, moving);
    // (só no 64) Pro Stick: drible/finalização pelo analógico direito
    else if (this.stickMove && hasBall && !this.gathering) this.useStickMove(u, ix, iy);
    // L com a bola solta perto: mergulha na bola
    if (this.btn.L.just && ball.state === 'loose') this.dive(u);

    if (hasBall) {
      this.passTarget = this.choosePassTarget(u, aim);
      if (this.btn.J.just) {
        this.jArmed = true;
        this.iconUsed = false;
      }
      if (this.btn.J.up && this.jArmed && !this.iconUsed && this.passTarget) {
        this.jArmed = false;
        this.doPass(u, this.passTarget);
      }
    } else {
      this.passTarget = null;
      this.jArmed = false;
      if (this.btn.J.just && ball.state === 'held' && ball.holder.team === 'home') {
        this.userCalling = true;
        this.floatText(u.x, u.y - 30, 'AQUI!', 0x6dff6d);
        this.time.delayedCall(1300, () => (this.userCalling = false));
      }
    }
  }

  // Encostou num defensor andando na direção dele: contorna pelo lado (mais devagar)
  // em vez de ficar empurrando. Assim o corpo do defensor ainda "custa" velocidade.
  slideAround(u, ix, iy) {
    for (const d of this.defTeam) {
      const dx = u.x - d.x;
      const dy = u.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 13 || dist < 0.01) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const into = -(ix * nx + iy * ny);
      if (into < 0.3) continue;
      let tx = -ny;
      let ty = nx;
      const side = tx * ix + ty * iy;
      const s = Math.abs(side) > 0.05 ? Math.sign(side) : this.ball.side || 1;
      tx *= s;
      ty *= s;
      const mx = tx + ix * 0.35;
      const my = ty + iy * 0.35;
      const l = Math.hypot(mx, my) || 1;
      return { x: mx / l, y: my / l, k: 0.75 };
    }
    return { x: ix, y: iy, k: 1 };
  }

  // ------------------------------------------------------------------ IA: dribles e finta de passe
  // Movimento de drible da IA contra quem a marca (você também pode ser enganado).
  aiDribble(p) {
    const d = this.defenderOf(p);
    if (!d || d.stun > 0 || p.distTo(d) > 24) return false;
    const moves = [['CROSSOVER', 1], ['HESITACAO', 0.9], ['GIRO', 0.9]];
    const [label, mult] = moves[Math.floor(Math.random() * moves.length)];
    this.floatText(p.x, p.y - p.headY - 14, label, 0xff9a4d);
    sfx.play('cross');
    const chance = (0.28 * mult * p.skills.crossAnkle * this.difficulty.dbl) / d.skills.defense;
    if (d === this.user) {
      // contra você: se você estiver avançando (bote), cai mais fácil
      if (Math.random() < chance * (d.lunge > 0 || d.reachT > 0 ? 2 : 1)) {
        d.slowT = 0.55;
        this.floatText(d.x, d.y - d.headY - 6, 'TE PEGOU!', 0xff7b6b);
      }
    } else if (Math.random() < chance) {
      d.stun = CROSSOVER.ankleStun * 0.8;
      d.stop();
      this.floatText(d.x, d.y - d.headY - 6, 'QUEBROU!', 0xffe14d);
    }
    return true;
  }

  aiPassFake(p, t) {
    this.floatText(p.x, p.y - p.headY - 14, 'FINTA DE PASSE', 0xff9a4d);
    for (const d of this.defTeam) {
      const c = closestOnSegment(d, p, t);
      if (c.d < 22 && c.t > 0.1) {
        if (d === this.user) d.slowT = 0.35;
        else if (Math.random() < 0.6 / d.skills.defense) d.stun = 0.35;
      }
    }
  }
  // ------------------------------------------------------------------ dribles (estilo Pro Stick)
  //  parado                -> SIZE-UP (prepara: o próximo movimento desequilibra mais)
  //  indo para a cesta     -> HESITAÇÃO (freia e explode; o marcador pode congelar)
  //  L duas vezes rápido   -> GIRO (contorna o marcador)
  //  para o lado           -> CROSSOVER
  dribbleMove(ix, iy, moving) {
    const u = this.user;
    const now = this.time.now;
    const dbl = now - (this.lastL || -1e9) < 300;
    this.lastL = now;
    const bx = this.basket.x - u.x;
    const by = this.basket.y - u.y;
    const bl = Math.hypot(bx, by) || 1;
    const toward = moving ? (ix * bx + iy * by) / bl : 0;
    const sizeUp = this.sizeUpT > 0 && now < this.sizeUpT ? 1.5 : 1;
    if (dbl && this.lastMove !== 'spin') {
      // giro: sai pelo lado oposto ao marcador, em direção à cesta
      const d = this.defenderOf(u);
      const side = d ? Math.sign((d.x - u.x) * by - (d.y - u.y) * bx) || 1 : 1;
      const a = side * 1.0;
      const c = Math.cos(a);
      const s2 = Math.sin(a);
      u.crossDir = { x: (bx / bl) * c - (by / bl) * s2, y: (bx / bl) * s2 + (by / bl) * c };
      u.crossTimer = 0.3;
      u.crossCooldown = CROSSOVER.cooldown;
      this.stamina = Math.max(0, this.stamina - STAMINA.crossCost);
      this.lastMove = 'spin';
      this.floatText(u.x, u.y - u.headY - 18, 'GIRO', 0x6fa0ff);
      this.narrator.say('spin', {});
      sfx.play('cross');
      return this.ankleCheck(0.9 * sizeUp, 'GIROU!');
    }
    this.lastMove = null;
    if (!moving) {
      this.sizeUpT = now + 1300;
      u.crossCooldown = 0.25;
      this.floatText(u.x, u.y - u.headY - 18, 'SIZE-UP', 0x6fa0ff);
      sfx.play('bounce', 0.6);
      return;
    }
    if (toward > 0.6) {
      // hesitação: freia um instante e acelera
      u.crossDir = { x: ix, y: iy };
      u.crossTimer = CROSSOVER.duration;
      u.hesiT = 0.12;
      u.crossCooldown = CROSSOVER.cooldown;
      this.stamina = Math.max(0, this.stamina - STAMINA.crossCost * 0.6);
      this.floatText(u.x, u.y - u.headY - 18, 'HESITACAO', 0x6fa0ff);
      this.narrator.say('hesi', {});
      sfx.play('cross');
      return this.ankleCheck(0.8 * sizeUp, 'CONGELOU!');
    }
    this.sizeMult = sizeUp;
    this.crossover(ix, iy);
    this.sizeMult = 1;
  }

  // chance de o marcador (ou quem dobra) ficar desequilibrado
  ankleCheck(mult, label) {
    const u = this.user;
    for (const d of this.defTeam) {
      if (d.stun > 0 || d.distTo(u) > CROSSOVER.ankleRange) continue;
      if (d !== this.defenderOf(u) && !this.isDoubled(u)) continue;
      const base = d.lunge > 0 ? CROSSOVER.ankleChanceLunging : CROSSOVER.ankleChance;
      if (Math.random() < (base * u.skills.crossAnkle * mult) / d.skills.defense) {
        d.stun = CROSSOVER.ankleStun;
        d.stop();
        this.floatText(d.x, d.y - d.headY - 6, label, 0xffe14d);
        this.narrator.say('ankle', {}, true);
        sfx.play('ankle');
      }
    }
  }

  // Mergulho na bola solta (L): explosão curta até a bola e alcance maior para pegar.
  dive(u) {
    const b = this.ball;
    const d = Math.hypot(b.x - u.x, b.y - u.y);
    if (d > 44 || (u.diveCd || 0) > this.time.now) return;
    u.diveT = 0.3;
    u.diveCd = this.time.now + 1200;
    u.diveDir = { x: (b.x - u.x) / (d || 1), y: (b.y - u.y) / (d || 1) };
    this.floatText(u.x, u.y - u.headY - 10, 'MERGULHO!', 0xffe14d);
    sfx.play('cross');
  }

  // Finta de passe (J + K longe do aro): os defensores perto da linha do passe "mordem".
  passFake(u, t) {
    this.jArmed = false;
    this.iconUsed = true;
    if ((this.fakeCd || 0) > this.time.now) return;
    this.fakeCd = this.time.now + 900;
    this.floatText(u.x, u.y - u.headY - 14, 'FINTA DE PASSE', 0x6fa0ff);
    for (const d of this.defTeam) {
      const c = closestOnSegment(d, u, t);
      if (c.d < 22 && c.t > 0.1 && Math.random() < 0.7 / d.skills.defense) {
        d.stun = 0.4;
        d.lunge = 0.3;
        this.floatText(d.x, d.y - d.headY - 6, 'MORDEU!', 0xffe14d);
        this.narrator.say('fake', {});
      }
    }
  }

  // ------------------------------------------------------------------ zonas quentes (por jogador)
  // 9 zonas; cada jogador tem quentes e frias (rating + "assinatura" pelo nome). Mudam a chance real.
  zoneOf(p) {
    const c = toWorldDir(p, this.dir);
    const three = isThree(p, this.dir);
    const dx = c.x - BASKET.x;
    if (isLayupZone(p, this.dir)) return 'garrafao';
    if (three) {
      if (c.y < 110) return dx < 0 ? 'cantoE' : 'cantoD';
      if (Math.abs(dx) > 70) return dx < 0 ? 'alaE' : 'alaD';
      return 'topo';
    }
    if (dx < -30) return 'meiaE';
    if (dx > 30) return 'meiaD';
    return 'meiaC';
  }

  zoneMult(p, zone = this.zoneOf(p)) {
    if (!p.info) return 1;
    const key = `${p.info.name}|${zone}`;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const sig = ((h % 1000) / 1000) * 2 - 1; // -1..1
    const r = p.info.r || {};
    const rating = zone === 'garrafao' ? r.fin : zone.startsWith('meia') ? r.mid : r.three;
    // carreira: pontos em ZONAS QUENTES esquentam todas as zonas do seu jogador
    const boost = p === this.pg ? (this.zoneBonus || 0) * 0.06 : 0;
    const v = clamp(sig * 0.8 + ((rating || 75) - 80) / 25 + boost, -1, 1);
    return 1 + 0.08 * v;
  }

  // centros das zonas (canônico) para desenhar na visão de quadra
  static ZONES = {
    cantoE: { x: 70, y: 70 }, alaE: { x: 108, y: 160 }, topo: { x: 240, y: 214 }, alaD: { x: 372, y: 160 }, cantoD: { x: 410, y: 70 },
    meiaE: { x: 182, y: 118 }, meiaC: { x: 240, y: 156 }, meiaD: { x: 298, y: 118 }, garrafao: { x: 240, y: 98 },
  };

  drawZones(g, p) {
    for (const [z, c] of Object.entries(GameScene.ZONES)) {
      const m = this.zoneMult(p, z);
      if (Math.abs(m - 1) < 0.035) continue;
      const w = toWorldDir(c, this.dir);
      g.fillStyle(m > 1 ? 0xff5a2d : 0x3a8cff, Math.min(0.55, Math.abs(m - 1) * 7));
      g.fillEllipse(w.x, w.y, 34, 22);
    }
  }

  // ------------------------------------------------------------------ insígnias dinâmicas (você)
  // Acertar sobe o nível durante o jogo (bronze -> prata -> ouro -> hall da fama); errar desce.
  badgeXP(delta) {
    const before = this.badgeLvl || 0;
    this.badgeMeter = clamp((this.badgeMeter || 0) + delta, 0, 13);
    const lvl = Math.min(4, Math.floor(this.badgeMeter / 3));
    this.badgeLvl = lvl;
    if (lvl !== before) {
      const names = ['SEM NIVEL', 'BRONZE', 'PRATA', 'OURO', 'HALL DA FAMA'];
      const colors = [0xb8b0d0, 0xd08a4a, 0xd8d8e8, 0xffe14d, 0xff6bd5];
      this.events.emit('toast', `INSIGNIAS ${lvl > before ? 'SUBIRAM' : 'CAIRAM'}: ${names[lvl]}`, colors[lvl]);
      this.floatText(this.pg.x, this.pg.y - this.pg.headY - 24, names[lvl], colors[lvl]);
      if (lvl > before) this.narrator.say('badge', { lvl: names[lvl] }, true);
    }
  }

  badgeMult(p) {
    return p === this.pg ? 1 + 0.025 * (this.badgeLvl || 0) : 1;
  }

  // ------------------------------------------------------------------ dica do técnico
  // No começo da sua posse, o técnico sugere a contra-jogada para a defesa que ele VÊ.
  // Some quando seu QI de leitura fica alto (você já não precisa).
  coachTip() {
    if (this.training || this.offSide !== 'home') return;
    if ((this.iq.good - this.iq.bad) >= 14) return;
    const shown = this.defScheme();
    if (this.lastTip === shown.id) return; // só quando a defesa que ele vê muda
    this.lastTip = shown.id;
    const c = COUNTERS[shown.id];
    if (!c || !c.good) return;
    const inBook = c.good.filter((n) => this.playbook.some((i) => PLAY_LIBRARY[i].name === n));
    if (!inBook.length) return;
    this.events.emit('toast', `TECNICO: contra ${shown.name}, tente ${inBook.slice(0, 2).join(' ou ')}`, 0xb8e0ff);
  }
  crossover(ix, iy) {
    const u = this.user;
    const ball = this.ball;
    ball.side *= -1;
    let dir = ix || iy ? { x: ix, y: iy } : { x: ball.side, y: 0 };
    dir = { x: dir.x + ball.side * 0.35, y: dir.y };
    const l = Math.hypot(dir.x, dir.y) || 1;
    u.crossDir = { x: dir.x / l, y: dir.y / l };
    u.crossTimer = CROSSOVER.duration;
    u.crossCooldown = CROSSOVER.cooldown;
    this.stamina = Math.max(0, this.stamina - STAMINA.crossCost);
    sfx.play('cross');
    // combo de drible: crossovers em sequência (até 0,9s entre eles) desequilibram mais
    const now = this.time.now;
    this.combo = now - (this.lastCross || 0) < 900 ? (this.combo || 1) + 1 : 1;
    this.lastCross = now;
    const comboMult = (1 + 0.35 * Math.min(3, this.combo - 1)) * (this.sizeMult || 1);
    if (this.combo >= 2) this.floatText(u.x, u.y - u.headY - 18, `COMBO x${this.combo}`, 0x6fa0ff);
    for (const d of this.defTeam) {
      if (d.stun > 0 || d.distTo(u) > CROSSOVER.ankleRange) continue;
      if (d !== this.defenderOf(u) && !this.isDoubled(u)) continue;
      const base = d.lunge > 0 ? CROSSOVER.ankleChanceLunging : CROSSOVER.ankleChance;
      if (Math.random() < (base * u.skills.crossAnkle * comboMult) / d.skills.defense) {
        d.stun = CROSSOVER.ankleStun;
        d.stop();
        this.floatText(d.x, d.y - d.headY - 6, 'QUEBROU!', 0xffe14d);
        this.narrator.say('ankle', {}, true);
        sfx.play('ankle');
      }
    }
  }

  choosePassTarget(passer, aim) {
    let best = null;
    let bestScore = -Infinity;
    for (const t of this.offTeam) {
      if (t === passer) continue;
      const dx = t.x - passer.x;
      const dy = t.y - passer.y;
      const d = Math.hypot(dx, dy);
      if (d > PASS.maxDist || d < 1) continue;
      const score = (dx * aim.x + dy * aim.y) / d - (d / PASS.maxDist) * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  doPass(from, to, opts = {}) {
    if (this.ball.state !== 'held' || this.ball.holder !== from || from.layupT > 0 || from === to) return;
    // a IA usa o passe quicado quando a linha está meio fechada
    if (from !== this.user && !opts.bounce && !this.inbound) {
      const risk = this.laneRisk(from, to);
      if (risk > 8 && risk < 16 && Math.random() < 0.5) opts = { ...opts, bounce: true };
    }
    let mult = from.skills.interceptMult * (this.inbound ? 0.3 : 1);
    let speed = PASS.speed * from.skills.passSpeed;
    // passe quicado: mais lento, mas passa por baixo das mãos
    if (opts.bounce) {
      mult *= 0.5;
      speed *= 0.85;
      this.floatText(from.x, from.y - from.headY - 12, 'QUICADO', 0x6fa0ff);
    }
    // passe de primeira: você soltou logo depois de receber (bola mais rápida, defesa não ajusta)
    if (from === this.user && this.time.now - (this.userCatchAt || -1e9) < 350) {
      mult *= 0.75;
      speed *= 1.3;
      this.floatText(from.x, from.y - from.headY - 20, 'DE PRIMEIRA', 0x6fa0ff);
    }
    if (opts.bounce) this.ball.bounce = true;
    // (só no 64) passe à frente de quem está correndo; passe longo vira passe cruzado (alto, mais lento)
    if (this.v64 && !opts.bounce && !this.ball.lob) {
      const tv = to.body.velocity;
      if (Math.hypot(tv.x, tv.y) > 45) this.ball.nextLead = { vx: tv.x, vy: tv.y };
      if (Math.hypot(to.x - from.x, to.y - from.y) > 200) {
        this.ball.nextSkip = true;
        speed *= 0.9;
        if (from === this.user) this.floatText(from.x, from.y - from.headY - 12, 'PASSE CRUZADO', 0x6fa0ff);
      }
    }
    const ic = this.defenseAI.rollIntercept(from, to, mult);
    this.ball.pass(from, to, ic ? ic.defender : null, ic ? ic.point : null, speed);
    from.pose = null;
    from.drive = null;
    if (from !== this.pg) this.assist = null;
    this.passCount++;
    if (this.inbound && this.inbound.by === from) this.inbound = null;
    if (from === this.pg) this.markDecision(`passe para ${to.role} ${this.shortName(to)}`, this.nearestDefenderDist(to) >= OFFENSE.openDist && this.laneRisk(from, to) >= 9);
    if (from.team === 'home' && this.oppDisguise) this.revealDisguise();
    // QI: passe arriscado vs passe para quem está mais livre
    if (from === this.pg && !this.inbound) {
      if (this.laneRisk(from, to) < 9) this.gradeAdd(GRADE.riskyPass);
      else if (this.nearestDefenderDist(to) > this.nearestDefenderDist(from) + 8) this.gradeAdd(GRADE.goodPass);
    }
    sfx.play('pass');
  }

  // páginas de jogadas: teclas 1..9 (ou o direcional) chamam as jogadas da página atual
  pageIndex(i) {
    return this.playbook[this.playPage * PLAYS_PER_PAGE + i];
  }

  nextPlayPage() {
    const pages = Math.ceil(this.playbook.length / PLAYS_PER_PAGE);
    this.playPage = (this.playPage + 1) % pages;
    const first = this.playbook.slice(this.playPage * PLAYS_PER_PAGE, this.playPage * PLAYS_PER_PAGE + 3).map((i) => PLAY_LIBRARY[i].name);
    this.events.emit('toast', `JOGADAS ${this.playPage + 1}/${pages}: ${first.join(', ')}...`, 0x6fa0ff);
    sfx.play('select');
  }

  // i = índice no PLAY_LIBRARY
  callPlay(i, ai = false) {
    if (i === undefined || i === null) return;
    if (this.play) this.play.finish();
    this.offenseAI.motion.release(this.offTeam);
    this.play = createPlay(i, this);
    if (!this.play) return;
    sfx.play('play');
    const h = this.play.handler();
    if (!ai && this.play.def.offBall) this.events.emit('toast', 'SEM BOLA: siga o anel azul e saia livre dos bloqueios', 0x3ad6ff);
    this.floatText(h.x, h.y - h.headY - 14, this.play.name, ai ? 0xff9a4d : 0x6fa0ff);
    // carreira: jogada ensaiada no plano de jogo da semana rende um pouco mais
    if (!ai && this.careerGame && this.careerGame.plan && this.careerGame.plan.plays.includes(i)) {
      this.readBuff = { mult: 1.06, t: 6 };
      this.floatText(h.x, h.y - h.headY - 24, 'ENSAIADA', 0x6dff6d);
    }
    if (!ai) {
      this.lastUserPlay = this.play.name;
      const t = this.track.plays[this.play.name] || (this.track.plays[this.play.name] = { uses: 0, pts: 0 });
      t.uses++;
    }
    // jogada desenhada no tempo técnico (ATO): bônus na primeira jogada depois do tempo
    if (!ai && this.atoReady && this.offSide === 'home') {
      this.atoReady = false;
      this.atoBuff = true;
      this.floatText(h.x, h.y - h.headY - 24, 'JOGADA DO TEMPO', 0x6dff6d);
    }
    // Contra-jogada: comparada com a defesa REAL do adversário (o disfarce engana)
    if (!ai && this.offSide === 'home') {
      const read = readOf(this.play.name, this.oppScheme.id);
      if (read === 'good') {
        this.trainRead = true;
        this.readBuff = { mult: READ.goodBonus, t: READ.duration };
        this.gradeAdd(GRADE.goodRead, 'BOA LEITURA!');
        this.events.emit('toast', `Boa leitura: ${COUNTERS[this.oppScheme.id].why}`, 0x6dff6d);
      } else if (read === 'bad') {
        this.readBuff = { mult: READ.badMalus, t: READ.duration };
        this.gradeAdd(GRADE.badRead, 'LEITURA RUIM');
        this.events.emit('toast', `Leitura ruim contra ${this.oppScheme.name}`, 0xff7b6b);
      }
    }
    if (this.atoBuff) {
      this.atoBuff = false;
      this.readBuff = { mult: (this.readBuff && this.readBuff.t > 0 ? this.readBuff.mult : 1) * 1.08, t: READ.duration };
    }
  }

  // ------------------------------------------------------------------ defesa: chamadas, falta de ataque, rebote
  defCall(handler) {
    const u = this.user;
    const late = this.mode === 'tempo' && this.gameClock < 40 && this.score.home < this.score.away;
    if (late && handler && handler.distTo(u) < 26 && this.ft === null) {
      this.floatText(u.x, u.y - u.headY - 6, 'FALTA INTENCIONAL', 0xffe14d);
      this.teamFouls.home++;
      sfx.play('whistle');
      return this.startFreeThrows(handler, 2, 'Falta intencional: 2 lances livres');
    }
    // troca: você pega o atacante mais perto de você, e o colega fica com o seu
    const mine = this.defenseAI.manOf(u);
    let best = null;
    let bd = Infinity;
    for (const d of this.home) {
      if (d === u) continue;
      const m = this.defenseAI.manOf(d);
      if (!m || m === mine) continue;
      const dist = m.distTo(u);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    if (!best || bd > 110) return this.floatText(u.x, u.y - u.headY - 6, 'NINGUEM PERTO', 0xb8b0d0);
    this.defenseAI.swap(u, best);
    this.floatText(u.x, u.y - u.headY - 6, 'TROCA!', 0x6dff6d);
    this.floatText(best.x, best.y - best.headY - 6, 'TROCA!', 0x6dff6d);
    sfx.play('select');
  }

  boxOut(u) {
    u.boxT = this.time.now + 900;
    u.body.pushable = false;
    this.time.delayedCall(900, () => (u.body.pushable = true));
    this.floatText(u.x, u.y - u.headY - 6, 'BOX OUT', 0x6fa0ff);
  }

  checkCharge(u, h, moving, dt) {
    u.stillT = moving ? 0 : (u.stillT || 0) + dt;
    if (!h || !h.drive || u.stillT < 0.3 || (this.chargeCd || 0) > this.time.now) return;
    const d = h.distTo(u);
    if (d > 11) return;
    // você precisa estar na frente (entre ele e a cesta)
    const inFront = courtDist(u, this.basket) < courtDist(h, this.basket);
    if (!inFront) return;
    this.chargeCd = this.time.now + 2500;
    h.drive = null;
    if (Math.random() < 0.55 * u.skills.defense) {
      sfx.play('whistle');
      this.floatText(u.x, u.y - u.headY - 8, 'FALTA DE ATAQUE!', 0x6dff6d);
      this.narrator.say('charge', {}, true);
      this.gradeAdd(GRADE.steal);
      this.turnover(u, 'Cavou a falta de ataque!', 0x6dff6d);
    } else {
      h.stun = 0.3;
      this.floatText(u.x, u.y - u.headY - 8, 'SEGUROU', 0x6fa0ff);
    }
  }
  // ------------------------------------------------------------------ você na defesa (sempre o armador)
  updateUserDefense(dt) {
    const k = this.keys;
    const u = this.user;
    const ball = this.ball;
    const handler = ball.state === 'held' && ball.holder.team === this.offSide ? ball.holder : null;
    const { ix, iy, moving } = this.readInput();
    u.lookAt = handler || ball;
    u.lookAlways = true;
    u.slideT = Math.max(0, (u.slideT || 0) - dt);
    u.slideCooldown = Math.max(0, (u.slideCooldown || 0) - dt);
    u.reachCooldown = Math.max(0, (u.reachCooldown || 0) - dt);
    this.passTarget = null;

    // 1..6: escolhe o esquema defensivo do seu time
    NUM_KEYS.forEach((name, i) => {
      if (JustDown(k[name]) && DEF_SCHEMES[i]) this.setUserScheme(i);
    });
    // controle: direcional escolhe a defesa (cima Individual, dir Trocas, baixo Hedge, esq Dobra; LB + cima/dir = Zona/Pressão)
    if (this.padPlay !== null && DEF_SCHEMES[this.padPlay]) this.setUserScheme(this.padPlay);
    // Y/Triângulo (ou U) na defesa: MÃO ALTA — contesta sem sair do chão (não cai em finta, não faz falta)
    if (this.btn.LOB.just) {
      u.handsT = this.time.now + 900;
      u.setPose('shoot', 0.9); // braços levantados
      this.floatText(u.x, u.y - u.headY - 6, 'MAO ALTA', 0x6fa0ff);
    }
    // C / LB na defesa: pedir TROCA de marcação (ou, perdendo no fim do jogo por tempo, falta intencional)
    if (this.btn.SCREEN.just || this.padScreenTap) this.defCall(handler);
    // L com a bola no ar: bloqueio de rebote; com a bola solta perto: mergulho
    if (this.btn.L.just && (ball.state === 'shot' || ball.state === 'drop')) this.boxOut(u);
    else if (this.btn.L.just && ball.state === 'loose') this.dive(u);
    if (u.diveT > 0) {
      u.diveT -= dt;
      u.moveDir(u.diveDir.x, u.diveDir.y, u.speed * 2.3, dt * 4);
      return;
    }
    if (u.boxT > this.time.now) {
      // segurando a posição: seu homem fica para trás
      u.moveDir(0, 0, 0, dt * 4);
      const m = this.defenseAI.manOf(u);
      if (m && m.distTo(u) < 16) m.slowT = Math.max(m.slowT, 0.2);
      return;
    }
    // falta de ataque: parado (de pé) no caminho de quem infiltra
    this.checkCharge(u, handler, moving, dt);
    // (64) se mexendo no caminho dele: a falta pode ser sua
    if (this.v64) blockingFoul(this, u, handler, moving);
    // (64) pulando no rebote, J dá um tapinha para um companheiro
    if (this.v64 && this.btn.J.just && tipOut(this, u)) return;

    // J: pede dobra de marcação em quem está com a bola
    if (this.btn.J.just && handler && !this.defenseAI.double) {
      this.defenseAI.forceDouble = USER_DEFENSE.callDoubleTime;
      this.defenseAI.doubleCd = 0;
      this.floatText(u.x, u.y - u.headY - 6, 'DOBRA!', 0xffe14d);
    }

    const speed = this.sprintAndStamina(u, moving, dt);
    if (this.btn.L.just && (moving || handler) && u.slideCooldown <= 0 && this.stamina > 6) {
      u.slideT = USER_DEFENSE.slideTime;
      u.slideCooldown = USER_DEFENSE.slideCooldown;
      u.slideDir = { x: ix, y: iy };
      // Corte defensivo: sem direção, L corta o caminho de quem tem a bola (entre ele e a cesta)
      if (!moving && handler) {
        const cx = handler.x + (this.basket.x - handler.x) * 0.12 - u.x;
        const cy = handler.y + (this.basket.y - handler.y) * 0.12 - u.y;
        const cl = Math.hypot(cx, cy) || 1;
        u.slideDir = { x: cx / cl, y: cy / cl };
        u.cutoffT = 0.45;
      }
      this.stamina = Math.max(0, this.stamina - STAMINA.crossCost * 0.5);
      sfx.play('cross');
    }
    // corte defensivo: chegou na frente de quem infiltra -> a infiltração para
    if (u.cutoffT > 0) {
      u.cutoffT -= dt;
      if (handler && handler.drive && Math.hypot(handler.x - u.x, handler.y - u.y) < 13) {
        handler.drive = null;
        handler.decideTimer = 0.35;
        u.cutoffT = 0;
        this.floatText(u.x, u.y - u.headY - 6, 'CORTOU!', 0x6dff6d);
        this.gradeAdd(1);
      }
    }
    if (u.reachT > 0) {
      // bote: a mão vai na bola (avanço curto)
      u.reachT -= dt;
      const bx = ball.x - u.x;
      const by = ball.y - u.y;
      const bl = Math.hypot(bx, by) || 1;
      u.moveDir(bx / bl, by / bl, u.speed * 1.6, dt * 3);
    } else if (u.slideT > 0) u.moveDir(u.slideDir.x, u.slideDir.y, u.speed * USER_DEFENSE.slideMult, dt * 3);
    else if (moving) u.moveDir(ix, iy, speed, dt);
    else u.moveDir(0, 0, 0, dt);

    // K na defesa: o jogo decide pela situação
    //  - passe passando perto -> interceptação
    //  - quem tem a bola está arremessando / subindo para a bandeja -> PULO (toco/contestar)
    //  - quem tem a bola está driblando -> ROUBO (mão na bola, sem pular)
    if (this.btn.K.just && u.reachCooldown <= 0) {
      u.reachCooldown = USER_DEFENSE.stealCooldown;
      const shooting = handler && (handler.pose === 'shoot' || handler.layupT > 0);
      if (ball.state === 'pass' && Math.hypot(u.x - ball.x, u.y - ball.y) < 18) {
        this.stats.stl++;
        this.gradeAdd(GRADE.steal);
        this.turnover(u, 'Interceptou!', 0x6dff6d);
        sfx.play('steal');
      } else if (shooting || !handler || ball.state === 'shot') {
        this.userJumpT = 0.4;
        u.setPose('shoot', 0.3);
        u.lift = this.v64 && ball.state === 'loose' ? 8 : 5; // (64) pulo de rebote mais alto
      } else if (!this.inbound) {
        u.reachT = 0.14;
        const d = u.distTo(handler);
        if (d > USER_DEFENSE.stealRange) {
          this.floatText(u.x, u.y - u.headY - 6, 'LONGE', 0xb8b0d0);
        } else {
          // bola exposta: driblando em velocidade, no crossover, ou do lado em que você está
          const hv = handler.body.velocity;
          const ballSide = Math.sign(ball.x - handler.x) === Math.sign(u.x - handler.x) ? 1.35 : 1;
          const exposed = (handler.sprinting || Math.hypot(hv.x, hv.y) > 85 ? 1.4 : 1) * (handler.crossTimer > 0 ? 1.5 : 1) * ballSide;
          const dbl = this.isDoubled(handler) ? 1.4 : 1;
          const timing = this.v64 ? stealTiming(this, u, handler) : 1; // (64) bola exposta na hora certa
          const chance = USER_DEFENSE.stealChance * u.skills.defense * u.skills.stealMult * dbl * exposed * timing * (1.15 - d / 60);
          if (Math.random() < chance) {
            this.stats.stl++;
            this.gradeAdd(GRADE.steal);
            this.onSteal(u, handler);
          } else {
            u.slowT = USER_DEFENSE.whiffSlow;
            this.floatText(u.x, u.y - u.headY - 6, 'ERROU', 0xff7b6b);
            this.maybeReachFoul(u, handler);
          }
        }
      }
    }
  }

  setUserScheme(i) {
    this.userScheme = DEF_SCHEMES[i];
    sfx.play('play');
    this.events.emit('toast', `Defesa: ${this.userScheme.name}`, 0xff9a4d);
  }

  // E + número: o companheiro executa um movimento agora (alas cortam, grandes bloqueiam).
  // Chamar bloqueio: o pivô/ala-pivô mais perto vem fazer o pick and roll em você.
  callScreen() {
    const u = this.user;
    const bigs = this.home.filter((p) => p !== u && (p.role === 'C' || p.role === 'PF') && p.motion);
    if (!bigs.length) return;
    bigs.sort((a, b) => a.distTo(u) - b.distTo(u));
    this.commandMate(bigs[0]);
    this.floatText(u.x, u.y - u.headY - 16, 'PEDIU BLOQUEIO', 0x6fa0ff);
  }

  // Você planta um bloqueio: não é empurrado, e o defensor que bater fica preso um instante.
  userScreening(u, on, dt) {
    if (!on) {
      if (u.screenOn) {
        u.screenOn = false;
        u.body.pushable = true;
      }
      return;
    }
    if (!u.screenOn) {
      u.screenOn = true;
      this.floatText(u.x, u.y - u.headY - 10, 'BLOQUEIO', 0xffe14d);
    }
    u.body.pushable = false;
    u.moveDir(0, 0, 0, dt * 4);
    u.setPose(null);
    this.regenStamina(dt);
    for (const d of this.defTeam) {
      if (d.stun > 0 || d.slowT > 0 || Math.hypot(d.x - u.x, d.y - u.y) > 12) continue;
      const v = d.body.velocity;
      if (Math.hypot(v.x, v.y) < 12 || (d.screenedAt && this.time.now - d.screenedAt < 1500)) continue;
      d.screenedAt = this.time.now;
      d.slowT = 0.8;
      d.stun = 0.25;
      this.floatText(d.x, d.y - d.headY - 6, 'BLOQUEADO!', 0x6dff6d);
      this.narrator.say('screen', {});
      this.gradeAdd(1);
      // o companheiro com a bola aproveita e ataca
      const h = this.ball.state === 'held' ? this.ball.holder : null;
      if (h && h.team === 'home' && h !== u && this.defenderOf(h) === d) h.drive = { t: 0, off: rand(-6, 6) };
    }
  }

  // Sem a bola, botão de arremesso: "chuta!" — o companheiro com a bola arremessa (ou ataca se estiver longe).
  urgeShot() {
    const b = this.ball;
    const h = b.state === 'held' ? b.holder : null;
    if (!h || h.team !== 'home' || h === this.user || this.inbound || h.layupT > 0 || h.pose === 'shoot') return;
    this.floatText(this.user.x, this.user.y - this.user.headY - 10, 'CHUTA!', 0x6fa0ff);
    const open = this.nearestDefenderDist(h);
    if (distToBasket(h, this.dir) < OFFENSE.shootRange * 1.08) {
      this.gradeAdd(open >= OFFENSE.openDist ? GRADE.goodPass : GRADE.riskyPass);
      h.drive = null;
      this.aiShoot(h);
    } else {
      h.drive = { t: 0, off: rand(-8, 8) };
      this.floatText(h.x, h.y - h.headY - 10, 'ATACA', 0x6fa0ff);
    }
  }

  commandMate(p) {
    if (!p || !p.motion) return;
    if (this.play) {
      this.play.finish();
      this.play = null;
    }
    const big = p.role === 'C' || p.role === 'PF';
    Object.assign(p.motion, { action: big ? 'ballscreen' : 'cut', phase: 0, t: big ? 3.5 : 2.4, holdT: undefined, backdoor: !big });
    p.body.pushable = true;
    this.floatText(p.x, p.y - p.headY - 8, big ? 'BLOQUEIO!' : 'CORTA!', 0x6fa0ff);
    sfx.play('select');
  }

  // ------------------------------------------------------------------ faltas e lances livres
  // Falta "comum" (mão na bola): reposição lateral; a partir do bônus, 2 lances livres.
  maybeReachFoul(defender, victim) {
    if (this.state !== 'live' || !victim) return;
    const chance = defender === this.user ? FOUL.userReachChance : FOUL.aiReachChance;
    if (Math.random() >= chance) return;
    const side = defender.team;
    this.teamFouls[side]++;
    sfx.play('whistle');
    this.floatText(defender.x, defender.y - defender.headY - 6, 'FALTA', 0xffe14d);
    if (this.teamFouls[side] >= FOUL.bonus) {
      this.startFreeThrows(victim, 2, `Falta (${this.teamFouls[side]}) - bonus: 2 lances livres`);
    } else {
      const spot = { x: victim.x < BASKET.x ? COURT.left - 4 : COURT.right + 4, y: clamp(victim.y, COURT.top + 20, COURT.bottom - 20) };
      this.startInbound(victim.team, spot, 0.7, `Falta (${this.teamFouls[side]})`, 0xffe14d);
    }
  }

  // Falta no arremesso? Defensor muito perto pode fazer falta.
  shootingFoul(shooter, kind) {
    const { d, dist } = this.nearestDefender(shooter);
    if (!d || dist > FOUL.closeDist) return false;
    const base = kind === 'jump' ? FOUL.jumpChance : FOUL.layupChance;
    const careful = d === this.user ? 1 : 1.2 - 0.3 * d.skills.defense; // bons defensores fazem menos falta
    if (Math.random() >= base * careful) return false;
    this.teamFouls[d.team]++;
    this.floatText(d.x, d.y - d.headY - 6, 'FALTA!', 0xffe14d);
    sfx.play('whistle');
    return true;
  }

  startFreeThrows(shooter, n, title) {
    if (this.play) this.play.finish();
    this.play = null;
    this.gathering = false;
    this.meter.clear();
    this.setOffense(shooter.team);
    this.autoSubs('home');
    this.autoSubs('away');
    this.state = 'ft';
    this.ft = { shooter, left: n, t: FT.wait, flying: false, gather: false, meter: 0 };
    // posições: arremessador na linha; defesa nos blocos; os outros fora do garrafão
    const lane = [{ x: 212, y: 94 }, { x: 268, y: 94 }, { x: 212, y: 114 }, { x: 268, y: 114 }];
    const outside = [{ x: 170, y: 190 }, { x: 310, y: 190 }, { x: 240, y: 214 }, { x: 130, y: 150 }, { x: 350, y: 150 }];
    shooter.setPosition(...Object.values(this.toWorld({ x: BASKET.x, y: 140 })));
    const defs = [...this.defTeam].sort((a, b) => b.cm - a.cm);
    const offs = this.offTeam.filter((p) => p !== shooter).sort((a, b) => b.cm - a.cm);
    // (com menos jogadores em quadra — 2x2, 3x3, treino — alguém pode não existir)
    const place = (p, s) => {
      if (!p) return;
      const w = this.toWorld(s);
      p.setPosition(w.x, w.y);
      p.stop();
    };
    place(defs[0], lane[0]);
    place(defs[1], lane[1]);
    place(offs[0], lane[2]);
    place(offs[1], lane[3]);
    [...defs.slice(2), ...offs.slice(2)].forEach((p, i) => place(p, outside[i % outside.length]));
    this.ball.give(shooter);
    shooter.facing.set(0, -this.dir);
    if (title) this.events.emit('toast', title, 0xffe14d);
  }

  updateFT(dt) {
    const ft = this.ft;
    for (const p of this.all) p.moveDir(0, 0, 0, dt * 3);
    if (!ft || ft.flying) return;
    const s = ft.shooter;
    s.lookAt = this.basket;
    if (s === this.user) {
      // seu lance livre: segure e solte K no verde
      if (!ft.gather && this.btn.K.just) {
        ft.gather = true;
        ft.meter = 0;
      }
      if (ft.gather) {
        ft.meter += dt / s.skills.meterTime;
        this.gathering = true;
        this.meterValue = ft.meter;
        s.setPose('shoot', 0.1);
        if (!this.btn.K.isDown || ft.meter >= SHOT.autoRelease) {
          this.gathering = false;
          this.meter.clear();
          this.ftShoot(this.timingQuality(ft.meter, s));
        }
      }
    } else {
      ft.t -= dt;
      if (ft.t <= 0) this.ftShoot(rand(0.55, 1));
    }
  }

  ftShoot(q) {
    const ft = this.ft;
    const s = ft.shooter;
    const skill = (s.skills.mid - 0.8) / 0.45;
    const chance = clamp((FT.base + FT.skill * skill) * lerp(0.7, 1.12, q), 0.25, 0.97);
    const made = Math.random() < chance;
    s.setPose('shoot', 0.35);
    this.ball.shoot(s, made, 'jump', this.basket, this.dir);
    this.pendingShot = { shooter: s, three: false, made, kind: 'ft' };
    ft.left--;
    ft.flying = true;
    ft.gather = false;
    if (s === this.pg) this.stats.fta = (this.stats.fta || 0) + 1;
    this.floatText(s.x, s.y - s.headY - 10, `LANCE LIVRE ${Math.round(chance * 100)}%`, 0xffffff);
  }

  // depois de um lance livre: próximo, ou bola viva / reposição
  afterFT(made) {
    const ft = this.ft;
    if (!ft) return;
    if (ft.left > 0) {
      this.time.delayedCall(made ? 50 : 450, () => {
        if (this.state !== 'ft') return;
        this.ball.give(ft.shooter);
        ft.flying = false;
        ft.t = FT.wait;
      });
      return;
    }
    this.ft = null;
    this.state = 'live';
    // errou o último: rebote valendo (a bola já está solta)
  }

  // ------------------------------------------------------------------ tempo de jogo (modo 6 minutos)
  updateGameClock(dt) {
    if (this.mode !== 'tempo' || this.suddenDeath) return;
    this.gameClock = Math.max(0, this.gameClock - dt);
    if (this.gameClock > 0) return;
    // bola no ar quando o tempo acaba: vale se cair (buzzer beater)
    if (this.ball.state === 'shot' || this.ball.state === 'drop') {
      if (!this.pendingEnd) {
        this.pendingEnd = true;
        sfx.play('buzzer');
      }
      return;
    }
    if (this.score.home !== this.score.away) return this.finishGame();
    this.suddenDeath = true;
    sfx.play('buzzer');
    this.events.emit('banner', 'Morte subita', 'Proxima cesta vence', 0xffe14d, 1.8);
  }

  finishGame() {
    if (this.state === 'final') return;
    this.state = 'final';
    this.stateT = GAME.finalTime;
    const win = this.score.home > this.score.away;
    this.events.emit('banner', win ? 'Vitoria!' : 'Derrota', `${this.homeTeam.name} ${this.score.home} x ${this.score.away} ${this.awayTeam.name}`, win ? 0x6dff6d : 0xff7b6b, GAME.finalTime);
    sfx.play('buzzer');
  }

  // ------------------------------------------------------------------ arremesso
  // Janela do verde. (só no 64, você, fora do lance livre) reage ao contexto: defensor perto, gás, em movimento.
  greenWindow(u) {
    const win = SHOT.perfectWindow * u.skills.perfectWindow;
    return this.v64 && u === this.user && !this.ft ? win * windowMult(this, u) : win;
  }

  timingQuality(v, shooter) {
    const win = this.greenWindow(shooter);
    const off = Math.abs(v - SHOT.sweetSpot);
    if (off <= win) return 1;
    return clamp(1 - (off - win) / (SHOT.tolerance - win), 0, 1);
  }

  releaseUserShot() {
    const u = this.user;
    const v = this.meterValue;
    this.gathering = false;
    this.meter.clear();
    // Toque rápido no K = FINTA (pump fake): defensores colados podem pular
    if (v < 0.22 && !this.stepBack) {
      u.pose = null;
      this.floatText(u.x, u.y - u.headY - 14, 'FINTA', 0x6fa0ff);
      for (const d of this.defTeam) {
        if (d === this.user || d.stun > 0 || Math.hypot(d.x - u.x, d.y - u.y) > 22) continue;
        if (Math.random() < 0.55 / d.skills.defense) {
          d.stun = 0.5;
          d.lift = 6;
          d.setPose('shoot', 0.4);
          this.floatText(d.x, d.y - d.headY - 6, 'PULOU!', 0xffe14d);
        }
      }
      return;
    }
    const q = this.timingQuality(v, u);
    let label;
    let color;
    if (q >= 1) [label, color] = ['VERDE!', 0x6dff6d];
    else if (q >= 0.6) [label, color] = ['BOM', 0xffe14d];
    else [label, color] = [v < SHOT.sweetSpot ? 'CEDO' : 'TARDE', 0xff7b6b];
    this.shoot(u, q, label, color, q >= 1);
    this.stepBack = 0;
  }

  aiShoot(p) {
    if (isLayupZone(p, this.dir)) return this.startLayup(p);
    // você pulou cedo (K) colado nele: a IA finta e passa por você
    const u = this.user;
    if (this.userOnDefense && this.userJumpT > 0.15 && u.distTo(p) < 24 && Math.random() < 0.55) {
      u.slowT = 0.6;
      this.floatText(u.x, u.y - u.headY - 8, 'CAIU NA FINTA', 0xff7b6b);
      p.drive = { t: 0, off: rand(-10, 10) };
      return;
    }
    p.setPose('shoot', 0.6);
    this.time.delayedCall(240, () => {
      if (this.state === 'live' && this.ball.state === 'held' && this.ball.holder === p) {
        this.shoot(p, rand(OFFENSE.aiTimingMin, OFFENSE.aiTimingMax));
      }
    });
  }

  // Contestação: distância do defensor mais próximo + diferença de altura.
  contestFactor(shooter, openDist, minFactor) {
    if (this.v64) return handContest(this, shooter, openDist, minFactor); // (64) a mão do defensor conta
    const { d, dist } = this.nearestDefender(shooter);
    let f = clamp(dist / openDist, minFactor, 1);
    if (d && dist < openDist) f *= clamp(1 - (d.cm - shooter.cm) * HEIGHT.contestPerCm, 0.85, 1.12);
    return f;
  }

  shotMods(shooter, chance) {
    if (this.userOnDefense && this.user.handsT > this.time.now && Math.hypot(this.user.x - shooter.x, this.user.y - shooter.y) < 30) {
      if (!this.v64) chance *= 0.82; // (no 64 a mão alta já entra na contestação pela mão)
      if (!shooter.contestShown || this.time.now - shooter.contestShown > 500) {
        shooter.contestShown = this.time.now;
        this.floatText(this.user.x, this.user.y - this.user.headY - 16, 'CONTESTOU!', 0x6dff6d);
      }
    }
    if (this.userOnDefense && this.userJumpT > 0 && Math.hypot(this.user.x - shooter.x, this.user.y - shooter.y) < 24) {
      chance *= USER_DEFENSE.contestBonus;
    }
    if (this.assist && this.assist.player === shooter && this.time.now - this.assist.time < 2500) {
      chance += this.pg.skills.assistBonus;
    }
    return chance;
  }

  // Chance = distância x marcação (e altura) x timing x estamina x arremesso do jogador
  shotChance(shooter, q) {
    const three = isThree(shooter, this.dir);
    const base = curve(SHOT.distanceCurve, distToBasket(shooter, this.dir));
    const contest = this.contestFactor(shooter, SHOT.contestOpenDist, SHOT.contestMinFactor);
    const timing = lerp(SHOT.timingMin, shooter.skills.timingMax, q);
    const stam = shooter === this.user ? lerp(SHOT.staminaMin, 1, this.stamina / STAMINA.max) : 1;
    const skill = three ? shooter.skills.three : shooter.skills.mid;
    const diff = shooter.team === 'away' ? this.difficulty.shoot : 1;
    const step = shooter === this.user && this.stepBack ? 0.92 : 1; // step-back: mais espaço, arremesso mais difícil
    const extra = this.heatMult(shooter) * this.energyMult(shooter) * this.adjMult(shooter, three ? 'three' : 'mid');
    const zone = this.zoneMult(shooter) * this.badgeMult(shooter);
    return clamp(this.shotMods(shooter, base * contest * timing * stam * skill * diff * step * this.readMult(shooter) * extra * zone), SHOT.minChance, SHOT.maxChance);
  }

  // Toco: você (se pulou com K) ou um defensor da IA colado. Altura conta muito.
  tryBlock(shooter, mult = 1) {
    const hf = (b) => clamp(1 + (b.cm - shooter.cm) * HEIGHT.blockPerCm, 0.3, 2.4);
    let blocker = null;
    const u = this.user;
    if (this.userOnDefense && this.userJumpT > 0 && Math.hypot(u.x - shooter.x, u.y - shooter.y) < USER_DEFENSE.blockRange) {
      if (Math.random() < USER_DEFENSE.blockChance * u.skills.defense * u.skills.blockMult * hf(u) * mult) blocker = u;
    }
    if (!blocker) {
      for (const d of this.defTeam) {
        if (d === u || d.stun > 0) continue;
        if (Math.hypot(d.x - shooter.x, d.y - shooter.y) < DEFENSE.blockRange && Math.random() < DEFENSE.blockChance * d.skills.defense * d.skills.blockMult * hf(d) * mult) {
          blocker = d;
          break;
        }
      }
    }
    if (!blocker) return false;
    shooter.setPose('shoot', 0.3);
    blocker.setPose('shoot', 0.35);
    blocker.lift = 7;
    this.ball.dir = this.dir;
    this.ball.block(shooter, blocker);
    if (blocker === u) {
      this.stats.blk++;
      this.gradeAdd(GRADE.block);
    }
    if (shooter === this.pg) this.stats.fga++;
    this.floatText(blocker.x, blocker.y - blocker.headY - 8, 'TOCO!', 0xff5a4d);
    this.narrator.say('block', { home: blocker.team === 'home' }, true);
    sfx.play('block');
    sfx.play('aww');
    return true;
  }

  // VERDE (estilo 2K): soltar na janela verde com bom arremessador e sem marcação colada = cesta garantida.
  greenMakes(shooter) {
    const three = isThree(shooter, this.dir);
    const r = shooter.r || { three: 70, mid: 70 };
    const good = (three ? r.three : r.mid) >= SHOT.greenRating;
    const open = this.nearestDefenderDist(shooter) >= SHOT.greenOpenDist;
    const range = distToBasket(shooter, this.dir) <= SHOT.greenMaxDist;
    return good && open && range;
  }

  shoot(shooter, q, label = null, color = 0xffffff, green = false) {
    let chance = this.shotChance(shooter, q);
    if (this.tryBlock(shooter)) return;
    const three = isThree(shooter, this.dir);
    const foul = this.shootingFoul(shooter, 'jump');
    // verde: garantido se for bom arremessador livre; senão, ainda ganha um bônus forte
    const sure = green && this.greenMakes(shooter);
    if (green && !sure) chance = Math.min(SHOT.maxChance, chance * SHOT.greenBonus);
    const made = sure || Math.random() < chance * (foul ? FOUL.madeMult : 1);
    if (green && made) {
      this.greenFlash(shooter);
      sfx.play('green');
      this.narrator.say('green', { home: shooter.team === 'home' }, true);
    }
    shooter.setPose('shoot', 0.35);
    shooter.lift = 4;
    this.ball.shoot(shooter, made, 'jump', this.basket, this.dir);
    this.pendingShot = { shooter, three, made, kind: 'jump', foul: foul ? (three ? 3 : 2) : 0 };
    this.logShot(shooter, made, three);
    // estouro do cronômetro / arremesso do meio da quadra
    this.pendingShot.late = this.shotClock < 1 || (this.mode === 'tempo' && this.gameClock < 1.5);
    this.pendingShot.heave = distToBasket(shooter, this.dir) > 230;
    if (shooter === this.pg) {
      this.stats.fga++;
      if (three) this.stats.tpa++;
      // QI: arremesso livre é boa decisão; forçado (defensor colado) é ruim
      const open = this.nearestDefenderDist(shooter);
      if (open >= OFFENSE.openDist) this.gradeAdd(GRADE.openShot);
      else if (open < 14) this.gradeAdd(GRADE.forcedShot, 'FORCADO');
    }
    const txt = [label, DEBUG.showShotChance ? (sure ? '100%' : `${Math.round(chance * 100)}%`) : null].filter(Boolean).join(' ');
    if (txt) this.floatText(shooter.x, shooter.y - shooter.headY - 10, txt, color);
  }

  // ------------------------------------------------------------------ bandeja / enterrada
  startLayup(p) {
    if (this.ball.state !== 'held' || this.ball.holder !== p || p.layupT > 0) return;
    p.drive = null;
    p.pose = null;
    const t = this.toWorld({ x: BASKET.x, y: BASKET.y + 12 });
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    p.layupDir = { x: (t.x - p.x) / (d || 1), y: (t.y - p.y) / (d || 1) };
    p.layupT = d < 14 ? 0.05 : LAYUP.driveTime;
    p.layupStyle = null;
    // (só no 64) segurando o sprint: pede ENTERRADA
    p.wantDunk = !!(this.v64 && p === this.user && this.btn.SHIFT.isDown);
    if (p === this.user) {
      this.gathering = false;
      // tipo de bandeja pelo comando (como no 2K):
      //   L segurado -> REVERSA (do outro lado do aro: difícil de tocar)
      //   direção para o lado -> EURO STEP (foge do contato)
      //   parado -> HOP STEP (força: mais falta, menos toco)
      const { ix, iy, moving } = this.readInput();
      const side = moving ? Math.abs(ix * p.layupDir.y - iy * p.layupDir.x) : 0;
      if (this.btn.L.isDown) p.layupStyle = 'reverse';
      else if (moving && side > 0.6) {
        p.layupStyle = 'euro';
        // o euro step desvia o caminho para o lado escolhido
        const lx = p.layupDir.x + ix * 0.6;
        const ly = p.layupDir.y + iy * 0.6;
        const ll = Math.hypot(lx, ly) || 1;
        p.layupDir = { x: lx / ll, y: ly / ll };
      } else if (!moving) p.layupStyle = 'hop';
    } else if (p.skills.finishing > 0.95) {
      // a IA também varia: reversa com marcador colado, euro step ou hop step
      const { d: nd, dist } = this.nearestDefender(p);
      const r = Math.random();
      if (nd && dist < 16 && r < 0.3) p.layupStyle = 'reverse';
      else if (r < 0.45) p.layupStyle = 'euro';
      else if (r < 0.55) p.layupStyle = 'hop';
    }
  }

  updateLayups(dt) {
    for (const p of this.all) {
      if (!(p.layupT > 0)) continue;
      if (this.ball.state !== 'held' || this.ball.holder !== p) {
        p.layupT = 0;
        continue;
      }
      p.lookAt = this.basket;
      p.moveDir(p.layupDir.x, p.layupDir.y, p.speed * LAYUP.driveSpeedMult, dt * 3);
      p.layupT -= dt;
      if (p.layupT <= 0) this.finishLayup(p);
    }
  }

  finishLayup(p) {
    p.layupT = 0;
    const space = this.nearestDefenderDist(p);
    const near = Math.hypot(p.x - this.basket.x, p.y - this.basket.y) < LAYUP.dunkMaxDist;
    const fin = p.skills.finishing;
    let dunk = fin >= LAYUP.dunkMinFinishing && space >= LAYUP.dunkOpenDist && near && Math.random() < LAYUP.dunkTry;
    // (só no 64) você pediu a enterrada: sai se for atlético o bastante (finalização boa ou 1,96 m+)
    const asked = p.wantDunk && near;
    if (asked) dunk = fin >= 0.95 || p.cm >= 196;
    p.wantDunk = false;
    // defensor colado entre você e o aro: flutuante (armadores/alas) ou gancho (grandalhões)
    const { d: nd } = this.nearestDefender(p);
    const blocked = !dunk && nd && space < 13 && courtDist(nd, this.basket) < courtDist(p, this.basket);
    const big = p.role === 'C' || p.role === 'PF';
    let chance;
    let kind = dunk ? 'dunk' : 'layup';
    let label = dunk ? 'ENTERRADA!' : 'BANDEJA';
    if (dunk) chance = LAYUP.dunkChance * (asked && space < LAYUP.dunkOpenDist ? 0.72 : 1); // contestada erra mais
    else if (blocked) {
      kind = 'floater';
      label = big ? 'GANCHO' : 'FLUTUANTE';
      chance = (big ? 0.5 * fin : 0.46 * p.skills.mid) * this.contestFactor(p, 20, 0.7);
    } else chance = lerp(LAYUP.contestedChance, LAYUP.openChance, this.contestFactor(p, p.layupStyle === 'euro' ? 16 : LAYUP.contestOpenDist, 0)) * fin;
    // estilos de bandeja (seu armador)
    const style = !dunk && p.layupStyle;
    let blockMult = blocked ? 0.7 : 1.6;
    let foulMult = 1;
    if (style === 'reverse') {
      label = 'REVERSA';
      blockMult *= 0.45;
      chance *= 0.95;
    } else if (style === 'euro') {
      label = 'EURO STEP';
      blockMult *= 0.8;
    } else if (style === 'hop') {
      label = 'HOP STEP';
      blockMult *= 0.75;
      foulMult = 1.7;
      chance *= 1.03;
    }
    if (p.team === 'away') chance *= this.difficulty.shoot;
    chance *= this.readMult(p) * this.heatMult(p) * this.energyMult(p) * this.adjMult(p, 'fin') * this.zoneMult(p, 'garrafao') * this.badgeMult(p);
    chance = clamp(this.shotMods(p, chance), SHOT.minChance, LAYUP.maxChance);
    if (this.tryBlock(p, blockMult)) return;
    const foul = !dunk && (this.shootingFoul(p, 'layup') || (foulMult > 1 && Math.random() < 0.08));
    const made = Math.random() < chance * (foul ? FOUL.madeMult : 1);
    p.setPose('shoot', 0.45);
    p.lift = dunk ? 12 : 8;
    p.stop();
    this.ball.shoot(p, made, kind, this.basket, this.dir);
    this.pendingShot = { shooter: p, three: false, made, kind, foul: foul ? 2 : 0, style };
    this.logShot(p, made, false);
    if (p === this.pg) this.stats.fga++;
    this.floatText(p.x, p.y - p.headY - 12, DEBUG.showShotChance ? `${label} ${Math.round(chance * 100)}%` : label, dunk ? 0xffe14d : 0xffffff);
  }

  // ------------------------------------------------------------------ eventos da bola
  wireBallEvents() {
    const b = this.ball;
    b.on('bounce', (holder) => {
      if (holder === this.user) sfx.play('bounce', 0.8);
      else if (holder) sfx.play('bounce', 0.25);
      else sfx.play('bounce', Math.min(1, 0.3 + Math.abs(b.vz) / 120));
    });
    b.on('caught', (to) => {
      sfx.play('catch');
      const from = b.passFrom;
      this.lastPass = { from, to, time: this.time.now };
      if (to === this.pg) this.userCatchAt = this.time.now;
      if (this.v64 && to === this.user) onUserCatch(this, to); // (só no 64) ameaça tripla
      to.decideTimer = rand(OFFENSE.decideMin, OFFENSE.decideMax);
      to.catchShoot = this.nearestDefenderDist(to) >= OFFENSE.openDist + 6 && distToBasket(to, this.dir) < OFFENSE.shootRange;
      if (to.catchShoot) to.decideTimer = OFFENSE.catchAndShoot;
      to.holdCount = 0;
      if (from === this.pg && to !== this.pg) this.assist = { player: to, time: this.time.now };
      if (to === this.pg) {
        if (this.userCalling && isLayupZone(to, this.dir)) this.floatText(to.x, to.y - to.headY - 14, 'GIVE AND GO', 0x6fa0ff);
        this.userCalling = false;
        this.assist = null;
      }
      if (b.wasLob) {
        b.wasLob = false;
        // perto do aro vira ponte aérea; longe, é só um passe alto por cima da defesa
        if (distToBasket(to, this.dir) < 90) this.finishAlleyOop(to);
      }
    });
    b.on('intercepted', (d) => {
      sfx.play('steal');
      if (b.passFrom === this.pg) {
        this.stats.to++;
        this.gradeAdd(GRADE.turnover);
      }
      const mine = d.team === 'home';
      this.turnover(d, mine ? 'Interceptado!' : 'Passe interceptado', mine ? 0x6dff6d : 0xff7b6b);
    });
    b.on('rim', () => {
      sfx.play('rim');
      sfx.play('aww');
      if (this.contestCtl) return this.contestCtl.shotDone(false);
      const s = this.pendingShot;
      if (!s) return;
      if (s.kind !== 'ft') s.shooter.heat = Math.max(0, (s.shooter.heat || 0) - 0.3);
      if (s.kind !== 'ft' && s.shooter === this.pg) this.badgeXP(-0.7);
      if (s.three) s.shooter.threeStreak = 0;
      if (s.shooter === this.pg) this.survStreakBreak(s.three ? 'chutador' : s.kind === 'layup' || s.kind === 'dunk' ? 'infiltrador' : null);
      this.pendingEnd = false;
      if (s.kind === 'ft') {
        this.pendingShot = null;
        this.afterFT(false);
      } else if (s.foul && this.state === 'live') {
        // errou com falta: lances livres
        this.pendingShot = null;
        this.startFreeThrows(s.shooter, s.foul, `Falta no arremesso: ${s.foul} lances livres`);
      }
    });
    b.on('rimIn', () => {
      sfx.play('swish');
      const net = this.basket === BASKET ? this.nets.top : this.nets.bottom;
      net.setTexture('net_swish');
      this.time.delayedCall(280, () => {
        net.setTexture('net');
        sfx.play('net');
      });
    });
    b.on('scored', () => this.onScore());
    b.on('out', () => {
      if (this.state !== 'live') return;
      sfx.play('whistle');
      const side = b.lastTouch === 'home' ? 'away' : 'home';
      // reposição de FORA da quadra, no ponto onde a bola saiu
      const o = COURT_OUT - 5;
      const spot = { x: clamp(b.x, COURT.left + 8, COURT.right - 8), y: clamp(b.y, COURT.top + 8, COURT.bottom - 8) };
      if (b.x <= COURT.left) spot.x = COURT.left - o;
      else if (b.x >= COURT.right) spot.x = COURT.right + o;
      else if (b.y <= COURT.top) spot.y = COURT.top - o;
      else if (b.y >= COURT.bottom) spot.y = COURT.bottom + o;
      this.startInbound(side, spot, 0.6, 'Bola fora', 0xd8d0ee);
    });
  }

  onScore() {
    if (this.contestCtl) {
      this.pendingShot = null;
      return this.contestCtl.shotDone(true);
    }
    const s = this.pendingShot;
    if (!s || (this.state !== 'live' && this.state !== 'ft')) return;
    this.pendingShot = null;
    const isFT = s.kind === 'ft';
    // Rua 3x3: cesta sem limpar a bola não vale — posse do adversário
    if (this.street && this.needClear && !isFT) {
      this.pendingEnd = false;
      sfx.play('whistle');
      this.floatText(this.basket.x, this.basket.y - 46, 'NAO VALEU!', 0xff9a4d);
      const other = s.shooter.team === 'home' ? 'away' : 'home';
      if (s.shooter.team === 'home') this.gradeAdd(GRADE.turnover);
      return this.startInbound(other, null, GAME.inboundTime, 'Nao valeu: faltou limpar a bola', 0xff9a4d);
    }
    // na Rua 3x3 vale 1 dentro do arco e 2 de fora
    const pts = isFT ? 1 : s.three ? (this.street ? 2 : 3) : this.street ? 1 : 2;
    const team = s.shooter.team;
    this.score[team] += pts;
    if (!isFT) this.addHeat(s.shooter, s.three ? 1.5 : 1);
    if (!isFT && s.shooter === this.pg) this.badgeXP(s.three ? 1.5 : 1);
    this.trackScore(team, pts);
    const sb = this.boxOf(s.shooter);
    sb.pts += pts;
    if (!isFT) {
      sb.fgm++;
      const lp = this.lastPass;
      if (lp && lp.to === s.shooter && lp.from.team === team && lp.from !== s.shooter && this.time.now - lp.time < 4000) this.boxOf(lp.from).ast++;
      if (team === 'home') this.events.emit('toast', 'R: REPLAY', 0xb8b0d0);
      // narração
      const home = team === 'home';
      const assisted = lp && lp.to === s.shooter && lp.from !== s.shooter && this.time.now - lp.time < 4000;
      if (this.pendingEnd || s.late) this.narrator.say('buzzer', { home }, true);
      else if (s.heave) this.narrator.say('heave', { home }, true);
      else if (s.alley) this.narrator.say('alley', { home }, true);
      else if (s.three) {
        s.shooter.threeStreak = (s.shooter.threeStreak || 0) + 1;
        if (s.shooter.threeStreak >= 3) this.narrator.say('streak3', { name: this.shortName(s.shooter), n: s.shooter.threeStreak, home }, true);
        else this.narrator.say('three', { home });
      } else if (s.kind === 'dunk') this.narrator.say('dunk', { home });
      else if (assisted && Math.random() < 0.5) this.narrator.say('assist', { home });
      else if (s.style === 'euro' || s.style === 'reverse' || s.style === 'hop') this.narrator.say(s.style, { home }, true);
      else this.narrator.say(s.kind === 'jump' ? 'jump' : 'layup', { home });
      this.narrator.onPoints(team, pts, home ? this.homeTeam.name : this.awayTeam.name);
    }
    this.pendingEnd = false;
    // sequência de pontos do seu armador (o adversário reage dobrando/zona)
    this.userStreak = s.shooter === this.pg && !isFT ? (this.userStreak || 0) + 1 : isFT ? this.userStreak || 0 : 0;
    const what = isFT ? 'LANCE LIVRE' : s.kind === 'dunk' ? 'ENTERRADA' : s.three ? 'CESTA DE 3' : 'CESTA';
    this.floatText(this.basket.x, this.basket.y - 46, `+${pts}`, team === 'home' ? 0xffe14d : 0xff7b6b);
    if (team === 'home') {
      if (s.shooter === this.pg) {
        this.stats.pts += pts;
        if (isFT) this.stats.ftm = (this.stats.ftm || 0) + 1;
        else this.stats.fgm++;
        if (s.three) this.stats.tpm++;
        if (!isFT) this.survStreakHit(s.three ? 'chutador' : s.kind === 'layup' || s.kind === 'dunk' ? 'infiltrador' : null);
      } else if (!isFT && this.assist && this.assist.player === s.shooter && this.time.now - this.assist.time < OFFENSE.assistWindow * 1000) {
        this.stats.ast++;
        this.possAssist = true;
        this.survStreakHit('passador');
        this.gradeAdd(GRADE.assist);
        this.addHeat(this.pg, 0.6); // o maestro também pega fogo distribuindo
        this.badgeXP(0.5);
        this.floatText(this.pg.x, this.pg.y - this.pg.headY - 8, 'ASSISTENCIA', 0x6fa0ff);
      }
      sfx.play('cheer');
    } else {
      sfx.play('aww');
      if (!isFT && this.userOnDefense && s.shooter === this.defenseAI.manOf(this.user)) this.gradeAdd(GRADE.manScored, 'SEU HOMEM');
    }

    if (team === 'home') this.possPts += pts;
    if (this.practice) {
      // treino livre: soma a posse e começa outra
      this.prac.possPts += pts;
      if (s.foul && !isFT) return this.startFreeThrows(s.shooter, 1, 'Cesta e falta! +1 lance livre');
      if (isFT && this.ft && this.ft.left > 0) return this.afterFT(true);
      this.ft = null;
      this.state = 'live';
      return this.endPracticePossession();
    }
    const reached = !this.survival && this.mode === 'pontos' && (this.score.home >= GAME.targetScore || this.score.away >= GAME.targetScore);
    if (reached || (this.suddenDeath && this.score.home !== this.score.away)) {
      this.ft = null;
      return this.finishGame();
    }
    if (this.training && team === 'home' && !this.training.def) return this.endTraining(true);
    if (this.training && team === 'away' && this.training.def) {
      if (!this.mechDone && this.lessonTries < 3) return this.retryDefLesson();
      return this.endTraining(false);
    }
    // cesta com falta: lance livre extra ("and one")
    if (s.foul) return this.startFreeThrows(s.shooter, 1, 'Cesta e falta! +1 lance livre');
    // lance livre: ainda tem outro?
    if (isFT && this.ft && this.ft.left > 0) return this.afterFT(true);
    if (isFT) {
      this.ft = null;
      this.state = 'live';
    }
    // Reposição pela linha de fundo da cesta que levou o ponto
    const other = team === 'home' ? 'away' : 'home';
    const spot = { x: BASKET.x + 14, y: team === 'home' ? COURT.top - 6 : COURT.bottom + 6 };
    const name = team === 'home' ? this.shortName(s.shooter) : this.awayTeam.name;
    this.startInbound(other, spot, GAME.inboundTime, `${what}! ${name}`, team === 'home' ? 0x6dff6d : 0xff7b6b);
  }

  shortName(p) {
    return p.info.nick || p.info.name;
  }

  onSteal(defender, victim) {
    this.narrator.say('steal', { home: defender.team === 'home' });
    if (this.state !== 'live') return;
    if (victim === this.pg) {
      this.stats.to++;
      this.gradeAdd(GRADE.turnover);
    }
    sfx.play('steal');
    this.floatText(defender.x, defender.y - defender.headY - 6, 'ROUBO!', defender.team === 'home' ? 0x6dff6d : 0xff7b6b);
    this.turnover(defender, null);
  }

  // Até que altura o jogador alcança a bola no pulo (rebote no ar): altura + rebote.
  reachZ(p) {
    const base = BALL.pickupMaxZ + REBOUND.jumpReach + (p.cm - HEIGHT.baseCm) * REBOUND.reachPerCm + (p.skills.rebounding - 1) * 20;
    return this.v64 ? reachZ64(this, p, base) : base; // (64) você só alcança alto pulando na hora (X)
  }

  // (64) a bola está exposta para o seu roubo agora? (o 3D faz a bola brilhar)
  stealCueOn() {
    return !!this.v64 && stealCue(this);
  }

  // Onde a bola solta vai estar na altura das mãos (os rebotes miram aí, não na bola).
  reboundSpot() {
    const b = this.ball;
    if (b.state !== 'loose' || b.z <= 0.5) return { x: b.x, y: b.y };
    const zt = REBOUND.handZ;
    const disc = b.vz * b.vz + 2 * BALL.gravity * (b.z - zt);
    const t = disc > 0 ? (b.vz + Math.sqrt(disc)) / BALL.gravity : 0;
    return {
      x: clamp(b.x + b.vx * t, COURT.left + 4, COURT.right - 4),
      y: clamp(b.y + b.vy * t, COURT.top + 4, this.street ? MID_Y - 10 : COURT.bottom - 4),
    };
  }

  checkPickups() {
    const b = this.ball;
    if (b.state !== 'loose') return;
    let best = null;
    let bd = Infinity;
    for (const p of this.all) {
      if (p.stun > 0 || p.noPickUntil > this.time.now) continue; // (64) quem deu tapinha espera um instante
      if (b.z > this.reachZ(p)) continue;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const radius = BALL.pickupRadius * Math.sqrt(p.skills.rebounding) + (b.z > BALL.pickupMaxZ ? REBOUND.airRadius : 0) + (p.diveT > 0 ? 7 : 0) + (p.boxT > this.time.now ? 4 : 0);
      // briga pelo rebote: o mais alto/melhor reboteiro leva vantagem quando dois chegam juntos
      const score = d - (p.cm - HEIGHT.baseCm) * 0.08 - (p.skills.rebounding - 1) * 10;
      if (d < radius && score < bd) {
        bd = score;
        best = p;
      }
    }
    if (!best) return;
    if (b.z > BALL.pickupMaxZ) {
      best.lift = Math.min(12, 4 + b.z * 0.2); // pegou no ar
      best.setPose('shoot', 0.25);
    }
    sfx.play('catch');
    if (best === this.pg) this.stats.reb++;
    this.boxOf(best).reb++;
    if (best.team !== this.offSide) {
      this.turnover(best, null);
      this.floatText(best.x, best.y - best.headY - 6, 'REBOTE', best.team === 'home' ? 0x6dff6d : 0xff7b6b);
    } else {
      b.give(best);
      this.assist = null;
      best.decideTimer = rand(OFFENSE.decideMin, OFFENSE.decideMax);
      this.shotClock = Math.max(this.shotClock, GAME.offensiveReboundClock);
      this.passCount = 0;
      this.floatText(best.x, best.y - best.headY - 6, 'REBOTE OF.', best.team === 'home' ? 0x6dff6d : 0xff7b6b);
      if (this.v64) onOffensiveRebound(this, best, b.z); // (só no 64) tapinha / enterrada no rebote
    }
  }

  updateShotClock(dt) {
    if (this.practice && this.practice.mode === 'shots') {
      this.shotClock = 24;
      return;
    }
    const s = this.ball.state;
    if ((s !== 'held' && s !== 'pass') || this.inbound) return;
    this.shotClock = Math.max(0, this.shotClock - dt);
    if (this.shotClock <= 0) {
      sfx.play('buzzer');
      const other = this.offSide === 'home' ? 'away' : 'home';
      this.startInbound(other, { x: this.ball.x, y: this.ball.y }, 0.6, 'Estouro dos 24s', 0xd8d0ee);
    }
  }

  // ------------------------------------------------------------------ indicadores
  updateIndicators(time) {
    this.drawPlayRoutes(time);
    const u = this.user;
    const ball = this.ball;
    const live = this.state === 'live';
    this.ring.setPosition(Math.round(u.x), Math.round(u.y));
    const inZone = live && !this.userOnDefense && ball.holder === u && ball.state === 'held' && isLayupZone(u, this.dir);
    if (inZone) this.ring.setTint(0x6dff6d);
    else if (this.userOnDefense) this.ring.setTint(0xff9a4d);
    else this.ring.clearTint();

    // jogada sem bola: anel azul onde você deve chegar
    const runTo = live && this.play && this.play.offBall && !this.userOnDefense && this.ball.holder !== u ? this.play.target('PG') : null;
    this.runMarker.setVisible(!!runTo);
    if (runTo) this.runMarker.setPosition(Math.round(runTo.x), Math.round(runTo.y)).setAlpha(0.6 + 0.4 * Math.abs(Math.sin(time / 160)));
    const t = live ? this.passTarget : null;
    this.targetMarker.setVisible(!!t);
    if (t) {
      const bob = Math.round(Math.sin(time / 120) * 1.5);
      this.targetMarker.setPosition(Math.round(t.x), Math.round(t.y - t.headY - 8 + bob));
      this.targetMarker.setAlpha(this.btn.J.isDown ? 1 : 0.55);
      const risky = this.laneRisk(u, t) < 9;
      const open = this.nearestDefenderDist(t) >= OFFENSE.openDist;
      this.targetMarker.setTint(risky ? 0xff5a4d : open ? 0x6dff6d : 0xffe14d);
    }

    // Ícones de passe: segure J (teclado: números 1-4) ou RB (controle: botões A/B/X/Y com as cores do Xbox).
    // Segurando LB (comando), os mesmos ícones mostram em quem o comando vai.
    const iconMode = (ball.holder === u && (this.btn.J.isDown || this.padMod === 'icon')) || this.padMod === 'cmd';
    const showIcons = live && !this.userOnDefense && iconMode;
    const usePad = this.lastInputPad || !!this.padMod;
    const PAD_BTN = [['A', 0x6dff6d], ['B', 0xff5a4d], ['X', 0x4d8dff], ['Y', 0xffe14d]];
    this.icons.forEach((ic, i) => {
      ic.bg.setVisible(showIcons);
      ic.num.setVisible(showIcons);
      if (!showIcons) return;
      const [label, color] = usePad ? PAD_BTN[i] || ['?', 0xffffff] : [String(i + 1), 0xffffff];
      if (ic.num.text !== label) ic.num.setText(label);
      ic.bg.setTint(color);
      const x = Math.round(ic.p.x);
      const y = Math.round(ic.p.y - ic.p.headY - 16);
      ic.bg.setPosition(x, y);
      ic.num.setPosition(x + 1, y + 1);
    });

    const options = this.play && !this.userOnDefense ? this.play.options() : [];
    const myMan = this.userOnDefense ? this.defenseAI.manOf(u) : null;
    this.all.forEach((p, i) => {
      const dot = this.dots[i];
      let tint = null;
      if (live && !this.userOnDefense && p.team === 'home' && p !== u && !showIcons) {
        if (options.includes(p)) tint = 0xffe14d;
        else if (this.nearestDefenderDist(p) >= OFFENSE.openDist && !inBackcourt(p, this.dir)) tint = 0x6dff6d;
      } else if (live && p === myMan) tint = 0xff5a4d;
      // linguagem corporal: defensor negando a linha de passe (leitura: corte pelas costas)
      else if (live && !this.userOnDefense && p.team === 'away' && p.denying) tint = 0xff9a4d;
      dot.setVisible(tint !== null);
      if (tint !== null) {
        dot.setTint(tint);
        dot.setPosition(Math.round(p.x), Math.round(p.y - p.headY - 8 - p.lift + Math.sin(time / 150 + i) * 1.2));
      }
    });

    const g = this.meter;
    g.clear();
    if (!this.gathering) return;
    const W = 24;
    const x = Math.round(u.x - W / 2);
    // perto do topo da tela (corner/linha de fundo) o placar tapava o medidor: desenha embaixo dos pés
    const above = Math.round(u.y - u.headY - 14);
    const y = above - this.cameras.main.scrollY < 40 ? Math.round(u.y + 6) : above;
    const win = this.greenWindow(u);
    g.fillStyle(0x10101a).fillRect(x - 1, y - 1, W + 2, 6);
    g.fillStyle(0x3a3352).fillRect(x, y, W, 4);
    g.fillStyle(0x2e8b3a).fillRect(x + Math.round(W * (SHOT.sweetSpot - win)), y, Math.max(2, Math.round(W * win * 2)), 4);
    const v = this.meterValue;
    const over = v > SHOT.sweetSpot + win;
    const color = v > 1 ? (Math.floor(time / 60) % 2 ? 0xff5a4d : 0xffffff) : over ? 0xff9a4d : 0xffe14d;
    g.fillStyle(color).fillRect(x, y + 1, Math.round(W * Math.min(1, v)), 2);
  }

  // cesta no verde: rede e aro acendem verde + brilho na tela
  greenFlash(shooter) {
    const net = this.basket === BASKET ? this.nets.top : this.nets.bottom;
    const flight = SHOT.flightBase + SHOT.flightPerPx * distToBasket(shooter, this.dir);
    this.time.delayedCall(Math.round(flight * 1000) - 60, () => {
      net.setTint(0x6dff6d);
      const glow = this.add.circle(this.basket.x, this.basket.y + 4, 18, 0x6dff6d, 0.45).setDepth(3500);
      this.tweens.add({ targets: glow, scale: 2.2, alpha: 0, duration: 650, onComplete: () => glow.destroy() });
      this.cameras.main.flash(120, 60, 255, 90);
      this.time.delayedCall(700, () => net.setTint(this.street ? 0x9aa0aa : 0xffffff));
    });
  }

  // Setas da jogada do SEU time: rota de cada companheiro até o próximo ponto (cor da posição),
  // quadrado amarelo onde vai o bloqueio, e a SUA rota em azul (sem bola: para onde correr;
  // com bola: para o bloqueio que vão fazer para você).
  drawPlayRoutes(time) {
    const g = this.playG;
    g.clear();
    const play = this.play;
    if (!play || play.done || this.offSide !== 'home' || this.state !== 'live') return;
    const ph = play.phase;
    if (!ph) return;
    const COLORS = { PG: 0x3ad6ff, SG: 0x6fa0ff, SF: 0x6dff6d, PF: 0xff9a4d, C: 0xff6bd5 };
    const screens = [].concat(ph.screen || []);
    const pulse = 0.55 + 0.35 * Math.abs(Math.sin(time / 220));
    const arrow = (from, to, color, alpha, width = 1) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len < 10) return;
      const ux = dx / len;
      const uy = dy / len;
      // tracejado que "anda" na direção da rota (com contorno escuro para ler no piso)
      const off = (time / 40) % 9;
      for (const [w, col, al] of [[width + 2, 0x000000, 0.4], [width, color, alpha]]) {
        g.lineStyle(w, col, al);
        for (let t = off; t < len - 6; t += 9) {
          const e = Math.min(t + 5, len - 6);
          g.lineBetween(from.x + ux * t, from.y + uy * t, from.x + ux * e, from.y + uy * e);
        }
      }
      // ponta da seta
      const a = 0.5;
      const hx = to.x - ux * 2;
      const hy = to.y - uy * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      g.fillStyle(color, alpha);
      g.fillTriangle(hx, hy, hx - 7 * (ux * c - uy * s), hy - 7 * (uy * c + ux * s), hx - 7 * (ux * c + uy * s), hy - 7 * (uy * c - ux * s));
    };
    const u = this.user;
    for (const role of Object.keys(ph.spots)) {
      const p = play.byRole(role);
      const to = play.target(role);
      if (!p || !to) continue;
      const mine = p === u;
      if (screens.includes(role)) {
        g.lineStyle(2, 0xffe14d, pulse).strokeRect(Math.round(to.x) - 5, Math.round(to.y) - 5, 10, 10);
      }
      if (play.holds(role)) continue; // já está bloqueando
      arrow({ x: p.x, y: p.y }, to, mine ? COLORS.PG : COLORS[role] || 0xffffff, mine ? 1 : 0.85, mine ? 3 : 2);
    }
    // com a bola numa jogada de bloqueio: seta sua até o bloqueio (passe do lado do meio)
    if (this.ball.holder === u && screens.length && !ph.spots.PG) {
      const s = play.target(screens[0]);
      if (s) arrow({ x: u.x, y: u.y }, { x: s.x + play.mid * 16, y: s.y + 8 * this.dir }, COLORS.PG, 1, 3);
    }
    // quem é a leitura (opção) ganha um anel pulsando
    for (const t of play.options()) {
      if (t === u) continue;
      g.lineStyle(1, 0x6dff6d, pulse).strokeEllipse(t.x, t.y, 18, 9);
    }
  }

  floatText(x, y, str, color = 0xffffff) {
    // lição de mecânica: reconhece quando você fez o movimento
    if (this.training && this.training.mech && !this.mechDone && String(str).toUpperCase().startsWith(this.training.mech.toUpperCase())) {
      this.mechDone = true;
      this.events.emit('toast', 'ISSO! ' + (this.training.def ? 'AGORA PARE O ATAQUE' : 'AGORA FACA A CESTA'), 0x6dff6d);
    }
    const t = new PixelText(this, x, y, str, { color, origin: 0.5, depth: 4000 });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      onUpdate: (tw) => {
        const v = tw.getValue();
        t.setPosition(x, y - v * 14);
        t.setAlpha(1 - Math.max(0, (v - 0.6) / 0.4));
      },
      onComplete: () => t.destroy(),
    });
  }
}
