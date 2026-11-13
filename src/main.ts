import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { createDebugPanel } from './debug/DebugPanel';
import { Input } from './input/Input';
import { loadBeatmap, type Beatmap } from './rhythm/Beatmap';
import { WINDOW } from './rhythm/constants';
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

const popupEl = document.getElementById('popup')!;
const POPUP_COLOR = { gold: '#d4a437', white: '#efe6d2', red: '#e0483c' };

/** Big centred word for a judgement or event (DOM, so it stays readable over the 3D scene). */
function popup(text: string, color: keyof typeof POPUP_COLOR, big = false): void {
  popupEl.textContent = text;
  popupEl.style.color = POPUP_COLOR[color];
  popupEl.style.fontSize = big ? '64px' : '44px';
  popupEl.getAnimations().forEach((a) => a.cancel());
  popupEl.animate(
    [
      { opacity: 1, transform: 'translate(-50%, 8px) scale(1.15)' },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.25 },
      { opacity: 0, transform: 'translate(-50%, -16px) scale(1)' },
    ],
    { duration: big ? 1100 : 650, easing: 'ease-out', fill: 'forwards' },
  );
}

const ACTION_KEY: Record<string, string> = {
  strike: 'J',
  hold: 'giữ J',
  jump: 'Space',
  counter: 'K',
  finisher: 'K',
};
const NOTE_NAME: Record<string, string> = {
  strike: 'chém',
  hold: 'đòn giữ',
  jump: 'nhảy',
  counter: 'phản đòn',
  finisher: 'kết liễu',
};

function wireJudge(j: Judge): void {
  j.bus.on('NoteJudged', ({ note, grade, errMs }) => {
    last = { grade, errMs };
    if (grade !== 'miss') {
      stage.setNoteVisible(note.id, false);
      audio?.playTick(grade === 'perfect' ? 1760 : 1320);
      stage.pulse(grade === 'perfect' ? 1 : 0.5);
      // Counter and finisher show their own, bigger word.
      if (note.type !== 'counter' && note.type !== 'finisher') {
        popup(GRADE_LABEL[grade], grade === 'perfect' ? 'gold' : 'white');
      }
    } else {
      audio?.playTick(220, 0.2, 0.12);
      stage.hurt();
      popup(note.type === 'jump' ? 'Trúng đòn!' : 'Trượt', 'red');
    }
  });
  j.bus.on('HoldBroken', () => {
    audio?.playTick(220, 0.2, 0.12);
    stage.hurt();
    popup('Đứt đòn!', 'red');
  });
  j.bus.on('NotesActivated', ({ notes }) => notes.forEach((n) => stage.setNoteVisible(n.id, true)));
  j.bus.on('CounterSuccess', () => {
    stage.pulse(1.5);
    popup('Phản đòn!', 'gold', true);
  });
  j.bus.on('PostureBroken', ({ enemyId }) => {
    audio?.playTick(2640, 0.3, 0.2);
    stage.markBroken(enemyId);
    window.setTimeout(() => popup('Vỡ thế!', 'red', true), 350); // after the hit word
  });
  j.bus.on('FinisherSuccess', ({ enemyId }) => {
    audio?.playTick(2640, 0.35, 0.3);
    if (enemyId) stage.killEnemy(enemyId);
    popup('Kết liễu!', 'red', true);
  });
  j.bus.on('RunFailed', () => audio?.stopMusic());
}

/** The next note the player must answer, so the HUD can say which key. */
function nextNote(j: Judge, song: number) {
  return map!.notes.find((n) => {
    if (j.statusOf(n.id) !== 'pending' || n.timeSong < song - WINDOW.good) return false;
    return n.type !== 'finisher' || (n.enemy !== undefined && j.postureOf(n.enemy)?.broken);
  });
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

function hudText(j: Judge, beat: number, bpm: number, song: number): string {
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
  const next = nextNote(j, song);
  if (next) {
    const inBeats = map!.tempo.beatAtSeconds(next.timeSong) - beat;
    lines.push(`Tiếp theo: ${ACTION_KEY[next.type]} (${NOTE_NAME[next.type]}) sau ${Math.max(0, inBeats).toFixed(1)} phách`);
  }
  if (j.finished) lines.push(`Hoàn thành! Hạng: ${RANK_LABEL[j.rank()!]}`);
  lines.push('J chém/đỡ · Space nhảy · K phản đòn/kết liễu · R chơi lại');
  return lines.join('\n');
}

// Dev-only handle for automated play-testing from the browser console.
if (import.meta.env.DEV) {
  Object.assign(window, { __kp: { stage, get judge() { return judge; }, get audio() { return audio; } } });
}

let frozenBeat = 0;
let prev = performance.now();
function frame(now: number): void {
  const dt = (now - prev) / 1000;
  prev = now;

  let beat = 0;
  if (audio && map && judge) {
    const clock = audio.clock;
    let song = 0;
    if (clock.isRunning) {
      judge.rate = clock.currentRate;
      for (const ev of input.drain()) {
        if (ev.kind === 'down') stage.act(ev.action);
        judge.input({ action: ev.action, kind: ev.kind, song: clock.inputSong(ev.perfMs) });
      }
      judge.advance(clock.heardSongNow());
      song = clock.renderSong();
      beat = map.tempo.beatAtSeconds(song);
    } else {
      input.drain();
      beat = frozenBeat; // where the run stopped
    }
    frozenBeat = beat;
    hud.textContent = hudText(judge, beat, map.tempo.bpmAtBeat(beat), song);
  } else {
    input.drain();
  }

  stage.update(beat, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
