// Quadra, cestas e ginásio do Armador 64.
//
// Coordenadas 3D: X = x do jogo, Z = y do jogo * Y_SCALE (a quadra 2D é
// "achatada" no eixo y), Y = altura (z do jogo * VS). A câmera fica atrás
// da linha de fundo de baixo, olhando para cima da quadra, como no 16-bit.
import * as THREE from 'three';
import { COURT, MID_Y, BASKET, BASKET_BOTTOM, THREE as ARC, PAINT, FT_CIRCLE, RESTRICTED, Y_SCALE, WORLD } from '../config.js';

export const VS = 2; // escala vertical: aro e alturas maiores que no 2D (jogadores grandes, estilo TV)
const HS = 1.3; // tamanho do aro/tabela
export const toZ = (y) => y * Y_SCALE;

// ------------------------------------------------------------------ piso
function courtTexture(paint = '#3355a8') {
  const S = 4; // pixels de textura por unidade
  const W = WORLD.W;
  const D = toZ(WORLD.H);
  const cv = document.createElement('canvas');
  cv.width = W * S;
  cv.height = D * S;
  const g = cv.getContext('2d');
  const X = (x) => x * S;
  const Zp = (y) => toZ(y) * S;

  // fora da quadra
  g.fillStyle = '#4a2a1a';
  g.fillRect(0, 0, cv.width, cv.height);
  // madeira (tábuas no comprimento)
  const L = X(COURT.left) - 8 * S;
  const R = X(COURT.right) + 8 * S;
  const T = Zp(COURT.top) - 8 * S;
  const B = Zp(COURT.bottom) + 8 * S;
  g.fillStyle = '#c98b4a';
  g.fillRect(L, T, R - L, B - T);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = L; x < R; x += 6 * S) {
    g.fillStyle = rnd() < 0.5 ? '#c4853f' : '#cf9555';
    g.fillRect(x, T, 6 * S - 1, B - T);
    g.fillStyle = 'rgba(90,50,20,0.25)';
    for (let y = T + rnd() * 80 * S; y < B; y += (60 + rnd() * 60) * S) g.fillRect(x, y, 6 * S - 1, 2);
  }

  const line = (w = 2) => {
    g.strokeStyle = '#f4f1e8';
    g.lineWidth = w * S * 0.6;
  };
  const ell = (cx, cy, rx, ry, a0, a1) => {
    g.beginPath();
    g.ellipse(X(cx), Zp(cy), rx * S, toZ(ry) * S, 0, a0, a1);
    g.stroke();
  };

  // metade de cima e a espelhada (de baixo)
  const half = (flip) => {
    g.save();
    if (flip) {
      g.translate(0, Zp(MID_Y) * 2);
      g.scale(1, -1);
    }
    // garrafão
    g.fillStyle = paint;
    g.fillRect(X(PAINT.left), Zp(PAINT.top), X(PAINT.right - PAINT.left), Zp(PAINT.bottom) - Zp(PAINT.top));
    line();
    g.strokeRect(X(PAINT.left), Zp(PAINT.top), X(PAINT.right - PAINT.left), Zp(PAINT.bottom) - Zp(PAINT.top));
    // lance livre (metade de fora cheia, de dentro tracejada)
    ell(BASKET.x, PAINT.bottom, FT_CIRCLE.rx, FT_CIRCLE.ry, 0, Math.PI);
    g.setLineDash([3 * S, 3 * S]);
    ell(BASKET.x, PAINT.bottom, FT_CIRCLE.rx, FT_CIRCLE.ry, Math.PI, Math.PI * 2);
    g.setLineDash([]);
    // área restrita
    ell(BASKET.x, BASKET.y, RESTRICTED.rx, RESTRICTED.ry, 0, Math.PI);
    // linha de 3: retas no canto + arco
    g.beginPath();
    g.moveTo(X(BASKET.x - ARC.rx), Zp(COURT.top));
    g.lineTo(X(BASKET.x - ARC.rx), Zp(BASKET.y));
    g.ellipse(X(BASKET.x), Zp(BASKET.y), ARC.rx * S, toZ(ARC.ry) * S, 0, Math.PI, 0, true);
    g.lineTo(X(BASKET.x + ARC.rx), Zp(COURT.top));
    g.stroke();
    g.restore();
  };
  half(false);
  half(true);

  // linhas externas, meio da quadra e círculo central
  line();
  g.strokeRect(X(COURT.left), Zp(COURT.top), X(COURT.right - COURT.left), Zp(COURT.bottom) - Zp(COURT.top));
  g.beginPath();
  g.moveTo(X(COURT.left), Zp(MID_Y));
  g.lineTo(X(COURT.right), Zp(MID_Y));
  g.stroke();
  g.fillStyle = paint;
  g.beginPath();
  g.ellipse(X(BASKET.x), Zp(MID_Y), 34 * S, 34 * S, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ cesta
function hoop(basket, dir) {
  // dir = +1: cesta de cima (tabela ao norte, menor Z); -1: cesta de baixo
  const g = new THREE.Group();
  const rimY = basket.rimZ * VS;
  const rimZ = toZ(basket.y);
  const back = -dir; // sentido "para trás da cesta" em Z

  const rimMat = new THREE.MeshLambertMaterial({ color: 0xff5a1f, emissive: 0x401000 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.2 * HS, 0.45 * HS, 6, 18), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(basket.x, rimY, rimZ);
  g.add(rim);

  // rede: cone aberto em "arame"
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.85 });
  const net = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * HS, 2.4 * HS, 7 * HS, 12, 3, true), netMat);
  net.position.set(basket.x, rimY - 3.5 * HS, rimZ);
  g.add(net);

  // tabela
  const boardZ = rimZ + back * 7 * HS;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(22 * HS, 13 * HS, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0.55 }),
  );
  board.position.set(basket.x, rimY + 5 * HS, boardZ);
  g.add(board);
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
  const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(8 * HS, 6 * HS)), new THREE.LineBasicMaterial({ color: 0xffffff }));
  sq.position.set(basket.x, rimY + 3 * HS, boardZ - back * 0.5);
  g.add(sq);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(22 * HS, 13 * HS, 0.8)), new THREE.LineBasicMaterial({ color: 0x222222 }));
  edge.position.copy(board.position);
  g.add(edge);
  // braço da tabela até o poste
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), frameMat);
  arm.position.set(basket.x, rimY + 2, rimZ + back * 3.5 * HS);
  arm.scale.z = 5 * HS;
  g.add(arm);

  // poste fora da quadra com base acolchoada
  const baseZ = toZ(dir > 0 ? COURT.top : COURT.bottom) + back * 16;
  const padMat = new THREE.MeshLambertMaterial({ color: 0x1b2a55 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 12), padMat);
  base.position.set(basket.x, 4, baseZ + back * 4);
  g.add(base);
  const poleH = rimY + 9 * HS;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(3, poleH, 3), padMat);
  pole.position.set(basket.x, poleH / 2, baseZ);
  g.add(pole);
  const beamLen = Math.abs(boardZ - baseZ);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, beamLen), padMat);
  beam.position.set(basket.x, rimY + 8 * HS, (boardZ + baseZ) / 2);
  g.add(beam);

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.userData = { net, rim, rimMat, netMat, netY: net.position.y, swish: 0 };
  return g;
}

// ------------------------------------------------------------------ ginásio
function arena() {
  const g = new THREE.Group();
  const cx = WORLD.W / 2;
  const cz = toZ(MID_Y);
  // chão escuro grande
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2400), new THREE.MeshLambertMaterial({ color: 0x1a1220 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.2, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // arquibancada: degraus em volta + torcida (caixinhas coloridas instanciadas)
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x2a2440 });
  const fanGeo = new THREE.BoxGeometry(5, 7, 4);
  const fanMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const fans = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const palette = [0xd84a3a, 0x3a6fd8, 0xf2c94c, 0xeeeeee, 0x2fa36b, 0x8e5bd8, 0x222222, 0xff8a3d];

  const halfW = (COURT.right - COURT.left) / 2 + 60;
  const halfD = (toZ(COURT.bottom) - toZ(COURT.top)) / 2 + 60;
  const sides = [
    { name: 'left', len: halfD * 2, pos: (d) => [cx - halfW - d, cz], rotY: Math.PI / 2 },
    { name: 'right', len: halfD * 2, pos: (d) => [cx + halfW + d, cz], rotY: -Math.PI / 2 },
    { name: 'top', len: halfW * 2, pos: (d) => [cx, cz - halfD - d], rotY: 0 },
  ];
  const steps = [];
  // (sem arquibancada atrás da cesta de baixo: é onde fica a câmera)
  for (const s of sides) {
    for (let row = 0; row < 7; row++) {
      const d = row * 9;
      const h = 4 + row * 6;
      const [px, pz] = s.pos(d);
      const step = new THREE.Mesh(new THREE.BoxGeometry(s.len + row * 18, h, 9), stepMat);
      step.position.set(px, h / 2, pz);
      step.rotation.y = s.rotY;
      step.receiveShadow = true;
      step.userData.side = s.name;
      steps.push(step);
      g.add(step);
      const n = Math.floor((s.len + row * 18) / 6.5);
      for (let k = 0; k < n; k++) {
        if (rnd() < 0.12) continue;
        const along = -((s.len + row * 18) / 2) + (k + 0.5) * 6.5;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.rotY, 0));
        const local = new THREE.Vector3(along, h + 3.5, 0).applyQuaternion(q);
        m.compose(new THREE.Vector3(px + local.x, local.y, pz + local.z), q, new THREE.Vector3(1, 0.8 + rnd() * 0.4, 1));
        fans.push({ m, side: s.name, c: palette[Math.floor(rnd() * palette.length)], phase: rnd() * Math.PI * 2 });
      }
    }
  }
  const crowd = new THREE.InstancedMesh(fanGeo, fanMat, fans.length);
  const col = new THREE.Color();
  fans.forEach((f, i) => {
    crowd.setMatrixAt(i, f.m);
    crowd.setColorAt(i, col.setHex(f.c));
  });
  g.add(crowd);
  // esconde a arquibancada de um lado (a câmera lateral fica atrás dela)
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const hideSide = (name) => {
    for (const st of steps) st.visible = st.userData.side !== name;
    fans.forEach((f, i) => {
      f.hidden = f.side === name;
      crowd.setMatrixAt(i, f.hidden ? zero : f.m);
    });
    crowd.instanceMatrix.needsUpdate = true;
  };
  g.userData = { crowd, fans, hideSide };
  return g;
}

export function buildCourt(scene3, { street = false, paint } = {}) {
  const tex = courtTexture(paint);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.W, toZ(WORLD.H)), new THREE.MeshLambertMaterial({ map: tex }));
  court.rotation.x = -Math.PI / 2;
  court.position.set(WORLD.W / 2, 0, toZ(WORLD.H) / 2);
  court.receiveShadow = true;
  scene3.add(court);
  const top = hoop(BASKET, 1);
  scene3.add(top);
  const hoops = { top, bottom: top };
  if (!street) {
    hoops.bottom = hoop(BASKET_BOTTOM, -1);
    scene3.add(hoops.bottom);
  }
  const ar = arena();
  scene3.add(ar);
  return { court, hoops, arena: ar, dispose: () => tex.dispose() };
}
