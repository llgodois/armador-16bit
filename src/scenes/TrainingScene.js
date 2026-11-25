import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { LESSONS, CHALLENGES, MECHANICS, loadProgress } from '../data/training.js';
import { schemeById } from '../data/defense.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { teamById } from '../data/teams.js';
import { PLAY_LIBRARY, playbookFor } from '../plays/index.js';

// Treino livre: modos e a ordem na tela
export const PRACTICE_MODES = [
  ['shots', 'SO ARREMESSOS', 'Sozinho na quadra: arremesse de onde quiser, a bola volta para voce.'],
  ['1x1', '1 CONTRA 1', 'Voce contra o armador deles. Treine drible, infiltracao e step-back.'],
  ['2x2', '2 CONTRA 2', 'Voce e o pivo: pick and roll e pick and pop sem ajuda da defesa.'],
  ['3x3', '3 CONTRA 3', 'Armador, ala e pivo: leituras com espaco.'],
  ['5x5', '5 CONTRA 5', 'Quadra cheia: todas as jogadas e defesas.'],
];

// Treino de leituras (lições de 1 posse) e desafios de lendas (partidas especiais).
export default class TrainingScene extends Phaser.Scene {
  constructor() {
    super('Training');
  }

  init(data) {
    this.tab = (data && data.tab) || 'lessons';
    this.result = data && data.result;
  }

  create() {
    const W = VIEW.W;
    this.cameras.main.setBackgroundColor('#0b0b14');
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 6) g.fillStyle([0x2b1f15, 0x261b13, 0x2f2217][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    g.fillStyle(0x0b0b14, 0.65).fillRect(0, 0, W, VIEW.H);
    drawPanel(g, 10, 10, W - 20, VIEW.H - 20, 0x6dff6d);
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, o);
    T(20, 18, 'TREINO', { scale: 2, color: 0x6dff6d });
    const TABS = ['lessons', 'mechanics', 'challenges', 'free'];
    const TAB_NAMES = { lessons: 'LEITURAS', mechanics: 'MECANICAS', challenges: 'DESAFIOS', free: 'LIVRE' };
    T(110, 22, TABS.map((t) => (t === this.tab ? `[${TAB_NAMES[t]}]` : TAB_NAMES[t])).join('  ') + '  (ESQ/DIR)', { color: 0xb8b0d0 });
    if (this.tab === 'free') return this.buildFree(T, TABS);
    const prog = loadProgress();
    const stars = (id, max = 3) => '*'.repeat(prog[id] || 0).padEnd(max, '.');
    const list = this.tab === 'lessons' ? LESSONS : this.tab === 'mechanics' ? MECHANICS : CHALLENGES;
    const items = list.map((it) => ({ label: `${stars(it.id, this.tab === 'challenges' ? 1 : 3)}  ${it.name}` }));
    const m = makeMenu(this, items, 34, 44, { gap: this.tab === 'mechanics' ? 12 : 16, origin: 0 });
    const detail = [0, 1, 2, 3].map((i) => T(232, 48 + i * 11, '', { color: 0xd8d0ee }));
    const show = (i) => {
      const it = list[i];
      const lines = this.tab === 'mechanics'
        ? [it.def ? 'NA DEFESA' : 'NO ATAQUE', ...wrap(it.tip, 38)]
        : this.tab === 'lessons'
        ? [`DEFESA: ${schemeById(it.scheme).name.toUpperCase()}`, ...wrap(it.tip, 38)]
        : [...wrap(it.desc, 38)];
      detail.forEach((t, k) => t.setText(lines[k] || '').setColor(k === 0 && this.tab !== 'challenges' ? 0xff9a4d : 0xd8d0ee));
    };
    m.set(0);
    show(0);
    if (this.result) {
      drawPanel(g, 226, 120, 236, 70, this.result.ok ? 0x6dff6d : 0xff7b6b);
      T(344, 128, this.result.title, { origin: [0.5, 0], scale: 2, color: this.result.ok ? 0x6dff6d : 0xff7b6b });
      (this.result.lines || []).forEach((l, i) => T(236, 150 + i * 10, l, { color: 0xd8d0ee }));
    }
    T(20, 236, this.tab !== 'challenges' ? 'ENTER TREINAR (1 POSSE)   ESC TITULO   * = ESTRELA' : 'ENTER JOGAR DESAFIO   ESC TITULO', { color: 0xb8b0d0 });

    const kb = this.input.keyboard;
    const nav = (d) => {
      m.set(m.index + d);
      show(m.index);
      sfx.play('select');
    };
    kb.on('keydown-UP', () => nav(-1));
    kb.on('keydown-W', () => nav(-1));
    kb.on('keydown-DOWN', () => nav(1));
    kb.on('keydown-S', () => nav(1));
    const flip = (d) => this.scene.restart({ tab: TABS[(TABS.indexOf(this.tab) + d + TABS.length) % TABS.length] });
    kb.on('keydown-LEFT', () => flip(-1));
    kb.on('keydown-RIGHT', () => flip(1));
    kb.on('keydown-A', () => flip(-1));
    kb.on('keydown-D', () => flip(1));
    kb.once('keydown-ESC', () => this.scene.start('Title'));
    kb.once('keydown-ENTER', () => {
      sfx.play('select');
      const it = list[m.index];
      const base = { ...(this.registry.get('setup') || { home: 'ondas', build: 'chutador' }), away: 'cervos', mode: 'pontos', champ: false };
      if (base.away === base.home) base.away = 'calor';
      if (this.tab !== 'challenges') this.scene.start('Game', { ...base, training: it.id, legend: it.legend || base.legend || null });
      else this.scene.start('Game', { ...base, challenge: it.id, legend: it.legend || base.legend || null });
    });
  }

  // TREINO LIVRE: escolha o modo (só arremessos, 1x1, 2x2, 3x3, 5x5) e, se quiser, uma jogada para repetir.
  buildFree(T, TABS) {
    const W = VIEW.W;
    const base = this.registry.get('setup') || { home: 'ondas', away: 'calor', build: 'chutador' };
    const home = teamById(base.home);
    const book = playbookFor(home);
    const sel = this.registry.get('practiceSel') || { mode: 0, play: 0 }; // play 0 = nenhuma
    let row = 0; // 0 modo, 1 jogada, 2 começar
    const g = this.add.graphics();
    const dyn = [];
    const D = (x, y, s, o) => dyn.push(T(x, y, s, o));
    const canPlay = () => PRACTICE_MODES[sel.mode][0] !== 'shots' && PRACTICE_MODES[sel.mode][0] !== '1x1';
    const draw = () => {
      dyn.forEach((o) => o.destroy());
      dyn.length = 0;
      g.clear();
      const [, mName, mDesc] = PRACTICE_MODES[sel.mode];
      const pl = sel.play ? PLAY_LIBRARY[book[sel.play - 1]] : null;
      const rowBox = (i, y, h) => {
        drawPanel(g, 30, y, W - 60, h, row === i ? 0xffe14d : 0x3a3352);
      };
      rowBox(0, 44, 52);
      D(42, 51, 'MODO', { color: row === 0 ? 0xffe14d : 0x7a7290 });
      D(W / 2, 61, row === 0 ? `<  ${mName}  >` : mName, { scale: 2, origin: [0.5, 0], color: 0xffffff });
      D(W / 2, 81, mDesc, { origin: [0.5, 0], color: 0xd8d0ee });
      rowBox(1, 102, 52);
      D(42, 109, 'JOGADA PARA APRIMORAR', { color: row === 1 ? 0xffe14d : 0x7a7290 });
      const plName = !canPlay() ? '(SO EM 2X2, 3X3 E 5X5)' : pl ? pl.name.toUpperCase() : 'NENHUMA - JOGO LIVRE';
      D(W / 2, 121, row === 1 && canPlay() ? `<  ${plName}  >` : plName, { origin: [0.5, 0], color: canPlay() ? 0xffffff : 0x5a5270 });
      D(W / 2, 135, pl && canPlay() ? (pl.desc.length > 60 ? pl.desc.slice(0, 58) + '...' : pl.desc) : canPlay() ? 'A jogada e chamada sozinha no comeco de cada posse' : '', { origin: [0.5, 0], color: 0xd8d0ee });
      rowBox(2, 160, 30);
      D(W / 2, 170, 'COMECAR TREINO', { origin: [0.5, 0], color: row === 2 ? 0x6dff6d : 0xd8d0ee });
      D(W / 2, 198, `TIME: ${home.name.toUpperCase()} (O DO ULTIMO JOGO)  -  SEM PLACAR, SEM FIM`, { origin: [0.5, 0], color: 0x7a7290 });
      D(W / 2, 210, 'ESC/PAUSA PARA SAIR DO TREINO', { origin: [0.5, 0], color: 0x7a7290 });
      D(20, 236, row === 2 ? 'ENTER COMECAR   ESQ/DIR TROCA DE ABA   ESC TITULO' : 'CIMA/BAIXO LINHA   ESQ/DIR MUDA   ENTER COMECAR', { color: 0xb8b0d0 });
    };
    const kb = this.input.keyboard;
    const flip = (d) => this.scene.restart({ tab: TABS[(TABS.indexOf('free') + d + TABS.length) % TABS.length] });
    const change = (d) => {
      if (row === 2) return flip(d);
      if (row === 0) sel.mode = (sel.mode + d + PRACTICE_MODES.length) % PRACTICE_MODES.length;
      if (row === 1 && canPlay()) sel.play = (sel.play + d + book.length + 1) % (book.length + 1);
      sfx.play('select');
      draw();
    };
    const nav = (d) => {
      row = (row + d + 3) % 3;
      sfx.play('select');
      draw();
    };
    kb.on('keydown-UP', () => nav(-1));
    kb.on('keydown-W', () => nav(-1));
    kb.on('keydown-DOWN', () => nav(1));
    kb.on('keydown-S', () => nav(1));
    kb.on('keydown-LEFT', () => change(-1));
    kb.on('keydown-A', () => change(-1));
    kb.on('keydown-RIGHT', () => change(1));
    kb.on('keydown-D', () => change(1));
    kb.once('keydown-ESC', () => this.scene.start('Title'));
    kb.on('keydown-ENTER', () => {
      this.registry.set('practiceSel', { ...sel });
      sfx.play('play');
      const mode = PRACTICE_MODES[sel.mode][0];
      const play = canPlay() && sel.play ? book[sel.play - 1] : null;
      let away = base.away && base.away !== base.home ? base.away : 'calor';
      if (away === base.home) away = 'cervos';
      this.scene.start('Game', { ...base, away, mode: 'pontos', champ: false, survival: false, street: false, practice: { mode, play } });
    });
    draw();
  }
}

function wrap(text, max) {
  const words = text.toUpperCase().split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  return lines;
}
