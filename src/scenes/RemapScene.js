import Phaser from 'phaser';
import { VIEW } from '../config.js';
import { ACTIONS, loadControls, saveControls, resetControls } from '../data/keys.js';
import PixelText from '../ui/PixelText.js';
import { drawPanel, makeMenu } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3', 'CIMA', 'BAIXO', 'ESQ', 'DIR'];

// Personalizar controles: ENTER numa ação e aperte a nova tecla (ou botão do gamepad).
export default class RemapScene extends Phaser.Scene {
  constructor() {
    super('Remap');
  }

  create() {
    const W = VIEW.W;
    this.cameras.main.setBackgroundColor('#0b0b14');
    const g = this.add.graphics();
    drawPanel(g, 30, 10, W - 60, VIEW.H - 20, 0x6dff6d);
    new PixelText(this, W / 2, 18, 'PERSONALIZAR CONTROLES', { scale: 2, origin: [0.5, 0], color: 0x6dff6d });
    new PixelText(this, 52, 40, 'ACAO                        TECLADO     GAMEPAD', { color: 0x7a7290 });
    const c = loadControls();
    const label = (a, name) => `${name.padEnd(28)}${c.keys[a].padEnd(12)}${PAD_NAMES[c.pad[a]] || c.pad[a]}`;
    const items = ACTIONS.map(([a, n]) => ({ label: label(a, n) }));
    items.push({ label: 'RESTAURAR PADRAO', color: 0xffe14d }, { label: 'VOLTAR', color: 0xb8b0d0 });
    const m = makeMenu(this, items, 52, 54, { gap: 13, origin: 0 });
    const hint = new PixelText(this, W / 2, 236, 'ENTER ESCOLHE A ACAO  -  MOVIMENTO: WASD/SETAS/ANALOGICO', { origin: [0.5, 0], color: 0xb8b0d0 });
    let waiting = null;
    let waitAt = 0;
    const kb = this.input.keyboard;
    kb.on('keydown', (ev) => {
      if (waiting) {
        if (ev.key === 'Escape') {
          waiting = null;
          hint.setText('CANCELADO');
          return;
        }
        const code = Phaser.Input.Keyboard.KeyCodes;
        const name = Object.keys(code).find((k) => code[k] === ev.keyCode);
        if (!name || ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ESC', 'P', 'M'].includes(name)) {
          hint.setText('TECLA RESERVADA - ESCOLHA OUTRA');
          return;
        }
        c.keys[waiting] = name;
        saveControls(c);
        sfx.play('play');
        const i = ACTIONS.findIndex(([a]) => a === waiting);
        m.label(i, label(waiting, ACTIONS[i][1]));
        hint.setText(`${ACTIONS[i][1].toUpperCase()} = ${name}`);
        waiting = null;
        return;
      }
      if (ev.key === 'ArrowUp' || ev.key === 'w') m.set(m.index - 1);
      else if (ev.key === 'ArrowDown' || ev.key === 's') m.set(m.index + 1);
      else if (ev.key === 'Escape') this.scene.start('Title');
      else if (ev.key === 'Enter') {
        if (m.index < ACTIONS.length) {
          waiting = ACTIONS[m.index][0];
          waitAt = this.time.now;
          hint.setText('APERTE A NOVA TECLA OU BOTAO DO GAMEPAD (ESC/B CANCELA)');
        } else if (m.index === ACTIONS.length) {
          resetControls();
          this.scene.restart();
        } else this.scene.start('Title');
      }
    });
    // gamepad: espera um botão enquanto uma ação está selecionada
    this.input.gamepad.on('down', (pad, button) => {
      // ignora o próprio A que abriu a espera (a ponte do controle vira ENTER)
      if (!waiting || this.time.now - waitAt < 300 || button.index === 1) return;
      c.pad[waiting] = button.index;
      saveControls(c);
      const i = ACTIONS.findIndex(([a]) => a === waiting);
      m.label(i, label(waiting, ACTIONS[i][1]));
      hint.setText(`${ACTIONS[i][1].toUpperCase()} = ${PAD_NAMES[button.index] || button.index}`);
      waiting = null;
    });
  }
}
