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
import './storage64.js'; // PRIMEIRO: dados (Supabase e navegador) separados do 16-bit
import './audio64.js'; // som do 64 (música e efeitos estilo anos 90; o 16-bit segue chiptune)
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
import { installPadBridge64, installErrorBox } from './padBridge64.js';
import World3D, { CAM_MODES } from './World3D.js';
import { enableModernTheme, fontsReady, styleScene, UI_ZOOM } from './modernUI.js';
import { installPortraits } from './portrait3d.js';
import { installSelect64 } from './select64.js';
import { installRoster64 } from './teams64.js';
import { installLoginPad } from './loginpad64.js';
import { sfx } from '../audio/sfx.js';
import { rumble } from '../game/mech64.js';

// Vibração do controle (só no 64): contato, verde, roubo, toco, tornozelo quebrado, enterrada
const RUMBLE = { ankle: [0.75, 0.4, 230], steal: [0.6, 0.3, 160], block: [0.9, 0.5, 220], green: [0, 0.35, 90] };
let rumbleScene = null; // a partida ligada ao 3D (bind)
const sfxPlay = sfx.play.bind(sfx);
sfx.play = (name, ...args) => {
  const g = rumbleScene;
  const r = RUMBLE[name];
  if (g && r) {
    rumble(g, ...r);
    // tornozelo quebrado pelo seu time: conta para o takeover
    if (name === 'ankle' && g.offSide === 'home') g.ankles64 = (g.ankles64 || 0) + 1;
  }
  return sfxPlay(name, ...args);
};

// menus e placar com visual moderno (só nesta versão)
enableModernTheme();
installPortraits(); // telas de menu: retratos 3D no lugar dos bonecos pixelados
installSelect64(SelectScene); // "Monte seu jogo" redesenhado (só no 64)
installRoster64(); // elencos 2026-27 e atributos do 2K27 (só no 64)
// placar da Sobrevivência: o RANKING inclui o bônus do desafio de estilo (só existe no 64)
const hudUpdate = HUDScene.prototype.update;
HUDScene.prototype.update = function (...args) {
  hudUpdate.apply(this, args);
  const g = this.gs;
  if (g && g.survival && g.survBonus) this.foulText.setText(`RANKING ${g.stats.fgm + g.stats.ast + g.survBonus}`);
};
fontsReady().then(start);

function start() {
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  transparent: true,
  pixelArt: true,
  roundPixels: true,
  // 4x a resolução do 16-bit: as câmeras usam zoom 4, o layout continua em 480x270
  scale: {
    mode: Phaser.Scale.FIT,
    width: VIEW.W * UI_ZOOM,
    height: VIEW.H * UI_ZOOM,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { gamepad: true },
  physics: {
    default: 'arcade',
    arcade: { debug: DEBUG.physics },
  },
  scene: [BootScene, TitleScene, SelectScene, GameScene, HUDScene, MenuScene, ChampionshipScene, TrainingScene, CareerScene, AllStarScene, FranchiseScene, RemapScene, GameOverScene, LoginScene, CompetitiveScene],
});

installErrorBox(); // (64) erro aparece na tela em vez de só travar
installPadBridge64(game); // (64) controle nos menus, tolerante a analógico/botão com folga
installLoginPad(game); // (64) o controle navega nos campos e botões do login
// cada tela, ao ser criada, ganha o zoom e o fundo translúcido (a partida 2D fica escondida)
game.events.once('ready', () => {
  // regras que só existem no 64 (vida extra na Sobrevivência, enterrada, Pro Stick, peso no movimento)
  const gs = game.scene.getScene('Game');
  gs.v64 = true;
  // câmeras: a escolha fica salva; o menu de pausa e a tecla V trocam
  gs.camModes = CAM_MODES;
  try {
    gs.camMode = CAM_MODES.some((c) => c.id === localStorage.getItem('camera3d')) ? localStorage.getItem('camera3d') : 'fundo';
  } catch {
    gs.camMode = 'fundo';
  }
  gs.setCamMode = (id) => {
    gs.camMode = id;
    try {
      localStorage.setItem('camera3d', id);
    } catch {
      /* ignore */
    }
  };
  // medidor do arremesso: 'barra' (padrão) ou 'pulo' (sem barra: solte no topo do pulo)
  try {
    gs.meterMode = localStorage.getItem('meter3d') === 'pulo' ? 'pulo' : 'barra';
  } catch {
    gs.meterMode = 'barra';
  }
  gs.setMeterMode = (m) => {
    gs.meterMode = m;
    try {
      localStorage.setItem('meter3d', m);
    } catch {
      /* ignore */
    }
  };
  // ícones dos botões (LB + botão, menus): Xbox, PlayStation ou teclado
  try {
    gs.glyphMode = ['xbox', 'ps', 'teclado'].includes(localStorage.getItem('glyphs3d')) ? localStorage.getItem('glyphs3d') : 'xbox';
  } catch {
    gs.glyphMode = 'xbox';
  }
  gs.setGlyphMode = (m) => {
    gs.glyphMode = m;
    try {
      localStorage.setItem('glyphs3d', m);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || !game.scene.isActive('Game')) return;
    const i = CAM_MODES.findIndex((c) => c.id === gs.camMode);
    gs.setCamMode(CAM_MODES[(i + 1) % CAM_MODES.length].id);
    gs.events.emit('toast', `CAMERA: ${CAM_MODES.find((c) => c.id === gs.camMode).name}`, 0x3ad6ff);
  });
  for (const sc of game.scene.scenes) {
    if (sc.sys.settings.key === 'Game') continue;
    sc.events.on('create', () => styleScene(sc));
  }
});
game.events.on('step', () => {
  const ov = document.getElementById('login-ov');
  if (ov && !game.scene.isActive('Login')) ov.remove();
});

const world = new World3D(document.getElementById('v3d'), document.getElementById('v3d-ov'));

// Liga o 3D a cada partida nova (cada vez que a GameScene é criada).
let bound = null;
function bind(scene) {
  bound = scene;
  rumbleScene = scene;
  if (world.ball !== scene.ball) {
    scene.tk64 = null; // partida nova: takeover zerado
    scene.ankles64 = 0;
  }
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
  // enterrada sua: vibra forte quando a bola entra
  if (!scene.ball.rumble64) scene.ball.rumble64 = scene.ball.on('rimIn', () => {
    const sh = scene.ball.shot;
    if (sh && sh.kind === 'dunk' && sh.shooter && sh.shooter.team === 'home') rumble(scene, 1, 0.7, 320);
  });
}

// Um erro aqui dentro NUNCA pode escapar: o Phaser chama isto dentro do próprio laço, e uma
// exceção mata o laço (o jogo "congela" no último quadro). Se o 3D falhar, a partida aparece
// em 2D naquele quadro, o erro vai para o console (window.__erro3d) e tentamos de novo.
let lastErrAt = -1e9;
game.events.on('postrender', (_r, time) => {
  const scene = game.scene.getScene('Game');
  try {
    if (world.lost) return; // contexto gráfico perdido: espera o navegador devolver
    const active = scene && (game.scene.isActive('Game') || game.scene.isPaused('Game')) && scene.ball && scene.all;
    if (!active) {
      if (bound) {
        bound = null;
        world.detach();
      }
      world.showcase(time); // menus: o ginásio 3D vazio, câmera passeando
      return;
    }
    if (bound !== scene || world.ball !== scene.ball) bind(scene);
    world.render(time);
  } catch (e) {
    if (time - lastErrAt > 3000) {
      lastErrAt = time;
      console.error('[Armador 64] erro no 3D (o jogo segue; tentando de novo):', e);
      window.__erro3d = { msg: String(e && e.message), stack: String(e && e.stack) };
    }
    // segurança: mostra a partida em 2D e refaz o 3D no próximo quadro
    bound = null;
    try {
      world.detach();
    } catch {
      /* ignore */
    }
    if (scene && scene.cameras && scene.cameras.main) scene.cameras.main.setZoom(UI_ZOOM).setVisible(true);
  }
});
// placa de vídeo / driver resetou o contexto do WebGL: reconstrói tudo quando voltar
const cv3d = document.getElementById('v3d');
cv3d.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  world.lost = true;
});
cv3d.addEventListener('webglcontextrestored', () => {
  world.lost = false;
  world.show = null; // ginásio dos menus é refeito
  bound = null; // a partida é religada no próximo quadro
});

if (import.meta.env.DEV) {
  window.__game = game;
  window.__world = world;
}
}
