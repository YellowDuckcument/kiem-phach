import { START_DELAY_SEC } from '../rhythm/constants';
import type { TempoMap } from '../rhythm/TempoMap';
import { SongClock } from './SongClock';

/**
 * Owns the AudioContext, the music stems and SFX.
 * Must be created from a user gesture (click) or browsers keep audio muted.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly clock: SongClock;
  private stems: AudioBufferSourceNode[] = [];
  private readonly master: GainNode;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.clock = new SongClock(this.ctx);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  async loadBuffer(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cannot load audio ${url}: ${res.status}`);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  }

  /** Start all stems sample-aligned and start the song clock at the same instant. */
  play(buffers: AudioBuffer[]): number {
    this.stopMusic();
    const when = this.ctx.currentTime + START_DELAY_SEC;
    this.stems = buffers.map((buf) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master);
      src.start(when);
      return src;
    });
    this.clock.start(when);
    return when;
  }

  stopMusic(): void {
    for (const s of this.stems) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.stems = [];
    this.clock.stop();
  }

  get stemSources(): AudioBufferSourceNode[] {
    return this.stems;
  }

  /** Short percussive SFX, fired immediately (e.g. parry "keng" placeholder). */
  playTick(freq = 1760, gain = 0.25, durationSec = 0.06): void {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + durationSec + 0.01);
  }

  /**
   * Placeholder music: a click track rendered offline from the tempo map
   * (accent on bar starts). Replace with real stems later.
   */
  async renderClickTrack(tempo: TempoMap, beats: number, beatsPerBar: number): Promise<AudioBuffer> {
    const sampleRate = this.ctx.sampleRate;
    const duration = tempo.secondsAtBeat(beats) + 1;
    const off = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);
    for (let b = 0; b < beats; b++) {
      const t = tempo.secondsAtBeat(b);
      if (t < 0) continue;
      const accent = b % beatsPerBar === 0;
      const osc = off.createOscillator();
      const g = off.createGain();
      osc.frequency.value = accent ? 1200 : 800;
      g.gain.setValueAtTime(accent ? 0.6 : 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(g).connect(off.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }
    return off.startRendering();
  }
}
