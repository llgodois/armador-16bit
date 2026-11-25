import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { teamById, teamHudColor, fmtHeight } from '../data/teams.js';
import { BUILDS } from '../data/builds.js';
import { PLAY_LIBRARY } from '../plays/index.js';
import { DEF_SCHEMES, schemeById } from '../data/defense.js';
import { badgesOf, BADGES } from '../data/badges.js';
import { generatePlayerTexture } from '../art/sprites.js';
import {
  COLLEGE, ATTRS, loadCareer, saveCareer, clearCareer, newCareer, careerPG, startPro, nextYear, spendPoint, buildName,
} from '../data/career.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

const NAMES = ['Lucas Leite', 'Pedro Alves', 'Joao Rocha', 'Rafa Lima', 'Davi Souza', 'Caio Melo', 'Theo Nunes', 'Enzo Dias'];

// Modo carreira: tudo numa cena, a "página" depende do estágio salvo.
export default class CareerScene extends Phaser.Scene {
  constructor() {
    super('Career');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const g = this.add.graphics();
    for (let x = 0; x < VIEW.W; x += 6) g.fillStyle([0x2b1f15, 0x261b13, 0x2f2217][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    g.fillStyle(0x0b0b14, 0.65).fillRect(0, 0, VIEW.W, VIEW.H);
    this.g = g;
    this.c = loadCareer();
    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.onNav && this.onNav(-1, 0));
    kb.on('keydown-W', () => this.onNav && this.onNav(-1, 0));
    kb.on('keydown-DOWN', () => this.onNav && this.onNav(1, 0));
    kb.on('keydown-S', () => this.onNav && this.onNav(1, 0));
    kb.on('keydown-LEFT', () => this.onNav && this.onNav(0, -1));
    kb.on('keydown-RIGHT', () => this.onNav && this.onNav(0, 1));
    kb.on('keydown-ENTER', () => this.onEnter && this.onEnter());
    kb.once('keydown-ESC', () => this.scene.start('Title'));
    if (!this.c) return this.pageCreate();
    ({ college: () => this.pageHub(true), draft: () => this.pageDraft(), season: () => this.pageHub(false), awards: () => this.pageAwards() })[this.c.stage]();
  }

  T(x, y, s, o = {}) {
    return new PixelText(this, x, y, s, o);
  }

  // Sprite do seu jogador com as cores de um time (editor de visual só existe aqui).
  preview(x, y, p, team) {
    const key = `car_prev_${p.skin}_${p.hair}_${p.cm}_${team.id}`;
    if (!this.textures.exists(key)) generatePlayerTexture(this, key, team.colors, p.cm, p.skin, p.hair);
    if (this.prevSpr) this.prevSpr.destroy();
    this.prevSpr = this.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(3);
  }

  // ------------------------------------------------------------ criar jogador
  pageCreate() {
    const W = VIEW.W;
    drawPanel(this.g, 10, 10, W - 20, VIEW.H - 20, 0xffe14d);
    this.T(W / 2, 16, 'CRIE SEU ARMADOR', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const f = { name: NAMES[0], cm: 188, skin: 0, hair: 0, build: 0 };
    let typed = false;
    const rows = ['name', 'cm', 'skin', 'hair', 'build', 'go'];
    let row = 0;
    const texts = rows.map((_, i) => this.T(40, 50 + i * 22, '', {}));
    const tip = this.T(40, 196, '', { color: 0xb8b0d0 });
    const team = COLLEGE[0];
    const draw = () => {
      const vals = {
        name: `NOME: ${f.name}${row === 0 ? '_' : ''}`,
        cm: `ALTURA: ${fmtHeight(f.cm)}`,
        skin: `PELE: ${f.skin + 1}/6`,
        hair: `CABELO: ${f.hair + 1}/6`,
        build: `ESTILO: ${BUILDS[f.build].name}`,
        go: 'COMECAR CARREIRA',
      };
      rows.forEach((r, i) => texts[i].setText(`${i === row ? '> ' : '  '}${vals[r]}`).setColor(i === row ? 0xffe14d : r === 'go' ? 0x6dff6d : 0xd8d0ee));
      tip.setText(row === 0 ? 'DIGITE O NOME (BACKSPACE APAGA)' : row === 1 ? 'MAIS ALTO: MAIS REBOTE E BANDEJA, MENOS VELOCIDADE' : row === 4 ? BUILDS[f.build].desc.toUpperCase() : 'ESQ/DIR MUDA');
      this.preview(360, 170, { skin: f.skin, hair: f.hair, cm: f.cm }, team);
    };
    this.onNav = (dr, dv) => {
      row = (row + dr + rows.length) % rows.length;
      const r = rows[row];
      if (dv) {
        if (r === 'cm') f.cm = Math.max(178, Math.min(206, f.cm + dv * 2));
        if (r === 'skin') f.skin = (f.skin + dv + 6) % 6;
        if (r === 'hair') f.hair = (f.hair + dv + 6) % 6;
        if (r === 'build') f.build = (f.build + dv + BUILDS.length) % BUILDS.length;
        if (r === 'name') f.name = NAMES[(NAMES.indexOf(f.name) + dv + NAMES.length) % NAMES.length] || NAMES[0];
      }
      sfx.play('select');
      draw();
    };
    this.input.keyboard.on('keydown', (ev) => {
      if (rows[row] !== 'name') return;
      if (ev.key === 'Backspace') {
        if (!typed) f.name = '';
        typed = true;
        f.name = f.name.slice(0, -1);
      } else if (/^[a-zA-Z ]$/.test(ev.key) && !['w', 's', 'W', 'S'].includes(ev.key)) {
        if (!typed) f.name = '';
        typed = true;
        if (f.name.length < 16) f.name += ev.key.toUpperCase();
      } else return;
      draw();
    });
    this.onEnter = () => {
      if (rows[row] !== 'go') return this.onNav(1, 0);
      newCareer({ name: f.name.trim() || NAMES[0], cm: f.cm, skin: f.skin, hair: f.hair, build: BUILDS[f.build].id });
      sfx.play('play');
      this.scene.restart();
    };
    draw();
  }

  // ------------------------------------------------------------ painel do jogador (universitário/temporada)
  playerCard(x, y, team) {
    const c = this.c;
    const p = c.player;
    drawPanel(this.g, x, y, 200, 210, teamHudColor(team));
    this.T(x + 8, y + 8, p.name, { color: 0xffffff });
    this.T(x + 8, y + 18, `${p.nick}  ${fmtHeight(p.cm)}  ${buildName(p.build)}`, { color: 0xffe14d });
    this.T(x + 8, y + 28, `${team.name} (${team.city})`, { color: teamHudColor(team) });
    this.preview(x + 26, y + 120, p, team);
    ATTRS.forEach(([k, lbl], i) => {
      const v = k === 'vis' ? p.vis : k === 'zone' ? 40 + (p.zone || 0) * 6 : k === 'badge' ? 40 + (p.badge || 0) * 9 : p.r[k];
      this.T(x + 56, y + 44 + i * 10, lbl.slice(0, 11), { color: 0xb8b0d0 });
      this.g.fillStyle(0x3a3352).fillRect(x + 128, y + 45 + i * 10, 40, 5);
      this.g.fillStyle(v >= 85 ? 0x6dff6d : v >= 70 ? 0xffe14d : 0xff7b6b).fillRect(x + 128, y + 45 + i * 10, Math.round((40 * (v - 40)) / 59), 5);
      this.T(x + 172, y + 44 + i * 10, String(v), { color: 0xd8d0ee });
    });
    const bad = badgesOf({ ...p, r: p.r }).map((b) => BADGES[b].name);
    this.T(x + 8, y + 132, 'INSIGNIAS:', { color: 0x6fa0ff });
    (bad.length ? bad : ['nenhuma ainda']).slice(0, 4).forEach((b, i) => this.T(x + 8, y + 142 + i * 10, b, { color: 0xd8d0ee }));
    if (c.awards.length) this.T(x + 8, y + 186, `PREMIOS: ${c.awards.length}`, { color: 0xffe14d });
  }

  pageHub(college) {
    const c = this.c;
    const W = VIEW.W;
    const team = teamById(college ? c.collegeTeam : c.team);
    this.playerCard(8, 8, team);
    drawPanel(this.g, 214, 8, W - 222, 210, 0xffe14d);
    let opp;
    if (college) {
      const others = COLLEGE.filter((t) => t.id !== c.collegeTeam);
      opp = others[c.college.game % others.length];
      this.T(224, 16, `UNIVERSITARIO - JOGO ${c.college.game + 1}/3`, { color: 0xffe14d });
      this.T(224, 28, `VITORIAS ${c.college.wins}  -  OS OLHEIROS DO DRAFT ESTAO VENDO`, { color: 0xb8b0d0 });
    } else {
      const s = c.season;
      opp = teamById(s.schedule[s.game]);
      this.T(224, 16, `TEMPORADA ${c.year} - JOGO ${s.game + 1}/${s.schedule.length}`, { color: 0xffe14d });
      this.T(224, 28, `CAMPANHA ${s.wins}-${s.losses}   MEDIAS: ${(s.tot.pts / Math.max(1, s.game)).toFixed(1)} PTS ${(s.tot.ast / Math.max(1, s.game)).toFixed(1)} AST`, { color: 0xb8b0d0 });
    }
    this.T(224, 42, `PROXIMO: ${opp.name.toUpperCase()}`, { color: teamHudColor(opp) });
    if (c.last) this.T(224, 54, `ULTIMO JOGO: ${c.last.win ? 'V' : 'D'} ${c.last.score.home}-${c.last.score.away}  NOTA ${c.last.grade}  QI ${c.last.iq}`, { color: 0xd8d0ee });

    // menu: jogar, plano de jogo (3 jogadas ensaiadas + defesa), evoluir atributo
    const items = [
      { label: 'JOGAR', color: 0x6dff6d },
      { label: '' }, { label: '' }, { label: '' }, { label: '' },
      { label: '' },
      { label: 'ABANDONAR CARREIRA', color: 0xff7b6b },
    ];
    const m = makeMenu(this, items, 230, 72, { gap: 14, origin: 0 });
    let attr = 0;
    const refresh = () => {
      c.plan.plays.forEach((pi, k) => m.label(1 + k, `ENSAIADA ${k + 1}: < ${PLAY_LIBRARY[pi].name} >`));
      m.label(4, `DEFESA DO TIME: < ${schemeById(c.plan.defense).name} >`);
      m.label(5, c.points > 0 ? `EVOLUIR (${c.points} PTS): < ${ATTRS[attr][1]} >` : 'SEM PONTOS DE EVOLUCAO');
    };
    refresh();
    this.T(224, 176, 'PLANO DE JOGO: AS 3 JOGADAS ENSAIADAS RENDEM', { color: 0x7a7290 });
    this.T(224, 186, 'MAIS QUANDO CHAMADAS. EVOLUA COM BOAS DECISOES.', { color: 0x7a7290 });
    this.T(W / 2, 228, 'CIMA/BAIXO ESCOLHE  ESQ/DIR MUDA  ENTER CONFIRMA  ESC TITULO', { origin: [0.5, 0], color: 0xb8b0d0 });
    this.onNav = (dr, dv) => {
      if (dr) m.set(m.index + dr);
      const i = m.index;
      if (dv) {
        if (i >= 1 && i <= 3) c.plan.plays[i - 1] = (c.plan.plays[i - 1] + dv + PLAY_LIBRARY.length) % PLAY_LIBRARY.length;
        if (i === 4) c.plan.defense = DEF_SCHEMES[(DEF_SCHEMES.indexOf(schemeById(c.plan.defense)) + dv + DEF_SCHEMES.length) % DEF_SCHEMES.length].id;
        if (i === 5) attr = (attr + dv + ATTRS.length) % ATTRS.length;
        saveCareer(c);
        refresh();
      }
      sfx.play('select');
    };
    this.onEnter = () => {
      const i = m.index;
      if (i === 5 && c.points > 0) {
        spendPoint(c, ATTRS[attr][0]);
        sfx.play('play');
        return this.scene.restart();
      }
      if (i === 6) {
        clearCareer();
        return this.scene.start('Title');
      }
      if (i !== 0) return;
      sfx.play('select');
      const setup = {
        home: team.id, away: opp.id, build: c.player.build, legend: null, customPG: careerPG(c),
        diff: college ? 'facil' : 'normal', mode: 'pontos', profile: 'normal', champ: false,
        career: { plan: college ? null : c.plan },
      };
      this.registry.set('setup', setup);
      this.scene.start('Game', setup);
    };
  }

  pageDraft() {
    const c = this.c;
    const W = VIEW.W;
    const team = teamById(c.team);
    drawPanel(this.g, 30, 30, W - 60, VIEW.H - 60, teamHudColor(team));
    this.T(W / 2, 44, 'NOITE DO DRAFT', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    this.T(W / 2, 80, `ESCOLHA NUMERO ${c.pick}`, { scale: 2, origin: [0.5, 0], color: 0xffffff });
    this.T(W / 2, 108, `${c.player.name} VAI PARA OS ${team.name.toUpperCase()}`, { origin: [0.5, 0], color: teamHudColor(team) });
    this.T(W / 2, 122, `(${team.city})`, { origin: [0.5, 0], color: 0xb8b0d0 });
    this.preview(W / 2, 200, c.player, team);
    this.T(W / 2, 214, 'ENTER: COMECAR A TEMPORADA', { origin: [0.5, 0], color: 0x6dff6d });
    this.onEnter = () => {
      startPro(c);
      this.scene.restart();
    };
  }

  pageAwards() {
    const c = this.c;
    const W = VIEW.W;
    const s = c.season;
    drawPanel(this.g, 30, 20, W - 60, VIEW.H - 40, 0xffe14d);
    this.T(W / 2, 32, `FIM DA TEMPORADA ${c.year}`, { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    this.T(W / 2, 56, `CAMPANHA ${s.wins}-${s.losses}`, { origin: [0.5, 0], color: 0xd8d0ee });
    const n = Math.max(1, s.game);
    this.T(W / 2, 70, `${(s.tot.pts / n).toFixed(1)} PTS  ${(s.tot.ast / n).toFixed(1)} AST  ${(s.tot.reb / n).toFixed(1)} REB  QI ${Math.round(s.tot.iq / n)}`, { origin: [0.5, 0], color: 0xd8d0ee });
    const aw = c.lastAwards || [];
    this.T(W / 2, 94, aw.length ? 'PREMIOS' : 'SEM PREMIOS DESTA VEZ', { origin: [0.5, 0], scale: 2, color: aw.length ? 0x6dff6d : 0xff9a4d });
    aw.forEach((a, i) => this.T(W / 2, 118 + i * 12, `* ${a.toUpperCase()} *`, { origin: [0.5, 0], color: 0xffe14d }));
    this.T(W / 2, 218, 'ENTER: PROXIMA TEMPORADA', { origin: [0.5, 0], color: 0x6dff6d });
    this.onEnter = () => {
      nextYear(c);
      this.scene.restart();
    };
  }
}
