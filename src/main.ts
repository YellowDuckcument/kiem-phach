import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { createDebugPanel } from './debug/DebugPanel';
import { Input } from './input/Input';
import { loadBeatmap, type Beatmap } from './rhythm/Beatmap';
import { BEAT_UNITS, WINDOW } from './rhythm/constants';
import { Judge, type Grade } from './rhythm/Judge';
import { Stage } from './render/Stage';

// Wiring only: input -> Judge -> events -> audio/render/HUD. Rules live in src/rhythm/.

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const startBtn = document.getElementById('start') as HTMLButtonElement;

const stage = new Stage(app);
const input = new Input();
let audio: AudioEngine | null = null;
let map: Beatmap | null = null;
let judge: Judge | null = null;
let clickTrack: AudioBuffer | null = null;
let last: { grade: Grade; errMs: number | null } | null = null;

const GRADE_LABEL: Record<Grade, string> = { perfect: 'Tuyệt kỹ', good: 'Tốt', miss: 'Trượt' };
const RANK_LABEL = { than: 'Thần', kien: 'Kiện', dung: 'Dũng', tap: 'Tập' } as const;

function wireJudge(j: Judge): void {
  j.bus.on('NoteJudged', ({ note, grade, errMs }) => {
    last = { grade, errMs };
    if (grade !== 'miss') {
      stage.setNoteVisible(note.id, false);
      audio?.playTick(grade === 'perfect' ? 1760 : 1320);
      stage.pulse(grade === 'perfect' ? 1 : 0.5);
    } else {
      audio?.playTick(220, 0.2, 0.12);
    }
  });
  j.bus.on('HoldBroken', () => audio?.playTick(220, 0.2, 0.12));
  j.bus.on('NotesActivated', ({ notes }) => notes.forEach((n) => stage.setNoteVisible(n.id, true)));
  j.bus.on('PostureBroken', () => audio?.playTick(2640, 0.3, 0.2));
  j.bus.on('RunFailed', () => audio?.stopMusic());
}

function restart(): void {
  if (!audio || !map || !judge || !clickTrack) return;
  judge.reset();
  last = null;
  stage.setNotes(map.notes, map.tempo);
  audio.play([clickTrack]);
}

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
    judge = new Judge(map);
    wireJudge(judge);
    const lastBeat = Math.max(...map.notes.map((n) => n.beat + (n.lengthBeats ?? 0)));
    clickTrack = await audio.renderClickTrack(map.tempo, Math.ceil(lastBeat) + 8, map.data.audio.beatsPerBar);
  }
  restart();
}

startBtn.addEventListener('click', () => {
  start().catch((err) => {
    hud.textContent = String(err);
    startBtn.hidden = false;
  });
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') restart();
});

function hudText(j: Judge, beat: number, bpm: number): string {
  const s = j.stats;
  if (s.failed) return `Thất bại — 3 lần Trượt liên tiếp.\nR: chơi lại ngay`;
  const lastStr = last
    ? `${GRADE_LABEL[last.grade]}${last.errMs === null ? '' : ` ${last.errMs >= 0 ? '+' : ''}${last.errMs.toFixed(0)} ms`}`
    : '—';
  const posture = map!.data.enemies
    .map((e) => {
      const p = j.postureOf(e.id)!;
      return `${e.id} ${p.value}/${p.max}${p.broken ? ' (vỡ thế)' : ''}`;
    })
    .join(' · ');
  const lines = [
    `Phách ${beat.toFixed(2)} · ${bpm} BPM · ô nhịp ${Math.floor(beat / map!.data.audio.beatsPerBar) + 1}`,
    `Gần nhất: ${lastStr}  (Tuyệt kỹ ±${(WINDOW.perfect * 1000).toFixed(0)} · Tốt ±${(WINDOW.good * 1000).toFixed(0)} ms)`,
    `Combo ${s.combo} (cao nhất ${s.maxCombo}) · Tuyệt kỹ ${s.perfect} · Tốt ${s.good} · Trượt ${s.miss}`,
    `Khí thế: ${posture}`,
  ];
  if (j.finished) lines.push(`Hoàn thành! Hạng: ${RANK_LABEL[j.rank()!]}`);
  lines.push('J chém/đỡ · Space nhảy · K phản đòn/kết liễu · R chơi lại');
  return lines.join('\n');
}

let prev = performance.now();
function frame(now: number): void {
  const dt = (now - prev) / 1000;
  prev = now;

  let beat = 0;
  if (audio && map && judge) {
    const clock = audio.clock;
    if (clock.isRunning) {
      judge.rate = clock.currentRate;
      for (const ev of input.drain()) {
        judge.input({ action: ev.action, kind: ev.kind, song: clock.inputSong(ev.perfMs) });
      }
      judge.advance(clock.heardSongNow());
      const song = clock.renderSong();
      beat = map.tempo.beatAtSeconds(song);
    } else {
      input.drain();
      beat = stage.phach.position.x / BEAT_UNITS; // frozen where the run stopped
    }
    hud.textContent = hudText(judge, beat, map.tempo.bpmAtBeat(beat));
  } else {
    input.drain();
  }

  stage.update(beat, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
