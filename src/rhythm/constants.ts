// All tunable rhythm values live here (see .claude/skills/kiem-phach-rhythm).
// Values come from the GDD; change them only through playtests.
// Objects (not `as const`) so the lil-gui debug panel can tune them live.

/** Judgement windows in seconds of HEARD (real) time. */
export const WINDOW = { perfect: 0.04, good: 0.09 };

/** Khí thế (posture) gained on the enemy per judgement. */
export const KHI_THE = { perfect: 2, good: 1 };

export const RULES = {
  /** Consecutive Trượt that end a run. */
  failAfterMisses: 3,
  /** Ghost presses (no matching note) are ignored for now. true = count as Trượt. */
  ghostPressPenalty: false,
};

/**
 * End-of-level rank thresholds (Tuyệt kỹ ratio). PROPOSAL — not in the GDD yet,
 * confirm with the designer after playtests.
 */
export const RANK = { than: 0.9, kien: 0.7, dung: 0.4 };

/** World X distance per beat. Constant regardless of BPM, so spacing on screen is the rhythm. */
export const BEAT_UNITS = 4;

/** Music always starts this far in the future (seconds) so every stem starts sample-aligned. */
export const START_DELAY_SEC = 0.2;
