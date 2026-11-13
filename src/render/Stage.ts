import * as THREE from 'three';
import { BEAT_UNITS } from '../rhythm/constants';
import type { TimedNote } from '../rhythm/Beatmap';
import type { TempoMap } from '../rhythm/TempoMap';

// Layout rules: .claude/skills/kiem-phach-style/references/layers-camera.md
export const CAMERA = { fov: 35, z: 14, y: 2.2, tiltDeg: 4, lead: 3 };

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
  private flash = 0;

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
    }
  }

  /** Brief gold flash on Phách (placeholder for parry feedback). */
  pulse(strength = 1): void {
    this.flash = Math.max(this.flash, strength);
  }

  /** Called once per frame with the current beat position from the song clock. */
  update(beat: number, dtSec: number): void {
    const x = beat * BEAT_UNITS;
    this.phach.position.x = x;
    this.camera.position.x = x + CAMERA.lead;
    this.flash = Math.max(0, this.flash - dtSec * 6);
    (this.phach.material as THREE.MeshLambertMaterial).emissive.setRGB(this.flash * 0.83, this.flash * 0.64, this.flash * 0.22);
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
