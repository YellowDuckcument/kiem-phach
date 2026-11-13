import { COURSE } from '../../combat/Course';
import type { Angles, CutoutRig } from './CutoutRig';

// Phách's poses on the cut-out rig. Angles in radians; 0 = piece as drawn (limbs hanging straight down).
// Phách faces right: for a hanging limb, + swings it FORWARD; for torso/head, - leans forward.
// The sword goes THROUGH the fist, roughly at right angles to the hand (weapon 0 = as drawn): the blade's
// direction comes from the arm, and `weapon` is only a small wrist tilt (keep it within about ±0.6).
// Visual only: nothing here is used for timing.

/** Tunables (lil-gui folder "Rig Phách"). Seconds are cosmetic reaction times to a press. */
export const RIG = {
  /** Phách's size on stage (1 = 1.7 units tall). */
  scale: 1,
  strikeSec: 0.32,
  /** Share of strikeSec spent going from wind-up to the slash. */
  strikeSnap: 0.3,
  counterSec: 0.4,
  /** Beats per step: 0.5 = a foot lands on every beat and half-beat. Step length = walkUnits x this;
   *  keep it near 0.8 world units (Phách's leg is ~0.9) or the planted foot cannot keep up. */
  beatsPerStep: 0.5,
  /** Share of a walk cycle (two steps) each foot spends on the ground. */
  stance: 0.6,
  /** How high the swinging foot lifts, world units. */
  footLift: 0.1,
  /** Walking feet centred this far ahead of the hip, world units. */
  footForward: 0.02,
  /** Hip height while walking, as a share of the full leg length (lower = more bent knees). */
  walkHeight: 0.95,
  /** Heel lift at push-off (radians, foot pieces only). */
  toeOff: 0.45,
  /** Toes up at heel strike (radians, foot pieces only). */
  heelStrike: 0.25,
  /** Secondary motion: how fast the lagging parts (far arm, head, scarf) follow, Hz. Lower = more drag. */
  lagHz: 3.5,
  /** Secondary motion damping (1 = no overshoot, lower = more swing). */
  lagDamp: 0.55,
  breathe: 0.03,
  scarfFlutter: 0.25,
};

type Pose = Angles;

// Blade direction in the world = torso + upperArmN + forearmN + handN + weapon (0 = forward, + = tip up).
const STAND: Pose = {
  hips: 0, torso: -0.06, head: 0.04, scarf: -0.25,
  upperArmN: 0.3, forearmN: 0.35, handN: 0, weapon: -0.1, // blade ≈ 0.5: low guard, tip forward-up
  upperArmF: -0.15, forearmF: 0.35, handF: 0.1,
  thighN: 0.22, shinN: -0.18, thighF: -0.22, shinF: -0.06,
};
const WINDUP: Pose = {
  ...STAND, torso: 0.08, head: 0.06,
  upperArmN: 2.55, forearmN: 0.45, handN: 0.1, weapon: 0, // blade ≈ 3.2: over the shoulder, tip back
  upperArmF: -0.5, forearmF: 0.6,
  thighN: 0.32, shinN: -0.25, thighF: -0.3,
};
const SLASH: Pose = {
  ...STAND, torso: -0.28, head: -0.05, scarf: -0.6,
  upperArmN: 0.35, forearmN: 0.05, handN: -0.35, weapon: -0.45, // blade ≈ -0.7: cut down and forward
  upperArmF: -0.7, forearmF: 0.2,
  thighN: 0.6, shinN: -0.55, thighF: -0.45, shinF: -0.1,
};
const THRUST: Pose = {
  ...STAND, torso: -0.32, head: -0.08, scarf: -0.8,
  upperArmN: 1.2, forearmN: 0.25, handN: -0.55, weapon: -0.5, // blade ≈ 0.1: straight ahead
  upperArmF: -0.8, forearmF: 0.1,
  thighN: 0.85, shinN: -0.85, thighF: -0.6, shinF: -0.15,
};
const TUCK: Pose = {
  ...STAND, torso: -0.15, scarf: 0.3,
  upperArmN: 0.8, forearmN: 0.55, handN: 0, weapon: -0.2,
  upperArmF: 0.4, forearmF: 0.9,
  thighN: 1.35, shinN: -1.9, thighF: 1.05, shinF: -1.7,
};
const HURT: Pose = {
  ...STAND, torso: 0.32, head: 0.28, scarf: 0.2,
  upperArmN: 0.1, forearmN: 0.3, handN: 0, weapon: 0,
  upperArmF: 0.6, forearmF: 0.5,
  thighN: 0.05, shinN: -0.1, thighF: -0.35,
};

// Walk: four key poses per step, as in hand-drawn walk cycles (contact, down, passing, up).
// They are drawn for the step where the NEAR leg lands in front; the next step mirrors them.
// They only hold the upper body plus `hipY` (hip height offset, world units): legs and feet are
// placed by IK so the planted foot never slides. The sword is carried low while walking.
const WALK_CONTACT: Pose = {
  hipY: 0, torso: -0.04, head: 0.02, scarf: -0.55,
  upperArmN: 0.05, forearmN: 0.35, handN: 0, weapon: -0.75,
  upperArmF: 0.35, forearmF: 0.3, handF: 0.05,
};
const WALK_DOWN: Pose = {
  hipY: -0.035, torso: -0.07, head: 0.05, scarf: -0.45,
  upperArmN: 0, forearmN: 0.4, handN: 0, weapon: -0.75,
  upperArmF: 0.42, forearmF: 0.45, handF: 0.1,
};
const WALK_PASS: Pose = {
  hipY: 0, torso: -0.05, head: 0.03, scarf: -0.6,
  upperArmN: 0.12, forearmN: 0.35, handN: 0, weapon: -0.75,
  upperArmF: 0.05, forearmF: 0.3, handF: 0.05,
};
const WALK_UP: Pose = {
  hipY: 0.025, torso: -0.04, head: 0, scarf: -0.7,
  upperArmN: 0.2, forearmN: 0.3, handN: 0, weapon: -0.75,
  upperArmF: -0.25, forearmF: 0.2, handF: 0,
};
/** Mirroring a walk key for the other step flips these swings around a neutral angle. */
const WALK_MIRROR: Record<string, number> = { upperArmF: 0, upperArmN: 0.1 };
/** Parts that follow with a delay (secondary motion), by looseness: lower = more drag. */
const LAG: Record<string, number> = { upperArmF: 1, forearmF: 0.8, handF: 0.7, head: 1.6, scarf: 0.55 };

/**
 * Key poses. The values above are the built-in defaults; <name>.poses.json (saved by /rig.html when a
 * joint is rotated) overrides them in place, so the game and the editor always use the same poses.
 */
export const POSES = { STAND, WINDUP, SLASH, THRUST, TUCK, HURT, WALK_CONTACT, WALK_DOWN, WALK_PASS, WALK_UP };
export const WALK_KEYS = ['WALK_CONTACT', 'WALK_DOWN', 'WALK_PASS', 'WALK_UP'] as const;
export type PoseName = keyof typeof POSES;
export const DEFAULT_POSES: Record<PoseName, Pose> = JSON.parse(JSON.stringify(POSES));

/** Copy saved angles into POSES. Unknown poses/bones are ignored. */
export function applyPoseOverrides(saved: unknown): void {
  if (!saved || typeof saved !== 'object') return;
  for (const [name, angles] of Object.entries(saved as Record<string, unknown>)) {
    const pose = POSES[name as PoseName];
    if (!pose || !angles || typeof angles !== 'object') continue;
    for (const [bone, v] of Object.entries(angles as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) pose[bone] = v;
    }
  }
}

/** Load <rig>.poses.json next to the rig if it exists. Missing file = built-in poses. */
export async function loadPoseOverrides(rigUrl: string): Promise<void> {
  try {
    const res = await fetch(rigUrl.replace(/\.rig\.json$/, '.poses.json'));
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return;
    applyPoseOverrides(await res.json());
  } catch {
    // no saved poses: keep the defaults
  }
}

const ease = (t: number) => t * t * (3 - 2 * t);

function mix(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  return out;
}

export interface PhachState {
  beat: number;
  /** Phách's x on the course; walking is detected from its change. */
  x: number;
  walking: boolean;
  /** 0..1 progress of the current jump, 0 when grounded. */
  jump: number;
  /** 1 right after a hit, decays to 0. */
  hurt: number;
  /** 1 right after a finisher, decays to 0. */
  lunge: number;
}

const LEGS: [thigh: string, shin: string, foot: string, offset: number][] = [
  ['thighN', 'shinN', 'footN', 0],
  ['thighF', 'shinF', 'footF', 0.5],
];

/** Catmull-Rom through p0..p3 at t in [p1, p2]. */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** The eight walk keys of a full cycle (two steps): the four keys, then the four mirrored. */
function walkLoop(): Pose[] {
  const keys = WALK_KEYS.map((k) => POSES[k]);
  const mirrored = keys.map((k) => {
    const m: Pose = { ...k };
    for (const [bone, mid] of Object.entries(WALK_MIRROR)) if (bone in m) m[bone] = 2 * mid - m[bone];
    return m;
  });
  return [...keys, ...mirrored];
}

/** Upper body + hipY of the walk at cycle phase c (0..1, 0 = near foot lands). */
export function walkPose(c: number): Pose {
  const loop = walkLoop();
  const n = loop.length;
  const pos = (((c % 1) + 1) % 1) * n;
  const i = Math.floor(pos);
  const t = pos - i;
  const at = (k: number) => loop[(i + k + n) % n];
  const out: Pose = {};
  for (const bone of Object.keys(loop[0])) {
    out[bone] = catmull(at(-1)[bone] ?? 0, at(0)[bone] ?? 0, at(1)[bone] ?? 0, at(2)[bone] ?? 0, t);
  }
  return out;
}

export class PhachAnimator {
  private strikeT = 0;
  private counterT = 0;
  private walkBlend = 0;
  private readonly lag = new Map<string, { a: number; v: number }>();

  constructor(readonly rig: CutoutRig) {}

  strike(): void {
    this.strikeT = RIG.strikeSec;
  }

  counter(): void {
    this.counterT = RIG.counterSec;
  }

  reset(): void {
    this.strikeT = this.counterT = this.walkBlend = 0;
    this.lag.clear();
  }

  /** World units per step (a foot lands every RIG.beatsPerStep beats of walking). */
  private stepUnits(): number {
    return COURSE.walkUnits * RIG.beatsPerStep;
  }

  /**
   * Legs and feet of the walk at cycle phase c, by IK. Each ankle follows a fixed path in the hips'
   * space: on the ground it moves back exactly as fast as Phach moves forward (no sliding), then lifts
   * and swings forward on an arc. Feet stay flat on the ground and roll heel-to-toe.
   */
  private walkLegs(c: number, hipY: number): Pose {
    const rig = this.rig;
    const px = 1 / rig.unitsPerPx;
    const span = RIG.stance * 2 * this.stepUnits() * px;
    const lift = RIG.footLift * px;
    const st = RIG.stance;
    const out: Pose = {};
    for (const [thigh, shin, foot, offset] of LEGS) {
      const hip = rig.bone(thigh)!.position;
      const knee = rig.bone(shin)!.position;
      const end = rig.legEnd(shin);
      const legLen = Math.hypot(knee.x, knee.y) + Math.hypot(end.x, end.y);
      const u = (((c + offset) % 1) + 1) % 1;
      let fx: number;
      let fy = 0;
      let footAngle = 0;
      if (u < st) {
        fx = span / 2 - (u / st) * span;
        // heel strike: toes come down over the first 15% of stance; push-off: heel rises over the last 25%
        if (u < 0.15 * st) footAngle = RIG.heelStrike * (1 - ease(u / (0.15 * st)));
        else if (u > 0.75 * st) footAngle = -RIG.toeOff * ease((u - 0.75 * st) / (0.25 * st));
      } else {
        const t = (u - st) / (1 - st);
        fx = -span / 2 + ease(t) * span;
        fy = Math.sin(t * Math.PI) * lift;
        // toes trail after push-off, then come up for the next heel strike
        footAngle = t < 0.5 ? -RIG.toeOff * (1 - ease(t / 0.5)) : RIG.heelStrike * ease((t - 0.5) / 0.5);
      }
      const ty = hip.y - legLen * RIG.walkHeight + hipY * px + fy;
      const [t1, t2] = rig.legIK(thigh, shin, hip.x + fx + RIG.footForward * px, ty);
      out[thigh] = t1;
      out[shin] = t2;
      if (rig.has(foot)) out[foot] = footAngle - t1 - t2;
    }
    return out;
  }

  /** Editor: show walk key `i` (0..3) as it appears in the cycle. */
  previewWalk(i: number): void {
    const c = i / 8;
    const w = walkPose(c);
    const p: Pose = { ...STAND, ...w, ...this.walkLegs(c, w.hipY ?? 0) };
    this.rig.pose(p);
    this.rig.plantFeet();
  }

  update(s: PhachState, dt: number): void {
    this.strikeT = Math.max(0, this.strikeT - dt);
    this.counterT = Math.max(0, this.counterT - dt);
    this.walkBlend += ((s.walking ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 8);

    // Base: guard stance; walking blends in the walk keys (upper body) and IK legs.
    const beatPhase = (s.beat % 1) * Math.PI * 2;
    let p: Pose = { ...STAND };
    const b = this.walkBlend;
    let walkFeet: Pose = {};
    if (b > 0.001) {
      const c = s.x / (2 * this.stepUnits());
      const w = walkPose(c);
      const legs = this.walkLegs(c, w.hipY ?? 0);
      walkFeet = legs;
      for (const [k, v] of Object.entries({ ...w, ...legs })) {
        if (k === 'hipY' || k.startsWith('foot')) continue;
        p[k] = (p[k] ?? 0) + (v - (p[k] ?? 0)) * b;
      }
    }
    p.torso += Math.sin(beatPhase) * RIG.breathe * (1 - b);
    p.scarf += Math.sin(beatPhase + 1) * RIG.scarfFlutter * 0.4;

    // Press reactions, strongest wins.
    if (this.strikeT > 0) {
      const t = 1 - this.strikeT / RIG.strikeSec;
      p = t < RIG.strikeSnap
        ? mix(WINDUP, SLASH, ease(t / RIG.strikeSnap))
        : mix(SLASH, p, ease((t - RIG.strikeSnap) / (1 - RIG.strikeSnap)));
    }
    if (this.counterT > 0) {
      const t = 1 - this.counterT / RIG.counterSec;
      p = t < 0.2 ? mix(p, THRUST, ease(t / 0.2)) : mix(THRUST, p, ease((t - 0.2) / 0.8));
    }
    if (s.lunge > 0) p = mix(p, THRUST, Math.min(1, s.lunge * 1.5));
    if (s.jump > 0) p = mix(p, TUCK, Math.sin(s.jump * Math.PI));
    if (s.hurt > 0) p = mix(p, HURT, s.hurt);

    // Feet (foot pieces only): flat on the ground when standing, the walk's heel-toe roll when walking,
    // toes pointing down in the air.
    for (const [thigh, shin, foot] of LEGS) {
      if (!this.rig.has(foot)) continue;
      const flat = -(p[thigh] ?? 0) - (p[shin] ?? 0) - (p.hips ?? 0);
      if (s.jump > 0) {
        p[foot] = -0.35;
        continue;
      }
      // keep the walk's roll (relative to flat) as the walk fades in/out
      const roll = walkFeet[foot] !== undefined ? walkFeet[foot] + (walkFeet[thigh] ?? 0) + (walkFeet[shin] ?? 0) : 0;
      p[foot] = flat + roll * b;
    }

    this.applyLag(p, dt);
    this.rig.pose(p);
    if (s.jump <= 0) this.rig.plantFeet();
  }

  /** Secondary motion: lagging parts chase their target angle on a damped spring (cosmetic, frame dt). */
  private applyLag(p: Pose, dt: number): void {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = Math.min(dt, 0.1) / steps;
    for (const [bone, looseness] of Object.entries(LAG)) {
      const target = p[bone];
      if (target === undefined) continue;
      let st = this.lag.get(bone);
      if (!st) {
        st = { a: target, v: 0 };
        this.lag.set(bone, st);
      }
      if (h <= 0) {
        p[bone] = st.a;
        continue;
      }
      const w = 2 * Math.PI * RIG.lagHz * looseness;
      const z = RIG.lagDamp;
      for (let i = 0; i < steps; i++) {
        st.v += (w * w * (target - st.a) - 2 * z * w * st.v) * h;
        st.a += st.v * h;
      }
      p[bone] = st.a;
    }
  }
}
