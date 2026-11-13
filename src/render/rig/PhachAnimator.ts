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
  /** Ground covered by one full walk cycle (two steps), world units. */
  strideUnits: 1.6,
  walkSwing: 0.5,
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

export class PhachAnimator {
  private strikeT = 0;
  private counterT = 0;
  private walkBlend = 0;

  constructor(readonly rig: CutoutRig) {}

  strike(): void {
    this.strikeT = RIG.strikeSec;
  }

  counter(): void {
    this.counterT = RIG.counterSec;
  }

  reset(): void {
    this.strikeT = this.counterT = this.walkBlend = 0;
  }

  update(s: PhachState, dt: number): void {
    this.strikeT = Math.max(0, this.strikeT - dt);
    this.counterT = Math.max(0, this.counterT - dt);
    this.walkBlend += ((s.walking ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 10);

    // Base: guard stance, breathing on the beat, walk cycle blended in.
    const beatPhase = (s.beat % 1) * Math.PI * 2;
    let p: Pose = { ...STAND };
    p.torso += Math.sin(beatPhase) * RIG.breathe;
    p.scarf += Math.sin(beatPhase + 1) * RIG.scarfFlutter * 0.4;
    if (this.walkBlend > 0.001) {
      const ph = (s.x / RIG.strideUnits) * Math.PI * 2;
      const w = RIG.walkSwing * this.walkBlend;
      p.thighN += Math.sin(ph) * w;
      p.thighF -= Math.sin(ph) * w;
      p.shinN -= Math.max(0, -Math.cos(ph)) * w * 1.4;
      p.shinF -= Math.max(0, Math.cos(ph)) * w * 1.4;
      p.upperArmF -= Math.sin(ph) * w * 0.6;
      p.torso -= 0.08 * this.walkBlend;
      p.scarf -= 0.3 * this.walkBlend + Math.sin(ph * 2) * RIG.scarfFlutter * this.walkBlend;
    }

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

    this.rig.pose(p);
    if (s.jump <= 0) this.rig.plantFeet();
  }
}
