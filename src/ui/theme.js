// Tema visual dos menus/placar. O 16-bit usa o padrão (fonte pixel).
// A versão 3D (src/v3d/modernUI.js) liga o tema "moderno" antes de o jogo começar:
// fonte de transmissão em alta resolução e painéis arredondados.
export const THEME = {
  modern: false,
  font: '"Barlow Condensed", "Arial Narrow", sans-serif',
  fontSize: 10, // px lógicos por "scale" (a fonte pixel tem 8)
  yOff: -1.6, // a caixa do texto tem margem em cima; sobe para alinhar com a fonte pixel
  res: 1, // resolução do texto (= zoom da câmera no 3D)
  // cores "roxas" da paleta 16-bit viram cinzas frios no moderno
  tints: { 0xd8d0ee: 0xe8eef7, 0xb8b0d0: 0xa9b8cc, 0x7a7290: 0x71829c },
};

export const themeTint = (c) => (THEME.modern && THEME.tints[c] !== undefined ? THEME.tints[c] : c);
