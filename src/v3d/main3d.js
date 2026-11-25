// =====================================================================
//  ARMADOR 64 — mesma partida do 16-bit, desenhada em 3D.
//
//  O jogo inteiro (menus, regras, IA, HUD) continua rodando no Phaser,
//  com o mesmo código da versão 16-bit. Aqui só:
//   - o canvas do Phaser fica transparente;
//   - durante a partida, a câmera 2D da GameScene é escondida e o World3D
//     lê o estado (jogadores, bola, indicadores) e desenha em Three.js.
//  Nada em src/ (fora desta pasta) sabe que o 3D existe.
// =====================================================================
import Phaser from 'phaser';
import { VIEW, DEBUG } from '../config.js';
import BootScene from '../scenes/BootScene.js';
import TitleScene from '../scenes/TitleScene.js';
import SelectScene from '../scenes/SelectScene.js';
import GameScene from '../scenes/GameScene.js';
import HUDScene from '../scenes/HUDScene.js';
import MenuScene from '../scenes/MenuScene.js';
import ChampionshipScene from '../scenes/ChampionshipScene.js';
import TrainingScene from '../scenes/TrainingScene.js';
import CareerScene from '../scenes/CareerScene.js';
import AllStarScene from '../scenes/AllStarScene.js';
import FranchiseScene from '../scenes/FranchiseScene.js';
import RemapScene from '../scenes/RemapScene.js';
import GameOverScene from '../scenes/GameOverScene.js';
import LoginScene from '../scenes/LoginScene.js';
import CompetitiveScene from '../scenes/CompetitiveScene.js';
import { installPadBridge } from '../ui/padBridge.js';
import World3D from './World3D.js';

function integerZoom() {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW.W, window.innerHeight / VIEW.H)));
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  transparent: true,
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
  scene: [BootScene, TitleScene, SelectScene, GameScene, HUDScene, MenuScene, ChampionshipScene, TrainingScene, CareerScene, AllStarScene, FranchiseScene, RemapScene, GameOverScene, LoginScene, CompetitiveScene],
});

window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));
installPadBridge(game);
game.events.on('step', () => {
  const ov = document.getElementById('login-ov');
  if (ov && !game.scene.isActive('Login')) ov.remove();
});

const world = new World3D(document.getElementById('v3d'), document.getElementById('v3d-ov'));

// Liga o 3D a cada partida nova (cada vez que a GameScene é criada).
let bound = null;
function bind(scene) {
  bound = scene;
  scene.cameras.main.setVisible(false); // o 2D da quadra some; o HUD (outra cena) continua
  // no 3D, ao começar o arremesso em movimento o jogador desacelera aos poucos (embalo natural)
  scene.gatherBrake = 0.35;
  // textos flutuantes ("REBOTE", "+3"...) também aparecem no 3D
  // (a cena é reaproveitada a cada partida: usa sempre o método original do protótipo)
  scene.floatText = function (x, y, str, color) {
    GameScene.prototype.floatText.call(this, x, y, str, color);
    world.floatText(x, y, str, color);
  };
  world.attach(scene);
}

game.events.on('postrender', (_r, time) => {
  const scene = game.scene.getScene('Game');
  const active = scene && (game.scene.isActive('Game') || game.scene.isPaused('Game')) && scene.ball && scene.all;
  if (!active) {
    if (bound) {
      bound = null;
      world.detach();
    }
    return;
  }
  if (bound !== scene || world.ball !== scene.ball) bind(scene);
  world.render(time);
});

if (import.meta.env.DEV) {
  window.__game = game;
  window.__world = world;
}
