// =====================================================================
//  Visual "moderno" dos menus e do placar — SÓ na versão 3D.
//  - liga o tema (fonte de transmissão em alta resolução, src/ui/theme.js)
//  - o Phaser roda em 4x (1920x1080) com câmeras em zoom 4: o layout dos
//    menus continua em 480x270, mas texto e cantos ficam nítidos
//  - painéis desenhados direto nas cenas (fillRect com as cores de painel
//    da paleta 16-bit) viram vidro escuro arredondado
//  - fundos das telas ficam translúcidos: o ginásio 3D aparece por trás
// =====================================================================
import Phaser from 'phaser';
import { THEME } from '../ui/theme.js';

export const UI_ZOOM = 4;

const PANEL = new Map([
  [0x0b0b14, 0x0a1120],
  [0x10101a, 0x0a1120],
  [0x14121f, 0x0e1628],
  [0x1a1626, 0x111b30],
]);
const BORDER = new Map([[0x3a3352, 0x2a3a58]]);
const ACCENT = new Map([[0x3a3352, 0x22314d]]); // trilhos de barra etc. (fill)

export function enableModernTheme() {
  THEME.modern = true;
  THEME.res = UI_ZOOM;

  const G = Phaser.GameObjects.Graphics.prototype;
  const { fillStyle, lineStyle, fillRect, strokeRect } = G;
  G.fillStyle = function (color, alpha = 1) {
    this._panel = PANEL.has(color);
    return fillStyle.call(this, PANEL.get(color) ?? ACCENT.get(color) ?? color, alpha);
  };
  G.lineStyle = function (width, color, alpha = 1) {
    this._border = BORDER.has(color);
    this._hideLine = color === 0x1a1626; // borda interna dupla do pixel-art: some
    return lineStyle.call(this, width, BORDER.get(color) ?? color, alpha);
  };
  G.fillRect = function (x, y, w, h) {
    if (this._panel && w >= 12 && h >= 8) return this.fillRoundedRect(x, y, w, h, Math.min(5, h / 3, w / 3));
    return fillRect.call(this, x, y, w, h);
  };
  G.strokeRect = function (x, y, w, h) {
    if (this._hideLine) return this;
    if (this._border && w >= 12 && h >= 8) return this.strokeRoundedRect(x, y, w, h, Math.min(5, h / 3, w / 3));
    return strokeRect.call(this, x, y, w, h);
  };
}

// Fonte da transmissão (Google Fonts, carregada no 3d.html). Espera no máximo 2,5 s.
export function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const load = Promise.all(['600 20px "Barlow Condensed"', '800 20px "Barlow Condensed"'].map((f) => document.fonts.load(f)));
  return Promise.race([load, new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
}

// Câmera de cada cena: zoom 4 a partir do canto (o layout continua em 480x270)
// e fundo translúcido, para o ginásio 3D aparecer atrás dos menus.
export function styleScene(scene) {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0).setZoom(UI_ZOOM);
  const bg = cam.backgroundColor;
  if (bg && bg.alpha > 0) cam.setBackgroundColor('rgba(6,10,20,0.84)');
  if (scene.sys.settings.key === 'Title') {
    // o título 16-bit tem uma quadra pixelada de fundo: no 3D, o ginásio de verdade
    for (const o of scene.children.list) {
      if (o.depth < 5000) o.setVisible(false);
      else if (o.type === 'Rectangle' && o.depth === 5000) o.setAlpha(0.45);
    }
  }
}
