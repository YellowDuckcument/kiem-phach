import type { Beatmap } from '../rhythm/Beatmap';

// The level's path, as a pure function of the beat (so it stays locked to the music):
// Phách walks at a constant pace between fights and stands still while an encounter lasts.
// An encounter runs from the enemy's spawnBeat (or its first wind-up, if earlier) to one beat
// after its last note.

/** Tunables. Read live, so the debug panel can change them. */
export const COURSE = {
  /** World X per walking beat. */
  walkUnits: 1.6,
  /** Distance from Phách to an enemy waiting in an encounter. */
  standoff: 4.5,
  /** Extra gap between enemies that share one encounter. */
  enemyGap: 1.8,
  /** Beats Phách keeps standing after the last note of an encounter. */
  exitBeats: 1,
};

export interface Stop {
  start: number;
  end: number;
  enemyIds: string[];
}

export class Course {
  /** Encounters, sorted and merged when they overlap. */
  readonly stops: Stop[] = [];
  private readonly stopOf = new Map<string, Stop>();

  constructor(map: Beatmap) {
    const raw: Stop[] = [];
    for (const e of map.data.enemies) {
      const notes = map.notes.filter((n) => n.enemy === e.id);
      if (notes.length === 0) continue;
      const first = Math.min(...notes.map((n) => n.beat - n.telegraphBeats));
      const last = Math.max(...notes.map((n) => n.beat + (n.lengthBeats ?? 0)));
      raw.push({ start: Math.min(e.spawnBeat, first), end: last + COURSE.exitBeats, enemyIds: [e.id] });
    }
    raw.sort((a, b) => a.start - b.start);
    for (const s of raw) {
      const prev = this.stops[this.stops.length - 1];
      if (prev && s.start <= prev.end) {
        prev.end = Math.max(prev.end, s.end);
        prev.enemyIds.push(...s.enemyIds);
      } else {
        this.stops.push({ ...s, enemyIds: [...s.enemyIds] });
      }
    }
    for (const s of this.stops) for (const id of s.enemyIds) this.stopOf.set(id, s);
  }

  /** Beats spent walking from beat 0 up to `beat`. */
  walkedBeats(beat: number): number {
    if (beat <= 0) return 0;
    let stopped = 0;
    for (const s of this.stops) {
      if (beat <= s.start) break;
      stopped += Math.min(beat, s.end) - s.start;
    }
    return beat - stopped;
  }

  /** Phách's world X at a beat. */
  xAt(beat: number): number {
    return this.walkedBeats(beat) * COURSE.walkUnits;
  }

  stopAt(beat: number): Stop | undefined {
    return this.stops.find((s) => beat >= s.start && beat < s.end);
  }

  stopOfEnemy(enemyId: string): Stop | undefined {
    return this.stopOf.get(enemyId);
  }

  /** Where an enemy waits during its encounter. */
  enemyX(enemyId: string): number {
    const s = this.stopOf.get(enemyId);
    if (!s) return 0;
    return this.xAt(s.start) + COURSE.standoff + s.enemyIds.indexOf(enemyId) * COURSE.enemyGap;
  }
}
