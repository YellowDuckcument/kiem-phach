# Testing and tools

## Unit tests (Vitest), required for any Judge change

Build notes from a tiny beatmap. Feed synthetic `InputEvent`s with song times computed directly (bypass the AudioContext). Cover at least:
- exact hit, ±39 ms (Tuyệt kỹ), ±41 ms (Tốt), ±89 ms (Tốt), ±91 ms (Trượt)
- two notes close together: an input goes to the nearest one
- ghost press does nothing
- hold: early release breaks it, release inside the end window succeeds
- counter hit cancels `onMiss`; counter miss activates it
- finisher stays dormant unless the enemy is posture-broken
- 3 consecutive misses → `RunFailed`; a hit in between resets the count
- Thính phong: same real-time windows at rate 0.75
- rank cap after Thính phong / Vô niệm

## Replays

Record every run as `{ levelId, version, calibration, inputs: [{ action, kind, inputSong }] }`. A replay re-runs `Judge` deterministically. Attach replays to bug reports. A bug that can't be reproduced from its replay means something outside `Judge` is reading time — fix that first.

## Autoplay bot

Debug mode in which a bot presses at each note's exact time plus random jitter (configurable ±ms). Use it to verify windows and to soak-test long levels without a human.

## Debug overlay (lil-gui + canvas)

- current BPM, beat, bar, section, rate
- last 32 input errors as a histogram in ms (early to the left)
- `outputLatency`, `baseLatency`, offsets in use
- live sliders: `WINDOW.perfect`, `WINDOW.good`, telegraph beats, `BEAT_UNITS`

## Beatmap editor (separate page in the same Vite project)

Must have:
- waveform of the drums stem; beat and bar grid from the tempo map
- snap to 1, 1/2, 1/4, 1/3 beat
- place, move and delete notes of every type; edit `enemy`, `lengthBeats`, `onMiss`
- events track (buildup, silence) and sections track
- play from cursor, with metronome and playback speed (0.5×, 0.75×, 1×)
- draft notes from automatic beat detection (`@audio/beat`, MIT), shown as ghosts for the author to accept; never auto-commit
- export JSON that passes the zod schema; show validation errors next to the offending note
