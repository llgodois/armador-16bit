import Phaser from 'phaser';
import { VIEW, DEBUG } from './config.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import SelectScene from './scenes/SelectScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import MenuScene from './scenes/MenuScene.js';
import ChampionshipScene from './scenes/ChampionshipScene.js';
import TrainingScene from './scenes/TrainingScene.js';
import CareerScene from './scenes/CareerScene.js';
import AllStarScene from './scenes/AllStarScene.js';
import FranchiseScene from './scenes/FranchiseScene.js';
import RemapScene from './scenes/RemapScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import LoginScene from './scenes/LoginScene.js';
import CompetitiveScene from './scenes/CompetitiveScene.js';
import { installPadBridge } from './ui/padBridge.js';

// Maior zoom INTEIRO que cabe na janela: pixels sempre nítidos (1px = NxN).
function integerZoom() {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW.W, window.innerHeight / VIEW.H)));
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#0b0b14',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: VIEW.W,
    height: VIEW.H,
    zoom: integerZoom(),
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { gamepad: true },
  physics: {
    default: 'arcade',
    arcade: { debug: DEBUG.physics },
  },
  // Ordem importa: o HUD é desenhado por cima do Game.
  scene: [BootScene, TitleScene, SelectScene, GameScene, HUDScene, MenuScene, ChampionshipScene, TrainingScene, CareerScene, AllStarScene, FranchiseScene, RemapScene, GameOverScene, LoginScene, CompetitiveScene],
});

window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));
// controle navega todos os menus (na partida, a GameScene lê o controle direto)
installPadBridge(game);

if (import.meta.env.DEV) window.__game = game;
