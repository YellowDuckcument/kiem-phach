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
  private readonly feet: { bone: THREE.Object3D; local: THREE.Vector3 }[] = [];
  private readonly tmp = new THREE.Vector3();
  private baseY = 0;

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
        bone.position.set(b.attach[0] - p.pivot[0], -(b.attach[1] - p.pivot[1]), 0);
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
      mesh.position.set(x + w / 2 - b.pivot[0], -(y + h / 2 - b.pivot[1]), 0);
      mesh.renderOrder = renderOrderBase + i;
      mesh.frustumCulled = false;
      bone.add(mesh);
      if (b.name.startsWith('shin')) {
        // Sole of the shoe: bottom-centre of the piece, in bone space.
        this.feet.push({ bone, local: new THREE.Vector3(x + w / 2 - b.pivot[0], -(y + h - b.pivot[1]), 0) });
      }
    });

    // Scale the rest pose to heightUnits, feet on y = 0, centred on x = 0.
    this.root.add(this.body);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.body);
    const s = def.heightUnits / (box.max.y - box.min.y);
    this.body.scale.setScalar(s);
    this.body.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, 0);
    if (def.facing === 'left') {
      // Mirror so every rig faces right in bone space; the stage flips root.scale.x for enemies.
      this.body.scale.x *= -1;
      this.body.position.x *= -1;
    }
    this.baseY = this.body.position.y;
  }

  bone(name: string): THREE.Object3D | undefined {
    return this.bones.get(name);
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
