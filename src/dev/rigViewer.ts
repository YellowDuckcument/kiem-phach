import GUI from 'lil-gui';
import * as THREE from 'three';
import { CutoutRig } from '../render/rig/CutoutRig';
import { PhachAnimator, RIG } from '../render/rig/PhachAnimator';

// Dev-only page (/rig.html): Phách's cut-out rig, big, with every pose on a key.
// Not part of the game build (vite only bundles index.html).

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1d17);
const camera = new THREE.OrthographicCamera(-2, 2, 2.1, -0.3, -10, 10);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.02), new THREE.MeshBasicMaterial({ color: 0x14100e }));
scene.add(ground);

const view = { walking: false, bpm: 100, showJoints: false, speed: 1 };
const state = { jumpT: 0, hurtT: 0, lungeT: 0, x: 0, beat: 0 };
const JUMP_SEC = 0.4;

function resize(): void {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  const halfH = 1.3;
  const halfW = (halfH * w) / h;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = 0.8 + halfH;
  camera.bottom = 0.8 - halfH;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const rig = await CutoutRig.load('./art/phach/phach.rig.json');
scene.add(rig.root);
const anim = new PhachAnimator(rig);

const dots: THREE.Mesh[] = [];
for (const b of rig.def.bones) {
  const bone = rig.bone(b.name)!;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(4, 12), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
  dot.renderOrder = 999;
  dot.position.z = 0.01;
  dot.visible = false;
  bone.add(dot);
  dots.push(dot);
}

const gui = new GUI({ title: 'Rig Phách' });
gui.add(view, 'walking').name('đi (W)').listen();
gui.add(view, 'bpm', 60, 200, 1);
gui.add(view, 'speed', 0.1, 1, 0.05).name('tốc độ xem');
gui.add(view, 'showJoints').name('hiện khớp').onChange((v: boolean) => dots.forEach((d) => (d.visible = v)));
gui.add(RIG, 'scale', 0.4, 1.5, 0.05).name('kích thước').onChange((v: number) => rig.root.scale.setScalar(v));
gui.add(RIG, 'strikeSec', 0.1, 0.8, 0.01).name('chém (s)');
gui.add(RIG, 'strikeSnap', 0.1, 0.8, 0.05).name('phần vung xuống');
gui.add(RIG, 'counterSec', 0.1, 0.8, 0.01).name('phản đòn (s)');
gui.add(RIG, 'strideUnits', 0.5, 4, 0.1).name('sải chân');
gui.add(RIG, 'walkSwing', 0, 1, 0.05).name('biên độ bước');
gui.add(RIG, 'breathe', 0, 0.2, 0.01).name('thở theo nhịp');
gui.add(RIG, 'scarfFlutter', 0, 1, 0.05).name('khăn bay');

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyJ') anim.strike();
  else if (e.code === 'KeyK') anim.counter();
  else if (e.code === 'Space') state.jumpT = JUMP_SEC;
  else if (e.code === 'KeyH') state.hurtT = 1;
  else if (e.code === 'KeyL') state.lungeT = 1;
  else if (e.code === 'KeyW') view.walking = !view.walking;
});

(window as unknown as { __rig: unknown }).__rig = { rig, anim, state, view };

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000) * view.speed;
  last = now;
  state.beat += (dt * view.bpm) / 60;
  if (view.walking) state.x += dt * 4 * (view.bpm / 60);
  state.jumpT = Math.max(0, state.jumpT - dt);
  state.hurtT = Math.max(0, state.hurtT - dt * 3);
  state.lungeT = Math.max(0, state.lungeT - dt * 3);
  const jp = state.jumpT > 0 ? 1 - state.jumpT / JUMP_SEC : 0;
  anim.update(
    { beat: state.beat, x: state.x, walking: view.walking, jump: jp, hurt: state.hurtT, lunge: state.lungeT },
    dt,
  );
  rig.root.position.y = Math.sin(jp * Math.PI) * 0.6;
  renderer.render(scene, camera);
});
