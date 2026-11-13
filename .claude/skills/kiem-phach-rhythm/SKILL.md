---
name: kiem-phach-rhythm
description: Rhythm core of Kiếm Phách — Web Audio song clock, input timestamps, hit judgement (Tuyệt kỹ / Tốt / Trượt), beatmap JSON, latency calibration, Khí thế posture, Tâm pháp skills, rhythm tests and the beatmap editor. Use for any code or design that touches timing, notes, scoring, music playback or beatmaps in this project.
---

# Kiếm Phách — rhythm core

Kiếm Phách is a side-scrolling rhythm action game: Phách runs left to right, every note is an enemy attack, the player answers on the beat. These rules come from the project GDD. When the GDD and this skill disagree, ask the user; do not invent new numbers.

## Non-negotiable rules

1. **One clock.** All gameplay time is *song time* derived from the Web Audio clock through `SongClock` (see `references/clock-and-input.md`). Never accumulate `dt` from `requestAnimationFrame`, never use `setTimeout`/`setInterval` for musical timing, never read `audioCtx.currentTime` outside `src/audio/` and `src/rhythm/`.
2. **Judge what was heard, at the moment of the press.** Input time = the event's own timestamp (`KeyboardEvent.timeStamp`, `Gamepad.timestamp`), mapped to the audio clock with `getOutputTimestamp()`. Never judge with the frame time at which the event was processed.
3. **The level is locked to the music, in encounters.** Phách walks between fights and stops for each encounter (from the enemy's `spawnBeat` to one beat after its last note). Position is a pure function of the beat: `Course.xAt(beat)` in `src/combat/Course.ts`. During an encounter the enemy waits at a standoff, winds up for `telegraphBeats`, and dashes in so its blade lands exactly on the note's beat; all of this is computed from the beat, never from frame time. (Design change from the user, 2026-11-13: no constant scrolling.)
4. **Beatmaps are authored in beats, not seconds.** A tempo map converts beats ↔ seconds. Schema: `references/beatmap-schema.md`.
5. **Judgement windows are tunable constants in real (heard) time**, defined once in `src/rhythm/constants.ts`. Starting values from the GDD:
   - Tuyệt kỹ (perfect parry): ±40 ms → +2 Khí thế, "keng" SFX, sparks
   - Tốt (good): ±90 ms → +1 Khí thế
   - Trượt (miss): outside ±90 ms → combo lost, Phách is pushed back
   - Fail: 3 consecutive Trượt ends the run; restart must be instant.
6. **Judgement is pure and testable.** `Judge` takes notes + timestamped inputs and returns events. No rendering, audio playback or DOM inside it. Every change to judging ships with Vitest cases (`references/testing-and-tools.md`).
7. **Gameplay reacts to events, never polls the clock for scoring.** `Judge` emits `NoteJudged`, `HoldBroken`, `CounterSuccess`, `PostureBroken`, `RunFailed`, … on an event bus; combat, VFX, UI and audio subscribe.

## Actions and note types

| Action | Keyboard | Gamepad | Note types it answers |
| --- | --- | --- | --- |
| Chém / đỡ (strike/parry) | J | X / □ | `strike`; hold J for `hold` |
| Nhảy (jump) | Space | A / ✕ | `jump` — unblockable "Nguy" attacks: sweeps, shockwaves, floor traps |
| Phản đòn / kết liễu | K | B / ○ | `counter` (the silent beat after a charge-up), `finisher` |
| Tâm pháp (skill) | L | Y / △ | not a note; spends the Tâm gauge |

All bindings are rebindable. Chapter 1 uses only `strike`; each later chapter introduces one more action.

Details of each note type, counters, finishers and Khí thế: `references/judgement.md`.

## Module layout

```
src/audio/   AudioEngine (context, stems, SFX), SongClock
src/rhythm/  constants.ts, TempoMap, Beatmap (load + validate), Judge, Posture, TamPhap, Calibration
src/input/   keyboard + gamepad → timestamped InputEvent { action, kind: 'down'|'up', perfMs }
```

Combat, render and UI import from `src/rhythm/` only through events and read-only getters (`clock.renderSong()`, `clock.beatAt()`).

## Reference files

- `references/clock-and-input.md` — SongClock, rate changes (Thính phong), input timestamps, gamepad polling
- `references/judgement.md` — matching inputs to notes, holds, counters, finishers, Khí thế, fail rule, ranks
- `references/beatmap-schema.md` — JSON schema, tempo map, validation
- `references/calibration.md` — audio and visual offset calibration, output profiles
- `references/tam-phap.md` — the four skills and their rules
- `references/testing-and-tools.md` — unit tests, replays, autoplay bot, debug overlay, beatmap editor requirements
