import GUI from 'lil-gui';
import * as THREE from 'three';
import { CutoutRig, type Angles, type RigDef } from '../render/rig/CutoutRig';
import { DEFAULT_POSES, loadPoseOverrides, PhachAnimator, POSES, RIG, type PoseName } from '../render/rig/PhachAnimator';

// Dev-only page (/rig.html): Phách's cut-out rig, big, with every move on a key, plus a joint editor.
// Not part of the game build (vite only bundles index.html). Saving goes through the dev-server
// endpoint in vite.config.ts and writes public/art/phach/phach.rig.json + phach.joints.json + phach.poses.json.

const RIG_PATH = 'art/phach/phach.rig.json';

const app = document.getElementById('app')!;
const hint = document.getElementById('hint')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1d17);
const camera = new THREE.OrthographicCamera(-2, 2, 2.1, -0.3, -10, 10);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.01), new THREE.MeshBasicMaterial({ color: 0x14100e }));
scene.add(ground);

type EditPose = 'thẳng' | 'thủ thế' | 'giơ kiếm' | 'chém' | 'đâm' | 'nhảy' | 'trúng đòn';
/** Editor pose -> animation key pose. 'thẳng' (all 0) is only a scratch pose and is not saved. */
const POSE_KEY: Record<Exclude<EditPose, 'thẳng'>, PoseName> = {
  'thủ thế': 'STAND', 'giơ kiếm': 'WINDUP', 'chém': 'SLASH', 'đâm': 'THRUST', 'nhảy': 'TUCK', 'trúng đòn': 'HURT',
};
const straight: Angles = {};
function editAngles(p: EditPose): Angles {
  return p === 'thẳng' ? straight : POSES[POSE_KEY[p]];
}

const view = { walking: false, bpm: 100, speed: 1, zoom: 1 };
const edit = {
  on: false,
  pose: 'thẳng' as EditPose,
  mode: 'dời khớp' as 'dời khớp' | 'dời cả mảnh' | 'trượt mảnh',
  selected: '',
};
const state = { jumpT: 0, hurtT: 0, lungeT: 0, x: 0, beat: 0 };
const JUMP_SEC = 0.4;

function resize(): void {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h);
  const halfH = 1.3 / view.zoom;
  const halfW = (halfH * w) / h;
  const cy = view.zoom > 1 ? 1.0 : 0.8;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = cy + halfH;
  camera.bottom = cy - halfH;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const [rig] = await Promise.all([CutoutRig.load('./' + RIG_PATH), loadPoseOverrides('./' + RIG_PATH)]);
scene.add(rig.root);
const anim = new PhachAnimator(rig);
const boneNames = rig.def.bones.map((b) => b.name).filter((n) => n !== 'hips');
const LABEL: Record<string, string> = {
  torso: 'eo (thân nối hông)', head: 'cổ', scarf: 'đuôi khăn',
  upperArmN: 'vai gần', forearmN: 'khuỷu gần', handN: 'cổ tay gần', weapon: 'chỗ cầm kiếm',
  upperArmF: 'vai xa', forearmF: 'khuỷu xa', handF: 'cổ tay xa',
  thighN: 'hông gần', shinN: 'gối gần', thighF: 'hông xa', shinF: 'gối xa',
};

// ---- joint dots (scene space, fixed screen size)
const dotGeo = new THREE.CircleGeometry(1, 20);
const ringGeo = new THREE.RingGeometry(1.4, 1.9, 24);
interface Dot { name: string; dot: THREE.Mesh; ring: THREE.Mesh }
const dots: Dot[] = boneNames.map((name) => {
  const mk = (geo: THREE.BufferGeometry, color: number) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
    m.renderOrder = 1000;
    m.visible = false;
    scene.add(m);
    return m;
  };
  return { name, dot: mk(dotGeo, 0xff3df2), ring: mk(ringGeo, 0x14100e) };
});
const DOT_PX = 5;

function worldPerPixel(): number {
  return (camera.top - camera.bottom) / app.clientHeight;
}

function jointWorld(name: string, out: THREE.Vector3): THREE.Vector3 {
  return rig.bone(name)!.getWorldPosition(out);
}

const tmp = new THREE.Vector3();
function updateDots(): void {
  const r = DOT_PX * worldPerPixel();
  for (const d of dots) {
    const show = edit.on;
    d.dot.visible = d.ring.visible = show;
    if (!show) continue;
    jointWorld(d.name, tmp);
    const sel = d.name === edit.selected;
    d.dot.position.set(tmp.x, tmp.y, 1);
    d.ring.position.copy(d.dot.position);
    d.dot.scale.setScalar(sel ? r * 1.4 : r);
    d.ring.scale.setScalar(sel ? r * 1.4 : r);
    (d.dot.material as THREE.MeshBasicMaterial).color.setHex(sel ? 0xd4a437 : 0xff3df2);
  }
}

// ---- undo / save
const history: string[] = [];
let dirty = false;
function snapshot(): void {
  history.push(JSON.stringify({ bones: rig.def.bones, poses: POSES, straight }));
  if (history.length > 200) history.shift();
}
function undo(): void {
  const prev = history.pop();
  if (!prev) return;
  const snap = JSON.parse(prev) as { bones: RigDef['bones']; poses: typeof POSES; straight: Angles };
  for (const b of snap.bones) rig.setJoint(b.name, b.pivot, b.attach);
  for (const k of Object.keys(POSES) as PoseName[]) {
    for (const bone of Object.keys(POSES[k])) delete POSES[k][bone];
    Object.assign(POSES[k], snap.poses[k]);
  }
  for (const k of Object.keys(straight)) delete straight[k];
  Object.assign(straight, snap.straight);
  dirty = true;
}

/** Rotate joint `name` by `delta` radians in the pose being edited. */
function rotateJoint(name: string, delta: number): void {
  const a = editAngles(edit.pose);
  a[name] = Math.round(((a[name] ?? 0) + delta) * 1000) / 1000;
  dirty = true;
}

/** Put the pose being edited back to the built-in angles. */
function resetPose(): void {
  snapshot();
  if (edit.pose === 'thẳng') {
    for (const k of Object.keys(straight)) delete straight[k];
    return;
  }
  const key = POSE_KEY[edit.pose];
  for (const k of Object.keys(POSES[key])) delete POSES[key][k];
  Object.assign(POSES[key], DEFAULT_POSES[key]);
  dirty = true;
}

/** Joints in piece-local px (relative to each piece's atlas rect) so a rebuilt atlas keeps them. */
function jointsFile(def: RigDef): unknown {
  const rect = new Map(def.bones.map((b) => [b.name, b.rect]));
  const bones: Record<string, unknown> = {};
  for (const b of def.bones) {
    const r = rect.get(b.name)!;
    const pr = b.parent ? rect.get(b.parent)! : null;
    bones[b.name] = {
      pivot: [round2(b.pivot[0] - r[0]), round2(b.pivot[1] - r[1])],
      attach: b.attach && pr ? [round2(b.attach[0] - pr[0]), round2(b.attach[1] - pr[1])] : null,
    };
  }
  return { note: 'Hand-placed joints from /rig.html, px relative to each piece rect. Kept by build_rig.py.', bones };
}
const round2 = (v: number) => Math.round(v * 100) / 100;

async function save(): Promise<void> {
  const def = rig.toJSON();
  const res = await fetch('/__rig/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: RIG_PATH, rig: def, joints: jointsFile(def), poses: POSES }),
  });
  if (res.ok) {
    dirty = false;
    flash('Đã lưu public/' + RIG_PATH);
  } else flash('Lưu lỗi: ' + (await res.text()));
}

let flashUntil = 0;
let flashText = '';
function flash(t: string): void {
  flashText = t;
  flashUntil = performance.now() + 2500;
}

// ---- dragging
const ndc = new THREE.Vector2();
function pointerWorld(e: PointerEvent, out: THREE.Vector3): THREE.Vector3 {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  out.set(ndc.x, ndc.y, 0).unproject(camera);
  out.z = 0;
  return out;
}

let dragging = false;
let rotating = false;
const lastPointer = new THREE.Vector3();
let dragMode: typeof edit.mode = 'dời khớp';

function pickJoint(p: THREE.Vector3): string {
  let best = '';
  let bestD = DOT_PX * 3 * worldPerPixel();
  for (const d of dots) {
    const dist = jointWorld(d.name, tmp).setZ(0).distanceTo(p);
    if (dist < bestD) {
      bestD = dist;
      best = d.name;
    }
  }
  return best;
}

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!edit.on) return;
  const p = pointerWorld(e, new THREE.Vector3());
  if (e.button === 2) {
    // Right drag: rotate the joint under the pointer, or the selected one.
    const hit = pickJoint(p);
    if (hit) edit.selected = hit;
    if (!edit.selected) return;
    snapshot();
    lastPointer.copy(p);
    rotating = true;
    renderer.domElement.setPointerCapture(e.pointerId);
    return;
  }
  edit.selected = pickJoint(p);
  if (!edit.selected) return;
  dragMode = e.shiftKey ? 'dời cả mảnh' : e.altKey || e.ctrlKey ? 'trượt mảnh' : edit.mode;
  snapshot();
  lastPointer.copy(p);
  dragging = true;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!edit.selected) return;
  const now = pointerWorld(e, new THREE.Vector3());
  if (rotating) {
    // Angle swept around the joint since the last move.
    const j = jointWorld(edit.selected, new THREE.Vector3());
    let d = Math.atan2(now.y - j.y, now.x - j.x) - Math.atan2(lastPointer.y - j.y, lastPointer.x - j.x);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    lastPointer.copy(now);
    rotateJoint(edit.selected, d);
  } else if (dragging) {
    // Move by how far the pointer moved, so grabbing slightly off the dot does not make it jump.
    const W = jointWorld(edit.selected, new THREE.Vector3()).setZ(0).add(now.clone().sub(lastPointer));
    lastPointer.copy(now);
    moveJoint(edit.selected, W, dragMode);
  }
});
renderer.domElement.addEventListener('pointerup', () => (dragging = rotating = false));
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    if (!edit.on || !edit.selected) return;
    e.preventDefault();
    snapshot();
    rotateJoint(edit.selected, THREE.MathUtils.degToRad((e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 5 : 1)));
  },
  { passive: false },
);

/**
 * Put joint `name` at world point W.
 *  dời khớp     – pivot and attach both move: the piece stays where it is, only its rotation centre moves.
 *  dời cả mảnh  – only attach moves: the piece (and everything below it) moves with the joint.
 *  trượt mảnh   – only pivot moves: the joint stays on the parent, the piece slides under it
 *                 (by W minus the joint, so callers pass joint + pointer delta).
 */
function moveJoint(name: string, W: THREE.Vector3, mode: typeof edit.mode): void {
  const bone = rig.bone(name)!;
  const def = rig.boneDef(name)!;
  const parent = bone.parent!;
  rig.root.updateMatrixWorld(true);
  const inBone = bone.worldToLocal(W.clone()); // offset from the current joint, in this bone's space
  const inParent = parent.worldToLocal(W.clone()).sub(bone.position); // same, in the parent's space
  let pivot: [number, number] = [def.pivot[0], def.pivot[1]];
  let attach = def.attach ? ([def.attach[0], def.attach[1]] as [number, number]) : null;
  if (mode !== 'dời cả mảnh') pivot = [pivot[0] + inBone.x, pivot[1] - inBone.y];
  if (mode !== 'trượt mảnh' && attach) attach = [attach[0] + inParent.x, attach[1] - inParent.y];
  if (mode === 'trượt mảnh') pivot = [def.pivot[0] - inBone.x, def.pivot[1] + inBone.y];
  rig.setJoint(name, pivot, attach);
  dirty = true;
}

// ---- GUI
const gui = new GUI({ title: 'Rig Phách' });
const fEdit = gui.addFolder('Sửa khớp');
fEdit.add(edit, 'on').name('bật sửa khớp (E)').listen();
fEdit.add(edit, 'pose', ['thẳng', 'thủ thế', 'giơ kiếm', 'chém', 'đâm', 'nhảy', 'trúng đòn']).name('tư thế khi sửa').listen();
fEdit.add(edit, 'mode', ['dời khớp', 'dời cả mảnh', 'trượt mảnh']).name('kéo chuột = ');
fEdit.add(edit, 'selected', ['', ...boneNames]).name('khớp đang chọn').listen();
fEdit.add({ resetPose }, 'resetPose').name('đặt lại tư thế này');
fEdit.add({ undo }, 'undo').name('hoàn tác (Ctrl+Z)');
fEdit.add({ save }, 'save').name('LƯU (Ctrl+S)');
const fPlay = gui.addFolder('Xem động tác');
fPlay.add(view, 'walking').name('đi (W)').listen();
fPlay.add(view, 'bpm', 60, 200, 1);
fPlay.add(view, 'speed', 0.1, 1, 0.05).name('tốc độ xem');
fPlay.add(view, 'zoom', 1, 3, 0.1).name('phóng to').onChange(resize);
const fTune = gui.addFolder('Thông số động tác');
fTune.add(RIG, 'strikeSec', 0.1, 0.8, 0.01).name('chém (s)');
fTune.add(RIG, 'strikeSnap', 0.1, 0.8, 0.05).name('phần vung xuống');
fTune.add(RIG, 'counterSec', 0.1, 0.8, 0.01).name('phản đòn (s)');
fTune.add(RIG, 'strideUnits', 0.5, 4, 0.1).name('sải chân');
fTune.add(RIG, 'walkSwing', 0, 1, 0.05).name('biên độ bước');
fTune.add(RIG, 'breathe', 0, 0.2, 0.01).name('thở theo nhịp');
fTune.add(RIG, 'scarfFlutter', 0, 1, 0.05).name('khăn bay');
fTune.close();

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    e.preventDefault();
    undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
    e.preventDefault();
    void save();
    return;
  }
  if (edit.on && edit.selected && e.code.startsWith('Arrow')) {
    // Fine nudge in the selected mode: 1 screen pixel (Shift: 5).
    e.preventDefault();
    const step = worldPerPixel() * (e.shiftKey ? 5 : 1);
    const W = jointWorld(edit.selected, new THREE.Vector3()).setZ(0);
    if (e.code === 'ArrowLeft') W.x -= step;
    if (e.code === 'ArrowRight') W.x += step;
    if (e.code === 'ArrowUp') W.y += step;
    if (e.code === 'ArrowDown') W.y -= step;
    snapshot();
    moveJoint(edit.selected, W, edit.mode);
    return;
  }
  const rotKey = e.code === 'BracketLeft' || e.key === '[' || e.key === '{' ? 1 : e.code === 'BracketRight' || e.key === ']' || e.key === '}' ? -1 : 0;
  if (edit.on && edit.selected && rotKey) {
    e.preventDefault();
    snapshot();
    const deg = rotKey * (e.shiftKey ? 5 : 1);
    rotateJoint(edit.selected, THREE.MathUtils.degToRad(deg));
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyE') edit.on = !edit.on;
  else if (e.code === 'KeyJ') anim.strike();
  else if (e.code === 'KeyK') anim.counter();
  else if (e.code === 'Space') state.jumpT = JUMP_SEC;
  else if (e.code === 'KeyH') state.hurtT = 1;
  else if (e.code === 'KeyL') state.lungeT = 1;
  else if (e.code === 'KeyW') view.walking = !view.walking;
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

(window as unknown as { __rig: unknown }).__rig = { rig, anim, state, view, edit, camera, moveJoint, rotateJoint, save };

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000) * view.speed;
  last = now;
  if (edit.on) {
    rig.pose(editAngles(edit.pose));
    rig.plantFeet();
    rig.root.position.y = 0;
  } else {
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
  }
  rig.root.updateMatrixWorld(true);
  updateDots();
  hint.textContent =
    performance.now() < flashUntil
      ? flashText
      : edit.on
        ? `SỬA KHỚP · tư thế "${edit.pose}"${edit.pose === 'thẳng' ? ' (chỉ để thử, góc không lưu)' : ''}${dirty ? ' (chưa lưu)' : ''}${
            edit.selected
              ? ` · đang chọn: ${LABEL[edit.selected] ?? edit.selected} ${Math.round(THREE.MathUtils.radToDeg(editAngles(edit.pose)[edit.selected] ?? 0))}°`
              : ''
          } · kéo = ${edit.mode} · Shift+kéo = dời cả mảnh · Alt+kéo = trượt mảnh · XOAY: chuột phải kéo / lăn chuột / [ ] · mũi tên nhích · Ctrl+Z · Ctrl+S lưu · E thoát`
        : 'J chém · K phản đòn · Space nhảy · H trúng đòn · L lao tới · W đi/đứng · E sửa khớp';
  renderer.render(scene, camera);
});
