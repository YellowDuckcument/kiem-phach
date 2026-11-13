# Song clock and input timestamps

## Two clocks inside the AudioContext

- **Scheduling time**: `audioCtx.currentTime`. Where audio is *scheduled*. Ahead of what the player hears.
- **Heard time**: the context time of the sample the speakers are playing *now*. Get it from `audioCtx.getOutputTimestamp()`, which pairs a `contextTime` with a `performanceTime` (same base as `performance.now()` and `event.timeStamp`).

Gameplay judges and renders against **heard time**. Scheduling time is only used to start sources and SFX.

## SongClock

```ts
export class SongClock {
  private segCtx = 0;   // scheduling-clock time where the current rate segment starts
  private segSong = 0;  // song time at segCtx (seconds into the audio file)
  private rate = 1;

  constructor(private ctx: AudioContext, private cal: { audioOffsetSec: number; visualOffsetSec: number }) {}

  /** Call with the same `when` passed to every stem's source.start(when). */
  start(when: number, fromSong = 0) { this.segCtx = when; this.segSong = fromSong; this.rate = 1; }

  /** Song time corresponding to a scheduling-clock time. */
  songAtCtx(t: number) { return this.segSong + (t - this.segCtx) * this.rate; }

  /** Context time that was audible at performance time `perfMs`. */
  heardCtxAt(perfMs: number): number {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    // Fallback: estimate output latency.
    const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - lat - (performance.now() - perfMs) / 1000;
  }

  /** Song time the player heard at the moment of an input event. Use for judging. */
  inputSong(perfMs: number) { return this.songAtCtx(this.heardCtxAt(perfMs)) - this.cal.audioOffsetSec; }

  /** Song time the player hears right now. */
  heardSongNow() { return this.inputSong(performance.now()); }

  /** Song time to draw this frame. Display lag is compensated by drawing slightly ahead. */
  renderSong() { return this.heardSongNow() + this.cal.visualOffsetSec; }

  get currentRate() { return this.rate; }

  /** Change playback rate at scheduling time `when` (use a bar boundary). Used by Thính phong. */
  setRate(newRate: number, when: number, sources: AudioBufferSourceNode[]) {
    this.segSong = this.songAtCtx(when);
    this.segCtx = when;
    this.rate = newRate;
    for (const s of sources) s.playbackRate.setValueAtTime(newRate, when);
  }
}
```

Notes:
- `songAtCtx` is only valid for times at or after the latest `setRate`. Gameplay only queries forward, so this is fine. If you add rewind or seek, restart the clock with `start(when, fromSong)`.
- Rate changes are **steps at bar boundaries**, never ramps. A ramp would make song time an integral and complicate everything for no gameplay gain.
- Pausing: `audioCtx.suspend()` / `resume()`. Both clocks freeze together, so no correction is needed.
- Electron: set `backgroundThrottling: false` or pause on blur. Throttled timers must never matter, because nothing musical uses timers.

## Playback (Thính phong decision: option a)

Music is a set of stems (`AudioBufferSourceNode` each, decoded up front), all started with the same `start(when)` at least 100 ms in the future.

**Thính phong slows playback to 0.75 by setting `playbackRate` on every stem. The pitch drops with it (tape slow-down). This is intended — do not add pitch correction.** An optional short "tape" whoosh SFX may mark the start and end.

SFX (parry "keng", hits) are scheduled at `audioCtx.currentTime` on input. They are not rate-shifted.

The "keng" of a Tuyệt kỹ parry is tuned to the song's key per level (`beatmap.audio.parryPitch`), so the parry sounds like a note of the music.

## Input

```ts
type Action = 'strike' | 'jump' | 'counter' | 'skill';
interface InputEvent { action: Action; kind: 'down' | 'up'; perfMs: number; }
```

- **Keyboard**: listen to `keydown` / `keyup` on `window`. Ignore `e.repeat`. Use `e.code` (layout-independent) and `e.timeStamp` as `perfMs`.
- **Gamepad**: the Gamepad API has no events. Poll every animation frame. Diff button states against the previous poll and use `gamepad.timestamp` (performance time of the last state change) as `perfMs`. Never use the poll time. Poll resolution is one frame, so pad input is slightly coarser than keyboard; calibration absorbs the average bias.
- Inputs go into a queue that the `Judge` drains once per frame, in timestamp order.
