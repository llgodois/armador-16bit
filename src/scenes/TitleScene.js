import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { addHoops, playerTexKey } from '../art/sprites.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu, drawControls } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { load as loadChamp } from '../data/championship.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  init(data) {
    this.mode = (data && data.mode) || 'menu';
    this.padPage = !!(data && data.pad);
  }

  create() {
    const W = VIEW.W;
    const cam = this.cameras.main;
    cam.setScroll(0, 0);

    // Fundo: a quadra com uma jogada "congelada" e a câmera passeando devagar
    this.add.image(0, 0, 'court').setOrigin(0);
    addHoops(this);
    const cast = [
      ['ondas', 0, 240, 210, 6], ['astros', 0, 236, 192, 0], ['ondas', 1, 370, 150, 6], ['astros', 1, 356, 140, 0],
      ['ondas', 4, 268, 108, 6], ['astros', 4, 254, 96, 0], ['ondas', 2, 110, 150, 6], ['astros', 2, 124, 140, 0],
      ['ondas', 3, 70, 74, 6], ['astros', 3, 86, 70, 0],
    ];
    for (const [team, i, x, y, frame] of cast) {
      this.add.image(x, y, 'shadow').setDepth(1);
      this.add.sprite(x, y, playerTexKey(team, i), frame).setOrigin(0.5, 1).setDepth(y);
    }
    this.add.image(247, 211, 'ball_shadow').setDepth(1);
    const ball = this.add.image(247, 204, 'ball').setDepth(400);
    this.tweens.add({ targets: ball, y: 196, duration: 210, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: cam, scrollY: 40, duration: 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x0b0b14, 0.55).setOrigin(0).setScrollFactor(0).setDepth(5000);
    const T = (x, y, s, o = {}) => new PixelText(this, x, y, s, { origin: [0.5, 0], depth: 5002, scroll: 0, ...o });
    const g = this.add.graphics().setScrollFactor(0).setDepth(5001);

    sfx.music('menu');
    if (this.mode === 'controls') {
      drawPanel(g, 14, 10, W - 28, VIEW.H - 20, 0x6dff6d);
      T(W / 2, 16, this.padPage ? 'CONTROLES - JOYSTICK' : 'CONTROLES - TECLADO', { scale: 2, color: 0x6dff6d });
      const g2 = this.add.graphics().setScrollFactor(0).setDepth(5002);
      drawControls(this, g2, 24, 40, W - 44, 5003, this.padPage);
      // os textos do drawControls nascem presos ao mundo: fixa na tela
      this.children.list.forEach((o) => o.type === 'BitmapText' && o.setScrollFactor(0));
      T(W / 2, VIEW.H - 22, 'ESQ/DIR (LB/RB) TECLADO-JOYSTICK   ENTER PERSONALIZAR   ESC VOLTAR', { color: 0xb8b0d0 });
      const flip = () => this.scene.restart({ mode: 'controls', pad: !this.padPage });
      this.input.keyboard.on('keydown-LEFT', flip);
      this.input.keyboard.on('keydown-RIGHT', flip);
      this.input.keyboard.once('keydown-ESC', () => this.scene.restart({ mode: 'menu' }));
      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Remap'));
      return;
    }

    // Logo
    T(W / 2 + 2, 30, 'ARMADOR', { scale: 5, color: 0xffe14d, shadow: 0xa3231c });
    T(W / 2, 72, 'BASQUETE 16-BIT  -  QUADRA INTEIRA  -  PRIMEIRO A 21', { color: 0x6fa0ff });
    g.fillStyle(0xffe14d, 1).fillRect(W / 2 - 120, 86, 240, 1);

    const saved = loadChamp();
    let acts;
    if (this.mode === 'more') acts = ['street', 'allstar', 'training', 'account', 'back'];
    else {
      acts = ['arcade', 'competitive', 'career', 'franchise', 'champ'];
      if (saved && !saved.champion) acts.push('continue');
      acts.push('more', 'controls', 'sound', 'music');
    }
    const LABEL = {
      arcade: 'ARCADE',
      competitive: 'COMPETITIVO (SOBREVIVENCIA)',
      account: 'TROCAR DE CONTA',
      champ: 'CAMPEONATO',
      career: 'CARREIRA',
      training: 'TREINO E DESAFIOS',
      franchise: 'FRANQUIA',
      more: 'MAIS MODOS',
      street: 'RUA 3X3',
      allstar: 'FIM DE SEMANA DAS ESTRELAS',
      back: 'VOLTAR',
      continue: 'CONTINUAR CAMPEONATO',
      controls: 'CONTROLES',
      sound: sfx.muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO',
      music: sfx.musicMuted ? 'MUSICA: DESLIGADA' : 'MUSICA: LIGADA',
    };
    drawPanel(g, W / 2 - 100, 92, 200, 20 + acts.length * 17, 0xffe14d);
    // quem está jogando
    const prof = this.registry.get('profile');
    T(W - 8, 4, prof ? `${prof.name}  -  ${prof.coins} MOEDAS` : 'CONVIDADO', { origin: [1, 0], color: prof ? 0x6dff6d : 0x7a7290 });
    const items = acts.map((a) => ({ label: LABEL[a], color: a === 'continue' ? 0x6dff6d : undefined }));
    const m = makeMenu(this, items, W / 2, 102, { gap: 17, depth: 5002 });
    this.children.list.forEach((o) => o.type === 'BitmapText' && o.setScrollFactor(0));
    T(W / 2, 250, 'SETAS / WASD ESCOLHE    ENTER CONFIRMA', { color: 0x7a7290 });

    const kb = this.input.keyboard;
    const nav = (d) => {
      sfx.unlock();
      m.set(m.index + d);
      sfx.play('select');
    };
    kb.on('keydown-UP', () => nav(-1));
    kb.on('keydown-W', () => nav(-1));
    kb.on('keydown-DOWN', () => nav(1));
    kb.on('keydown-S', () => nav(1));
    const enter = () => {
      sfx.unlock();
      sfx.play('select');
      const a = acts[m.index];
      if (a === 'arcade') this.scene.start('Select', { champ: false });
      else if (a === 'champ') this.scene.start('Select', { champ: true });
      else if (a === 'competitive') this.scene.start('Competitive');
      else if (a === 'account') this.scene.start('Login');
      else if (a === 'continue') this.scene.start('Championship');
      else if (a === 'career') this.scene.start('Career');
      else if (a === 'training') this.scene.start('Training');
      else if (a === 'franchise') this.scene.start('Franchise');
      else if (a === 'more') this.scene.restart({ mode: 'more' });
      else if (a === 'back') this.scene.restart({ mode: 'menu' });
      else if (a === 'street') this.scene.start('Select', { champ: false, street: true });
      else if (a === 'allstar') this.scene.start('AllStar');
      else if (a === 'controls') this.scene.restart({ mode: 'controls', pad: !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) });
      else if (a === 'music') {
        const mm = sfx.toggleMusic();
        m.label(m.index, mm ? 'MUSICA: DESLIGADA' : 'MUSICA: LIGADA');
      } else {
        const muted = sfx.toggleMute();
        m.label(m.index, muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO');
      }
    };
    kb.on('keydown-ENTER', enter);
    kb.on('keydown-SPACE', enter);
    kb.on('keydown-M', () => {
      const muted = sfx.toggleMute();
      m.label(acts.indexOf('sound'), muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO');
    });
  }
}
