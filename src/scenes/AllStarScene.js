import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { teamById } from '../data/teams.js';
import { ALLSTARS } from '../data/allstar.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

// Fim de semana das estrelas: torneio de 3 pontos, de enterradas e o Jogo das Estrelas.
export default class AllStarScene extends Phaser.Scene {
  constructor() {
    super('AllStar');
  }

  init(data) {
    this.result = data && data.result;
  }

  create() {
    const W = VIEW.W;
    this.cameras.main.setBackgroundColor('#0b0b14');
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 6) g.fillStyle([0x1d1a3b, 0x221f45, 0x1a1736][(x / 6) % 3]).fillRect(x, 0, 6, VIEW.H);
    drawPanel(g, 10, 10, W - 20, VIEW.H - 20, 0xffe14d);
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, o);
    T(W / 2, 18, 'FIM DE SEMANA DAS ESTRELAS', { scale: 2, origin: [0.5, 0], color: 0xffe14d });
    const base = this.registry.get('setup') || { home: 'ondas', build: 'chutador' };
    const myConf = (teamById(base.home).conf || 'W') === 'E' ? 'E' : 'W';
    const mine = ALLSTARS.find((t) => t.conf === myConf);
    const other = ALLSTARS.find((t) => t.conf !== myConf);
    const items = [{ label: 'TORNEIO DE 3 PONTOS' }, { label: 'TORNEIO DE ENTERRADAS' }, { label: `JOGO DAS ESTRELAS (${mine.name.toUpperCase()} X ${other.name.toUpperCase()})` }, { label: 'VOLTAR', color: 0xb8b0d0 }];
    const m = makeMenu(this, items, 40, 50, { gap: 18, origin: 0 });
    T(40, 128, `SEU ELENCO DAS ESTRELAS (${mine.name.toUpperCase()}):`, { color: 0x6fa0ff });
    mine.players.forEach((p, i) => T(48, 140 + i * 10, `${['PG', 'SG', 'SF', 'PF', 'C'][i]} ${p.name}${i === 0 ? ' (VOCE JOGA COM SEU ARMADOR)' : ''}`, { color: 0xd8d0ee }));

    if (this.result) {
      const r = this.result;
      drawPanel(g, 300, 120, 160, 112, 0x6dff6d);
      T(380, 126, r.kind === 'three' ? 'RESULTADO 3 PTS' : 'RESULTADO ENTERRADAS', { origin: [0.5, 0], color: 0x6dff6d });
      r.ranking.forEach((p, i) => T(308, 142 + i * 14, `${i + 1}. ${p.name.slice(0, 15)} ${p.score}`, { color: p.you ? 0xffe14d : 0xd8d0ee }));
      const won = r.ranking[0].you;
      T(380, 214, won ? 'CAMPEAO!' : 'NAO FOI DESTA VEZ', { origin: [0.5, 0], color: won ? 0x6dff6d : 0xff7b6b });
    }
    T(W / 2, 240, 'ENTER ESCOLHE    ESC TITULO', { origin: [0.5, 0], color: 0xb8b0d0 });

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => m.set(m.index - 1));
    kb.on('keydown-DOWN', () => m.set(m.index + 1));
    kb.on('keydown-W', () => m.set(m.index - 1));
    kb.on('keydown-S', () => m.set(m.index + 1));
    kb.once('keydown-ESC', () => this.scene.start('Title'));
    kb.on('keydown-ENTER', () => {
      sfx.play('select');
      const setup = { ...base, champ: false, career: null, challenge: null, training: null, street: false, mode: 'pontos' };
      if (m.index === 0) this.scene.start('Game', { ...setup, away: other.id, contest: 'three' });
      else if (m.index === 1) this.scene.start('Game', { ...setup, away: other.id, contest: 'dunk' });
      else if (m.index === 2) this.scene.start('Game', { ...setup, home: mine.id, away: other.id, contest: null });
      else this.scene.start('Title');
    });
  }
}
