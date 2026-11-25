// Página de comparação dos estilos de jogador (stylelab.html). Só para escolher o visual.
import * as THREE from 'three';
import CartoonModel, { STYLES } from './CartoonModel.js';
import { SIZE } from './PlayerModel.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131c);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2a22, 1.5));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
sun.position.set(-60, 120, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 100, bottom: -100 });
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshLambertMaterial({ color: 0xc98b4a }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);
camera.position.set(0, 40, 210);
camera.lookAt(0, 22, 0);

const home = { jersey: '#1d5fd1', trim: '#ffc72c', shorts: '#1d5fd1', shoes: '#ffc72c' };
const away = { jersey: '#6a2fa0', trim: '#fdb927', shorts: '#6a2fa0', shoes: '#fdb927' };
const heightOf = (cm) => SIZE * Math.max(0.85, Math.min(1.15, 1 + (cm - 198) * 0.006));

const models = [];
const keys = Object.keys(STYLES);
keys.forEach((k, col) => {
  const x = (col - 1) * 95;
  const cast = [
    [{ cm: 188, num: 30 }, home, 0, -14],
    [{ cm: 213, num: 15 }, away, 4, 14],
  ];
  for (const [info, colors, idx, dx] of cast) {
    const m = new CartoonModel(info, colors, idx, STYLES[k]);
    m.root.scale.setScalar(heightOf(info.cm) / m.totalH);
    m.root.position.set(x + dx, 0, 0);
    m.dribble = idx === 0;
    scene.add(m.root);
    models.push(m);
  }
  const d = document.createElement('div');
  d.textContent = STYLES[k].name;
  document.getElementById('labels').appendChild(d);
});

// bola quicando ao lado de cada armador
const ballGeo = new THREE.SphereGeometry(2.3, 16, 12);
const ballMat = new THREE.MeshToonMaterial({ color: 0xe8722a });
const balls = models.filter((m) => m.dribble).map((m) => {
  const b = new THREE.Mesh(ballGeo, ballMat);
  b.castShadow = true;
  scene.add(b);
  return { b, m };
});

let spin = true;
let yaw = 0.5;
window.addEventListener('keydown', (e) => e.code === 'Space' && (spin = !spin));
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // afasta a câmera até caberem as três colunas (~300 de largura)
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const d = 165 / Math.tan(half);
  camera.position.set(0, 26 + d * 0.08, d);
  camera.lookAt(0, 20, 0);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  if (spin) yaw += dt * 0.6;
  for (const m of models) {
    m.root.rotation.y = yaw;
    m.idle(t, m.dribble);
  }
  for (const { b, m } of balls) {
    const side = new THREE.Vector3(4.5, 0, 3).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    b.position.set(m.root.position.x + side.x, 2.3 + Math.abs(Math.cos(t * 4)) * 12, side.z);
  }
  renderer.render(scene, camera);
});
window.__lab = { models, scene, camera, renderer };
