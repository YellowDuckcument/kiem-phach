// All tunable rhythm values live here (see .claude/skills/kiem-phach-rhythm).
// Values come from the GDD; change them only through playtests.

/** Judgement windows in seconds of HEARD (real) time. */
export const WINDOW = { perfect: 0.04, good: 0.09 } as const;

/** World X distance per beat. Constant regardless of BPM, so spacing on screen is the rhythm. */
export const BEAT_UNITS = 4;

/** Consecutive misses that end a run. */
export const FAIL_AFTER_MISSES = 3;

/** Ghost presses (no matching note) are ignored for now. */
export const GHOST_PRESS_PENALTY = false;

/** Music always starts this far in the future (seconds) so every stem starts sample-aligned. */
export const START_DELAY_SEC = 0.2;
