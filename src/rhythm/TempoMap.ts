export interface TempoPoint {
  beat: number;
  bpm: number;
}

/**
 * Converts beats <-> song seconds for a piecewise-constant tempo.
 * Song seconds are measured from the start of the audio file; beat 0 is at `offsetSec`.
 */
export class TempoMap {
  private readonly points: { beat: number; bpm: number; sec: number }[];

  constructor(tempo: TempoPoint[], private readonly offsetSec = 0) {
    if (tempo.length === 0) throw new Error('TempoMap needs at least one tempo point');
    const sorted = [...tempo].sort((a, b) => a.beat - b.beat);
    if (sorted[0]!.beat !== 0) throw new Error('First tempo point must be at beat 0');
    let sec = offsetSec;
    this.points = sorted.map((p, i) => {
      if (p.bpm <= 0) throw new Error(`Invalid bpm ${p.bpm} at beat ${p.beat}`);
      if (i > 0) {
        const prev = sorted[i - 1]!;
        sec += ((p.beat - prev.beat) * 60) / prev.bpm;
      }
      return { beat: p.beat, bpm: p.bpm, sec };
    });
  }

  /** Song seconds at a given beat (beats before 0 extrapolate with the first tempo). */
  secondsAtBeat(beat: number): number {
    const p = this.segmentForBeat(beat);
    return p.sec + ((beat - p.beat) * 60) / p.bpm;
  }

  /** Beat position at a given song time in seconds. */
  beatAtSeconds(sec: number): number {
    const p = this.segmentForSeconds(sec);
    return p.beat + ((sec - p.sec) * p.bpm) / 60;
  }

  bpmAtBeat(beat: number): number {
    return this.segmentForBeat(beat).bpm;
  }

  get offset(): number {
    return this.offsetSec;
  }

  private segmentForBeat(beat: number) {
    let seg = this.points[0]!;
    for (const p of this.points) if (p.beat <= beat) seg = p;
    return seg;
  }

  private segmentForSeconds(sec: number) {
    let seg = this.points[0]!;
    for (const p of this.points) if (p.sec <= sec) seg = p;
    return seg;
  }
}
