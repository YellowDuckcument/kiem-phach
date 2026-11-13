# Calibration

`getOutputTimestamp()` removes most output latency, but devices still differ (Bluetooth especially, and the player's own reaction bias). The game has calibration on first launch and in Settings.

## Audio offset (required on first launch)

1. Schedule a click on every beat at 100 BPM for 10 beats.
2. The player presses J (or pad X) on each click they hear. Ignore the first 2 presses.
3. For each press: `d = inputSongRaw - clickSong`, where `inputSongRaw` is `clock.inputSong(perfMs)` computed with `audioOffsetSec = 0`.
4. `audioOffsetSec = median(d)`. If the spread (interquartile range) exceeds 60 ms, ask the player to repeat.

## Visual offset

1. No sound. Flash a marker on every beat at the rendered time.
2. The player presses on each flash they see.
3. `v = median(inputSong - flashSong)` with the audio offset already applied.
4. `visualOffsetSec = v`. `renderSong()` draws ahead by `v`.

## Output profiles

The browser cannot reliably detect whether output is speakers, wired or Bluetooth headphones. Settings has a profile picker: **Loa ngoài**, **Tai nghe dây**, **Tai nghe Bluetooth**. Each profile stores its own `{ audioOffsetSec, visualOffsetSec }`. The selected profile is saved locally (and to Steam Cloud later).

## Manual nudge

Settings also offers ±1 ms steps on the audio offset, with a looping test pattern, for players who want to fine-tune.
