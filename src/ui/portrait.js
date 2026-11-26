import { THEME } from './theme.js';
import { FRAME_H } from '../art/sprites.js';

// Desenha um jogador numa tela de menu.
//  16-bit: o sprite pixelado de sempre (texKey, quadro 0).
//  64 (THEME.portrait ligado pela versão 3D): um retrato 3D do jogador cartoon, do mesmo tamanho.
// who = { info, colors, index } — quem é o jogador (para o retrato 3D).
export function addPlayerArt(scene, x, y, texKey, scale, who) {
  if (THEME.portrait && who && who.info && who.colors) {
    const pt = THEME.portrait(scene, who);
    if (pt) {
      const h = FRAME_H * scale * 1.12;
      return scene.add
        .image(x, y + scale, pt.key)
        .setOrigin(0.5, 1)
        .setDisplaySize(h * pt.aspect, h);
    }
  }
  return scene.add.sprite(x, y, texKey, 0).setOrigin(0.5, 1).setScale(scale);
}
