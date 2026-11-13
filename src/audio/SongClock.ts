// The ONLY source of musical time in the game.
// See .claude/skills/kiem-phach-rhythm/references/clock-and-input.md

export interface Calibration {
  /** Seconds the player tends to press late relative to what they hear (from calibration). */
  audioOffsetSec: number;
  /** Seconds the display lags; rendering draws this far ahead. */
  visualOffsetSec: number;
}

/** The subset of AudioContext the clock needs (makes it testable without a browser). */
export interface ClockAudioContext {
  readonly currentTime: number;
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  getOutputTimestamp?(): AudioTimestamp;
}

export class SongClock {
  private segCtx = 0;
  private segSong = 0;
  private rate = 1;
  private running = false;

  constructor(
    private readonly ctx: ClockAudioContext,
    public calibration: Calibration = { audioOffsetSec: 0, visualOffsetSec: 0 },
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Call with the same `when` passed to every stem's source.start(when). */
  start(when: number, fromSong = 0): void {
    this.segCtx = when;
    this.segSong = fromSong;
    this.rate = 1;
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentRate(): number {
    return this.rate;
  }

  /** Song time corresponding to a scheduling-clock time. Valid at/after the latest rate change. */
  songAtCtx(t: number): number {
    return this.segSong + (t - this.segCtx) * this.rate;
  }

  /** Context time that was audible at performance time `perfMs`. */
  heardCtxAt(perfMs: number): number {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - lat - (this.now() - perfMs) / 1000;
  }

  /** Song time the player heard at the moment of an input event. Use for judging. */
  inputSong(perfMs: number): number {
    return this.songAtCtx(this.heardCtxAt(perfMs)) - this.calibration.audioOffsetSec;
  }

  /** Song time the player hears right now. */
  heardSongNow(): number {
    return this.inputSong(this.now());
  }

  /** Song time to draw this frame. */
  renderSong(): number {
    return this.heardSongNow() + this.calibration.visualOffsetSec;
  }

  /** Step the playback rate at scheduling time `when` (use a bar boundary). Used by Thính phong. */
  setRate(newRate: number, when: number, sources: AudioBufferSourceNode[]): void {
    this.segSong = this.songAtCtx(when);
    this.segCtx = when;
    this.rate = newRate;
    for (const s of sources) s.playbackRate.setValueAtTime(newRate, when);
  }
}
