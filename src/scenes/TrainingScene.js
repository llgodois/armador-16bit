import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { LESSONS, CHALLENGES, MECHANICS, loadProgress } from '../data/training.js';
import { schemeById } from '../data/defense.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

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
    const TABS = ['lessons', 'mechanics', 'challenges'];
    const TAB_NAMES = { lessons: 'LEITURAS', mechanics: 'MECANICAS', challenges: 'DESAFIOS' };
    T(110, 22, TABS.map((t) => (t === this.tab ? `[${TAB_NAMES[t]}]` : TAB_NAMES[t])).join('  ') + '  (ESQ/DIR)', { color: 0xb8b0d0 });
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
