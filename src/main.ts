import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { createDebugPanel } from './debug/DebugPanel';
import { Input } from './input/Input';
import { loadBeatmap, type Beatmap } from './rhythm/Beatmap';
import { WINDOW } from './rhythm/constants';
import { Stage } from './render/Stage';

// Scaffold only: plays a click track, scrolls with the song clock and shows how far
// each J press is from the nearest strike note. The real Judge comes next
// (.claude/skills/kiem-phach-rhythm).

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const startBtn = document.getElementById('start') as HTMLButtonElement;

const stage = new Stage(app);
const input = new Input();
let audio: AudioEngine | null = null;
let map: Beatmap | null = null;
let clickTrack: AudioBuffer | null = null;
let lastErrMs: number | null = null;

async function start(): Promise<void> {
  startBtn.hidden = true;
  if (!audio) {
    audio = new AudioEngine();
    createDebugPanel(audio.clock);
  }
  await audio.resume();
  if (!map) {
    const res = await fetch('./levels/demo.json');
    map = loadBeatmap(await res.json());
    stage.setNotes(map.notes, map.tempo);
    const lastBeat = Math.max(...map.notes.map((n) => n.beat + (n.lengthBeats ?? 0)));
    clickTrack = await audio.renderClickTrack(map.tempo, Math.ceil(lastBeat) + 8, map.data.audio.beatsPerBar);
  }
  audio.play([clickTrack!]);
}

startBtn.addEventListener('click', () => {
  start().catch((err) => {
    hud.textContent = String(err);
    startBtn.hidden = false;
  });
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && audio && clickTrack) audio.play([clickTrack]);
});

let prev = performance.now();
function frame(now: number): void {
  const dt = (now - prev) / 1000;
  prev = now;

  let beat = 0;
  if (audio && map && audio.clock.isRunning) {
    const clock = audio.clock;
    for (const ev of input.drain()) {
      if (ev.kind !== 'down' || ev.action !== 'strike') continue;
      const t = clock.inputSong(ev.perfMs);
      const nearest = map.notes
        .filter((n) => n.type === 'strike' || n.type === 'hold')
        .reduce((best, n) => (Math.abs(n.timeSong - t) < Math.abs(best.timeSong - t) ? n : best));
      lastErrMs = ((t - nearest.timeSong) / clock.currentRate) * 1000;
      if (Math.abs(lastErrMs) <= WINDOW.good * 1000) {
        audio.playTick(Math.abs(lastErrMs) <= WINDOW.perfect * 1000 ? 1760 : 1320);
        stage.pulse(Math.abs(lastErrMs) <= WINDOW.perfect * 1000 ? 1 : 0.5);
      }
    }
    const song = clock.renderSong();
    beat = map.tempo.beatAtSeconds(song);
    const bpm = map.tempo.bpmAtBeat(beat);
    const err = lastErrMs === null ? '—' : `${lastErrMs >= 0 ? '+' : ''}${lastErrMs.toFixed(0)} ms`;
    hud.textContent =
      `Phách ${beat.toFixed(2)} · ${bpm} BPM · ô nhịp ${Math.floor(beat / map.data.audio.beatsPerBar) + 1}\n` +
      `Lần bấm J gần nhất: ${err}  (Tuyệt kỹ ±${WINDOW.perfect * 1000} · Tốt ±${WINDOW.good * 1000})\n` +
      `R: chơi lại`;
  } else {
    input.drain();
  }

  stage.update(beat, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
