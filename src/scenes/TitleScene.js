import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { addHoops, playerTexKey } from '../art/sprites.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu, drawControls } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { load as loadChamp } from '../data/championship.js';
import { THEME } from '../ui/theme.js';
import { settings64 } from '../v3d/settings64.js'; // (só usado no 64)

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
      this.children.list.forEach((o) => (o.type === 'BitmapText' || o.type === 'Text') && o.setScrollFactor(0));
      T(W / 2, VIEW.H - 22, 'ESQ/DIR (LB/RB) TECLADO-JOYSTICK   ENTER PERSONALIZAR   ESC VOLTAR', { color: 0xb8b0d0 });
      const flip = () => this.scene.restart({ mode: 'controls', pad: !this.padPage });
      this.input.keyboard.on('keydown-LEFT', flip);
      this.input.keyboard.on('keydown-RIGHT', flip);
      this.input.keyboard.once('keydown-ESC', () => this.scene.restart({ mode: THEME.modern ? 'settings' : 'menu' }));
      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Remap'));
      return;
    }

    // Logo
    if (THEME.modern) {
      // versão 3D: logo "ARMADOR 64" com cara de transmissão
      T(W / 2 - 14, 18, 'ARMADOR', { scale: 5, color: 0xffffff });
      T(W / 2 + 92, 22, '64', { scale: 3.4, color: 0xff7a2e });
      T(W / 2, 72, 'BASQUETE 3D  -  QUADRA INTEIRA  -  PRIMEIRO A 21', { color: 0xa9b8cc });
    } else {
      T(W / 2 + 2, 30, 'ARMADOR', { scale: 5, color: 0xffe14d, shadow: 0xa3231c });
      T(W / 2, 72, 'BASQUETE 16-BIT  -  QUADRA INTEIRA  -  PRIMEIRO A 21', { color: 0x6fa0ff });
    }
    if (!THEME.modern) g.fillStyle(0xffe14d, 1).fillRect(W / 2 - 120, 86, 240, 1);

    const saved = loadChamp();
    let acts;
    // (64: menu enxuto — opções em CONFIGURACOES e a versão 16-bit em MAIS MODOS)
    const opts64 = THEME.modern ? settings64(this.scene.get('Game')) : [];
    if (this.mode === 'more') acts = THEME.modern ? ['street', 'allstar', 'training', 'practice', 'account', 'version', 'back'] : ['street', 'allstar', 'training', 'practice', 'account', 'back'];
    else if (this.mode === 'settings') acts = [...opts64.map((o) => o.id), 'controls', 'back'];
    else {
      acts = ['arcade', 'competitive', 'career', 'franchise', 'champ'];
      if (saved && !saved.champion) acts.push('continue');
      if (THEME.modern) acts.push('more', 'settings');
      else acts.push('more', 'version', 'controls', 'sound', 'music');
    }
    const LABEL = {
      arcade: 'ARCADE',
      competitive: 'COMPETITIVO (SOBREVIVENCIA)',
      account: 'TROCAR DE CONTA',
      practice: 'TREINO LIVRE',
      champ: 'CAMPEONATO',
      career: 'CARREIRA',
      training: 'TREINO E DESAFIOS',
      franchise: 'FRANQUIA',
      more: 'MAIS MODOS',
      version: THEME.modern ? 'VERSAO CLASSICA 16-BIT' : 'NOVO: VERSAO 3D (ARMADOR 64)',
      street: 'RUA 3X3',
      allstar: 'FIM DE SEMANA DAS ESTRELAS',
      back: 'VOLTAR',
      continue: 'CONTINUAR CAMPEONATO',
      controls: 'CONTROLES',
      sound: sfx.muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO',
      music: sfx.musicMuted ? 'MUSICA: DESLIGADA' : 'MUSICA: LIGADA',
      settings: 'CONFIGURACOES',
    };
    for (const o of opts64) LABEL[o.id] = o.label();
    // com muitos itens o espaçamento aperta para caber na tela
    const gap = Math.min(17, Math.floor(135 / acts.length));
    drawPanel(g, W / 2 - 100, 92, 200, 20 + acts.length * gap, THEME.modern ? 0xff7a2e : 0xffe14d);
    // quem está jogando
    const prof = this.registry.get('profile');
    T(W - 8, 4, prof ? `${prof.name}  -  ${prof.coins} MOEDAS` : 'CONVIDADO', { origin: [1, 0], color: prof ? 0x6dff6d : 0x7a7290 });
    const items = acts.map((a) => ({ label: LABEL[a], color: a === 'continue' ? 0x6dff6d : a === 'version' ? 0xff9a4d : a === 'settings' || (this.mode === 'settings' && opts64.some((o) => o.id === a)) ? 0x3ad6ff : undefined }));
    const m = makeMenu(this, items, W / 2, 102, { gap, depth: 5002 });
    this.children.list.forEach((o) => (o.type === 'BitmapText' || o.type === 'Text') && o.setScrollFactor(0));
    T(W / 2, 250, THEME.modern && this.mode !== 'menu' ? 'SETAS ESCOLHEM    ENTER / A CONFIRMA    ESC / B VOLTA' : 'SETAS / WASD ESCOLHE    ENTER CONFIRMA', { color: 0x7a7290 });

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
      const o64 = this.mode === 'settings' && opts64.find((o) => o.id === a);
      if (o64) {
        o64.act();
        return m.label(m.index, o64.label());
      }
      if (a === 'settings') return this.scene.restart({ mode: 'settings' });
      if (a === 'arcade') this.scene.start('Select', { champ: false });
      else if (a === 'champ') this.scene.start('Select', { champ: true });
      else if (a === 'competitive') this.scene.start('Competitive');
      else if (a === 'account') this.scene.start('Login');
      else if (a === 'practice') this.scene.start('Training', { tab: 'free' });
      else if (a === 'continue') this.scene.start('Championship');
      else if (a === 'career') this.scene.start('Career');
      else if (a === 'training') this.scene.start('Training');
      else if (a === 'franchise') this.scene.start('Franchise');
      else if (a === 'more') this.scene.restart({ mode: 'more' });
      // as duas versões ficam no mesmo site: 16-bit (index.html) e 3D (3d.html)
      // (no endereço próprio do 64, armador-64, o 16-bit fica no site armador-16bit)
      else if (a === 'version') window.location.href = THEME.modern ? (location.pathname.includes('/armador-64') ? 'https://llgodois.github.io/armador-16bit/' : './index.html') : './3d.html';
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
    // (64) B do controle / ESC: volta de MAIS MODOS e CONFIGURACOES para o menu
    if (THEME.modern && (this.mode === 'more' || this.mode === 'settings')) {
      kb.once('keydown-ESC', () => {
        sfx.play('select');
        this.scene.restart({ mode: 'menu' });
      });
    }
    kb.on('keydown-M', () => {
      const muted = sfx.toggleMute();
      if (acts.includes('sound')) m.label(acts.indexOf('sound'), muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO');
    });
  }
}
