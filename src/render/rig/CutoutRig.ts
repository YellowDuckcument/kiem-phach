import * as THREE from 'three';

// Cut-out (rối nước) rig: flat pieces from one atlas, each on a bone that only rotates around Z.
// Built from <name>.rig.json written by scripts/art/build_rig.py. All rig coordinates are atlas pixels
// with y down; here they become bone-local units with y up, then the whole body is scaled to heightUnits.

export interface RigBoneDef {
  name: string;
  parent: string | null;
  /** Piece rectangle in the atlas: x, y, w, h (px). */
  rect: [number, number, number, number];
  /** Joint this piece rotates around, atlas px. */
  pivot: [number, number];
  /** Where the joint sits on the parent piece, atlas px (null for the root). */
  attach: [number, number] | null;
}

export interface RigDef {
  image: string;
  size: [number, number];
  facing: 'left' | 'right';
  heightUnits: number;
  /** Back-to-front draw order. */
  bones: RigBoneDef[];
}

/** Bone name -> Z rotation in radians. 0 = the piece as drawn; positive = counter-clockwise. */
export type Angles = Record<string, number>;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
uniform float uTintAmount;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.02) discard;
  vec3 col = mix(tex.rgb, uTint, uTintAmount);
  gl_FragColor = vec4(col, tex.a * uOpacity);
  #include <colorspace_fragment>
}`;

export class CutoutRig {
  /** Origin between the feet at ground level. Move/rotate this from the stage. */
  readonly root = new THREE.Group();
  readonly material: THREE.ShaderMaterial;
  private readonly body = new THREE.Group();
  private readonly bones = new Map<string, THREE.Object3D>();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly byName: Map<string, RigBoneDef>;
  private readonly feet: { bone: THREE.Object3D; name: string; local: THREE.Vector3 }[] = [];
  private readonly tmp = new THREE.Vector3();
  private baseY = 0;
  /** World units per bone unit (atlas px) after scaling the rest pose to heightUnits. */
  unitsPerPx = 1;

  static async load(url: string): Promise<CutoutRig> {
    const def = (await (await fetch(url)).json()) as RigDef;
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const tex = await new THREE.TextureLoader().loadAsync(base + def.image);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new CutoutRig(def, tex);
  }

  constructor(
    readonly def: RigDef,
    texture: THREE.Texture,
    renderOrderBase = 100,
  ) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uTint: { value: new THREE.Color(0xffffff) },
        uTintAmount: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const [aw, ah] = def.size;
    const byName = new Map(def.bones.map((b) => [b.name, b]));
    this.byName = byName;
    // Create bones parent-first regardless of draw order.
    const make = (b: RigBoneDef): THREE.Object3D => {
      const existing = this.bones.get(b.name);
      if (existing) return existing;
      const bone = new THREE.Object3D();
      bone.name = b.name;
      this.bones.set(b.name, bone);
      if (b.parent) {
        const p = byName.get(b.parent);
        if (!p || !b.attach) throw new Error(`rig bone ${b.name}: bad parent ${b.parent}`);
        make(p).add(bone);
      } else {
        this.body.add(bone);
      }
      return bone;
    };

    def.bones.forEach((b, i) => {
      const bone = make(b);
      const [x, y, w, h] = b.rect;
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) {
        const u = uv.getX(k);
        const v = uv.getY(k);
        uv.setXY(k, (x + u * w) / aw, 1 - (y + (1 - v) * h) / ah);
      }
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.renderOrder = renderOrderBase + i;
      mesh.frustumCulled = false;
      bone.add(mesh);
      this.meshes.set(b.name, mesh);
    });
    // Soles: separate foot pieces if the rig has them, else the bottom of the shin pieces.
    const hasFeet = def.bones.some((b) => b.name.startsWith('foot'));
    for (const b of def.bones) {
      if (b.name.startsWith(hasFeet ? 'foot' : 'shin')) {
        this.feet.push({ bone: this.bones.get(b.name)!, name: b.name, local: new THREE.Vector3() });
      }
    }
    this.layout();

    // Scale the rest pose to heightUnits, feet on y = 0, centred on x = 0.
    this.root.add(this.body);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.body);
    const s = def.heightUnits / (box.max.y - box.min.y);
    this.body.scale.setScalar(s);
    this.unitsPerPx = s;
    this.body.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, 0);
    if (def.facing === 'left') {
      // Mirror so every rig faces right in bone space; the stage flips root.scale.x for enemies.
      this.body.scale.x *= -1;
      this.body.position.x *= -1;
    }
    this.baseY = this.body.position.y;
  }

  /** Place every bone and piece from the joint data in `def` (atlas px, y down -> bone units, y up). */
  private layout(): void {
    for (const b of this.def.bones) {
      const bone = this.bones.get(b.name)!;
      const p = b.parent ? this.byName.get(b.parent) : undefined;
      if (p && b.attach) bone.position.set(b.attach[0] - p.pivot[0], -(b.attach[1] - p.pivot[1]), 0);
      const [x, y, w, h] = b.rect;
      this.meshes.get(b.name)!.position.set(x + w / 2 - b.pivot[0], -(y + h / 2 - b.pivot[1]), 0);
    }
    for (const f of this.feet) {
      // Sole of the shoe: bottom-centre of the piece, in bone space.
      const b = this.byName.get(f.name)!;
      const [x, y, w, h] = b.rect;
      f.local.set(x + w / 2 - b.pivot[0], -(y + h - b.pivot[1]), 0);
    }
  }

  /** Sole of a shin piece, in that bone's space (bone units, y up). */
  /** Sole (bottom-centre) of a foot or shin piece, in that bone's space (bone units, y up). */
  soleOf(name: string): THREE.Vector3 | undefined {
    return this.feet.find((f) => f.name === name)?.local;
  }

  /** The leg's end point in shin space: the ankle joint if the rig has feet, else the sole. */
  legEnd(shin: string): THREE.Vector3 {
    const foot = this.bones.get(shin.replace('shin', 'foot'));
    return foot ? foot.position : this.soleOf(shin)!;
  }

  has(name: string): boolean {
    return this.bones.has(name);
  }

  /**
   * Two-bone IK for a leg. Returns [thigh, shin] rotations that put the leg end (ankle, or the sole
   * when there are no foot pieces) at (x, y),
   * given in the thigh's parent space (bone units, y up; the parent is assumed unrotated).
   * The knee bends forward (+x). Out-of-reach targets give a straight leg pointing at them.
   */
  legIK(thigh: string, shin: string, x: number, y: number): [number, number] {
    const tb = this.bones.get(thigh)!;
    const sb = this.bones.get(shin)!;
    const sole = this.legEnd(shin);
    const fromDown = (vx: number, vy: number) => Math.atan2(vx, -vy);
    // Rest geometry: hip -> knee in thigh space, knee -> sole in shin space.
    const kx = sb.position.x;
    const ky = sb.position.y;
    const l1 = Math.hypot(kx, ky);
    const l2 = Math.hypot(sole.x, sole.y);
    const a1 = fromDown(kx, ky);
    const a2 = fromDown(sole.x, sole.y);
    const dx = x - tb.position.x;
    const dy = y - tb.position.y;
    const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
    const phi = fromDown(dx, dy);
    const clamp1 = (v: number) => Math.min(1, Math.max(-1, v));
    const alpha = Math.acos(clamp1((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const t1 = phi + alpha; // thigh direction (from straight down, + = forward)
    const kneeX = Math.sin(t1) * l1;
    const kneeY = -Math.cos(t1) * l1;
    const t2 = fromDown(dx - kneeX, dy - kneeY); // shin direction
    const thighRot = t1 - a1;
    return [thighRot, t2 - a2 - thighRot];
  }

  bone(name: string): THREE.Object3D | undefined {
    return this.bones.get(name);
  }

  boneDef(name: string): RigBoneDef | undefined {
    return this.byName.get(name);
  }

  /** Editor: move a joint. `pivot` is on the bone's own piece, `attach` on the parent's (atlas px). */
  setJoint(name: string, pivot: [number, number], attach: [number, number] | null): void {
    const b = this.byName.get(name);
    if (!b) return;
    b.pivot = [round2(pivot[0]), round2(pivot[1])];
    if (b.parent && attach) b.attach = [round2(attach[0]), round2(attach[1])];
    this.layout();
  }

  /** Editor: the rig data as saved in <name>.rig.json. */
  toJSON(): RigDef {
    return JSON.parse(JSON.stringify(this.def)) as RigDef;
  }

  /** Set every listed bone's rotation; bones not listed go back to 0. */
  pose(angles: Angles): void {
    for (const [name, bone] of this.bones) bone.rotation.z = angles[name] ?? 0;
  }

  /** Shift the body so the lowest foot touches y = 0 (call after pose when grounded). */
  plantFeet(): void {
    this.body.position.y = this.baseY;
    this.root.updateMatrixWorld(true);
    let low = Infinity;
    for (const f of this.feet) {
      this.tmp.copy(f.local).applyMatrix4(f.bone.matrixWorld);
      this.root.worldToLocal(this.tmp);
      low = Math.min(low, this.tmp.y);
    }
    if (Number.isFinite(low)) this.body.position.y = this.baseY - low;
  }

  setTint(color: THREE.ColorRepresentation, amount: number): void {
    (this.material.uniforms.uTint.value as THREE.Color).set(color);
    this.material.uniforms.uTintAmount.value = amount;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.material.dispose();
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
