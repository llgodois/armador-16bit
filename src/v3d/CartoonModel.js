// Jogador cartoon (protótipo de estilo): formas arredondadas, cotovelos e joelhos,
// rosto simples, sombra em faixas (toon) e contorno preto ("casca invertida").
// Os parâmetros de cada estilo ficam em STYLES; a página stylelab.html compara.
import * as THREE from 'three';

const SKINS = ['#f1c27d', '#8d5524', '#c68642', '#e0ac69', '#5c3a1e', '#a86b3c'];
const HAIRS = ['#3b2414', '#111111', '#1a1a1a', '#6b3e1f', '#0d0d0d', '#c9a26b'];

export const STYLES = {
  // A: caricatura de arcade — cabeça grande, ombros largos, mãos e tênis exagerados
  arcade: {
    name: 'A - Caricatura de arcade',
    head: 1.45, shoulder: 4.6, waist: 2.7, legLen: 12, torsoH: 8.5, armLen: 10.5,
    limb: 1.05, hand: 1.25, foot: 1.35, outline: 0.32, bands: [0.45, 0.75, 1],
  },
  // B: bonequinho — cabeçona, corpo curto e redondo
  toy: {
    name: 'B - Bonequinho',
    head: 2.0, shoulder: 3.6, waist: 3.3, legLen: 8.5, torsoH: 7.5, armLen: 7.5,
    limb: 1.25, hand: 1.3, foot: 1.2, outline: 0.28, bands: [0.6, 1],
  },
  // C: desenho de TV — atlético e esticado, cintura fina, contorno grosso
  tv: {
    name: 'C - Desenho de TV',
    head: 1.1, shoulder: 5.2, waist: 2.2, legLen: 14, torsoH: 9.5, armLen: 12,
    limb: 0.9, hand: 1.1, foot: 1.2, outline: 0.5, bands: [0.35, 1],
  },
};

// ---------------------------------------------------------------- materiais
const gradients = new Map();
function gradient(bands) {
  const key = bands.join(',');
  if (!gradients.has(key)) {
    const data = new Uint8Array(bands.map((b) => Math.round(b * 255)));
    const t = new THREE.DataTexture(data, bands.length, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    gradients.set(key, t);
  }
  return gradients.get(key);
}
const toonMats = new Map();
function toon(color, bands) {
  const key = color + bands.join(',');
  if (!toonMats.has(key)) toonMats.set(key, new THREE.MeshToonMaterial({ color, gradientMap: gradient(bands) }));
  return toonMats.get(key);
}
// contorno: a malha "inchada" pela normal, desenhando só o lado de dentro (preto)
const outlineMats = new Map();
function outlineMat(t) {
  if (!outlineMats.has(t)) {
    const m = new THREE.MeshBasicMaterial({ color: 0x0b0b10, side: THREE.BackSide });
    m.customProgramCacheKey = () => 'outline' + t; // cada espessura é um shader
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${t.toFixed(3)};`);
    };
    outlineMats.set(t, m);
  }
  return outlineMats.get(t);
}

export default class CartoonModel {
  constructor(info, colors, index, style = STYLES.arcade) {
    const S = style;
    const skin = SKINS[(info.skin ?? index * 3 + 1) % SKINS.length];
    const hair = HAIRS[(info.hair ?? index + 2) % HAIRS.length];
    const jersey = colors.jersey;
    const trim = colors.trim || '#ffffff';
    const shorts = colors.shorts || jersey;
    const shoes = colors.shoes || '#222222';
    const B = S.bands;
    const outline = S.outline;

    const add = (parent, geo, color, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, toon(color, B));
      m.position.set(x, y, z);
      m.castShadow = true;
      if (outline > 0) m.add(new THREE.Mesh(geo, outlineMat(outline / Math.max(0.6, this.scaleHint || 1))));
      parent.add(m);
      return m;
    };
    const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8).translate(0, -len / 2 - r, 0);

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const L = S.legLen;
    const hipY = L + 1.2;

    // pernas: coxa + canela (joelho dobra) + tênis
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 1.55, hipY, 0);
      add(hip, capsule(S.limb * 1.25, L * 0.42), skin);
      const knee = new THREE.Group();
      knee.position.y = -L * 0.5;
      hip.add(knee);
      add(knee, capsule(S.limb * 1.05, L * 0.38), skin);
      add(knee, new THREE.CylinderGeometry(S.limb * 1.15, S.limb * 1.15, 1.6, 8), '#f4f4f4', 0, -L * 0.36, 0); // meião
      add(knee, new THREE.BoxGeometry(2.3 * S.foot, 1.5 * S.foot, 4 * S.foot), shoes, 0, -L * 0.5 - 0.2, 0.7 * S.foot);
      this.body.add(hip);
      return { hip, knee };
    });

    // calção (largo) e faixa
    add(this.body, new THREE.CylinderGeometry(S.waist + 0.9, S.waist + 1.5, 5, 10).scale(1, 1, 0.72), shorts, 0, hipY - 0.6, 0);
    add(this.body, new THREE.CylinderGeometry(S.waist + 0.95, S.waist + 0.95, 0.7, 10).scale(1, 1, 0.73), trim, 0, hipY + 1.9, 0);

    // tronco (camisa em "V": ombro largo, cintura fina)
    this.torso = new THREE.Group();
    this.torso.position.y = hipY + 1.6;
    this.body.add(this.torso);
    const th = S.torsoH;
    add(this.torso, new THREE.CylinderGeometry(S.shoulder, S.waist, th, 10).scale(1, 1, 0.62), jersey, 0, th / 2, 0);
    add(this.torso, new THREE.TorusGeometry(1.25, 0.32, 5, 10).rotateX(Math.PI / 2), trim, 0, th + 0.1, 0.15); // gola
    // número nas costas e na frente
    const num = numberTexture(String(info.num ?? [3, 1, 23, 7, 21][index % 5]), trim);
    for (const z of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: num, transparent: true }));
      p.position.set(0, th * 0.55, z * (((S.shoulder + S.waist) / 2) * 0.62 + 0.06));
      if (z < 0) p.rotation.y = Math.PI;
      this.torso.add(p);
    }

    // cabeça: pescoço, cabeça redonda, orelhas, olhos, sobrancelhas, cabelo
    this.head = new THREE.Group();
    this.head.position.y = th + 0.6;
    this.torso.add(this.head);
    const hr = 1.9 * S.head;
    add(this.head, new THREE.CylinderGeometry(0.9, 1.1, 1.4, 8), skin, 0, 0.3, 0);
    add(this.head, new THREE.SphereGeometry(hr, 14, 10).scale(0.92, 1, 0.95), skin, 0, hr + 0.6, 0);
    for (const s of [-1, 1]) add(this.head, new THREE.SphereGeometry(hr * 0.22, 6, 5), skin, s * hr * 0.9, hr + 0.5, 0);
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeB = new THREE.MeshBasicMaterial({ color: 0x15151c });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.2, 8, 6).scale(0.8, 1.1, 0.5), eyeW);
      e.position.set(s * hr * 0.33, hr * 1.05 + 0.6, hr * 0.82);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.11, 6, 5).scale(1, 1, 0.5), eyeB);
      pu.position.set(0, -hr * 0.02, hr * 0.07);
      e.add(pu);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(hr * 0.36, hr * 0.08, hr * 0.08), eyeB);
      brow.position.set(s * hr * 0.33, hr * 1.36 + 0.6, hr * 0.86);
      brow.rotation.z = s * -0.15;
      this.head.add(e, brow);
    }
    const hairStyle = index % 3;
    if (hairStyle === 0) add(this.head, new THREE.SphereGeometry(hr * 1.04, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, hr + 0.65, -0.05);
    else if (hairStyle === 1) add(this.head, new THREE.CylinderGeometry(hr * 0.86, hr * 0.92, hr * 0.7, 10), hair, 0, hr * 1.75 + 0.6, -0.1); // flat-top
    else {
      add(this.head, new THREE.SphereGeometry(hr * 1.02, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), hair, 0, hr + 0.7, -0.05);
      add(this.head, new THREE.TorusGeometry(hr * 0.98, 0.35, 5, 14).rotateX(Math.PI / 2), trim, 0, hr * 1.3 + 0.6, 0); // faixa na cabeça
    }

    // braços: ombro + cotovelo + mão
    this.arms = [-1, 1].map((s) => {
      const sh = new THREE.Group();
      sh.position.set(s * (S.shoulder - 0.4), th - 0.9, 0);
      add(sh, new THREE.SphereGeometry(S.limb * 1.35, 8, 6), skin); // ombro
      add(sh, capsule(S.limb, S.armLen * 0.4), skin);
      const elbow = new THREE.Group();
      elbow.position.y = -S.armLen * 0.5;
      sh.add(elbow);
      add(elbow, capsule(S.limb * 0.92, S.armLen * 0.36), skin);
      add(elbow, new THREE.SphereGeometry(S.hand, 8, 6), skin, 0, -S.armLen * 0.5, 0);
      this.torso.add(sh);
      return { sh, elbow };
    });

    this.totalH = this.torso.position.y + th + 0.6 + hr * 2 + 0.6;
  }

  // Pose parada de basquete (para a página de comparação): joelhos e cotovelos dobrados.
  idle(t, dribble = false) {
    const b = Math.sin(t * 2.2);
    this.body.position.y = -0.6 + b * 0.25;
    this.torso.rotation.x = 0.12;
    for (const [i, l] of this.legs.entries()) {
      l.hip.rotation.x = -0.25;
      l.knee.rotation.x = 0.45;
      l.hip.rotation.z = (i ? 1 : -1) * 0.08;
    }
    const [L, R] = this.arms;
    L.sh.rotation.set(-0.35, 0, -0.25);
    L.elbow.rotation.x = -0.9;
    R.sh.rotation.set(dribble ? -0.5 + Math.abs(Math.sin(t * 4)) * 0.4 : -0.3, 0, 0.3);
    R.elbow.rotation.x = dribble ? -0.4 : -0.8;
  }
}

function numberTexture(n, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.font = '800 46px "Barlow Condensed", Impact, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 6;
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.strokeText(n, 32, 34);
  c.fillStyle = color;
  c.fillText(n, 32, 34);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
