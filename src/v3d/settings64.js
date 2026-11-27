// Configurações do Armador 64 num lugar só — usadas pela tela CONFIGURACOES do menu inicial e
// da pausa (antes cada opção era um item solto e os menus ficavam enormes).
// gs = a GameScene (é nela que o main3d pendura câmera, medidor e ícones).
import { sfx } from '../audio/sfx.js';

const GLYPH_NAMES = { xbox: 'XBOX', ps: 'PLAYSTATION', teclado: 'TECLADO' };
const rumbleOn = () => {
  try {
    return localStorage.getItem('rumble3d') !== 'off';
  } catch (e) {
    return true;
  }
};

// [{ id, label(), act() }] — act() muda a opção (o rótulo é lido de novo depois)
export function settings64(gs) {
  const list = [];
  if (gs && gs.camModes) {
    const cams = gs.camModes;
    list.push(
      {
        id: 'camera',
        label: () => `CAMERA: ${(cams.find((c) => c.id === gs.camMode) || cams[0]).name}`,
        act: () => gs.setCamMode(cams[(cams.findIndex((c) => c.id === gs.camMode) + 1) % cams.length].id),
      },
      {
        id: 'meter',
        label: () => `MEDIDOR: ${gs.meterMode === 'pulo' ? 'PULO (SEM BARRA)' : 'BARRA'}`,
        act: () => gs.setMeterMode(gs.meterMode === 'pulo' ? 'barra' : 'pulo'),
      },
      {
        id: 'glyphs',
        label: () => `BOTOES: ${GLYPH_NAMES[gs.glyphMode] || 'XBOX'}`,
        act: () => {
          const order = ['xbox', 'ps', 'teclado'];
          gs.setGlyphMode(order[(order.indexOf(gs.glyphMode) + 1) % order.length]);
        },
      },
    );
  }
  list.push(
    {
      id: 'rumble',
      label: () => `VIBRACAO: ${rumbleOn() ? 'LIGADA' : 'DESLIGADA'}`,
      act: () => {
        try {
          localStorage.setItem('rumble3d', rumbleOn() ? 'off' : 'on');
        } catch (e) {
          /* sem storage */
        }
      },
    },
    { id: 'sound', label: () => (sfx.muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO'), act: () => sfx.toggleMute() },
    { id: 'music', label: () => (sfx.musicMuted ? 'MUSICA: DESLIGADA' : 'MUSICA: LIGADA'), act: () => sfx.toggleMusic() },
  );
  return list;
}
