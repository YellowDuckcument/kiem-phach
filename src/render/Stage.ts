import * as THREE from 'three';
import { BEAT_UNITS } from '../rhythm/constants';
import type { TimedNote } from '../rhythm/Beatmap';
import type { TempoMap } from '../rhythm/TempoMap';

// Layout rules: .claude/skills/kiem-phach-style/references/layers-camera.md
export const CAMERA = { fov: 35, z: 14, y: 2.2, tiltDeg: 4, lead: 3 };

/** Placeholder action animation (visual only, never used for timing). */
export const ACT = { jumpSec: 0.4, jumpHeight: 1.6, swingDecay: 7, knockback: 0.8 };

export type StageAction = 'strike' | 'jump' | 'counter' | 'skill';

const COLORS = {
  ink: 0x14100e,
  son: 0xb3261e,
  vang: 0xd4a437,
  nga: 0xefe6d2,
  cham: 0x2b3a67,
};

/** Placeholder 2.5D stage: real depth layers, gameplay on z = 0, blocks instead of art. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly phach: THREE.Mesh;
  private readonly enemies = new Map<string, THREE.Mesh>();
  private readonly noteEnemy = new Map<string, string>();
  private readonly swordPivot = new THREE.Object3D();
  private readonly ring: THREE.Mesh;
  private flash = 0;
  private flashColor = new THREE.Color(COLORS.vang);
  private jumpT = 0;
  private swing = 0;
  private ringT = 0;
  private hurtT = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(COLORS.ink);
    this.scene.fog = new THREE.Fog(COLORS.ink, 30, 160);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.1, 400);
    this.camera.position.set(0, CAMERA.y, CAMERA.z);
    this.camera.rotation.x = THREE.MathUtils.degToRad(-CAMERA.tiltDeg);

    this.scene.add(new THREE.HemisphereLight(COLORS.nga, COLORS.ink, 1.2));
    const sun = new THREE.DirectionalLight(COLORS.vang, 1.5);
    sun.position.set(-5, 10, 8);
    this.scene.add(sun);

    // Gameplay ground (z around 0)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a1d17 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(900, 0, -1);
    this.scene.add(ground);

    this.buildScenery();

    this.phach = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.7, 0.4),
      new THREE.MeshLambertMaterial({ color: COLORS.son }),
    );
    this.phach.position.y = 0.85;
    this.scene.add(this.phach);

    // Sword on a pivot at the hand, so a strike is a visible swing.
    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 1.1, 0.07),
      new THREE.MeshBasicMaterial({ color: COLORS.nga }),
    );
    sword.position.y = 0.55;
    this.swordPivot.add(sword);
    this.swordPivot.position.set(0.3, 0.15, 0.25);
    this.phach.add(this.swordPivot);

    // Gold ring that bursts out on a counter press.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.vang, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.ring.position.z = 0.3;
    this.scene.add(this.ring);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Midground blocks and far cards at real depth, so parallax comes for free. */
  private buildScenery(): void {
    const mid = new THREE.MeshLambertMaterial({ color: 0x3a2a22 });
    const far = new THREE.MeshBasicMaterial({ color: 0x241a16 });
    for (let i = 0; i < 120; i++) {
      const x = i * 9 + ((i * 37) % 7);
      const h = 2 + ((i * 53) % 5);
      const house = new THREE.Mesh(new THREE.BoxGeometry(3, h, 2), mid);
      house.position.set(x, h / 2, -6 - ((i * 11) % 10));
      this.scene.add(house);
    }
    for (let i = 0; i < 40; i++) {
      const w = 30 + ((i * 17) % 20);
      const h = 15 + ((i * 29) % 25);
      const mountain = new THREE.Mesh(new THREE.PlaneGeometry(w, h), far);
      mountain.position.set(i * 40, h / 2 - 2, -80 - ((i * 13) % 40));
      this.scene.add(mountain);
    }
  }

  /** Place one marker per note at the X of its beat. */
  setNotes(notes: TimedNote[], tempo: TempoMap): void {
    for (const m of this.enemies.values()) this.scene.remove(m);
    this.enemies.clear();
    this.noteEnemy.clear();
    this.jumpT = this.swing = this.ringT = this.hurtT = this.flash = 0;
    const color: Record<string, number> = {
      strike: COLORS.nga,
      hold: COLORS.nga,
      jump: COLORS.son,
      counter: COLORS.vang,
      finisher: COLORS.vang,
    };
    for (const n of notes) {
      const beat = tempo.beatAtSeconds(n.timeSong);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, n.type === 'jump' ? 0.4 : 1.6, 0.4),
        new THREE.MeshLambertMaterial({ color: color[n.type] ?? COLORS.nga }),
      );
      m.position.set(beat * BEAT_UNITS + 1, n.type === 'jump' ? 0.2 : 0.8, 0);
      m.visible = n.activeAtStart;
      this.scene.add(m);
      this.enemies.set(n.id, m);
      if (n.enemy) this.noteEnemy.set(n.id, n.enemy);
    }
  }

  /** Phách's move for a button press, hit or not. */
  act(action: StageAction): void {
    if (action === 'jump') this.jumpT = ACT.jumpSec;
    else if (action === 'strike') this.swing = 1;
    else if (action === 'counter') {
      this.swing = 1;
      this.ringT = 1;
    }
  }

  /** Phách takes a hit: red flash and knockback. */
  hurt(): void {
    this.hurtT = 1;
  }

  /** Tint the remaining notes of a posture-broken enemy (they are now open to a finisher). */
  markBroken(enemyId: string): void {
    for (const [id, m] of this.enemies) {
      if (this.noteEnemy.get(id) !== enemyId) continue;
      const mat = m.material as THREE.MeshLambertMaterial;
      mat.color.setHex(COLORS.son);
      m.rotation.z = -0.35;
    }
  }

  /** Remove every marker of a finished enemy. */
  killEnemy(enemyId: string): void {
    for (const [id, m] of this.enemies) if (this.noteEnemy.get(id) === enemyId) m.visible = false;
    this.pulse(1.5, COLORS.son);
  }

  /** Show or hide one note marker (judged notes vanish, activated onMiss notes appear). */
  setNoteVisible(id: string, visible: boolean): void {
    const m = this.enemies.get(id);
    if (m) m.visible = visible;
  }

  /** Brief gold flash on Phách (placeholder for parry feedback). */
  pulse(strength = 1, color: number = COLORS.vang): void {
    this.flash = Math.max(this.flash, strength);
    this.flashColor.setHex(color);
  }

  /** Called once per frame with the current beat position from the song clock. */
  update(beat: number, dtSec: number): void {
    const x = beat * BEAT_UNITS;
    this.jumpT = Math.max(0, this.jumpT - dtSec);
    this.swing = Math.max(0, this.swing - dtSec * ACT.swingDecay);
    this.ringT = Math.max(0, this.ringT - dtSec * 3);
    this.hurtT = Math.max(0, this.hurtT - dtSec * 3);
    this.flash = Math.max(0, this.flash - dtSec * 6);

    const jp = this.jumpT > 0 ? 1 - this.jumpT / ACT.jumpSec : 0; // 0..1 through the jump
    this.phach.position.set(x - this.hurtT * ACT.knockback, 0.85 + Math.sin(jp * Math.PI) * ACT.jumpHeight, 0);
    this.phach.rotation.z = this.hurtT * 0.4;
    // Sword rests raised, sweeps down and forward on a swing.
    this.swordPivot.rotation.z = 0.5 - Math.sin(this.swing * Math.PI) * 2.2;

    const ringMat = this.ring.material as THREE.MeshBasicMaterial;
    ringMat.opacity = this.ringT;
    this.ring.position.set(this.phach.position.x, this.phach.position.y, 0.3);
    this.ring.scale.setScalar(0.5 + (1 - this.ringT) * 2);

    this.camera.position.x = x + CAMERA.lead;
    const mat = this.phach.material as THREE.MeshLambertMaterial;
    if (this.hurtT > 0) mat.emissive.setRGB(this.hurtT * 0.9, 0, 0);
    else mat.emissive.copy(this.flashColor).multiplyScalar(this.flash);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
