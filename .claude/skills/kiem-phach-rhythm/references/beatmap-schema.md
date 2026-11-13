# Beatmap format

One level = one audio set + one JSON file in `assets/levels/<id>.json`. Positions are in **beats** (floats allowed: 0.5 = eighth note in 4/4).

```jsonc
{
  "version": 1,
  "id": "c1-m1",
  "title": "Làng trống — Hội làng",
  "chapter": 1,
  "difficulty": "thuong",            // "thuong" | "kho" | "ma-dao"
  "audio": {
    "stems": { "drums": "c1-m1/drums.ogg", "music": "c1-m1/music.ogg" },
    "offsetSec": 0.012,               // seconds from file start to beat 0
    "beatsPerBar": 4,
    "tempo": [ { "beat": 0, "bpm": 100 } ],   // add entries for tempo changes (chapter 4 chầu văn speeds up)
    "parryPitch": "D5"
  },
  "sections": [
    { "name": "intro", "beat": 0 },
    { "name": "verse", "beat": 16 },
    { "name": "chorus", "beat": 48 },
    { "name": "break", "beat": 80 },
    { "name": "climax", "beat": 96 }
  ],
  "enemies": [
    { "id": "e1", "kind": "linh-giao", "spawnBeat": 14, "posture": 6 },
    { "id": "boss", "kind": "dai-dao", "spawnBeat": 78, "posture": 10, "postureSegments": 2 }
  ],
  "notes": [
    { "id": "n1", "beat": 16, "type": "strike", "enemy": "e1" },
    { "id": "n2", "beat": 20, "type": "hold", "lengthBeats": 2, "enemy": "e1" },
    { "id": "n3", "beat": 24, "type": "jump", "enemy": "e1" },
    { "id": "n4", "beat": 88, "type": "counter", "enemy": "boss",
      "onMiss": [ { "id": "n4m", "beat": 89, "type": "jump", "enemy": "boss" } ] },
    { "id": "n5", "beat": 127, "type": "finisher", "enemy": "boss" }
  ],
  "events": [
    { "beat": 84, "type": "buildup", "enemy": "boss", "lengthBeats": 4 },
    { "beat": 88, "type": "silence", "lengthBeats": 1 }
  ]
}
```

## Rules

- Every attack note has `telegraphBeats` (default 1, minimum 1): the wind-up starts that many beats before the note. Chapter 1 may use 2.
- `counter` must sit on a beat covered by a `silence` event, and must follow a `buildup` for the same enemy.
- `onMiss` notes must be later than their parent and must not overlap other notes of the same action within `WINDOW.good`.
- Two notes of the same action closer than `2 × WINDOW.good` at the level's max BPM are invalid (unplayable).
- `finisher` notes go on the last beat of a phrase in the climax.

## TempoMap

```ts
// beat → song seconds: integrate the piecewise-constant tempo
secondsAtBeat(b) = offsetSec + Σ over tempo segments (beatsInSegment * 60 / bpm)
beatAtSeconds(s) = inverse, by finding the segment then interpolating linearly
```

Precompute `timeSong` for every note and event at load time. Never recompute per frame.

## Validation

Validate with a `zod` schema at load time *and* in the editor on export. Reject on: unknown type, missing enemy, counter without silence, notes closer than allowed, negative lengths. Error messages name the note id and beat.
