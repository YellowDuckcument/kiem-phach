import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadBeatmap, type Beatmap } from '../src/rhythm/Beatmap';
import { Judge, type Grade, type JudgeEvents } from '../src/rhythm/Judge';
import { RULES, WINDOW } from '../src/rhythm/constants';

// 60 BPM: one beat = one second, so beat N is at song time N.
function makeMap(notes: unknown[], extra: Record<string, unknown> = {}): Beatmap {
  return loadBeatmap({
    version: 1,
    id: 't',
    title: 't',
    chapter: 1,
    difficulty: 'thuong',
    audio: { stems: {}, tempo: [{ beat: 0, bpm: 60 }] },
    enemies: [
      { id: 'e', kind: 'linh', spawnBeat: 0, posture: 4 },
      { id: 'boss', kind: 'tuong', spawnBeat: 0, posture: 6, postureSegments: 3 },
    ],
    notes,
    ...extra,
  });
}

function record(judge: Judge) {
  const log: { type: keyof JudgeEvents; payload: unknown }[] = [];
  const types: (keyof JudgeEvents)[] = [
    'NoteJudged', 'GhostPress', 'HoldCompleted', 'HoldBroken', 'CounterSuccess', 'FinisherSuccess',
    'NotesActivated', 'NotesCancelled', 'PostureChanged', 'PostureBroken', 'ComboChanged', 'RunFailed',
  ];
  for (const t of types) judge.bus.on(t, (payload) => log.push({ type: t, payload }));
  const grades = () =>
    log.filter((e) => e.type === 'NoteJudged').map((e) => {
      const p = e.payload as JudgeEvents['NoteJudged'];
      return `${p.note.id}:${p.grade}`;
    });
  const has = (t: keyof JudgeEvents) => log.some((e) => e.type === t);
  return { log, grades, has };
}

const strike = (id: string, beat: number, enemy = 'e') => ({ id, beat, type: 'strike', enemy });

const down = (judge: Judge, song: number, action: 'strike' | 'jump' | 'counter' = 'strike') =>
  judge.input({ action, kind: 'down', song });
const up = (judge: Judge, song: number) => judge.input({ action: 'strike', kind: 'up', song });

afterEach(() => {
  RULES.ghostPressPenalty = false;
});

describe('Judge windows', () => {
  const cases: [number, Grade][] = [
    [0, 'perfect'],
    [0.039, 'perfect'],
    [-0.039, 'perfect'],
    [0.041, 'good'],
    [-0.041, 'good'],
    [0.089, 'good'],
    [-0.089, 'good'],
  ];
  for (const [offset, grade] of cases) {
    it(`${offset * 1000} ms → ${grade}`, () => {
      const judge = new Judge(makeMap([strike('a', 2)]));
      const r = record(judge);
      down(judge, 2 + offset);
      expect(r.grades()).toEqual([`a:${grade}`]);
    });
  }

  it('±91 ms is a ghost press, then the note times out as Trượt', () => {
    for (const offset of [0.091, -0.091]) {
      const judge = new Judge(makeMap([strike('a', 2)]));
      const r = record(judge);
      down(judge, 2 + offset);
      expect(r.has('GhostPress')).toBe(true);
      judge.advance(3);
      expect(r.grades()).toEqual(['a:miss']);
    }
  });

  it('reads WINDOW live, so the debug panel can tune it', () => {
    const old = WINDOW.perfect;
    WINDOW.perfect = 0.06;
    try {
      const judge = new Judge(makeMap([strike('a', 2)]));
      const r = record(judge);
      down(judge, 2.05);
      expect(r.grades()).toEqual(['a:perfect']);
    } finally {
      WINDOW.perfect = old;
    }
  });
});

describe('Judge matching', () => {
  it('an input goes to the nearest of two close notes', () => {
    const judge = new Judge(makeMap([strike('a', 2), strike('b', 2.1)]));
    const r = record(judge);
    down(judge, 2.07); // 70 ms after a, 30 ms before b
    expect(r.grades()).toEqual(['b:perfect']);
    judge.advance(2.2);
    expect(r.grades()).toEqual(['b:perfect', 'a:miss']);
  });

  it('ignores inputs of the wrong action', () => {
    const judge = new Judge(makeMap([strike('a', 2)]));
    const r = record(judge);
    down(judge, 2, 'jump');
    expect(r.grades()).toEqual([]);
    expect(r.has('GhostPress')).toBe(true);
  });

  it('ghost press changes nothing by default', () => {
    const judge = new Judge(makeMap([strike('a', 2), strike('b', 4)]));
    down(judge, 2);
    down(judge, 3);
    expect(judge.stats).toMatchObject({ combo: 1, miss: 0, consecutiveMisses: 0 });
  });

  it('ghost press counts as Trượt when the penalty is on', () => {
    RULES.ghostPressPenalty = true;
    const judge = new Judge(makeMap([strike('a', 2), strike('b', 4)]));
    down(judge, 2);
    down(judge, 3);
    expect(judge.stats).toMatchObject({ combo: 0, miss: 1, consecutiveMisses: 1 });
  });

  it('a note is judged only once', () => {
    const judge = new Judge(makeMap([strike('a', 2)]));
    const r = record(judge);
    down(judge, 2);
    down(judge, 2.01);
    judge.advance(5);
    expect(r.grades()).toEqual(['a:perfect']);
  });
});

describe('Judge hold', () => {
  const holdMap = () => makeMap([{ id: 'h', beat: 2, type: 'hold', lengthBeats: 2, enemy: 'e' }]);

  it('early release breaks the hold and gives no Khí thế', () => {
    const judge = new Judge(holdMap());
    const r = record(judge);
    down(judge, 2);
    up(judge, 3);
    expect(r.has('HoldBroken')).toBe(true);
    expect(judge.stats.consecutiveMisses).toBe(1);
    expect(judge.postureOf('e')!.value).toBe(0);
  });

  it('release inside the end window succeeds', () => {
    const judge = new Judge(holdMap());
    const r = record(judge);
    down(judge, 2.01);
    up(judge, 4 - 0.08);
    expect(r.has('HoldCompleted')).toBe(true);
    expect(r.has('HoldBroken')).toBe(false);
    expect(judge.postureOf('e')!.value).toBe(2);
  });

  it('holding past the end completes on its own', () => {
    const judge = new Judge(holdMap());
    const r = record(judge);
    down(judge, 2.05); // Tốt
    judge.advance(4);
    expect(r.has('HoldCompleted')).toBe(true);
    expect(judge.postureOf('e')!.value).toBe(1);
    expect(judge.finished).toBe(true);
  });
});

describe('Judge counter and finisher', () => {
  const counterMap = () =>
    makeMap(
      [
        { id: 'c', beat: 4, type: 'counter', enemy: 'e', onMiss: [{ id: 'm', beat: 5, type: 'jump', enemy: 'e' }] },
        { id: 'f', beat: 8, type: 'finisher', enemy: 'e' },
      ],
      { events: [{ beat: 4, type: 'silence', lengthBeats: 1 }] },
    );

  it('counter hit cancels onMiss and posture-breaks an ordinary enemy', () => {
    const judge = new Judge(counterMap());
    const r = record(judge);
    down(judge, 4, 'counter');
    expect(r.has('CounterSuccess')).toBe(true);
    expect(r.has('NotesCancelled')).toBe(true);
    expect(r.has('PostureBroken')).toBe(true);
    judge.advance(6);
    expect(judge.statusOf('m')).toBe('cancelled');
    expect(r.grades()).toEqual(['c:perfect']);
  });

  it('counter miss activates onMiss notes', () => {
    const judge = new Judge(counterMap());
    const r = record(judge);
    judge.advance(4.5);
    expect(r.grades()).toEqual(['c:miss']);
    expect(r.has('NotesActivated')).toBe(true);
    down(judge, 5, 'jump');
    expect(r.grades()).toEqual(['c:miss', 'm:perfect']);
  });

  it('finisher wakes after a posture break and can be hit', () => {
    const judge = new Judge(counterMap());
    const r = record(judge);
    down(judge, 4, 'counter');
    down(judge, 8.02, 'counter');
    expect(r.has('FinisherSuccess')).toBe(true);
    expect(judge.finished).toBe(true);
  });

  it('finisher stays dormant without a posture break and is never a miss', () => {
    const judge = new Judge(counterMap());
    const r = record(judge);
    judge.advance(4.5); // counter missed
    down(judge, 5, 'jump');
    down(judge, 8, 'counter');
    judge.advance(10);
    expect(judge.statusOf('f')).toBe('dormant');
    expect(r.grades()).toEqual(['c:miss', 'm:perfect']);
    expect(r.has('FinisherSuccess')).toBe(false);
    expect(judge.finished).toBe(true);
  });

  it('counter on a boss fills one posture segment', () => {
    const judge = new Judge(
      makeMap(
        [strike('s', 2, 'boss'), { id: 'c', beat: 4, type: 'counter', enemy: 'boss' }],
        { events: [{ beat: 4, type: 'silence' }] },
      ),
    );
    down(judge, 2.05); // Tốt: +1 → 1/6
    down(judge, 4, 'counter'); // next segment boundary: 2/6
    expect(judge.postureOf('boss')).toMatchObject({ value: 2, broken: false });
  });
});

describe('Judge Khí thế, combo and fail', () => {
  it('Tuyệt kỹ +2, Tốt +1, break at max', () => {
    const judge = new Judge(makeMap([strike('a', 1), strike('b', 2), strike('c', 3)]));
    const r = record(judge);
    down(judge, 1);
    down(judge, 2.05);
    expect(judge.postureOf('e')!.value).toBe(3);
    down(judge, 3.01);
    expect(judge.postureOf('e')).toMatchObject({ value: 4, broken: true });
    expect(r.has('PostureBroken')).toBe(true);
  });

  it('jump gives no Khí thế', () => {
    const judge = new Judge(makeMap([{ id: 'j', beat: 2, type: 'jump', enemy: 'e' }]));
    down(judge, 2, 'jump');
    expect(judge.postureOf('e')!.value).toBe(0);
    expect(judge.stats.combo).toBe(1);
  });

  it('3 consecutive misses → RunFailed', () => {
    const judge = new Judge(makeMap([strike('a', 1), strike('b', 2), strike('c', 3), strike('d', 4)]));
    const r = record(judge);
    judge.advance(3.5);
    expect(r.has('RunFailed')).toBe(true);
    expect(judge.stats.failed).toBe(true);
    down(judge, 4);
    expect(r.grades()).toEqual(['a:miss', 'b:miss', 'c:miss']);
    expect(judge.rank()).toBeNull();
  });

  it('a hit in between resets the miss count', () => {
    const judge = new Judge(
      makeMap([strike('a', 1), strike('b', 2), strike('c', 3), strike('d', 4), strike('e2', 5)]),
    );
    judge.advance(2.5);
    down(judge, 3);
    judge.advance(5.5);
    expect(judge.stats).toMatchObject({ failed: false, consecutiveMisses: 2, maxCombo: 1 });
  });

  it('reset() restarts instantly', () => {
    const judge = new Judge(makeMap([strike('a', 1), strike('b', 2), strike('c', 3)]));
    judge.advance(10);
    expect(judge.stats.failed).toBe(true);
    judge.reset();
    expect(judge.stats).toMatchObject({ failed: false, miss: 0, combo: 0 });
    down(judge, 1);
    expect(judge.stats.perfect).toBe(1);
  });
});

describe('Judge Thính phong (rate 0.75)', () => {
  it('keeps the same real-time windows', () => {
    // At rate 0.75 one real second covers 0.75 song seconds.
    const judge = new Judge(makeMap([strike('a', 2), strike('b', 4), strike('c', 6)]));
    judge.rate = 0.75;
    const r = record(judge);
    down(judge, 2 + 0.039 * 0.75);
    down(judge, 4 + 0.089 * 0.75);
    down(judge, 6 + 0.095 * 0.75);
    expect(r.grades()).toEqual(['a:perfect', 'b:good', 'c:miss']);
  });
});

describe('Judge rank', () => {
  it('Thần needs 90 % Tuyệt kỹ and no Trượt; assist caps at Kiện', () => {
    const notes = Array.from({ length: 10 }, (_, i) => strike(`n${i}`, i + 1));
    const judge = new Judge(makeMap(notes));
    for (let i = 1; i <= 10; i++) down(judge, i);
    expect(judge.rank()).toBe('than');
    expect(judge.rank(true)).toBe('kien');
  });

  it('lower ratios give Kiện / Dũng / Tập', () => {
    const notes = Array.from({ length: 10 }, (_, i) => strike(`n${i}`, i + 1));
    const play = (perfects: number) => {
      const judge = new Judge(makeMap(notes));
      for (let i = 1; i <= 10; i++) down(judge, i + (i <= perfects ? 0 : 0.06));
      return judge.rank();
    };
    expect(play(8)).toBe('kien');
    expect(play(5)).toBe('dung');
    expect(play(2)).toBe('tap');
  });
});

describe('Demo boss', () => {
  const demo = () => loadBeatmap(JSON.parse(readFileSync('public/levels/demo.json', 'utf8')));
  const actionOf = { strike: 'strike', hold: 'strike', jump: 'jump', counter: 'counter', finisher: 'counter' } as const;

  /** Bot: hits every active note at `offset` seconds, holds through holds. */
  function play(offset: number) {
    const map = demo();
    const judge = new Judge(map);
    /** For each broken enemy: the last note judged when it broke. */
    const brokenAt = new Map<string, string>();
    let lastJudged = '';
    judge.bus.on('NoteJudged', ({ note }) => (lastJudged = note.id));
    judge.bus.on('PostureBroken', ({ enemyId }) => brokenAt.set(enemyId, lastJudged));
    for (const n of map.notes) {
      if (judge.statusOf(n.id) !== 'pending') {
        judge.advance(n.timeSong - 0.2);
        if (judge.statusOf(n.id) !== 'pending') continue;
      }
      judge.input({ action: actionOf[n.type], kind: 'down', song: n.timeSong + offset });
      if (n.type === 'hold') judge.input({ action: 'strike', kind: 'up', song: n.endSong! });
    }
    judge.advance(999);
    return { judge, brokenAt };
  }

  it('perfect play breaks the boss at its first counter and lands the finisher', () => {
    const { judge, brokenAt } = play(0);
    expect(brokenAt.get('boss')).toBe('b9');
    expect(judge.statusOf('b16')).toBe('judged');
    expect(judge.rank()).toBe('than');
  });

  it('all-Tốt play needs the second counter to break the boss', () => {
    const { judge, brokenAt } = play(0.06);
    expect(brokenAt.get('boss')).toBe('b15');
    expect(judge.statusOf('b16')).toBe('judged');
  });
});
