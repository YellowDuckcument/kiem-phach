import * as THREE from 'three';
import { Course } from '../combat/Course';
import type { Beatmap, TimedNote } from '../rhythm/Beatmap';
import { CutoutRig } from './rig/CutoutRig';
import { loadPoseOverrides, PhachAnimator, RIG } from './rig/PhachAnimator';

// Layout rules: .claude/skills/kiem-phach-style/references/layers-camera.md
// Everything that has to line up with the music is a pure function of `beat`.
// Only cosmetic reactions to presses (swing, jump, hurt) use frame dt.
export const CAMERA = { fov: 35, z: 14, y: 2.2, tiltDeg: 4, lead: 2.5 };

/** Placeholder action animation (visual only, never used for timing). */
export const ACT = { jumpSec: 0.4, jumpHeight: 1.6, swingDecay: 7, knockback: 0.8 };

/** Enemy attack choreography, in beats. Visual only: judging uses the beatmap times. */
export const ATTACK = {
  /** Dash from the waiting spot to Phách in the last part of the wind-up. */
  dashBeats: 0.25,
  /** Back to the waiting spot after the strike lands. */
  recoverBeats: 0.45,
  /** A ground wave (jump note) takes this long to reach Phách. */
  waveBeats: 0.6,
  /** Cue ring starts at this scale and shrinks to 1 on the beat. */
  cueScale: 3.5,
};

export type StageAction = 'strike' | 'jump' | 'counter' | 'skill';
export type NoteState = 'inactive' | 'pending' | 'judged' | 'cancelled' | 'dormant' | undefined;

const COLORS = {
  ink: 0x14100e,
  son: 0xb3261e,
  vang: 0xd4a437,
  nga: 0xefe6d2,
  cham: 0x2b3a67,
  dat: 0x5a4a40,
};

const CUE_COLOR: Record<TimedNote['type'], number> = {
  strike: COLORS.nga,
  hold: COLORS.nga,
  jump: COLORS.son,
  counter: COLORS.vang,
  finisher: COLORS.vang,
};

interface EnemyView {
  id: string;
  isBoss: boolean;
  group: THREE.Group;
  body: THREE.Mesh;
  weapon: THREE.Object3D;
  wave: THREE.Mesh;
  /** Attack notes (finishers are Phách's move, not the enemy's). */
  notes: TimedNote[];
  height: number;
  broken: boolean;
  deadAt: number | null;
}

/** Placeholder 2.5D stage: real depth layers, gameplay on z = 0, blocks instead of art. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Phách's root, feet at y = 0. Holds the cut-out rig once loaded, a placeholder box until then. */
  readonly phach = new THREE.Group();
  private readonly phachBox: THREE.Mesh;
  private phachRig: PhachAnimator | null = null;
  /** Set by main: lets the stage skip cancelled/inactive notes without knowing the Judge. */
  noteState: (id: string) => NoteState = () => 'pending';

  private course: Course | null = null;
  private enemies: EnemyView[] = [];
  private readonly swordPivot = new THREE.Object3D();
  private readonly burst: THREE.Mesh;
  private readonly cues: THREE.Mesh[] = [];
  private readonly target: THREE.Mesh;
  private beat = 0;
  private flash = 0;
  private flashColor = new THREE.Color(COLORS.vang);
  private jumpT = 0;
  private swing = 0;
  private burstT = 0;
  private hurtT = 0;
  private lungeT = 0;

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

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a1d17 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(900, 0, -1);
    this.scene.add(ground);

    this.buildScenery();

    this.phachBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.7, 0.4),
      new THREE.MeshLambertMaterial({ color: COLORS.son }),
    );
    this.phachBox.position.y = 0.85;
    this.phach.add(this.phachBox);
    this.scene.add(this.phach);
    this.loadPhachRig();

    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 1.1, 0.07),
      new THREE.MeshBasicMaterial({ color: COLORS.nga }),
    );
    sword.position.y = 0.55;
    this.swordPivot.add(sword);
    this.swordPivot.position.set(0.3, 0.15, 0.25);
    this.phachBox.add(this.swordPivot);

    // Gold burst on a K press.
    this.burst = this.makeRing(0.8, 1, COLORS.vang);
    this.scene.add(this.burst);

    // Timing cues: rings that shrink onto Phách and land on the beat; a faint target ring shows where.
    this.target = this.makeRing(0.95, 1.05, COLORS.nga);
    this.scene.add(this.target);
    for (let i = 0; i < 6; i++) {
      const r = this.makeRing(0.9, 1.05, COLORS.nga);
      this.cues.push(r);
      this.scene.add(r);
    }

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Swap the placeholder box for the cut-out rig. Keeps the box if the art is missing. */
  private async loadPhachRig(): Promise<void> {
    try {
      const url = './art/phach/phach.rig.json';
      const [rig] = await Promise.all([CutoutRig.load(url), loadPoseOverrides(url)]);
      this.phach.add(rig.root);
      this.phachBox.visible = false;
      this.phachRig = new PhachAnimator(rig);
    } catch (err) {
      console.warn('Phách rig not loaded, keeping the placeholder box', err);
    }
  }

  private makeRing(inner: number, outer: number, color: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
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

  /** Build one figure per enemy from the beatmap. */
  load(map: Beatmap, course: Course): void {
    for (const e of this.enemies) {
      this.scene.remove(e.group, e.wave);
    }
    this.course = course;
    this.enemies = map.data.enemies.map((e) => {
      const isBoss = (e.postureSegments ?? 0) > 1;
      const big = isBoss ? 1.5 : e.kind === 'dai-dao' ? 1.15 : 1;
      const height = 1.8 * big;
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 * big, height, 0.45 * big),
        new THREE.MeshLambertMaterial({ color: isBoss ? COLORS.cham : COLORS.dat }),
      );
      body.position.y = height / 2;
      group.add(body);
      const weapon = new THREE.Object3D();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.09 * big, 1.4 * big, 0.09),
        new THREE.MeshLambertMaterial({ color: 0x9a9a9a }),
      );
      blade.position.y = 0.7 * big;
      weapon.add(blade);
      weapon.position.set(-0.35 * big, height * 0.6, 0.3);
      group.add(weapon);
      this.scene.add(group);

      const wave = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.8),
        new THREE.MeshBasicMaterial({ color: COLORS.son, transparent: true, opacity: 0.9 }),
      );
      wave.visible = false;
      this.scene.add(wave);

      return {
        id: e.id,
        isBoss,
        group,
        body,
        weapon,
        wave,
        height,
        notes: map.notes.filter((n) => n.enemy === e.id && n.type !== 'finisher'),
        broken: false,
        deadAt: null,
      };
    });
    this.setFinishers(map.notes);
    this.reset();
  }

  /** Back to the start of the level (instant restart). */
  reset(): void {
    this.jumpT = this.swing = this.burstT = this.hurtT = this.flash = this.lungeT = 0;
    this.phachRig?.reset();
    for (const e of this.enemies) {
      e.broken = false;
      e.deadAt = null;
      e.group.visible = true;
      e.group.rotation.set(0, 0, 0);
      (e.body.material as THREE.MeshLambertMaterial).emissive.setRGB(0, 0, 0);
    }
  }

  /** Phách's move for a button press, hit or not. */
  act(action: StageAction): void {
    if (action === 'jump') this.jumpT = ACT.jumpSec;
    else if (action === 'strike') {
      this.swing = 1;
      this.phachRig?.strike();
    } else if (action === 'counter') {
      this.swing = 1;
      this.burstT = 1;
      this.phachRig?.counter();
    }
  }

  /** Phách takes a hit: red flash and knockback. */
  hurt(): void {
    this.hurtT = 1;
  }

  /** Posture broken: the enemy staggers (red, bent) and is open to a finisher. */
  markBroken(enemyId: string): void {
    const e = this.enemies.find((x) => x.id === enemyId);
    if (e) e.broken = true;
  }

  /** Finisher landed: Phách lunges, the enemy falls. */
  killEnemy(enemyId: string): void {
    const e = this.enemies.find((x) => x.id === enemyId);
    if (e && e.deadAt === null) e.deadAt = this.beat;
    this.lungeT = 1;
    this.pulse(1.5, COLORS.son);
  }

  pulse(strength = 1, color: number = COLORS.vang): void {
    this.flash = Math.max(this.flash, strength);
    this.flashColor.setHex(color);
  }

  /** Called once per frame with the current beat position from the song clock. */
  update(beat: number, dtSec: number): void {
    this.beat = beat;
    const x = this.course ? this.course.xAt(beat) : 0;
    this.jumpT = Math.max(0, this.jumpT - dtSec);
    this.swing = Math.max(0, this.swing - dtSec * ACT.swingDecay);
    this.burstT = Math.max(0, this.burstT - dtSec * 3);
    this.hurtT = Math.max(0, this.hurtT - dtSec * 3);
    this.lungeT = Math.max(0, this.lungeT - dtSec * 3);
    this.flash = Math.max(0, this.flash - dtSec * 6);

    const jp = this.jumpT > 0 ? 1 - this.jumpT / ACT.jumpSec : 0;
    const lunge = Math.sin(this.lungeT * Math.PI) * 1.5;
    this.phach.position.set(
      x - this.hurtT * ACT.knockback + lunge,
      Math.sin(jp * Math.PI) * ACT.jumpHeight,
      0,
    );
    this.phach.scale.setScalar(RIG.scale);
    if (this.phachRig) {
      const ahead = this.course ? this.course.xAt(beat + 0.05) : x;
      this.phachRig.update(
        { beat, x, walking: ahead - x > 1e-4, jump: jp, hurt: this.hurtT, lunge: this.lungeT },
        dtSec,
      );
    } else {
      this.phachBox.rotation.z = this.hurtT * 0.4;
      this.swordPivot.rotation.z = 0.5 - Math.sin(this.swing * Math.PI) * 2.2;
    }

    const burstMat = this.burst.material as THREE.MeshBasicMaterial;
    burstMat.opacity = this.burstT;
    this.burst.position.set(this.phach.position.x, this.phach.position.y + 0.95, 0.3);
    this.burst.scale.setScalar(0.5 + (1 - this.burstT) * 2);

    for (const e of this.enemies) this.updateEnemy(e, beat, x);
    this.updateCues(beat, x);

    this.camera.position.x = x + CAMERA.lead;
    const mat = this.phachBox.material as THREE.MeshLambertMaterial;
    if (this.hurtT > 0) mat.emissive.setRGB(this.hurtT * 0.9, 0, 0);
    else mat.emissive.copy(this.flashColor).multiplyScalar(this.flash);
    if (this.phachRig) {
      if (this.hurtT > 0) this.phachRig.rig.setTint(COLORS.son, this.hurtT * 0.6);
      else this.phachRig.rig.setTint(this.flashColor, Math.min(0.5, this.flash * 0.35));
    }
    this.renderer.render(this.scene, this.camera);
  }

  private isLive(n: TimedNote): boolean {
    const s = this.noteState(n.id);
    return s === 'pending' || s === 'judged';
  }

  /** Enemy pose is a pure function of the beat: wait, wind up, dash in on the beat, recover. */
  private updateEnemy(e: EnemyView, beat: number, phachX: number): void {
    const course = this.course!;
    const stop = course.stopOfEnemy(e.id);
    const home = course.enemyX(e.id);
    const contact = phachX + 0.9 + (e.isBoss ? 0.4 : 0);
    const mat = e.body.material as THREE.MeshLambertMaterial;

    if (e.deadAt !== null) {
      const t = Math.min(1, (beat - e.deadAt) / 1.5);
      e.group.position.set(home, -t * 0.6, 0);
      e.group.rotation.z = -t * 1.4;
      mat.emissive.setRGB(0.4 * (1 - t), 0, 0);
      e.group.visible = t < 1;
      e.wave.visible = false;
      return;
    }

    // Left the fight alive: run off to the right.
    const fled = stop ? beat - stop.end : 0;
    if (fled > 0) {
      e.group.position.set(home + fled * 7, 0, 0);
      e.group.rotation.z = 0;
      e.group.visible = fled < 2;
      e.wave.visible = false;
      return;
    }
    e.group.visible = true;

    let reach = 0; // 0 = at home, 1 = at Phách
    let windup = 0;
    let windColor = COLORS.nga;
    let slash = 0;
    let crouch = 0;
    let wave: { t: number } | null = null;
    for (const n of e.notes) {
      if (!this.isLive(n)) continue;
      const d = beat - n.beat; // <0 before the hit, >0 after
      if (d < -n.telegraphBeats - 0.1 || d > ATTACK.recoverBeats + 0.4) continue;
      const w = d < 0 ? Math.min(1, (d + n.telegraphBeats) / n.telegraphBeats) : 0;
      if (w > windup) {
        windup = w;
        windColor = CUE_COLOR[n.type];
      }
      if (n.type === 'jump') {
        crouch = Math.max(crouch, w);
        if (d >= -ATTACK.waveBeats && d <= 0.3) wave = { t: (d + ATTACK.waveBeats) / ATTACK.waveBeats };
        continue;
      }
      if (d >= -ATTACK.dashBeats && d <= 0) reach = Math.max(reach, (d + ATTACK.dashBeats) / ATTACK.dashBeats);
      else if (d > 0 && d <= ATTACK.recoverBeats) reach = Math.max(reach, 1 - d / ATTACK.recoverBeats);
      if (n.type === 'hold' && n.lengthBeats && d > 0 && d <= n.lengthBeats) reach = 1; // pressing the blade
      if (d >= -0.08 && d <= 0.2) slash = Math.max(slash, 1 - Math.abs(d - 0.04) / 0.16);
    }

    const ease = reach * reach * (3 - 2 * reach);
    e.group.position.set(home + (contact - home) * ease, 0, 0);
    e.group.rotation.z = e.broken ? 0.35 : -windup * 0.25 * (1 - reach) + crouch * 0.15;
    e.group.scale.y = 1 - crouch * 0.25;
    // Blade raised behind during wind-up, swung down onto Phách on the beat.
    e.weapon.rotation.z = 0.8 + windup * 0.6 - slash * 2.6;
    mat.emissive.setHex(e.broken ? COLORS.son : windColor).multiplyScalar(e.broken ? 0.5 : windup * 0.7);

    if (wave) {
      e.wave.visible = true;
      e.wave.position.set(home + (phachX - home) * wave.t, 0.18, 0);
      (e.wave.material as THREE.MeshBasicMaterial).opacity = wave.t > 1 ? Math.max(0, 1 - (wave.t - 1) * 3) : 0.9;
    } else {
      e.wave.visible = false;
    }
  }

  /** Rings shrinking onto Phách: they land on the beat of each upcoming note. */
  private updateCues(beat: number, phachX: number): void {
    const upcoming: TimedNote[] = [];
    for (const e of this.enemies) {
      if (e.deadAt !== null) continue;
      for (const n of e.notes) {
        if (this.noteState(n.id) !== 'pending') continue;
        if (beat >= n.beat - n.telegraphBeats && beat <= n.beat + 0.1) upcoming.push(n);
      }
    }
    // Finishers: only once the enemy is broken.
    for (const e of this.enemies) {
      if (!e.broken || e.deadAt !== null) continue;
      for (const n of this.finishersOf(e)) {
        if (this.noteState(n.id) === 'pending' && beat >= n.beat - n.telegraphBeats && beat <= n.beat + 0.1) {
          upcoming.push(n);
        }
      }
    }
    upcoming.sort((a, b) => a.beat - b.beat);
    const cy = 0.9;
    for (let i = 0; i < this.cues.length; i++) {
      const ring = this.cues[i]!;
      const n = upcoming[i];
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (!n) {
        mat.opacity = 0;
        continue;
      }
      const p = Math.max(0, (n.beat - beat) / n.telegraphBeats); // 1 → 0 on the beat
      ring.position.set(phachX, cy, 0.35);
      ring.scale.setScalar(1 + (ATTACK.cueScale - 1) * p);
      mat.color.setHex(CUE_COLOR[n.type]);
      mat.opacity = Math.min(1, (1 - p) * 1.6) * (i === 0 ? 1 : 0.5);
    }
    const tMat = this.target.material as THREE.MeshBasicMaterial;
    tMat.opacity = upcoming.length ? 0.35 : 0;
    this.target.position.set(phachX, cy, 0.34);
  }

  private finisherCache = new Map<string, TimedNote[]>();
  private finishersOf(e: EnemyView): TimedNote[] {
    return this.finisherCache.get(e.id) ?? [];
  }

  /** Finisher notes are kept apart: they belong to Phách, not to the enemy's attacks. */
  private setFinishers(notes: TimedNote[]): void {
    this.finisherCache.clear();
    for (const n of notes) {
      if (n.type !== 'finisher' || !n.enemy) continue;
      const list = this.finisherCache.get(n.enemy) ?? [];
      list.push(n);
      this.finisherCache.set(n.enemy, list);
    }
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
