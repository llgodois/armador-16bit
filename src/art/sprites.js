// =====================================================================
//  SPRITES — toda a arte do jogo é gerada aqui, em código (canvas).
//
//  Para trocar por spritesheets reais depois:
//   1. Carregue os PNGs no BootScene com as MESMAS chaves de textura
//      (ex.: 'p_ondas_0', 'ball', 'court', 'board_top'...).
//   2. Jogadores: 12 frames de 16x30 em linha (FRAME_LAYOUT). O pé fica na
//      última linha; jogadores mais altos simplesmente ocupam mais pixels.
//   3. Remova a chamada correspondente em generateAll().
// =====================================================================
import { WORLD, COURT, MID_Y, BASKET, BASKET_BOTTOM, THREE, PAINT, FT_CIRCLE, RESTRICTED, HEIGHT } from '../config.js';
import { TEAMS, EXTRA_TEAMS } from '../data/teams.js';

export const FRAME_W = 16;
export const FRAME_H = 30;

// 0..5 de frente (parado, corrida 1-4, arremesso) · 6..11 de costas (mesma ordem)
export const FRAME_LAYOUT = { idle: 0, run: [1, 2, 3, 4], shoot: 5, perView: 6 };

export const playerTexKey = (teamId, i) => `p_${teamId}_${i}`;
// Pixels extras de altura do sprite a partir da altura em cm.
export const heightPixels = (cm) => Math.max(0, Math.min(HEIGHT.maxPixels, Math.round((cm - HEIGHT.baseCm) / HEIGHT.cmPerPixel)));

const SKINS = ['#f1c27d', '#8d5524', '#c68642', '#e0ac69', '#5c3a1e', '#a86b3c'];
const HAIRS = ['#3b2414', '#111111', '#1a1a1a', '#6b3e1f', '#0d0d0d', '#c9a26b'];
const OUTLINE = '#1a1222';

// Canto superior esquerdo das texturas de cada cesta (o aro fica em x=30, y=44 da textura).
export const HOOPS = {
  top: { x: BASKET.x - 30, y: BASKET.y - 74 },
  bottom: { x: BASKET_BOTTOM.x - 30, y: BASKET_BOTTOM.y - 74 },
};

// ------------------------------------------------------------- helpers
function canvasTexture(scene, key, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return { tex, ctx };
}

function rectFn(ctx, ox = 0, oy = 0) {
  return (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
}

function ellipsePoints(cx, cy, rx, ry, filter = () => true) {
  const pts = new Map();
  const steps = Math.ceil(Math.max(rx, ry) * 8);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const s = Math.sin(a);
    if (!filter(s, Math.cos(a))) continue;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + s * ry);
    pts.set(x + ',' + y, [x, y]);
  }
  return [...pts.values()];
}

function fillEllipse(r, cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    r(cx - w, cy + y, w * 2 + 1, 1, c);
  }
}

function outlineRegion(ctx, x0, y0, w, h, color) {
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const [cr, cg, cb] = hexToRgb(color);
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const mark = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) mark.push(x, y);
    }
  }
  for (let i = 0; i < mark.length; i += 2) {
    const k = (mark[i + 1] * w + mark[i]) * 4;
    d[k] = cr; d[k + 1] = cg; d[k + 2] = cb; d[k + 3] = 255;
  }
  ctx.putImageData(img, x0, y0);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------- jogadores
const POSES = [
  { bob: 0, lLift: 0, rLift: 0, lArm: 0, rArm: 0 },  // parado
  { bob: 0, lLift: 2, rLift: 0, lArm: 1, rArm: -1 }, // corrida 1
  { bob: -1, lLift: 0, rLift: 0, lArm: 0, rArm: 0 }, // corrida 2
  { bob: 0, lLift: 0, rLift: 2, lArm: -1, rArm: 1 }, // corrida 3
  { bob: -1, lLift: 0, rLift: 0, lArm: 0, rArm: 0 }, // corrida 4
  { bob: -2, lLift: 1, rLift: 1, armsUp: true },     // arremesso
];

// hp = pixels extras de altura (0..5): metade vai para o tronco, metade para as pernas.
function drawPlayerFrame(ctx, ox, pal, skin, hair, view, pose, hp) {
  const r = rectFn(ctx, ox, 0);
  const ht = Math.floor(hp / 2);
  const S = FRAME_H - 24 - hp; // deslocamento do topo
  const b = pose.bob + S;
  const back = view === 'up';

  // Cabeça
  r(6, 2 + b, 4, 1, hair);
  r(5, 3 + b, 6, 1, hair);
  if (back) {
    r(5, 4 + b, 6, 4, hair);
    r(6, 8 + b, 4, 1, skin);
  } else {
    r(5, 4 + b, 6, 4, skin);
    r(6, 8 + b, 4, 1, skin);
    r(5, 4 + b, 1, 1, hair);
    r(10, 4 + b, 1, 1, hair);
    r(6, 6 + b, 1, 1, OUTLINE);
    r(9, 6 + b, 1, 1, OUTLINE);
  }
  r(7, 9 + b, 2, 1, skin);

  // Camisa (mais comprida nos altos)
  const wide = hp >= 4 ? 1 : 0; // grandalhões têm ombros mais largos
  r(5 - wide, 10 + b, 6 + wide * 2, 6 + ht, pal.jersey);
  r(4 - wide, 11 + b, 8 + wide * 2, 5 + ht, pal.jersey);
  r(10, 11 + b, 2 + wide, 5 + ht, pal.dark);
  if (back) {
    r(7, 11 + b, 2, 3, pal.trim);
  } else {
    r(6, 10 + b, 1, 1, pal.trim);
    r(9, 10 + b, 1, 1, pal.trim);
    r(7, 10 + b, 2, 1, skin);
    r(7, 12 + b, 2, 2, pal.trim);
  }

  // Braços
  if (pose.armsUp) {
    r(3 - wide, Math.max(0, 3 + b), 1, 8, skin);
    r(12 + wide, Math.max(0, 3 + b), 1, 8, skin);
    r(4 - wide, Math.max(0, 2 + b), 1, 2, skin);
    r(11 + wide, Math.max(0, 2 + b), 1, 2, skin);
  } else {
    r(3 - wide, 11 + b + pose.lArm, 1, 5 + ht, skin);
    r(12 + wide, 11 + b + pose.rArm, 1, 5 + ht, skin);
  }

  // Short
  const sy = 16 + b + ht;
  r(4, sy, 8, 3, pal.shorts);
  r(4, sy, 1, 3, pal.trim);
  r(11, sy, 1, 3, pal.trim);
  ctx.clearRect(ox + 7, sy + 2, 2, 1);

  // Pernas, meias, tênis (pé sempre na última linha)
  const leg = (x, lift) => {
    const top = sy + 3;
    const foot = FRAME_H - 2 - lift;
    r(x, top, 2, Math.max(1, foot - top), skin);
    r(x, foot - 1, 2, 1, '#f4f4f4');
    r(x === 5 ? 4 : 9, foot, 3, 2, pal.shoes);
  };
  leg(5, pose.lLift);
  leg(9, pose.rLift);
}

// Gera a spritesheet + animações de um jogador (cores do time, altura, pele, cabelo).
export function generatePlayerTexture(scene, key, colors, cm, skinIdx, hairIdx) {
  const skin = SKINS[skinIdx % SKINS.length];
  const hair = HAIRS[hairIdx % HAIRS.length];
  const hp = heightPixels(cm);
  const { tex, ctx } = canvasTexture(scene, key, FRAME_W * 12, FRAME_H);
  ['down', 'up'].forEach((view, v) => {
    POSES.forEach((pose, p) => {
      const ox = (v * 6 + p) * FRAME_W;
      drawPlayerFrame(ctx, ox, colors, skin, hair, view, pose, hp);
      outlineRegion(ctx, ox, 0, FRAME_W, FRAME_H, OUTLINE);
    });
  });
  tex.refresh();
  for (let f = 0; f < 12; f++) tex.add(f, 0, f * FRAME_W, 0, FRAME_W, FRAME_H);
  ['down', 'up'].forEach((view, v) => {
    const base = v * FRAME_LAYOUT.perView;
    const animKey = `${key}-run-${view}`;
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({ key: animKey, frames: FRAME_LAYOUT.run.map((f) => ({ key, frame: base + f })), frameRate: 10, repeat: -1 });
  });
  return key;
}

// Textura de uma lenda vestindo o uniforme de um time (gerada sob demanda).
export function legendTexKey(scene, legend, team) {
  const key = `lg_${legend.id}_${team.id}`;
  if (!scene.textures.exists(key)) generatePlayerTexture(scene, key, team.colors, legend.cm, legend.skin, legend.hair);
  return key;
}

function generatePlayers(scene) {
  [...TEAMS, ...EXTRA_TEAMS].forEach((team, ti) => {
    team.players.forEach((pl, i) => {
      generatePlayerTexture(scene, playerTexKey(team.id, i), team.colors, pl.cm, i * 3 + ti * 2, i + ti * 3);
    });
  });
}

// ------------------------------------------------------------- pequenos sprites
function generateSmall(scene) {
  {
    const { tex, ctx } = canvasTexture(scene, 'ball', 7, 7);
    const r = rectFn(ctx);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const d = (x - 3) ** 2 + (y - 3) ** 2;
        if (d > 10) continue;
        let c = x + y > 7 ? '#c0561c' : '#ec7a2c';
        if (d > 7) c = '#7a3410';
        r(x, y, 1, 1, c);
      }
    }
    r(3, 1, 1, 5, '#6b2a0c');
    r(1, 3, 5, 1, '#6b2a0c');
    r(2, 1, 1, 1, '#ffb070');
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'ball_shadow', 7, 3);
    const r = rectFn(ctx);
    r(1, 0, 5, 3, 'rgba(0,0,0,0.38)');
    r(0, 1, 7, 1, 'rgba(0,0,0,0.38)');
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'shadow', 14, 5);
    fillEllipse(rectFn(ctx), 7, 2, 6, 2, 'rgba(0,0,0,0.33)');
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'ring', 18, 8);
    const r = rectFn(ctx);
    for (const [x, y] of ellipsePoints(9, 4, 8, 3)) r(x, y, 1, 1, '#ffe14d');
    for (const [x, y] of ellipsePoints(9, 4, 7, 2, (s) => s > 0)) r(x, y, 1, 1, '#c9a51c');
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'target', 9, 7);
    const r = rectFn(ctx);
    r(1, 1, 7, 1, '#ffffff');
    r(2, 2, 5, 1, '#ffffff');
    r(3, 3, 3, 1, '#ffffff');
    r(4, 4, 1, 1, '#ffffff');
    outlineRegion(ctx, 0, 0, 9, 7, OUTLINE);
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'dot', 7, 7);
    const r = rectFn(ctx);
    r(3, 1, 1, 5, '#ffffff');
    r(2, 2, 3, 3, '#ffffff');
    r(1, 3, 5, 1, '#ffffff');
    outlineRegion(ctx, 0, 0, 7, 7, OUTLINE);
    tex.refresh();
  }
  // Ícone de passe (quadradinho com borda) — o número vai por cima
  {
    const { tex, ctx } = canvasTexture(scene, 'icon', 11, 11);
    const r = rectFn(ctx);
    r(1, 1, 9, 9, '#1a1222');
    r(2, 2, 7, 7, '#ffffff');
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'px', 1, 1);
    rectFn(ctx)(0, 0, 1, 1, '#ffffff');
    tex.refresh();
  }
}

// ------------------------------------------------------------- quadra inteira
function generateCourt(scene) {
  const { tex, ctx } = canvasTexture(scene, 'court', WORLD.W, WORLD.H);
  const r = rectFn(ctx);
  const rand = rng(1234);
  const LINE = '#f3efe6';

  r(0, 0, WORLD.W, WORLD.H, '#1d1a2b');
  const crowd = ['#e0392f', '#2f6fe4', '#f1c27d', '#8d5524', '#ffd23f', '#c68642', '#ffffff', '#5c3a1e'];
  const drawCrowd = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y += 5) {
      for (let x = x0 + ((y / 5) % 2) * 2; x < x1; x += 4) {
        if (rand() < 0.15) continue;
        r(x, y, 2, 2, crowd[Math.floor(rand() * crowd.length)]);
        r(x, y + 2, 2, 2, rand() < 0.5 ? '#2b2740' : '#3a3352');
      }
    }
  };
  // laterais mais largas: faixa fora das linhas onde os jogadores repõem a bola
  const SX = 24;
  const SY = 18;
  drawCrowd(0, 0, WORLD.W, COURT.top - SY - 2);
  drawCrowd(0, COURT.bottom + SY + 2, WORLD.W, WORLD.H);
  drawCrowd(0, COURT.top - SY - 2, COURT.left - SX - 2, COURT.bottom + SY + 2);
  drawCrowd(COURT.right + SX + 2, COURT.top - SY - 2, WORLD.W, COURT.bottom + SY + 2);

  r(COURT.left - SX, COURT.top - SY, COURT.right - COURT.left + 2 * SX, COURT.bottom - COURT.top + 2 * SY, '#7a2f2a');
  // bancos dos times na lateral
  for (const y of [MID_Y - 60, MID_Y + 20]) r(COURT.left - SX + 2, y, 5, 40, '#3a3352');
  for (const y of [MID_Y - 60, MID_Y + 20]) r(COURT.right + SX - 7, y, 5, 40, '#3a3352');

  // Tábuas
  const woods = ['#c98a4c', '#c08043', '#d19459', '#c58648'];
  const H = COURT.bottom - COURT.top;
  for (let x = COURT.left, i = 0; x < COURT.right; x += 6, i++) {
    r(x, COURT.top, 6, H, woods[i % woods.length]);
    let y = COURT.top + Math.floor(rand() * 50);
    while (y < COURT.bottom) {
      r(x, y, 6, 1, '#a76a35');
      y += 40 + Math.floor(rand() * 40);
    }
    for (let k = 0; k < 26; k++) {
      const gy = COURT.top + Math.floor(rand() * H);
      r(x + 1 + Math.floor(rand() * 4), gy, 1, 2 + Math.floor(rand() * 3), rand() < 0.5 ? '#b5763d' : '#d9a066');
    }
    r(x + 5, COURT.top, 1, H, '#b27238');
  }

  // Desenha uma metade (a de cima); flip = true desenha a de baixo espelhada.
  const half = (flip) => {
    const R = (x, y, w, h, c) => (flip ? r(x, 2 * MID_Y - y - h + 1, w, h, c) : r(x, y, w, h, c));
    const E = (cx, cy, rx, ry, filter, c, dash = null) => {
      for (const [x, y] of ellipsePoints(cx, cy, rx, ry, filter)) {
        if (dash && !dash(x, y)) continue;
        R(x, y, 1, 1, c);
      }
    };
    R(PAINT.left, PAINT.top, PAINT.right - PAINT.left, PAINT.bottom - PAINT.top, '#3355a8');
    for (let x = PAINT.left; x < PAINT.right; x += 6) R(x + 5, PAINT.top, 1, PAINT.bottom - PAINT.top, '#2c4b96');
    R(PAINT.left, PAINT.top, 1, PAINT.bottom - PAINT.top, LINE);
    R(PAINT.right - 1, PAINT.top, 1, PAINT.bottom - PAINT.top, LINE);
    R(PAINT.left, PAINT.bottom, PAINT.right - PAINT.left, 1, LINE);
    for (const y of [86, 100, 114, 128]) {
      R(PAINT.left - 3, y, 3, 1, LINE);
      R(PAINT.right, y, 3, 1, LINE);
    }
    E(BASKET.x, PAINT.bottom, FT_CIRCLE.rx, FT_CIRCLE.ry, () => true, LINE, (x, y) => y >= PAINT.bottom || (x + y) % 4 < 2);
    E(BASKET.x, BASKET.y, RESTRICTED.rx, RESTRICTED.ry, (s) => s >= 0, LINE);
    R(BASKET.x - THREE.rx, COURT.top, 1, BASKET.y - COURT.top, LINE);
    R(BASKET.x + THREE.rx, COURT.top, 1, BASKET.y - COURT.top, LINE);
    E(BASKET.x, BASKET.y, THREE.rx, THREE.ry, (s) => s >= 0, LINE);
    R(COURT.left, COURT.top, COURT.right - COURT.left, 1, LINE); // linha de fundo
  };
  half(false);
  half(true);

  // Laterais, meio da quadra, círculo central
  r(COURT.left, COURT.top, 1, H, LINE);
  r(COURT.right - 1, COURT.top, 1, H, LINE);
  fillEllipse(r, BASKET.x, MID_Y, 14, 10, '#3355a8');
  r(COURT.left, MID_Y, COURT.right - COURT.left, 1, LINE);
  for (const [x, y] of ellipsePoints(BASKET.x, MID_Y, FT_CIRCLE.rx, FT_CIRCLE.ry)) r(x, y, 1, 1, LINE);

  tex.refresh();
}

// ------------------------------------------------------------- quadra de rua (meia quadra, Rua 3x3)
// Asfalto com rachaduras, linhas pintadas gastas, alambrado em volta, calçada e muro com grafite.
function generateStreetCourt(scene) {
  const { tex, ctx } = canvasTexture(scene, 'court_street', WORLD.W, WORLD.H);
  const r = rectFn(ctx);
  const rand = rng(777);
  const LINE = '#e9e4d2';
  const BOTTOM = MID_Y + 4;

  // calçada / grama fora da quadra
  r(0, 0, WORLD.W, WORLD.H, '#3a3f35');
  for (let k = 0; k < 900; k++) r(Math.floor(rand() * WORLD.W), Math.floor(rand() * WORLD.H), 1, 2, rand() < 0.5 ? '#45503d' : '#2f3529');
  // muro de tijolos atrás da cesta, com grafite
  for (let y = 0; y < COURT.top - 12; y += 4) {
    for (let x = (y / 4) % 2 ? 0 : 4; x < WORLD.W; x += 8) {
      r(x, y, 7, 3, ['#8a3b2c', '#7c3427', '#93432f'][Math.floor(rand() * 3)]);
    }
  }
  const graffiti = ['#ff4fa3', '#3ad6ff', '#ffe14d', '#6dff6d'];
  for (let k = 0; k < 6; k++) {
    const gx = 20 + k * 78 + Math.floor(rand() * 20);
    const c = graffiti[k % graffiti.length];
    for (let i = 0; i < 26; i++) r(gx + Math.floor(rand() * 34), 4 + Math.floor(rand() * 14), 3, 2, c);
  }
  // asfalto
  r(COURT.left - 14, COURT.top - 10, COURT.right - COURT.left + 28, BOTTOM - COURT.top + 22, '#4a4c52');
  for (let k = 0; k < 2600; k++) {
    const x = COURT.left - 14 + Math.floor(rand() * (COURT.right - COURT.left + 28));
    const y = COURT.top - 10 + Math.floor(rand() * (BOTTOM - COURT.top + 22));
    r(x, y, 1, 1, ['#55575e', '#404247', '#5d6067', '#393b40'][Math.floor(rand() * 4)]);
  }
  // rachaduras
  for (let c = 0; c < 7; c++) {
    let x = COURT.left + rand() * (COURT.right - COURT.left);
    let y = COURT.top + rand() * (BOTTOM - COURT.top);
    for (let s = 0; s < 40; s++) {
      r(Math.round(x), Math.round(y), 1, 1, '#2b2c30');
      x += rand() * 2 - 1;
      y += rand() * 1.6 - 0.3;
    }
  }
  // poças / manchas
  for (let k = 0; k < 5; k++) fillEllipse(r, Math.round(COURT.left + 30 + rand() * 340), Math.round(COURT.top + 40 + rand() * 200), Math.round(10 + rand() * 12), Math.round(4 + rand() * 4), '#3f4146');

  // linhas pintadas (gastas: alguns pixels falham)
  const P = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (rand() > 0.12) r(xx, yy, 1, 1, LINE);
  };
  const E = (cx, cy, rx, ry, filter) => {
    for (const [x, y] of ellipsePoints(cx, cy, rx, ry, filter)) if (rand() > 0.12) r(x, y, 1, 1, LINE);
  };
  r(PAINT.left, PAINT.top, PAINT.right - PAINT.left, PAINT.bottom - PAINT.top, '#8a3a33');
  for (let k = 0; k < 400; k++) r(PAINT.left + Math.floor(rand() * (PAINT.right - PAINT.left)), PAINT.top + Math.floor(rand() * (PAINT.bottom - PAINT.top)), 1, 1, '#7a332d');
  P(PAINT.left, PAINT.top, 1, PAINT.bottom - PAINT.top);
  P(PAINT.right - 1, PAINT.top, 1, PAINT.bottom - PAINT.top);
  P(PAINT.left, PAINT.bottom, PAINT.right - PAINT.left, 1);
  E(BASKET.x, PAINT.bottom, FT_CIRCLE.rx, FT_CIRCLE.ry, () => true);
  P(BASKET.x - THREE.rx, COURT.top, 1, BASKET.y - COURT.top);
  P(BASKET.x + THREE.rx, COURT.top, 1, BASKET.y - COURT.top);
  E(BASKET.x, BASKET.y, THREE.rx, THREE.ry, (s) => s >= 0);
  P(COURT.left, COURT.top, COURT.right - COURT.left, 1);
  P(COURT.left, COURT.top, 1, BOTTOM - COURT.top);
  P(COURT.right - 1, COURT.top, 1, BOTTOM - COURT.top);
  P(COURT.left, BOTTOM, COURT.right - COURT.left, 1);
  // logo da quadra no topo
  fillEllipse(r, BASKET.x, BOTTOM - 22, 16, 9, '#ffb000');
  fillEllipse(r, BASKET.x, BOTTOM - 22, 12, 6, '#4a4c52');

  // alambrado (losangos) nas laterais e embaixo
  const fence = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) r(x, y, 1, 1, 'rgba(190,196,206,0.55)');
      }
    }
  };
  fence(COURT.left - 30, COURT.top - 14, COURT.left - 18, BOTTOM + 22);
  fence(COURT.right + 18, COURT.top - 14, COURT.right + 30, BOTTOM + 22);
  fence(COURT.left - 30, BOTTOM + 14, COURT.right + 30, BOTTOM + 22);
  for (const x of [COURT.left - 30, COURT.left - 19, COURT.right + 18, COURT.right + 29]) r(x, COURT.top - 16, 2, BOTTOM - COURT.top + 40, '#9aa0aa');
  for (let x = COURT.left - 30; x < COURT.right + 30; x += 60) r(x, BOTTOM + 12, 2, 12, '#9aa0aa');

  tex.refresh();
}

// ------------------------------------------------------------- cestas
// Cima:  board_top (poste+tabela) atrás · rim_back · net (aro da frente + rede) na frente.
// Baixo: rim_back · net · board_bottom (tabela de VIDRO + poste) na frente de tudo, translúcida.
function generateHoops(scene) {
  const rimX = 30;
  const rimY = 44;
  const RIM = '#e8551c';

  {
    const { tex, ctx } = canvasTexture(scene, 'board_top', 60, 64);
    const r = rectFn(ctx);
    r(rimX - 3, 0, 6, 14, '#4b4f5c');
    r(rimX - 3, 0, 1, 14, '#6b7080');
    const bx = rimX - 24;
    const by = rimY - 30;
    r(bx, by, 48, 27, '#20232b');
    r(bx + 1, by + 1, 46, 25, '#e2e8f1');
    r(bx + 1, by + 1, 46, 1, '#ffffff');
    r(bx + 2, by + 2, 44, 1, '#c8303a');
    r(bx + 2, by + 24, 44, 1, '#c8303a');
    r(bx + 2, by + 2, 1, 23, '#c8303a');
    r(bx + 45, by + 2, 1, 23, '#c8303a');
    r(rimX - 8, by + 13, 16, 1, '#c8303a');
    r(rimX - 8, by + 13, 1, 11, '#c8303a');
    r(rimX + 7, by + 13, 1, 11, '#c8303a');
    r(rimX - 2, by + 26, 4, 3, '#555a66');
    tex.refresh();
  }
  {
    const { tex, ctx } = canvasTexture(scene, 'rim_back', 60, 64);
    const r = rectFn(ctx);
    for (const [x, y] of ellipsePoints(rimX, rimY, 7, 3, (s) => s < 0)) r(x, y, 1, 1, '#a63a12');
    tex.refresh();
  }
  {
    // tabela de vidro vista "por trás": translúcida, com o poste vindo até o chão
    const { tex, ctx } = canvasTexture(scene, 'board_bottom', 60, 130);
    const r = rectFn(ctx);
    const bx = rimX - 24;
    const by = rimY - 22;
    r(bx, by, 48, 27, 'rgba(200,220,240,0.28)');
    r(bx, by, 48, 1, '#20232b');
    r(bx, by + 26, 48, 1, '#20232b');
    r(bx, by, 1, 27, '#20232b');
    r(bx + 47, by, 1, 27, '#20232b');
    r(bx + 1, by + 1, 46, 1, 'rgba(255,255,255,0.6)');
    r(rimX - 2, by - 3, 4, 3, '#555a66');
    r(rimX - 3, by + 27, 6, 70, 'rgba(75,79,92,0.55)');   // poste até o chão (atrás da linha de fundo)
    r(rimX - 8, by + 94, 16, 5, 'rgba(60,64,76,0.7)');
    tex.refresh();
  }
  const drawNet = (key, stretch) => {
    const { tex, ctx } = canvasTexture(scene, key, 60, 72);
    const r = rectFn(ctx);
    const rows = 11 + stretch;
    for (let row = 1; row <= rows; row++) {
      const hw = Math.round(7 - (row / rows) * (stretch ? 4 : 3));
      for (let x = -hw; x <= hw; x++) {
        if ((x + row) % 3 === 0 || (x - row + 30) % 3 === 0 || Math.abs(x) === hw) {
          r(rimX + x, rimY + row, 1, 1, row % 2 ? '#f4f4f4' : '#d6d6d6');
        }
      }
    }
    for (const [x, y] of ellipsePoints(rimX, rimY, 7, 3, (s) => s >= 0)) r(x, y, 1, 1, RIM);
    r(rimX - 7, rimY, 1, 1, RIM);
    r(rimX + 7, rimY, 1, 1, RIM);
    tex.refresh();
  };
  drawNet('net', 0);
  drawNet('net_swish', 4);
}

// Cria os objetos das duas cestas numa cena. Retorna as redes (para animar o "swish").
// single = Rua 3x3: só a cesta de cima, com rede de corrente.
export function addHoops(scene, { single = false } = {}) {
  const t = HOOPS.top;
  const b = HOOPS.bottom;
  scene.add.image(t.x, t.y, 'board_top').setOrigin(0).setDepth(BASKET.y - 4).setTint(single ? 0xc8ccd4 : 0xffffff);
  scene.add.image(t.x, t.y, 'rim_back').setOrigin(0).setDepth(BASKET.y - 3);
  const netTop = scene.add.image(t.x, t.y, 'net').setOrigin(0).setDepth(BASKET.y - 1);
  if (single) {
    netTop.setTint(0x9aa0aa); // corrente
    return { top: netTop, bottom: netTop };
  }
  scene.add.image(b.x, b.y, 'rim_back').setOrigin(0).setDepth(BASKET_BOTTOM.y - 3);
  const netBottom = scene.add.image(b.x, b.y, 'net').setOrigin(0).setDepth(BASKET_BOTTOM.y - 1);
  scene.add.image(b.x, b.y, 'board_bottom').setOrigin(0).setDepth(BASKET_BOTTOM.y + 14);
  return { top: netTop, bottom: netBottom };
}

export function generateAll(scene) {
  generateCourt(scene);
  generateStreetCourt(scene);
  generateHoops(scene);
  generatePlayers(scene);
  generateSmall(scene);
}
