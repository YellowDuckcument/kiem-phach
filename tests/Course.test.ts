import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COURSE, Course } from '../src/combat/Course';
import { loadBeatmap } from '../src/rhythm/Beatmap';

const map = (enemies: unknown[], notes: unknown[]) =>
  loadBeatmap({
    version: 1,
    id: 't',
    title: 't',
    chapter: 1,
    difficulty: 'thuong',
    audio: { stems: {}, tempo: [{ beat: 0, bpm: 60 }] },
    enemies,
    notes,
  });

describe('Course', () => {
  const m = map(
    [
      { id: 'a', kind: 'k', spawnBeat: 4, posture: 4 },
      { id: 'b', kind: 'k', spawnBeat: 12, posture: 4 },
    ],
    [
      { id: 'n1', beat: 6, type: 'strike', enemy: 'a' },
      { id: 'n2', beat: 8, type: 'strike', enemy: 'a' },
      { id: 'n3', beat: 14, type: 'strike', enemy: 'b', telegraphBeats: 3 },
    ],
  );

  it('stops from spawnBeat (or first wind-up) to exitBeats after the last note', () => {
    const c = new Course(m);
    expect(c.stops).toEqual([
      { start: 4, end: 8 + COURSE.exitBeats, enemyIds: ['a'] },
      { start: 11, end: 14 + COURSE.exitBeats, enemyIds: ['b'] },
    ]);
  });

  it('walks between stops and stands still inside them', () => {
    const c = new Course(m);
    const u = COURSE.walkUnits;
    expect(c.xAt(0)).toBe(0);
    expect(c.xAt(2)).toBe(2 * u);
    expect(c.xAt(4)).toBe(4 * u);
    expect(c.xAt(6)).toBe(4 * u); // stopped
    expect(c.xAt(9)).toBe(4 * u);
    expect(c.xAt(10)).toBe(5 * u); // walking again
    expect(c.xAt(13)).toBe(6 * u); // second stop starts at 11
    expect(c.stopAt(6)?.enemyIds).toEqual(['a']);
    expect(c.stopAt(10)).toBeUndefined();
  });

  it('places the enemy a standoff ahead of where Phách stops', () => {
    const c = new Course(m);
    expect(c.enemyX('a')).toBe(c.xAt(4) + COURSE.standoff);
  });

  it('merges overlapping encounters', () => {
    const c = new Course(
      map(
        [
          { id: 'a', kind: 'k', spawnBeat: 2, posture: 4 },
          { id: 'b', kind: 'k', spawnBeat: 3, posture: 4 },
        ],
        [
          { id: 'n1', beat: 4, type: 'strike', enemy: 'a' },
          { id: 'n2', beat: 6, type: 'strike', enemy: 'b' },
        ],
      ),
    );
    expect(c.stops).toHaveLength(1);
    expect(c.stops[0]!.enemyIds).toEqual(['a', 'b']);
    expect(c.enemyX('b') - c.enemyX('a')).toBeCloseTo(COURSE.enemyGap);
  });

  it('demo level: every enemy gets an encounter', () => {
    const c = new Course(loadBeatmap(JSON.parse(readFileSync('public/levels/demo.json', 'utf8'))));
    expect(c.stops.flatMap((s) => s.enemyIds)).toEqual(['e1', 'e2', 'boss']);
  });
});
