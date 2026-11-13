import { EventBus } from '../core/EventBus';
import type { Action } from '../input/Input';
import type { Beatmap, TimedNote } from './Beatmap';
import { KHI_THE, RANK, RULES, WINDOW } from './constants';

// Pure judgement: notes + timestamped inputs in, events out. No DOM, audio or rendering.
// Rules: .claude/skills/kiem-phach-rhythm/references/judgement.md

export type Grade = 'perfect' | 'good' | 'miss';
export type Rank = 'than' | 'kien' | 'dung' | 'tap';

/** An input already mapped to song time (SongClock.inputSong). */
export interface JudgeInput {
  action: Action;
  kind: 'down' | 'up';
  song: number;
}

export interface JudgeEvents extends Record<string, unknown> {
  NoteJudged: { note: TimedNote; grade: Grade; /** real-time error, null for a timeout miss */ errMs: number | null };
  GhostPress: { action: Action; song: number };
  HoldCompleted: { note: TimedNote };
  HoldBroken: { note: TimedNote; song: number };
  CounterSuccess: { note: TimedNote; enemyId?: string };
  FinisherSuccess: { note: TimedNote; enemyId?: string };
  NotesActivated: { notes: TimedNote[] };
  NotesCancelled: { notes: TimedNote[] };
  PostureChanged: { enemyId: string; value: number; max: number };
  PostureBroken: { enemyId: string };
  ComboChanged: { combo: number };
  RunFailed: { song: number };
}

const ACTION_FOR: Record<TimedNote['type'], Action> = {
  strike: 'strike',
  hold: 'strike',
  jump: 'jump',
  counter: 'counter',
  finisher: 'counter',
};

type Status = 'inactive' | 'pending' | 'judged' | 'cancelled' | 'dormant';

interface PostureState {
  value: number;
  max: number;
  segments?: number;
  broken: boolean;
}

export interface JudgeStats {
  perfect: number;
  good: number;
  /** Trượt, including broken holds and a counted ghost press. */
  miss: number;
  combo: number;
  maxCombo: number;
  consecutiveMisses: number;
  failed: boolean;
}

export class Judge {
  readonly bus: EventBus<JudgeEvents>;
  /** Set by Tâm pháp Hồi âm (x2). */
  khiTheMultiplier = 1;
  /** Current playback rate (Thính phong). Windows stay in real time. */
  rate = 1;

  private status = new Map<string, Status>();
  private woken = new Set<string>();
  private children = new Map<string, TimedNote[]>();
  private posture = new Map<string, PostureState>();
  private hold: { note: TimedNote; grade: Grade } | null = null;
  private cursor = 0;
  private s!: JudgeStats;

  constructor(
    private readonly map: Beatmap,
    bus?: EventBus<JudgeEvents>,
  ) {
    this.bus = bus ?? new EventBus<JudgeEvents>();
    for (const n of map.notes) {
      if (!n.parentId) continue;
      const list = this.children.get(n.parentId) ?? [];
      list.push(n);
      this.children.set(n.parentId, list);
    }
    this.reset();
  }

  /** Instant restart: no reload, no allocation of notes. */
  reset(): void {
    this.status.clear();
    this.woken.clear();
    for (const n of this.map.notes) this.status.set(n.id, n.activeAtStart ? 'pending' : 'inactive');
    this.posture.clear();
    for (const e of this.map.data.enemies) {
      this.posture.set(e.id, { value: 0, max: e.posture, segments: e.postureSegments, broken: false });
    }
    this.hold = null;
    this.cursor = 0;
    this.rate = 1;
    this.khiTheMultiplier = 1;
    this.s = { perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0, consecutiveMisses: 0, failed: false };
  }

  get stats(): Readonly<JudgeStats> {
    return this.s;
  }

  get holding(): TimedNote | null {
    return this.hold?.note ?? null;
  }

  postureOf(enemyId: string): Readonly<PostureState> | undefined {
    return this.posture.get(enemyId);
  }

  statusOf(noteId: string): Status | undefined {
    return this.status.get(noteId);
  }

  /** Every note resolved and no hold in progress. */
  get finished(): boolean {
    return this.cursor >= this.map.notes.length && !this.hold;
  }

  /** Feed one input. Inputs must arrive in timestamp order. */
  input(ev: JudgeInput): void {
    if (this.s.failed) return;
    this.advance(ev.song);
    if (this.s.failed) return;

    if (ev.kind === 'up') {
      if (ev.action === 'strike' && this.hold) {
        const { note } = this.hold;
        if (ev.song >= note.endSong! - WINDOW.good * this.rate) this.completeHold();
        else this.breakHold(ev.song);
      }
      return;
    }

    let best: TimedNote | null = null;
    let bestErr = Infinity;
    for (let i = this.cursor; i < this.map.notes.length; i++) {
      const n = this.map.notes[i]!;
      const err = (ev.song - n.timeSong) / this.rate;
      if (err < -WINDOW.good) break; // sorted: every later note is further away
      if (!this.isJudgeable(n) || ACTION_FOR[n.type] !== ev.action) continue;
      if (Math.abs(err) <= WINDOW.good && Math.abs(err) < Math.abs(bestErr)) {
        best = n;
        bestErr = err;
      }
    }

    if (!best) {
      this.bus.emit('GhostPress', { action: ev.action, song: ev.song });
      if (RULES.ghostPressPenalty) this.registerMiss(ev.song);
      return;
    }
    this.hit(best, Math.abs(bestErr) <= WINDOW.perfect ? 'perfect' : 'good', bestErr * 1000);
    this.skipResolved();
  }

  /** Resolve timeouts up to heard song time `song`. Call every frame and before each input. */
  advance(song: number): void {
    if (this.s.failed) return;
    const late = WINDOW.good * this.rate;
    for (let i = this.cursor; i < this.map.notes.length; i++) {
      const n = this.map.notes[i]!;
      if (n.timeSong - late > song) break;
      if (n.type === 'finisher' && this.status.get(n.id) === 'pending' && !this.woken.has(n.id)) {
        if (n.enemy && this.posture.get(n.enemy)?.broken) this.woken.add(n.id);
        else this.status.set(n.id, 'dormant');
      }
      if (this.status.get(n.id) === 'pending' && song > n.timeSong + late) {
        this.missNote(n, song);
        if (this.s.failed) return;
      }
    }
    this.skipResolved();
    // An inactive onMiss note whose parent never activated it would block the cursor: retire it
    // once its window has passed.
    while (this.cursor < this.map.notes.length) {
      const n = this.map.notes[this.cursor]!;
      if (this.status.get(n.id) !== 'inactive' || song <= n.timeSong + late) break;
      this.status.set(n.id, 'cancelled');
      this.skipResolved();
    }
    if (this.hold && song >= this.hold.note.endSong!) this.completeHold();
  }

  private skipResolved(): void {
    while (this.cursor < this.map.notes.length) {
      const st = this.status.get(this.map.notes[this.cursor]!.id);
      if (st === 'pending' || st === 'inactive') break;
      this.cursor++;
    }
  }

  /** Rank at the end of a cleared level; null if the run failed. */
  rank(usedAssist = false): Rank | null {
    if (this.s.failed) return null;
    const total = this.s.perfect + this.s.good + this.s.miss;
    const ratio = total === 0 ? 0 : this.s.perfect / total;
    let r: Rank = 'tap';
    if (ratio >= RANK.than && this.s.miss === 0) r = 'than';
    else if (ratio >= RANK.kien) r = 'kien';
    else if (ratio >= RANK.dung) r = 'dung';
    if (usedAssist && r === 'than') r = 'kien';
    return r;
  }

  private isJudgeable(n: TimedNote): boolean {
    if (this.status.get(n.id) !== 'pending') return false;
    return n.type !== 'finisher' || this.woken.has(n.id);
  }

  private hit(note: TimedNote, grade: Grade, errMs: number): void {
    this.status.set(note.id, 'judged');
    if (grade === 'perfect') this.s.perfect++;
    else this.s.good++;
    this.s.combo++;
    this.s.maxCombo = Math.max(this.s.maxCombo, this.s.combo);
    this.s.consecutiveMisses = 0;
    this.bus.emit('NoteJudged', { note, grade, errMs });
    this.bus.emit('ComboChanged', { combo: this.s.combo });

    switch (note.type) {
      case 'strike':
        this.addPosture(note.enemy, grade === 'perfect' ? KHI_THE.perfect : KHI_THE.good);
        break;
      case 'hold':
        this.hold = { note, grade };
        break;
      case 'jump':
        break;
      case 'counter': {
        this.bus.emit('CounterSuccess', { note, enemyId: note.enemy });
        const kids = (this.children.get(note.id) ?? []).filter((c) => this.status.get(c.id) === 'inactive');
        for (const c of kids) this.status.set(c.id, 'cancelled');
        if (kids.length) this.bus.emit('NotesCancelled', { notes: kids });
        this.counterPosture(note.enemy);
        break;
      }
      case 'finisher':
        this.bus.emit('FinisherSuccess', { note, enemyId: note.enemy });
        break;
    }
  }

  private missNote(note: TimedNote, song: number): void {
    this.status.set(note.id, 'judged');
    this.bus.emit('NoteJudged', { note, grade: 'miss', errMs: null });
    if (note.type === 'counter') {
      const kids = (this.children.get(note.id) ?? []).filter((c) => this.status.get(c.id) === 'inactive');
      for (const c of kids) this.status.set(c.id, 'pending');
      if (kids.length) this.bus.emit('NotesActivated', { notes: kids });
    }
    this.registerMiss(song);
  }

  private registerMiss(song: number): void {
    this.s.miss++;
    this.s.consecutiveMisses++;
    if (this.s.combo !== 0) {
      this.s.combo = 0;
      this.bus.emit('ComboChanged', { combo: 0 });
    }
    if (this.s.consecutiveMisses >= RULES.failAfterMisses) {
      this.s.failed = true;
      this.hold = null;
      this.bus.emit('RunFailed', { song });
    }
  }

  private completeHold(): void {
    const { note, grade } = this.hold!;
    this.hold = null;
    this.addPosture(note.enemy, grade === 'perfect' ? KHI_THE.perfect : KHI_THE.good);
    this.bus.emit('HoldCompleted', { note });
  }

  private breakHold(song: number): void {
    const { note } = this.hold!;
    this.hold = null;
    this.bus.emit('HoldBroken', { note, song });
    this.registerMiss(song);
  }

  private addPosture(enemyId: string | undefined, amount: number): void {
    const p = enemyId ? this.posture.get(enemyId) : undefined;
    if (!p || p.broken) return;
    this.setPosture(enemyId!, p, p.value + amount * this.khiTheMultiplier);
  }

  /** Ordinary enemy: broken at once. Boss (postureSegments): fill up to the next segment. */
  private counterPosture(enemyId: string | undefined): void {
    const p = enemyId ? this.posture.get(enemyId) : undefined;
    if (!p || p.broken) return;
    if (!p.segments) return this.setPosture(enemyId!, p, p.max);
    const seg = p.max / p.segments;
    this.setPosture(enemyId!, p, (Math.floor(p.value / seg + 1e-9) + 1) * seg);
  }

  private setPosture(enemyId: string, p: PostureState, value: number): void {
    p.value = Math.min(p.max, value);
    this.bus.emit('PostureChanged', { enemyId, value: p.value, max: p.max });
    if (p.value >= p.max) {
      p.broken = true;
      this.bus.emit('PostureBroken', { enemyId });
    }
  }
}
