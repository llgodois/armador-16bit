import Phaser from 'phaser';
import { generateAll } from '../art/sprites.js';
import { generateFont } from '../art/font.js';

// Gera todas as texturas, a fonte e as animações, depois vai para o título.
// Quando houver arte real, carregue os arquivos aqui em preload().
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateAll(this);
    generateFont(this);
    // ao abrir o site: tela de login (apelido + PIN)
    this.scene.start('Login');
  }
}
