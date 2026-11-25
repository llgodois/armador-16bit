import { toFontText } from '../art/font.js';
import { THEME, themeTint } from './theme.js';

// Texto com a fonte pixel + sombra de 1px. Uso:
//   const t = new PixelText(scene, x, y, 'Olá', { color: 0xffe14d, scale: 2, origin: 0.5 });
// No tema moderno (versão 3D) vira texto com fonte de transmissão, mesma API.
export default class PixelText {
  constructor(scene, x, y, text, opts = {}) {
    const { color = 0xffffff, shadow = 0x10101a, scale = 1, origin = 0, depth = 0, scroll = 1 } = opts;
    this.scale = scale;
    const ox = Array.isArray(origin) ? origin[0] : origin;
    const oy = Array.isArray(origin) ? origin[1] : origin;
    const str = toFontText(text);
    if (THEME.modern) {
      this.modern = true;
      this.dy = THEME.yOff * scale;
      this.shadow = null;
      this.main = scene.add
        .text(x, y + this.dy, str, {
          fontFamily: THEME.font,
          fontSize: `${THEME.fontSize * scale}px`,
          fontStyle: scale >= 2 ? '800' : '600',
          color: '#ffffff',
        })
        .setResolution(THEME.res)
        .setTint(themeTint(color))
        .setOrigin(ox, oy)
        .setDepth(depth)
        .setScrollFactor(scroll);
      if (shadow !== null) this.main.setShadow(0, 0.7 * scale, 'rgba(0,0,0,0.75)', 1.2 * scale, false, true);
      return;
    }
    this.dy = 0;
    this.shadow =
      shadow === null
        ? null
        : scene.add.bitmapText(x + scale, y + scale, 'pixel', str).setTint(shadow).setScale(scale).setOrigin(ox, oy).setDepth(depth).setScrollFactor(scroll);
    this.main = scene.add.bitmapText(x, y, 'pixel', str).setTint(color).setScale(scale).setOrigin(ox, oy).setDepth(depth).setScrollFactor(scroll);
  }
  each(fn) {
    if (this.shadow) fn(this.shadow, true);
    fn(this.main, false);
    return this;
  }
  setText(t) {
    const s = toFontText(t);
    return this.each((o) => o.text !== s && o.setText(s));
  }
  setColor(c) {
    this.main.setTint(themeTint(c));
    return this;
  }
  setPosition(x, y) {
    if (this.modern) {
      this.main.setPosition(x, y + this.dy);
      return this;
    }
    return this.each((o, sh) => o.setPosition(Math.round(x) + (sh ? this.scale : 0), Math.round(y) + (sh ? this.scale : 0)));
  }
  setVisible(v) {
    return this.each((o) => o.setVisible(v));
  }
  setAlpha(a) {
    return this.each((o) => o.setAlpha(a));
  }
  setDepth(d) {
    return this.each((o) => o.setDepth(d));
  }
  get x() {
    return this.main.x;
  }
  get y() {
    return this.main.y - this.dy;
  }
  get width() {
    return this.main.width;
  }
  destroy() {
    this.each((o) => o.destroy());
  }
}
