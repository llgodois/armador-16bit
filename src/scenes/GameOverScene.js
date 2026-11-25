import Phaser from 'phaser';
import { VIEW, BASKET, THREE, PAINT } from '../config.js';
import { teamById, teamHudColor } from '../data/teams.js';
import { buildById } from '../data/builds.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { load as loadChamp, recordUserGame } from '../data/championship.js';
import { CHALLENGES, saveResult } from '../data/training.js';
import { recordCareerGame } from '../data/career.js';
import { recordFranchiseGame } from '../data/franchise.js';

// Fim de jogo em 3 páginas (ESQ/DIR): resumo, box score dos 10 e mapa de arremessos.
// Também registra o resultado de campeonato, desafio e carreira.
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    // ao trocar de página a cena reinicia com os mesmos dados (sem registrar de novo)
    this.data_ = data.data_ || data;
    this.page = data.page || 0;
    this.recorded = !!data.recorded;
  }

  create() {
    sfx.music('menu');
    const d = this.data_;
    const W = VIEW.W;
    const win = d.score.home > d.score.away;
    this.cameras.main.setBackgroundColor('#0b0b14');
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 6) g.fillStyle([0x3b2a1c, 0x34251a, 0x3f2d1e][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    g.fillStyle(0x0b0b14, 0.72).fillRect(0, 0, W, VIEW.H);
    this.g = g;

    // ---- registra resultados (uma vez)
    let extra = null;
    if (!this.recorded) {
      this.recorded = true;
      sfx.play(win ? 'cheer' : 'buzzer');
      if (d.champ) {
        const champ = loadChamp();
        if (champ) recordUserGame(champ, win);
      }
      if (d.challenge) {
        const ch = CHALLENGES.find((c) => c.id === d.challenge);
        const ok = ch.check(d);
        saveResult(ch.id, ok ? 1 : 0);
        this.challengeOk = ok;
      }
      if (d.career) this.careerInfo = recordCareerGame(d);
      if (d.franchise) recordFranchiseGame(win);
    }
    extra = d.challenge ? (this.challengeOk ? 'DESAFIO CUMPRIDO!' : 'DESAFIO NAO CUMPRIDO') : null;

    const pages = [() => this.pageSummary(win, extra), () => this.pageBox(), () => this.pageChart()];
    pages[this.page]();
    new PixelText(this, W / 2, 246, `PAGINA ${this.page + 1}/3 (ESQ/DIR)    ${this.nextLabel()}`, { origin: [0.5, 0], color: 0xb8b0d0 });

    const kb = this.input.keyboard;
    const go = (dp) => this.scene.restart({ data_: d, page: (this.page + dp + 3) % 3, recorded: true });
    kb.once('keydown-LEFT', () => go(-1));
    kb.once('keydown-RIGHT', () => go(1));
    kb.once('keydown-A', () => go(-1));
    kb.once('keydown-D', () => go(1));
    kb.once('keydown-ENTER', () => this.next());
    if (!d.champ && !d.career && !d.franchise) {
      kb.once('keydown-S', () => this.scene.start('Select'));
      kb.once('keydown-ESC', () => this.scene.start('Title'));
    }
  }

  nextLabel() {
    const d = this.data_;
    if (d.champ) return 'ENTER: CONTINUAR CAMPEONATO';
    if (d.career) return 'ENTER: CONTINUAR CARREIRA';
    if (d.franchise) return 'ENTER: CONTINUAR FRANQUIA';
    if (d.challenge) return 'ENTER: VOLTAR AOS DESAFIOS';
    return 'ENTER REVANCHE  S TIMES  ESC TITULO';
  }

  next() {
    const d = this.data_;
    sfx.play('select');
    if (d.champ) return this.scene.start('Championship');
    if (d.career) return this.scene.start('Career');
    if (d.franchise) return this.scene.start('Franchise');
    if (d.challenge) return this.scene.start('Training', { tab: 'challenges' });
    this.scene.start('Game', { ...(this.registry.get('setup') || {}), home: d.home, away: d.away, build: d.build, champ: false });
  }

  pageSummary(win, extra) {
    const d = this.data_;
    const { score, stats } = d;
    const W = VIEW.W;
    const home = teamById(d.home);
    const away = teamById(d.away);
    const build = buildById(d.build);
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, { origin: 0.5, ...o });
    T(W / 2, 22, extra || 'FIM DE JOGO', { scale: 2, color: extra ? (this.challengeOk ? 0x6dff6d : 0xff7b6b) : 0xd8d0ee });
    T(W / 2, 54, win ? 'VITORIA!' : 'DERROTA', { scale: 3, color: win ? 0x6dff6d : 0xff7b6b });
    T(W / 2 - 70, 88, home.name, { color: teamHudColor(home) });
    T(W / 2 + 70, 88, away.name, { color: teamHudColor(away) });
    T(W / 2 - 70, 104, String(score.home), { scale: 2 });
    T(W / 2, 104, 'X', { color: 0x7a7290 });
    T(W / 2 + 70, 104, String(score.away), { scale: 2 });
    const pct = (m, a) => (a ? `${Math.round((m / a) * 100)}%` : '-');
    const lines = [
      [`${d.pgName || 'SEU ARMADOR'} - ${build.name}`, 0xffe14d],
      [`NOTA DE COMPANHEIRO ${d.grade || '-'}    QI DO ARMADOR ${d.iq ?? '-'}`, 0x6fa0ff],
      [`PONTOS ${stats.pts}    ASSISTENCIAS ${stats.ast}    TURNOVERS ${stats.to}`, 0xffffff],
      [`ARREMESSOS ${stats.fgm}/${stats.fga} (${pct(stats.fgm, stats.fga)})    3PTS ${stats.tpm}/${stats.tpa}    REB ${stats.reb}`, 0xffffff],
      [`DEFESA: ROUBOS ${stats.stl}    TOCOS ${stats.blk}`, 0xff9a4d],
    ];
    if (this.careerInfo) lines.push([`CARREIRA: +${this.careerInfo.points} PONTOS DE EVOLUCAO`, 0x6dff6d]);
    lines.forEach(([l, c], i) => T(W / 2, 132 + i * 13, l, { color: c }));
  }

  pageBox() {
    const d = this.data_;
    const W = VIEW.W;
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, o);
    T(W / 2, 8, 'BOX SCORE', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const box = d.box || [];
    ['home', 'away'].forEach((side, k) => {
      const team = teamById(side === 'home' ? d.home : d.away);
      const y0 = 30 + k * 108;
      drawPanel(this.g, 8, y0, W - 16, 102, teamHudColor(team));
      T(16, y0 + 6, team.name, { color: teamHudColor(team) });
      T(160, y0 + 6, 'PTS  REB  AST  ARR', { color: 0x7a7290 });
      box.filter((b) => b.team === side).sort((a, b) => b.pts - a.pts).slice(0, 8).forEach((b, i) => {
        const y = y0 + 17 + i * 10;
        T(16, y, `${b.pos} ${b.name.slice(0, 18)}`, { color: 0xd8d0ee });
        T(160, y, `${String(b.pts).padStart(3)}  ${String(b.reb).padStart(3)}  ${String(b.ast).padStart(3)}  ${b.fgm}/${b.fga}`, { color: 0xffffff });
      });
    });
  }

  // Mapa de arremessos do seu armador (verde = cesta, vermelho = erro)
  pageChart() {
    const d = this.data_;
    const W = VIEW.W;
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, o);
    T(W / 2, 8, 'MAPA DE ARREMESSOS', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const g = this.g;
    const X0 = 90;
    const Y0 = 30;
    const S = 0.75;
    const map = (p) => ({ x: X0 + (p.x - 40) * S, y: Y0 + (p.y - 36) * S });
    g.fillStyle(0xc08043, 1).fillRect(X0, Y0, 400 * S, 270 * S);
    const pa = map({ x: PAINT.left, y: PAINT.top });
    const pb = map({ x: PAINT.right, y: PAINT.bottom });
    g.fillStyle(0x3355a8, 1).fillRect(pa.x, pa.y, pb.x - pa.x, pb.y - pa.y);
    const arc = [];
    for (let a = 0; a <= 180; a += 6) {
      const r = (a * Math.PI) / 180;
      arc.push(map({ x: BASKET.x + Math.cos(r) * THREE.rx, y: BASKET.y + Math.sin(r) * THREE.ry }));
    }
    g.lineStyle(1, 0xf3efe6, 1).strokePoints(arc);
    const bk = map(BASKET);
    g.fillStyle(0xe8551c, 1).fillCircle(bk.x, bk.y, 3);
    const log = d.shotLog || [];
    for (const s of log) {
      const p = map(s);
      if (s.made) g.fillStyle(0x6dff6d, 1).fillCircle(p.x, p.y, 3);
      else {
        g.lineStyle(2, 0xff5a4d, 1);
        g.lineBetween(p.x - 3, p.y - 3, p.x + 3, p.y + 3).lineBetween(p.x - 3, p.y + 3, p.x + 3, p.y - 3);
      }
    }
    const made = log.filter((s) => s.made).length;
    const in3 = log.filter((s) => s.three);
    T(W / 2, 236, `${made}/${log.length} ARREMESSOS    3PTS ${in3.filter((s) => s.made).length}/${in3.length}`, { origin: [0.5, 0], color: 0xd8d0ee });
  }
}
