import Phaser from 'phaser';
import { GAME, STAMINA, VIEW } from '../config.js';
import { teamHudColor } from '../data/teams.js';
import { letterGrade } from '../data/reads.js';
import PixelText from '../ui/PixelText.js';
import { sfx } from '../audio/sfx.js';

// HUD em cena paralela. Lê o estado da GameScene; só mostra o essencial
// (controles ficam no menu de pausa / título).
export default class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  init(data) {
    this.gs = data.game;
  }

  create() {
    const W = VIEW.W;
    const H = VIEW.H;
    const gs = this.gs;
    const panel = this.add.graphics();
    const box = (x, y, w, h) => {
      panel.fillStyle(0x10101a, 0.82).fillRect(x, y, w, h);
      panel.lineStyle(1, 0x3a3352, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // Placar com setinha de posse
    box(4, 4, 104, 24);
    this.homeArrow = new PixelText(this, 8, 8, '>', { color: 0xffe14d });
    this.awayArrow = new PixelText(this, 8, 17, '>', { color: 0xffe14d });
    new PixelText(this, 15, 8, gs.homeTeam.name, { color: teamHudColor(gs.homeTeam) });
    new PixelText(this, 15, 17, gs.awayTeam.name, { color: teamHudColor(gs.awayTeam) });
    this.homeScore = new PixelText(this, 103, 8, '0', { origin: [1, 0] });
    this.awayScore = new PixelText(this, 103, 17, '0', { origin: [1, 0] });

    box(112, 4, 36, 24);
    this.clock = new PixelText(this, 130, 9, '24', { scale: 2, origin: [0.5, 0], color: 0xffe14d });

    // Relógio de jogo (modo por tempo) / faltas
    box(152, 4, 60, 24);
    this.gameClock = new PixelText(this, 182, 8, '', { origin: [0.5, 0], color: 0xffffff });
    this.foulText = new PixelText(this, 182, 17, '', { origin: [0.5, 0], color: 0xb8b0d0 });

    box(W - 130, 4, 126, 24);
    this.modeText = new PixelText(this, W - 125, 8, '');
    this.goalText = new PixelText(this, W - 9, 8, `A ${GAME.targetScore}`, { origin: [1, 0], color: 0x7a7290 });
    this.statText = new PixelText(this, W - 9, 17, '', { origin: [1, 0], color: 0xb8b0d0 });

    box(4, H - 20, 86, 16);
    new PixelText(this, 8, H - 16, 'GAS', { color: 0xb8b0d0 });
    this.stamBar = this.add.graphics();

    box(94, H - 20, 270, 16);
    this.playText = new PixelText(this, 229, H - 16, '', { origin: [0.5, 0] });

    box(W - 112, H - 20, 108, 16);
    this.buildText = new PixelText(this, W - 58, H - 16, '', { origin: [0.5, 0] });

    // Faixa grande (início/fim) e aviso rápido (cesta, roubo...)
    this.bannerBg = this.add.graphics().setDepth(10);
    this.bannerTitle = new PixelText(this, W / 2, 116, '', { scale: 2, origin: 0.5, depth: 11 });
    this.bannerSub = new PixelText(this, W / 2, 136, '', { origin: 0.5, depth: 11, color: 0xd8d0ee });
    this.hideBanner();
    this.toastBg = this.add.graphics().setDepth(10);
    this.toast = new PixelText(this, W / 2, 40, '', { origin: 0.5, depth: 11 });
    this.toast.setVisible(false);

    // Narração (faixa de "transmissão" logo acima do rodapé)
    this.narrBg = this.add.graphics().setDepth(10);
    this.narr = new PixelText(this, W / 2, H - 34, '', { origin: 0.5, depth: 11, color: 0xffe14d });
    this.narr.setVisible(false);
    this.onNarrate = (text) => {
      this.narr.setText(text).setVisible(true);
      const w = this.narr.width + 16;
      this.narrBg.clear().fillStyle(0x10101a, 0.85).fillRect(Math.round(W / 2 - w / 2), H - 41, Math.round(w), 14);
      this.narrBg.fillStyle(0xffe14d, 1).fillRect(Math.round(W / 2 - w / 2), H - 41, 2, 14);
      if (this.narrTimer) this.narrTimer.remove();
      this.narrTimer = this.time.delayedCall(2200, () => {
        this.narr.setVisible(false);
        this.narrBg.clear();
      });
    };

    this.onBanner = (title, sub, color, seconds) => this.showBanner(title, sub, color, seconds);
    this.onToast = (text, color) => this.showToast(text, color);
    gs.events.on('banner', this.onBanner);
    gs.events.on('toast', this.onToast);
    gs.events.on('narrate', this.onNarrate);
    gs.events.on('contestHud', (t) => (this.contestText = t));
    this.events.once('shutdown', () => {
      gs.events.off('banner', this.onBanner);
      gs.events.off('toast', this.onToast);
      gs.events.off('narrate', this.onNarrate);
    });
    this.input.keyboard.on('keydown-M', () => sfx.toggleMute());
  }

  showBanner(title, sub, color = 0xffffff, seconds = 1.5) {
    const W = VIEW.W;
    this.bannerBg.clear();
    this.bannerBg.fillStyle(0x10101a, 0.78).fillRect(0, 102, W, 44);
    this.bannerBg.fillStyle(color, 1).fillRect(0, 102, W, 1).fillRect(0, 145, W, 1);
    this.bannerTitle.setText(title).setColor(color).setVisible(true);
    this.bannerSub.setText(sub || '').setVisible(true);
    if (this.bannerTimer) this.bannerTimer.remove();
    this.bannerTimer = this.time.delayedCall(seconds * 1000 - 60, () => this.hideBanner());
  }

  hideBanner() {
    this.bannerBg.clear();
    this.bannerTitle.setVisible(false);
    this.bannerSub.setVisible(false);
  }

  showToast(text, color = 0xffffff) {
    this.toast.setText(text).setColor(color).setVisible(true);
    const w = this.toast.width + 12;
    this.toastBg.clear();
    this.toastBg.fillStyle(0x10101a, 0.8).fillRect(Math.round(VIEW.W / 2 - w / 2), 33, Math.round(w), 14);
    this.toastBg.fillStyle(color, 1).fillRect(Math.round(VIEW.W / 2 - w / 2), 46, Math.round(w), 1);
    if (this.toastTimer) this.toastTimer.remove();
    this.toastTimer = this.time.delayedCall(1300, () => {
      this.toast.setVisible(false);
      this.toastBg.clear();
    });
  }

  update(time) {
    const g = this.gs;
    if (!g || !g.offTeam) return;
    this.homeScore.setText(String(g.score.home));
    this.awayScore.setText(String(g.score.away));
    this.homeArrow.setVisible(g.offSide === 'home');
    this.awayArrow.setVisible(g.offSide === 'away');

    const sc = Math.ceil(g.shotClock);
    this.clock.setText(String(sc).padStart(2, '0'));
    this.clock.setColor(sc <= 5 ? (Math.floor(time / 250) % 2 ? 0xff5a4d : 0xffffff) : 0xffe14d);

    const def = g.userOnDefense;
    this.modeText.setText(g.state === 'ft' ? 'LANCE LIVRE' : def ? 'DEFESA' : 'ATAQUE').setColor(g.state === 'ft' ? 0xffe14d : def ? 0xff9a4d : 0x6dff6d);
    const s = g.stats;
    const gl = letterGrade(g.grade);
    this.statText.setText(def ? `${gl}  RB ${s.stl} TOCO ${s.blk}` : `${gl}  PTS ${s.pts} AST ${s.ast}`);
    this.statText.setColor(gl.startsWith('A') ? 0x6dff6d : gl.startsWith('B') ? 0xd8d0ee : gl.startsWith('C') ? 0xffe14d : 0xff7b6b);
    const frac = g.stamina / STAMINA.max;
    const bw = 56;
    this.stamBar.clear();
    this.stamBar.fillStyle(0x3a3352).fillRect(28, VIEW.H - 15, bw, 4);
    const col = frac < 0.25 ? 0xff5a4d : frac < 0.5 ? 0xffb03b : 0x6dff6d;
    this.stamBar.fillStyle(col).fillRect(28, VIEW.H - 15, Math.round(bw * frac), 4);
    // barra da visão de quadra (Q), logo abaixo do GAS
    this.stamBar.fillStyle(0x3a3352).fillRect(28, VIEW.H - 10, bw, 2);
    this.stamBar.fillStyle(g.visionOn ? 0xffffff : 0x6fa0ff).fillRect(28, VIEW.H - 10, Math.round(bw * (g.vision / 100)), 2);

    if (g.mode === 'tempo') {
      const t = Math.ceil(g.gameClock);
      this.gameClock.setText(g.suddenDeath ? 'MORTE SUB.' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      this.goalText.setText('TEMPO');
    } else this.gameClock.setText(`A ${GAME.targetScore}`);
    this.foulText.setText(`FALTAS ${g.teamFouls.home}-${g.teamFouls.away}`);
    // competitivo: vidas e pontos de ranking no lugar do relógio/faltas
    if (g.survival) {
      this.gameClock.setText(`VIDAS ${g.lives}`);
      this.gameClock.setColor(g.lives > 1 ? 0xffe14d : 0xff7b6b);
      this.foulText.setText(`RANKING ${g.stats.fgm + g.stats.ast}`);
    }

    // Jogada (sua ou do adversário) e esquema defensivo em uso: é o que você precisa ler
    const sch = g.defScheme();
    if (g.contestCtl) {
      this.playText.setText(this.contestText || '').setColor(0xffe14d);
      this.modeText.setText('TORNEIO').setColor(0xffe14d);
    } else if (g.play) {
      this.playText.setText(def ? `ADV: ${g.play.name}` : `${g.play.name}  VS  ${sch.name}`);
      this.playText.setColor(def ? 0xff9a4d : 0x6fa0ff);
    } else {
      this.playText.setText(def ? `SUA DEFESA: ${sch.name}` : `DEFESA ADV: ${sch.name}`);
      this.playText.setColor(def ? 0xff9a4d : 0xd8d0ee);
    }
    this.buildText.setText(`${g.build.name}${sfx.muted ? ' - MUDO' : ''}`);
    this.buildText.setColor(sfx.muted ? 0xff7b6b : 0xb8b0d0);
  }
}
