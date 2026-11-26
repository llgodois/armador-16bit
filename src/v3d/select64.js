// =====================================================================
//  "MONTE SEU JOGO" redesenhado — SÓ no Armador 64.
//  Substitui (no protótipo da cena, a partir do main3d.js) o desenho das
//  etapas de time e de armador. O SelectScene.js do 16-bit fica intocado.
//  Layout em 480x270 (as câmeras do 64 dão zoom 4x).
// =====================================================================
import Phaser from 'phaser';
import { playerTexKey } from '../art/sprites.js';
import { FRANCHISES, historicOf, POS, teamHudColor, fmtHeight } from '../data/teams.js';
import { LEGENDS } from '../data/legends.js';
import { drawPanel } from '../ui/widgets.js';
import { BADGES, badgesOf } from '../data/badges.js';
import { isTeamUnlocked, historicRequirement } from '../data/unlocks.js';

const BARS = [['three', '3PT'], ['mid', 'MEI'], ['fin', 'FIN'], ['pass', 'PAS'], ['spd', 'VEL'], ['def', 'DEF']];
const hexColor = (s) => Phaser.Display.Color.HexStringToColor(s).color;

// quebra um texto em linhas de até n caracteres
function wrap(text, n, max) {
  const lines = [''];
  for (const w of String(text || '').split(' ')) {
    if ((lines[lines.length - 1] + ' ' + w).trim().length > n) lines.push(w);
    else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
  }
  return lines.filter(Boolean).slice(0, max);
}

// cartão com fundo de vidro (dentro dos painéis)
function card(g, x, y, w, h) {
  g.fillStyle(0x111b30, 0.92).fillRoundedRect(x, y, w, h, 5);
  g.lineStyle(1, 0x2a3a58, 0.9).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 5);
}

function drawTeamStep(side) {
  const g = this.g;
  const c = this.cur;

  // ---- lista de times (Leste / Oeste)
  drawPanel(g, 8, 34, 228, 214, c.focus === 'ver' ? 0x6fa0ff : 0xffe14d);
  [['E', 'LESTE', 66], ['W', 'OESTE', 178]].forEach(([cf, name, tx]) => {
    const on = c.conf === cf;
    if (on) g.fillStyle(c.focus === 'tabs' ? 0xffe14d : 0x6fa0ff, 0.22).fillRoundedRect(tx - 46, 39, 92, 13, 4);
    this.T(tx, 42, on ? `< ${name} >` : name, { origin: [0.5, 0], color: on ? (c.focus === 'tabs' ? 0xffe14d : 0xffffff) : 0x5a6a86 });
  });
  this.confList(c.conf).forEach((t, i) => {
    const tx = 16 + (i % 2) * 110;
    const ty = 60 + Math.floor(i / 2) * 22;
    const on = i === c.idx && c.focus !== 'tabs';
    if (on) g.fillStyle(c.focus === 'grid' ? 0xffe14d : 0x6fa0ff, 0.2).fillRoundedRect(tx - 4, ty - 3, 106, 20, 4);
    g.fillStyle(hexColor(t.colors.jersey), 1).fillRoundedRect(tx, ty, 5, 14, 2);
    g.fillStyle(hexColor(t.colors.trim || '#ffffff'), 1).fillRect(tx, ty + 11, 5, 3);
    this.T(tx + 10, ty - 0.5, t.city.slice(0, 18), { color: on ? 0xffe14d : 0x8a98b0 });
    this.T(tx + 10, ty + 7.5, t.name.slice(0, 18), { color: on ? 0xffffff : teamHudColor(t) });
  });

  // ---- prévia do time
  const team = this.team(side);
  const fr = FRANCHISES[this.sel[side]];
  const h = historicOf(fr.id);
  const X0 = 244;
  const X1 = 472;
  drawPanel(g, X0, 34, 228, 214, teamHudColor(team));
  g.fillStyle(hexColor(team.colors.jersey), 1).fillRoundedRect(X0 + 7, 41, 4, 28, 2); // faixa na cor do time
  this.T(X0 + 17, 40, side === 'home' ? 'SEU TIME' : 'ADVERSARIO', { color: 0x71829c });
  this.T(X1 - 8, 40, `${team.city}${team.era ? '  ' + team.era : ''}`, { origin: [1, 0], color: 0xa9b8cc });
  this.T(X0 + 17, 49, team.name, { scale: 2, color: teamHudColor(team) });
  this.T(X0 + 17, 72, team.style.slice(0, 46), { color: 0xd8d0ee });

  // cartão do armador: retrato à esquerda, texto à direita (sem encostar)
  const p0 = team.players[0];
  card(g, X0 + 8, 86, 212, 66);
  this.sprite(X0 + 34, 151, playerTexKey(team.id, 0), 1.9, { info: p0, colors: team.colors, index: 0 });
  const tx = X0 + 64;
  this.T(tx, 91, 'ARMADOR', { color: 0x71829c });
  this.T(tx, 100, p0.name.slice(0, 26), { color: 0xffffff });
  this.T(tx, 111, `"${p0.nick}"  ${fmtHeight(p0.cm)}`, { color: 0xffe14d });
  const bad = badgesOf(p0).map((b) => BADGES[b].name);
  wrap(bad.join(', '), 30, 2).forEach((l, k) => this.T(tx, 123 + k * 9, l, { color: 0x6fa0ff }));

  // elenco
  team.players.forEach((p, i) => {
    const ry = 158 + i * 9.5;
    this.T(X0 + 12, ry, POS[i], { color: 0x71829c });
    this.T(X0 + 30, ry, p.name.slice(0, 26), { color: i === 0 ? 0xffe14d : 0xd8d0ee });
    this.T(X1 - 10, ry, fmtHeight(p.cm), { origin: [1, 0], color: p.cm >= 208 ? 0x6fa0ff : 0xa9b8cc });
  });

  // versões (atual / histórica)
  const vy = 210;
  g.fillStyle(0x22314d, 1).fillRect(X0 + 8, vy - 4, 212, 1);
  const hLocked = h && this.locks && !isTeamUnlocked(this.registry.get('profile'), h);
  const hLabel = h ? `HISTORICO ${h.era}${hLocked ? `  [X] ${historicRequirement(h)} PTS` : ''}` : 'HISTORICO';
  [['ATUAL 2025-26', 0], [hLabel, 1]].forEach(([label, k]) => {
    const on = c.ver === k;
    const y = vy + k * 12;
    if (on) g.fillStyle(c.focus === 'ver' ? 0xffe14d : 0x6fa0ff, 0.18).fillRoundedRect(X0 + 8, y - 2, 212, 11, 3);
    this.T(X0 + 14, y, `${on ? '> ' : '  '}${label}`, { color: on ? (c.focus === 'ver' ? 0xffe14d : 0xffffff) : 0x71829c });
  });
  this.T((X0 + X1) / 2, 236, c.focus === 'ver' ? 'CIMA/BAIXO E ENTER' : 'ENTER PARA A VERSAO', { origin: [0.5, 0], color: 0x71829c });
}

function drawPgStep() {
  const g = this.g;
  const c = this.cur;
  const home = this.team('home');

  // ---- lista: armador do time + lendas
  drawPanel(g, 8, 34, 200, 214, 0xffe14d);
  const items = [`DO TIME: ${home.players[0].name}`, ...LEGENDS.map((l) => l.name)];
  const start = Math.max(0, Math.min(items.length - 17, c.idx - 8));
  for (let k = 0; k < 17 && start + k < items.length; k++) {
    const i = start + k;
    const on = i === c.idx;
    const y = 42 + k * 12;
    if (on) g.fillStyle(0xffe14d, 0.2).fillRoundedRect(12, y - 2, 192, 11, 3);
    const lock = this.legendLocked(i);
    this.T(16, y, `${i === 0 ? '' : String(i).padStart(2, ' ') + ' '}${lock ? '[X] ' : ''}${items[i]}`.slice(0, 34), { color: on ? (lock ? 0xff7b6b : 0xffe14d) : lock ? 0x55657f : i === 0 ? 0x6fa0ff : 0xd8d0ee });
  }

  // ---- ficha do armador
  const { info, tex } = this.star();
  const X0 = 216;
  drawPanel(g, X0, 34, 256, 214, teamHudColor(home));
  this.T(X0 + 8, 40, c.idx ? `LENDA ${c.idx}/${LEGENDS.length}  NO ${home.name.toUpperCase()}` : `ARMADOR DO ${home.name.toUpperCase()}`, { color: 0x71829c });
  card(g, X0 + 6, 50, 244, 88);
  this.sprite(X0 + 36, 136, tex, 2.5, { info, colors: home.colors, index: 0 });
  const tx = X0 + 72;
  this.T(tx, 55, info.name.slice(0, 28), { color: 0xffffff });
  this.T(tx, 65, `"${info.nick}"  ${fmtHeight(info.cm)}`, { color: 0xffe14d });
  const bad = badgesOf(info).map((b) => BADGES[b].name);
  let y = 77;
  wrap(bad.join(', '), 32, 2).forEach((l) => {
    this.T(tx, y, l, { color: 0x6fa0ff });
    y += 9;
  });
  if (info.desc) wrap(info.desc, 32, 2).forEach((l) => {
    this.T(tx, y, l, { color: 0xd8d0ee });
    y += 9;
  });
  // estilo (vem do ponto forte do armador)
  const b = this.buildOf();
  this.T(X0 + 10, 142, `ESTILO: ${b.name.toUpperCase()}`, { color: 0x6dff6d });
  wrap(b.desc, 52, 2).forEach((l, k) => this.T(X0 + 10, 151 + k * 9, l, { color: 0xa9b8cc }));

  // atributos
  BARS.forEach(([k, lbl], i) => {
    const bx = X0 + 12;
    const by = 173 + i * 12;
    this.T(bx, by, lbl, { color: 0xa9b8cc });
    const v = info.r[k];
    g.fillStyle(0x22314d).fillRoundedRect(bx + 26, by + 1, 186, 6, 3);
    g.fillStyle(v >= 90 ? 0x3ddc5a : v >= 75 ? 0xffe14d : 0xff7b6b).fillRoundedRect(bx + 26, by + 1, Math.max(6, Math.round((186 * (Math.max(40, v) - 40)) / 59)), 6, 3);
    this.T(bx + 228, by, String(v), { origin: [1, 0], color: 0xd8d0ee });
  });
}

export function installSelect64(SelectScene) {
  SelectScene.prototype.drawTeamStep = drawTeamStep;
  SelectScene.prototype.drawPgStep = drawPgStep;
  // o título grande (primeiro texto da tela) encostava no topo com a fonte nova: desce um pouco
  const refresh = SelectScene.prototype.refresh;
  SelectScene.prototype.refresh = function () {
    refresh.call(this);
    const title = this.dyn[0];
    if (title && title.setPosition) title.setPosition(title.x, 8);
  };
}
