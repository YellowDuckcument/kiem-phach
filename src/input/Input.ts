// Keyboard (and later gamepad) -> timestamped actions.
// See .claude/skills/kiem-phach-rhythm/references/clock-and-input.md

export type Action = 'strike' | 'jump' | 'counter' | 'skill';

export interface InputEvent {
  action: Action;
  kind: 'down' | 'up';
  /** performance.now()-based timestamp of the physical event (never the frame time). */
  perfMs: number;
}

export const DEFAULT_KEYS: Record<string, Action> = {
  KeyJ: 'strike',
  Space: 'jump',
  KeyK: 'counter',
  KeyL: 'skill',
};

export class Input {
  private queue: InputEvent[] = [];
  private readonly onKey = (e: KeyboardEvent) => {
    const action = this.keys[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    this.queue.push({ action, kind: e.type === 'keydown' ? 'down' : 'up', perfMs: e.timeStamp });
  };

  constructor(private keys: Record<string, Action> = { ...DEFAULT_KEYS }) {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  /** Drain queued events in timestamp order (call once per frame). */
  drain(): InputEvent[] {
    const out = this.queue.sort((a, b) => a.perfMs - b.perfMs);
    this.queue = [];
    return out;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }
}
