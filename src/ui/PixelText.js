import { toFontText } from '../art/font.js';

// Texto com a fonte pixel + sombra de 1px. Uso:
//   const t = new PixelText(scene, x, y, 'Olá', { color: 0xffe14d, scale: 2, origin: 0.5 });
export default class PixelText {
  constructor(scene, x, y, text, opts = {}) {
    const { color = 0xffffff, shadow = 0x10101a, scale = 1, origin = 0, depth = 0, scroll = 1 } = opts;
    this.scale = scale;
    const ox = Array.isArray(origin) ? origin[0] : origin;
    const oy = Array.isArray(origin) ? origin[1] : origin;
    const str = toFontText(text);
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
    this.main.setTint(c);
    return this;
  }
  setPosition(x, y) {
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
    return this.main.y;
  }
  get width() {
    return this.main.width;
  }
  destroy() {
    this.each((o) => o.destroy());
  }
}
