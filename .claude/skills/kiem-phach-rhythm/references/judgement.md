# Judgement, Khí thế and ranks

## Windows

```ts
export const WINDOW = { perfect: 0.040, good: 0.090 } as const; // seconds of HEARD (real) time — GDD values, tune in playtests
```

The error of an input against a note is measured in real time:

```ts
const errReal = (inputSong - note.timeSong) / clock.currentRate;
```

So during Thính phong (rate 0.75) the windows are the same in real time while notes are further apart. That is what makes the skill easier.

## Matching an input to a note

For each `down` input, in timestamp order:

1. Candidates are unjudged, **active** notes whose `action` matches and whose `|errReal| <= WINDOW.good`.
2. Pick the candidate with the smallest `|errReal|`; on a tie, the earliest note.
3. `|errReal| <= WINDOW.perfect` → **Tuyệt kỹ**; else → **Tốt**.
4. No candidate → **ghost press**. It is ignored (no penalty). Keep this as a constant `GHOST_PRESS_PENALTY = false`, so it can be changed after playtests.

A note becomes **Trượt** when the heard song time passes `note.timeSong + WINDOW.good * rate` without a match.

## Note types

| Type | Action | Rule |
| --- | --- | --- |
| `strike` | J down | As above. |
| `hold` | J down, then J up | The head is judged like a strike. The hold succeeds if J is released at or after `endSong - WINDOW.good * rate`. An earlier release emits `HoldBroken` (counts as Trượt for the fail rule; no Khí thế for the tail). Khí thế is awarded when the hold completes. |
| `jump` | Space down | Judged like a strike, but gives no Khí thế; a miss means Phách is hit. |
| `counter` | K down | Placed on the **silent beat** after a charge-up (`buildup` event). Hit (Tuyệt kỹ or Tốt) → emit `CounterSuccess`. Ordinary enemies are posture-broken at once; a boss loses one posture segment. The note's `onMiss` notes are cancelled. On a miss, the `onMiss` notes (usually the strong attack, as `strike` or `jump`) become active. |
| `finisher` | K down | Dormant unless its target enemy is posture-broken when the note's window opens. Dormant finishers are never judged and never count as misses. Hit → kill animation synced to the phrase end. |

Notes listed in another note's `onMiss` start **inactive** and are only judged once activated.

## Khí thế (posture)

- Each enemy has `posture` (max) from the beatmap's enemy table. A boss has `postureSegments` (2–3, matching song sections).
- Tuyệt kỹ on that enemy's note: +2. Tốt: +1. (Hồi âm doubles both.)
- Posture full → emit `PostureBroken(enemyId)`. The music moves to its climax section, and finisher notes for that enemy wake up.

## Fail rule

Keep a `consecutiveMisses` counter. Any Trượt (including `HoldBroken` and a missed active `jump`) increments it; any Tuyệt kỹ or Tốt resets it. At 3 → `RunFailed`. Restart must be instant (no menu, no reload of assets).

## Combo

+1 per Tuyệt kỹ or Tốt, reset on Trượt. Ghost presses do not affect combo.

## End-of-level rank

The rank uses the Tuyệt kỹ ratio and the longest combo. Labels from the GDD, best first: **Thần · Kiện · Dũng · Tập**.

Starting thresholds are a *proposal* — not in the GDD yet; tune them and confirm with the user:

| Rank | Tuyệt kỹ ratio | Other |
| --- | --- | --- |
| Thần | ≥ 90 % | no Trượt |
| Kiện | ≥ 70 % | — |
| Dũng | ≥ 40 % | — |
| Tập | anything that clears | — |

Cap: if Thính phong or Vô niệm was used in the run, the best possible rank is **Kiện**.
