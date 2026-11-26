// Retratos 3D para as telas de menu do Armador 64: "fotografa" o jogador cartoon
// (cores do time, altura, número, visual) num renderizador separado e entrega como
// textura do Phaser. Cada retrato é feito uma vez e fica guardado.
import * as THREE from 'three';
import Phaser from 'phaser';
import CartoonModel, { STYLES } from './CartoonModel.js';
import { THEME } from '../ui/theme.js';

const W = 252;
const H = 420;
let renderer = null;
let scene = null;
let camera = null;

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2a22, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sun.position.set(-40, 80, 90);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(26, W / H, 1, 1000);
}

export function installPortraits() {
  THEME.portrait = (phaserScene, who) => {
    const { info, colors, index = 0 } = who;
    const key = `pt3d_${colors.jersey}_${colors.trim}_${info.name || ''}_${info.cm}_${info.skin ?? ''}_${info.hair ?? ''}_${index}`;
    const tm = phaserScene.textures;
    if (!tm.exists(key)) {
      try {
        if (!renderer) setup();
        const m = new CartoonModel(info, colors, index, STYLES.arcade);
        m.idle(0.6, false);
        m.root.rotation.y = 0.45; // 3/4, olhando para a "câmera"
        scene.add(m.root);
        const h = m.totalH;
        camera.position.set(0, h * 0.62, h * 2.35);
        camera.lookAt(0, h * 0.47, 0);
        renderer.render(scene, camera);
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
        scene.remove(m.root);
        m.root.traverse((o) => o.isMesh && o.geometry.dispose());
        tm.addCanvas(key, cv);
        tm.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR); // retrato liso (o jogo usa filtro pixelado)
      } catch {
        return null; // sem WebGL extra: fica o sprite pixelado
      }
    }
    return { key, aspect: W / H };
  };
}
