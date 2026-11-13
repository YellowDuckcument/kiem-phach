import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BeatmapError, loadBeatmap } from '../src/rhythm/Beatmap';

const demo = () => JSON.parse(readFileSync('public/levels/demo.json', 'utf8'));

describe('loadBeatmap', () => {
  it('loads the demo level and precomputes song times', () => {
    const map = loadBeatmap(demo());
    expect(map.notes.length).toBe(14);
    const n1 = map.notes.find((n) => n.id === 'n1')!;
    expect(n1.timeSong).toBeCloseTo(8 * 0.6);
    const hold = map.notes.find((n) => n.id === 'n6')!;
    expect(hold.endSong).toBeCloseTo(18 * 0.6);
  });

  it('marks onMiss notes as inactive at start', () => {
    const map = loadBeatmap(demo());
    const child = map.notes.find((n) => n.id === 'n12m')!;
    expect(child.activeAtStart).toBe(false);
    expect(child.parentId).toBe('n12');
  });

  it('sorts notes by time', () => {
    const t = loadBeatmap(demo()).notes.map((n) => n.timeSong);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });

  it('rejects unknown enemies', () => {
    const d = demo();
    d.notes[0].enemy = 'ghost';
    expect(() => loadBeatmap(d)).toThrow(BeatmapError);
  });

  it('rejects a counter that is not on a silence event', () => {
    const d = demo();
    d.events = d.events.filter((e: { type: string }) => e.type !== 'silence');
    expect(() => loadBeatmap(d)).toThrow(/silence/);
  });

  it('rejects a hold without length', () => {
    const d = demo();
    delete d.notes.find((n: { id: string }) => n.id === 'n6').lengthBeats;
    expect(() => loadBeatmap(d)).toThrow(/lengthBeats/);
  });

  it('rejects invalid schema with readable messages', () => {
    expect(() => loadBeatmap({ version: 2 })).toThrow(/Invalid beatmap/);
  });
});
