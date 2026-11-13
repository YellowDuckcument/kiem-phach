import { describe, expect, it } from 'vitest';
import { SongClock, type ClockAudioContext } from '../src/audio/SongClock';

/** Fake context: audio clock and performance clock advance together; output lags 40 ms. */
function fakeCtx(state: { ctxTime: number; perfMs: number }, outputLagSec = 0.04): ClockAudioContext {
  return {
    get currentTime() {
      return state.ctxTime;
    },
    getOutputTimestamp: () => ({ contextTime: state.ctxTime - outputLagSec, performanceTime: state.perfMs }),
  };
}

describe('SongClock', () => {
  it('reports heard song time, compensating output latency', () => {
    const s = { ctxTime: 10, perfMs: 5000 };
    const clock = new SongClock(fakeCtx(s), undefined, () => s.perfMs);
    clock.start(10);
    s.ctxTime = 11;
    s.perfMs = 6000;
    expect(clock.heardSongNow()).toBeCloseTo(1 - 0.04);
  });

  it('timestamps inputs at the event time, not the frame time', () => {
    const s = { ctxTime: 10, perfMs: 5000 };
    const clock = new SongClock(fakeCtx(s), undefined, () => s.perfMs);
    clock.start(10);
    s.ctxTime = 12;
    s.perfMs = 7000;
    // key pressed 250 ms before this frame
    expect(clock.inputSong(6750)).toBeCloseTo(2 - 0.04 - 0.25);
  });

  it('applies calibration offsets', () => {
    const s = { ctxTime: 0, perfMs: 0 };
    const clock = new SongClock(fakeCtx(s, 0), { audioOffsetSec: 0.03, visualOffsetSec: 0.02 }, () => s.perfMs);
    clock.start(0);
    s.ctxTime = 2;
    s.perfMs = 2000;
    expect(clock.heardSongNow()).toBeCloseTo(1.97);
    expect(clock.renderSong()).toBeCloseTo(1.99);
  });

  it('keeps song time continuous across a rate change (Thính phong)', () => {
    const s = { ctxTime: 0, perfMs: 0 };
    const clock = new SongClock(fakeCtx(s, 0), undefined, () => s.perfMs);
    clock.start(0);
    const param = { setValueAtTime: () => undefined };
    clock.setRate(0.75, 4, [{ playbackRate: param } as unknown as AudioBufferSourceNode]);
    expect(clock.songAtCtx(4)).toBeCloseTo(4);
    expect(clock.songAtCtx(8)).toBeCloseTo(4 + 4 * 0.75);
    expect(clock.currentRate).toBe(0.75);
  });

  it('falls back to outputLatency when getOutputTimestamp is unavailable', () => {
    const s = { ctxTime: 5, perfMs: 1000 };
    const ctx: ClockAudioContext = {
      get currentTime() {
        return s.ctxTime;
      },
      outputLatency: 0.05,
    };
    const clock = new SongClock(ctx, undefined, () => s.perfMs);
    clock.start(5);
    s.ctxTime = 6;
    s.perfMs = 2000;
    expect(clock.heardSongNow()).toBeCloseTo(0.95);
  });
});
