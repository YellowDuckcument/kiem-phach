import { z } from 'zod';
import { TempoMap } from './TempoMap';

// Schema: .claude/skills/kiem-phach-rhythm/references/beatmap-schema.md

const NoteType = z.enum(['strike', 'hold', 'jump', 'counter', 'finisher']);

const BaseNote = z.object({
  id: z.string().min(1),
  beat: z.number(),
  type: NoteType,
  enemy: z.string().optional(),
  lengthBeats: z.number().positive().optional(),
  telegraphBeats: z.number().min(1).default(1),
});

type NoteInput = z.input<typeof BaseNote> & { onMiss?: NoteInput[] };
type NoteOutput = z.output<typeof BaseNote> & { onMiss?: NoteOutput[] };

const Note: z.ZodType<NoteOutput, z.ZodTypeDef, NoteInput> = BaseNote.extend({
  onMiss: z.lazy(() => z.array(Note)).optional(),
});

export const BeatmapSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  chapter: z.number().int().min(1),
  difficulty: z.enum(['thuong', 'kho', 'ma-dao']),
  audio: z.object({
    stems: z.record(z.string()),
    offsetSec: z.number().default(0),
    beatsPerBar: z.number().int().positive().default(4),
    tempo: z.array(z.object({ beat: z.number(), bpm: z.number().positive() })).min(1),
    parryPitch: z.string().optional(),
  }),
  sections: z.array(z.object({ name: z.string(), beat: z.number() })).default([]),
  enemies: z
    .array(
      z.object({
        id: z.string(),
        kind: z.string(),
        spawnBeat: z.number(),
        posture: z.number().int().positive(),
        postureSegments: z.number().int().positive().optional(),
      }),
    )
    .default([]),
  notes: z.array(Note),
  events: z
    .array(
      z.object({
        beat: z.number(),
        type: z.enum(['buildup', 'silence', 'cue']),
        enemy: z.string().optional(),
        lengthBeats: z.number().positive().optional(),
      }),
    )
    .default([]),
});

export type BeatmapData = z.output<typeof BeatmapSchema>;
export type NoteData = NoteOutput;

/** A note with its song time precomputed at load time. */
export interface TimedNote extends Omit<NoteData, 'onMiss'> {
  timeSong: number;
  endSong?: number;
  /** false for notes that only activate when a parent counter is missed. */
  activeAtStart: boolean;
  parentId?: string;
}

export interface Beatmap {
  data: BeatmapData;
  tempo: TempoMap;
  notes: TimedNote[];
}

export class BeatmapError extends Error {}

/** Parse, validate and precompute a beatmap. Throws BeatmapError with readable messages. */
export function loadBeatmap(json: unknown): Beatmap {
  const parsed = BeatmapSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new BeatmapError(`Invalid beatmap:\n${msg}`);
  }
  const data = parsed.data;
  const tempo = new TempoMap(data.audio.tempo, data.audio.offsetSec);
  const enemyIds = new Set(data.enemies.map((e) => e.id));
  const notes: TimedNote[] = [];

  const add = (n: NoteData, activeAtStart: boolean, parentId?: string) => {
    if (n.enemy && !enemyIds.has(n.enemy)) {
      throw new BeatmapError(`Note ${n.id} at beat ${n.beat}: unknown enemy "${n.enemy}"`);
    }
    if (n.type === 'hold' && !n.lengthBeats) {
      throw new BeatmapError(`Hold note ${n.id} at beat ${n.beat} needs lengthBeats`);
    }
    const { onMiss, ...rest } = n;
    notes.push({
      ...rest,
      timeSong: tempo.secondsAtBeat(n.beat),
      endSong: n.lengthBeats ? tempo.secondsAtBeat(n.beat + n.lengthBeats) : undefined,
      activeAtStart,
      parentId,
    });
    for (const child of onMiss ?? []) {
      if (child.beat <= n.beat) {
        throw new BeatmapError(`onMiss note ${child.id} must be later than its parent ${n.id}`);
      }
      add(child, false, n.id);
    }
  };

  for (const n of data.notes) add(n, true);

  const ids = new Set<string>();
  for (const n of notes) {
    if (ids.has(n.id)) throw new BeatmapError(`Duplicate note id ${n.id}`);
    ids.add(n.id);
  }
  for (const n of notes.filter((x) => x.type === 'counter')) {
    const silent = data.events.some(
      (e) => e.type === 'silence' && e.beat <= n.beat && n.beat < e.beat + (e.lengthBeats ?? 1),
    );
    if (!silent) throw new BeatmapError(`Counter ${n.id} at beat ${n.beat} must sit on a silence event`);
  }

  notes.sort((a, b) => a.timeSong - b.timeSong);
  return { data, tempo, notes };
}
