import Phaser from 'phaser';
import { VIEW, DIFFICULTY, MODES } from '../config.js';
import { playerTexKey, legendTexKey } from '../art/sprites.js';
import { TEAMS, FRANCHISES, franchiseOf, historicOf, POS, teamHudColor, fmtHeight } from '../data/teams.js';
import { BUILDS, buildById, buildForPlayer } from '../data/builds.js';
import { LEGENDS } from '../data/legends.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { SHOT_PROFILES } from '../game/skills.js';
import { BADGES, badgesOf } from '../data/badges.js';
import { createChampionship } from '../data/championship.js';
import { isUnlocked, unlockOf, isTeamUnlocked, historicRequirement, teamBest } from '../data/unlocks.js';

const BARS = [['three', '3PT'], ['mid', 'MEI'], ['fin', 'FIN'], ['pass', 'PAS'], ['spd', 'VEL'], ['def', 'DEF']];
const DIFF_IDS = Object.keys(DIFFICULTY);
const MODE_IDS = Object.keys(MODES);
const PROFILE_IDS = Object.keys(SHOT_PROFILES);
const SERIES = [1, 3];
const STEP_NAMES = { home: 'SEU TIME', pg: 'ARMADOR', away: 'ADVERSARIO', rules: 'REGRAS', go: 'CONFIRMAR' };

// =====================================================================
//  MONTE SEU JOGO — em ETAPAS (uma coisa por tela):
//   1 seu time (Leste/Oeste -> time -> atual/histórico)  2 seu armador (do time ou lenda)
//   3 adversário  4 estilo + arremesso  5 dificuldade + modo (+ série)  6 confirmar
//  ENTER/A avança · ESC/B volta · setas navegam
// =====================================================================
export default class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  init(data) {
    this.champMode = !!(data && data.champ);
    this.street = !!(data && data.street);
    this.survival = !!(data && data.survival);
    // fora do Arcade, lendas bloqueadas precisam ser desbloqueadas (desafio ou moedas)
    this.locks = this.champMode || this.street || this.survival;
  }

  legendLocked(i) {
    if (!this.locks || !i) return false;
    return !isUnlocked(this.registry.get('profile'), LEGENDS[i - 1].id);
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0b14');
    const prev = this.registry.get('setup') || { home: 'ondas', away: 'astros', build: 'chutador' };
    this.sel = {
      home: this.frIndex(prev.home),
      away: this.frIndex(prev.away),
      homeH: !!TEAMS.find((t) => t.id === prev.home && t.era),
      awayH: !!TEAMS.find((t) => t.id === prev.away && t.era),
      build: Math.max(0, BUILDS.findIndex((b) => b.id === prev.build)),
      legend: prev.legend ? LEGENDS.findIndex((l) => l.id === prev.legend) + 1 : 0,
      diff: Math.max(0, DIFF_IDS.indexOf(prev.diff || 'normal')),
      mode: Math.max(0, MODE_IDS.indexOf(prev.mode || 'pontos')),
      profile: Math.max(0, PROFILE_IDS.indexOf(prev.profile || 'normal')),
      series: 0,
    };
    if (this.team('home') === this.team('away')) this.sel.away = (this.sel.home + 1) % FRANCHISES.length;
    // o estilo (build) não é escolhido: é o do armador (ponto forte dele)
    this.steps = this.champMode || this.survival ? ['home', 'pg', 'rules', 'go'] : ['home', 'pg', 'away', 'rules', 'go'];
    // COMPETITIVO: o adversário é sempre o mesmo — Chicago Bulls 96 (Jordan) — para o ranking ser justo
    if (this.survival) {
      this.sel.away = FRANCHISES.findIndex((t) => t.id === 'touros');
      this.sel.awayH = true;
    }
    this.step = 0;
    this.enterStep();

    const bg = this.add.graphics();
    for (let x = 0; x < VIEW.W; x += 6) bg.fillStyle([0x2b1f15, 0x261b13, 0x2f2217][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    bg.fillStyle(0x0b0b14, 0.75).fillRect(0, 0, VIEW.W, VIEW.H);
    this.g = this.add.graphics();
    this.dyn = [];
    const kb = this.input.keyboard;
    const nav = (dx, dy) => {
      this.nav(dx, dy);
      sfx.play('select');
      this.refresh();
    };
    kb.on('keydown-UP', () => nav(0, -1));
    kb.on('keydown-W', () => nav(0, -1));
    kb.on('keydown-DOWN', () => nav(0, 1));
    kb.on('keydown-S', () => nav(0, 1));
    kb.on('keydown-LEFT', () => nav(-1, 0));
    kb.on('keydown-A', () => nav(-1, 0));
    kb.on('keydown-RIGHT', () => nav(1, 0));
    kb.on('keydown-D', () => nav(1, 0));
    kb.on('keydown-V', () => {
      const s = this.steps[this.step];
      if (s === 'home' || s === 'away') {
        this.sel[s + 'H'] = !this.sel[s + 'H'];
        this.cur.ver = this.sel[s + 'H'] ? 1 : 0;
        sfx.play('select');
        this.refresh();
      }
    });
    kb.on('keydown-M', () => sfx.toggleMute());
    kb.on('keydown-ESC', () => this.back());
    kb.on('keydown-ENTER', () => this.next());
    this.refresh();
  }

  // ------------------------------------------------------------------ dados
  frIndex(id) {
    const t = TEAMS.find((x) => x.id === id);
    return Math.max(0, FRANCHISES.findIndex((f) => f.id === (t ? franchiseOf(t) : id)));
  }
  team(side) {
    const fr = FRANCHISES[this.sel[side]];
    return (this.sel[side + 'H'] && historicOf(fr.id)) || fr;
  }
  confList(conf) {
    return FRANCHISES.filter((t) => t.conf === conf).sort((a, b) => a.name.localeCompare(b.name));
  }
  star() {
    const legend = this.sel.legend ? LEGENDS[this.sel.legend - 1] : null;
    const home = this.team('home');
    return { info: legend || home.players[0], tex: legend ? legendTexKey(this, legend, home) : playerTexKey(home.id, 0) };
  }

  // estado de navegação da etapa atual
  enterStep() {
    const s = this.steps[this.step];
    if (s === 'home' || s === 'away') {
      const fr = FRANCHISES[this.sel[s]];
      const list = this.confList(fr.conf);
      this.cur = { focus: 'grid', conf: fr.conf, idx: Math.max(0, list.indexOf(fr)), ver: this.sel[s + 'H'] ? 1 : 0 };
    } else if (s === 'pg') this.cur = { idx: this.sel.legend };
    else this.cur = { row: 0 };
  }

  nav(dx, dy) {
    const s = this.steps[this.step];
    const c = this.cur;
    if (s === 'home' || s === 'away') {
      if (c.focus === 'tabs') {
        if (dx) {
          c.conf = c.conf === 'E' ? 'W' : 'E';
          c.idx = 0;
        }
        if (dy > 0) c.focus = 'grid';
      } else if (c.focus === 'grid') {
        const n = this.confList(c.conf).length;
        if (dy < 0 && c.idx < 2) c.focus = 'tabs';
        else if (dy) c.idx = Math.max(0, Math.min(n - 1, c.idx + dy * 2));
        if (dx) c.idx = Math.min(n - 1, c.idx % 2 === 0 ? c.idx + 1 : c.idx - 1);
        // pré-visualiza na hora
        this.sel[s] = FRANCHISES.indexOf(this.confList(c.conf)[c.idx]);
        this.sel[s + 'H'] = c.ver === 1;
      } else if (c.focus === 'ver' && (dx || dy)) {
        c.ver = 1 - c.ver;
        this.sel[s + 'H'] = c.ver === 1;
      }
    } else if (s === 'pg') {
      const n = LEGENDS.length + 1;
      c.idx = (c.idx + dy + dx * 8 + n * 8) % n;
      this.sel.legend = c.idx;
    } else if (s === 'rules') {
      const rows = this.rowsOf(s);
      if (dy) c.row = (c.row + dy + rows.length) % rows.length;
      if (dx) {
        const key = rows[c.row];
        const n = { build: BUILDS.length, profile: PROFILE_IDS.length, diff: DIFF_IDS.length, mode: MODE_IDS.length, series: SERIES.length }[key];
        this.sel[key] = (this.sel[key] + dx + n) % n;
      }
    }
  }

  rowsOf() {
    if (this.survival) return ['profile']; // competitivo: dificuldade fixa no DIFICIL
    return this.champMode ? ['profile', 'diff', 'mode', 'series'] : ['profile', 'diff', 'mode'];
  }

  buildOf() {
    return buildById(buildForPlayer(this.star().info));
  }

  next() {
    sfx.play('select');
    const s = this.steps[this.step];
    const c = this.cur;
    if ((s === 'home' || s === 'away') && c.focus !== 'ver') {
      if (c.focus === 'tabs') c.focus = 'grid';
      else c.focus = 'ver';
      return this.refresh();
    }
    // fora do Arcade, a versão histórica precisa ser liberada no Competitivo
    if ((s === 'home' || s === 'away') && this.locks && !isTeamUnlocked(this.registry.get('profile'), this.team(s))) {
      const t = this.team(s);
      const fr = FRANCHISES[this.sel[s]];
      this.flash = `BLOQUEADO: ${historicRequirement(t)} PONTOS NO COMPETITIVO COM O ${fr.name.toUpperCase()} ATUAL (RECORDE ${teamBest(this.registry.get('profile'), fr.id)})`;
      sfx.play('buzzer');
      return this.refresh();
    }
    if (s === 'home' && this.survival && this.team('home') === this.team('away')) {
      this.flash = 'NO COMPETITIVO O ADVERSARIO E O BULLS 96: ESCOLHA OUTRO TIME';
      return this.refresh();
    }
    if (s === 'away' && this.team('away') === this.team('home')) {
      this.flash = 'ESCOLHA UM ADVERSARIO DIFERENTE DO SEU TIME';
      return this.refresh();
    }
    if (s === 'pg' && this.legendLocked(this.sel.legend)) {
      const u = unlockOf(LEGENDS[this.sel.legend - 1].id);
      this.flash = `BLOQUEADO: ${u ? u.desc.toUpperCase() + ' OU ' + u.price + ' MOEDAS' : 'COMPETITIVO'}`;
      sfx.play('buzzer');
      return this.refresh();
    }
    if (s === 'go') return this.start();
    this.step++;
    this.flash = null;
    this.enterStep();
    this.refresh();
  }

  back() {
    sfx.play('select');
    const s = this.steps[this.step];
    if ((s === 'home' || s === 'away') && this.cur.focus === 'ver') {
      this.cur.focus = 'grid';
      return this.refresh();
    }
    if (this.step === 0) return this.scene.start('Title');
    this.step--;
    this.enterStep();
    this.refresh();
  }

  start() {
    if (this.started) return;
    this.started = true;
    const setup = {
      home: this.team('home').id,
      away: this.team('away').id,
      build: this.buildOf().id,
      legend: this.sel.legend ? LEGENDS[this.sel.legend - 1].id : null,
      diff: DIFF_IDS[this.sel.diff],
      mode: MODE_IDS[this.sel.mode],
      profile: PROFILE_IDS[this.sel.profile],
      street: this.street,
      survival: this.survival,
    };
    if (this.survival) {
      setup.mode = 'pontos';
      setup.diff = 'dificil';
    }
    this.registry.set('setup', setup);
    if (this.champMode) {
      createChampionship(setup, SERIES[this.sel.series]);
      this.scene.start('Championship');
    } else this.scene.start('Game', setup);
  }

  // ------------------------------------------------------------------ desenho
  T(x, y, s, o = {}) {
    const t = new PixelText(this, x, y, s, o);
    this.dyn.push(t);
    return t;
  }
  sprite(x, y, tex, scale = 2) {
    const spr = this.add.sprite(x, y, tex, 0).setOrigin(0.5, 1).setScale(scale);
    this.dyn.push({ destroy: () => spr.destroy() });
  }

  refresh() {
    this.dyn.forEach((o) => o.destroy());
    this.dyn = [];
    this.g.clear();
    const W = VIEW.W;
    const s = this.steps[this.step];
    // cabeçalho: título + trilha das etapas
    this.T(W / 2, 4, this.survival ? 'COMPETITIVO' : this.champMode ? 'CAMPEONATO' : this.street ? 'RUA 3X3' : 'MONTE SEU JOGO', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const parts = this.steps.map((k, i) => `${i + 1} ${STEP_NAMES[k]}`);
    let x = 12;
    const total = parts.join('   ').length * 6;
    x = Math.round((W - total) / 2);
    parts.forEach((p, i) => {
      this.T(x, 22, p, { color: i === this.step ? 0xffe14d : i < this.step ? 0x6dff6d : 0x5a5270 });
      x += (p.length + 3) * 6;
    });
    ({ home: () => this.drawTeamStep('home'), away: () => this.drawTeamStep('away'), pg: () => this.drawPgStep(), rules: () => this.drawRows('rules'), go: () => this.drawConfirm() })[s]();
    if (this.flash) this.T(W / 2, 236, this.flash, { origin: [0.5, 0], color: 0xff7b6b });
    const hint = {
      home: 'SETAS ESCOLHEM  ENTER/A CONFIRMA  V/Y ATUAL-HISTORICO  ESC/B VOLTA',
      away: 'SETAS ESCOLHEM  ENTER/A CONFIRMA  V/Y ATUAL-HISTORICO  ESC/B VOLTA',
      pg: 'CIMA/BAIXO ESCOLHE  ESQ/DIR PULA 8  ENTER/A CONFIRMA  ESC/B VOLTA',
      rules: 'CIMA/BAIXO LINHA  ESQ/DIR MUDA  ENTER/A CONFIRMA  ESC/B VOLTA',
      go: 'ENTER/A JOGAR   ESC/B VOLTA',
    }[s];
    this.T(W / 2, 256, hint, { origin: [0.5, 0], color: 0x7a7290 });
  }

  // Etapa de time: abas Leste/Oeste, 15 times em 2 colunas e a prévia do time (atual ou histórico)
  drawTeamStep(side) {
    const g = this.g;
    const c = this.cur;
    drawPanel(g, 8, 34, 228, 214, c.focus === 'ver' ? 0x6fa0ff : 0xffe14d);
    [['E', 'LESTE', 66], ['W', 'OESTE', 178]].forEach(([cf, name, tx]) => {
      const on = c.conf === cf;
      if (on) g.fillStyle(c.focus === 'tabs' ? 0xffe14d : 0x6fa0ff, 0.25).fillRect(tx - 44, 40, 88, 12);
      this.T(tx, 42, on ? `< ${name} >` : name, { origin: [0.5, 0], color: on ? (c.focus === 'tabs' ? 0xffe14d : 0xffffff) : 0x5a5270 });
    });
    const list = this.confList(c.conf);
    list.forEach((t, i) => {
      const tx = 16 + (i % 2) * 110;
      const ty = 60 + Math.floor(i / 2) * 22;
      const on = i === c.idx && c.focus !== 'tabs';
      if (on) g.fillStyle(c.focus === 'grid' ? 0xffe14d : 0x6fa0ff, 0.22).fillRect(tx - 4, ty - 3, 106, 20);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(t.colors.jersey).color, 1).fillRect(tx, ty, 5, 14);
      this.T(tx + 9, ty, t.city.slice(0, 16), { color: on ? 0xffe14d : 0x9a92b0 });
      this.T(tx + 9, ty + 8, t.name.slice(0, 16), { color: on ? 0xffffff : teamHudColor(t) });
    });

    // prévia
    const team = this.team(side);
    const fr = FRANCHISES[this.sel[side]];
    const h = historicOf(fr.id);
    drawPanel(g, 244, 34, 228, 214, teamHudColor(team));
    this.T(252, 40, side === 'home' ? 'SEU TIME' : 'ADVERSARIO', { color: 0x7a7290 });
    this.T(252, 50, team.name, { scale: 2, color: teamHudColor(team) });
    this.T(464, 42, team.city, { origin: [1, 0], color: 0xb8b0d0 });
    this.T(252, 68, team.style.slice(0, 36), { color: 0xd8d0ee });
    this.sprite(268, 120, playerTexKey(team.id, 0));
    const p0 = team.players[0];
    this.T(286, 84, p0.name.slice(0, 26), { color: 0xffffff });
    this.T(286, 94, `${p0.nick}  ${fmtHeight(p0.cm)}`, { color: 0xffe14d });
    const bad = badgesOf(p0).map((b) => BADGES[b].name);
    if (bad.length) this.T(286, 104, bad.join(', ').slice(0, 30), { color: 0x6fa0ff });
    team.players.forEach((p, i) => {
      const ry = 126 + i * 10;
      this.T(252, ry, POS[i], { color: 0x7a7290 });
      this.T(270, ry, p.name.slice(0, 24), { color: i === 0 ? 0xffe14d : 0xd8d0ee });
      this.T(464, ry, fmtHeight(p.cm), { origin: [1, 0], color: p.cm >= 208 ? 0x6fa0ff : 0xb8b0d0 });
    });
    // versões
    const vy = 182;
    g.fillStyle(0x3a3352, 1).fillRect(250, vy - 4, 216, 1);
    const hLocked = h && this.locks && !isTeamUnlocked(this.registry.get('profile'), h);
    const hLabel = h ? `HISTORICO ${h.era}${hLocked ? `  [X] ${historicRequirement(h)} PTS` : ''}` : 'HISTORICO';
    [['ATUAL 2025-26', 0], [hLabel, 1]].forEach(([label, k]) => {
      const on = c.ver === k;
      const y = vy + k * 14;
      if (on) g.fillStyle(c.focus === 'ver' ? 0xffe14d : 0x6fa0ff, 0.2).fillRect(250, y - 3, 216, 12);
      this.T(256, y, `${on ? '> ' : '  '}${label}`, { color: on ? (c.focus === 'ver' ? 0xffe14d : 0xffffff) : 0x7a7290 });
    });
    this.T(358, 216, c.focus === 'ver' ? 'CIMA/BAIXO E ENTER' : 'ENTER PARA A VERSAO', { origin: [0.5, 0], color: 0x7a7290 });
  }

  // Etapa do armador: o do time ou uma das lendas
  drawPgStep() {
    const g = this.g;
    const c = this.cur;
    const home = this.team('home');
    drawPanel(g, 8, 34, 200, 214, 0xffe14d);
    const items = [`DO TIME: ${home.players[0].name}`, ...LEGENDS.map((l) => l.name)];
    const start = Math.max(0, Math.min(items.length - 17, c.idx - 8));
    for (let k = 0; k < 17 && start + k < items.length; k++) {
      const i = start + k;
      const on = i === c.idx;
      const y = 42 + k * 12;
      if (on) g.fillStyle(0xffe14d, 0.22).fillRect(12, y - 2, 192, 11);
      const lock = this.legendLocked(i);
      this.T(16, y, `${i === 0 ? '' : String(i).padStart(2, ' ') + ' '}${lock ? '[X] ' : ''}${items[i]}`.slice(0, 31), { color: on ? (lock ? 0xff7b6b : 0xffe14d) : lock ? 0x5a5270 : i === 0 ? 0x6fa0ff : 0xd8d0ee });
    }
    const { info, tex } = this.star();
    drawPanel(g, 216, 34, 256, 214, teamHudColor(home));
    this.T(224, 40, c.idx ? `LENDA ${c.idx}/${LEGENDS.length}  NO ${home.name.toUpperCase()}` : `ARMADOR DO ${home.name.toUpperCase()}`, { color: 0x7a7290 });
    this.sprite(250, 130, tex, 3);
    this.T(280, 56, info.name.slice(0, 30), { color: 0xffffff });
    this.T(280, 66, `${info.nick}  ${fmtHeight(info.cm)}`, { color: 0xffe14d });
    const bad = badgesOf(info).map((b) => BADGES[b].name);
    this.T(280, 78, (bad.length ? bad.join(', ') : info.desc || '').slice(0, 30), { color: bad.length ? 0x6fa0ff : 0xd8d0ee });
    if (info.desc && bad.length) this.T(280, 88, info.desc.slice(0, 30), { color: 0xd8d0ee });
    // o estilo vem do próprio armador (ponto forte dele)
    const b = this.buildOf();
    this.T(280, 102, `ESTILO: ${b.name.toUpperCase()}`, { color: 0x6dff6d });
    const words = b.desc.split(' ');
    const lines = [''];
    for (const w of words) {
      if ((lines[lines.length - 1] + ' ' + w).trim().length > 30) lines.push(w);
      else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
    }
    lines.slice(0, 3).forEach((l, k) => this.T(280, 112 + k * 9, l, { color: 0xb8b0d0 }));
    BARS.forEach(([k, lbl], i) => {
      const bx = 230;
      const by = 146 + i * 13;
      this.T(bx, by, lbl, { color: 0xb8b0d0 });
      const v = info.r[k];
      g.fillStyle(0x3a3352).fillRect(bx + 24, by + 1, 170, 6);
      g.fillStyle(v >= 90 ? 0x6dff6d : v >= 75 ? 0xffe14d : 0xff7b6b).fillRect(bx + 24, by + 1, Math.round((170 * (Math.max(40, v) - 40)) / 59), 6);
      this.T(bx + 200, by, String(v), { color: 0xd8d0ee });
    });
  }

  // Etapas de opções (estilo/arremesso, dificuldade/modo/série): uma linha por escolha com explicação
  drawRows(s) {
    const g = this.g;
    const rows = this.rowsOf(s);
    const info = {
      build: () => ['ESTILO DO ARMADOR', BUILDS[this.sel.build].name, BUILDS[this.sel.build].desc],
      profile: () => ['PERFIL DE ARREMESSO', SHOT_PROFILES[PROFILE_IDS[this.sel.profile]].name, SHOT_PROFILES[PROFILE_IDS[this.sel.profile]].desc],
      diff: () => ['DIFICULDADE', DIFFICULTY[DIFF_IDS[this.sel.diff]].name, 'Afeta a defesa, os roubos, as dobras e o arremesso do adversario'],
      mode: () => ['MODO', MODES[MODE_IDS[this.sel.mode]].name, MODES[MODE_IDS[this.sel.mode]].desc],
      series: () => ['SERIES DO MATA-MATA', SERIES[this.sel.series] === 1 ? 'Jogo unico' : 'Melhor de 3', 'Quantos jogos tem cada serie'],
    };
    rows.forEach((key, i) => {
      const on = i === this.cur.row;
      const step = rows.length > 3 ? 50 : 64;
      const y = 40 + i * step;
      drawPanel(g, 40, y, VIEW.W - 80, step - 6, on ? 0xffe14d : 0x3a3352);
      const [title, value, desc] = info[key]();
      this.T(52, y + 8, title, { color: on ? 0xffe14d : 0x7a7290 });
      this.T(VIEW.W / 2, y + 20, on ? `<  ${value}  >` : value, { scale: 2, origin: [0.5, 0], color: on ? 0xffffff : 0xb8b0d0 });
      this.T(VIEW.W / 2, y + (step > 50 ? 40 : 33), desc.slice(0, 64), { origin: [0.5, 0], color: 0xd8d0ee });
    });
  }

  drawConfirm() {
    const g = this.g;
    const W = VIEW.W;
    const home = this.team('home');
    const { info, tex } = this.star();
    drawPanel(g, 20, 36, W - 40, 196, 0x6dff6d);
    this.T(W / 2, 44, 'TUDO PRONTO?', { scale: 2, origin: [0.5, 0], color: 0x6dff6d });
    this.sprite(70, 140, tex, 3);
    this.T(110, 70, home.name, { scale: 2, color: teamHudColor(home) });
    this.T(110, 88, `${home.city}${home.era ? '  ' + home.era : ''}`, { color: 0xb8b0d0 });
    this.T(110, 100, `ARMADOR: ${info.name}`, { color: 0xffe14d });
    if (!this.champMode) {
      const away = this.team('away');
      this.T(W - 40, 70, away.name, { scale: 2, origin: [1, 0], color: teamHudColor(away) });
      this.T(W - 40, 88, `${away.city}${away.era ? '  ' + away.era : ''}`, { origin: [1, 0], color: 0xb8b0d0 });
      this.T(W / 2 + 40, 72, 'X', { scale: 2, origin: [0.5, 0], color: 0xffffff });
      this.sprite(W - 70, 140, playerTexKey(away.id, 0), 3);
    } else this.T(W - 40, 72, 'CHAVE SORTEADA', { origin: [1, 0], color: 0x6fa0ff });
    if (this.survival) this.T(W / 2, 160, 'ADVERSARIO FIXO DO COMPETITIVO: O BULLS DE 96', { origin: [0.5, 0], color: 0xff9a4d });
    const lines = [
      `ESTILO ${this.buildOf().name} (DO ARMADOR)  -  ARREMESSO ${SHOT_PROFILES[PROFILE_IDS[this.sel.profile]].name}`,
      `${DIFFICULTY[DIFF_IDS[this.sel.diff]].name}  -  ${MODES[MODE_IDS[this.sel.mode]].name}${this.champMode ? '  -  ' + (SERIES[this.sel.series] === 1 ? 'JOGO UNICO' : 'MELHOR DE 3') : ''}`,
    ];
    lines.forEach((l, i) => this.T(W / 2, 176 + i * 12, l.toUpperCase(), { origin: [0.5, 0], color: 0xd8d0ee }));
    this.T(W / 2, 210, 'ENTER / A PARA JOGAR', { origin: [0.5, 0], color: 0x6dff6d });
  }
}
