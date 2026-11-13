import { describe, expect, it } from 'vitest';
import { TempoMap } from '../src/rhythm/TempoMap';

describe('TempoMap', () => {
  it('converts beats to seconds at a constant tempo', () => {
    const t = new TempoMap([{ beat: 0, bpm: 120 }]);
    expect(t.secondsAtBeat(0)).toBe(0);
    expect(t.secondsAtBeat(4)).toBeCloseTo(2);
    expect(t.beatAtSeconds(1.5)).toBeCloseTo(3);
  });

  it('applies the audio offset', () => {
    const t = new TempoMap([{ beat: 0, bpm: 60 }], 0.25);
    expect(t.secondsAtBeat(0)).toBeCloseTo(0.25);
    expect(t.beatAtSeconds(1.25)).toBeCloseTo(1);
  });

  it('handles tempo changes (chầu văn speeds up)', () => {
    const t = new TempoMap([
      { beat: 0, bpm: 120 },
      { beat: 8, bpm: 150 },
    ]);
    expect(t.secondsAtBeat(8)).toBeCloseTo(4);
    expect(t.secondsAtBeat(13)).toBeCloseTo(4 + 2);
    expect(t.beatAtSeconds(6)).toBeCloseTo(13);
    expect(t.bpmAtBeat(10)).toBe(150);
  });

  it('round-trips beats and seconds', () => {
    const t = new TempoMap([
      { beat: 0, bpm: 97 },
      { beat: 16, bpm: 133 },
      { beat: 40, bpm: 170 },
    ], 0.012);
    for (const b of [0, 3.5, 16, 22.25, 40, 63.75]) expect(t.beatAtSeconds(t.secondsAtBeat(b))).toBeCloseTo(b, 9);
  });

  it('rejects invalid tempo maps', () => {
    expect(() => new TempoMap([])).toThrow();
    expect(() => new TempoMap([{ beat: 4, bpm: 100 }])).toThrow();
    expect(() => new TempoMap([{ beat: 0, bpm: 0 }])).toThrow();
  });
});
